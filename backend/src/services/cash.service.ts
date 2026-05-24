import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { isCashPaymentMethod } from '../constants';
import { logAudit } from './audit.service';
import { emitToRole } from '../websocket';

// Renvoie la session de caisse ouverte du caissier, ou null.
export async function getOpenSession(cashierId: number) {
  return prisma.cashSession.findFirst({
    where: { cashierId, status: 'ouverte' },
    orderBy: { openedAt: 'desc' },
  });
}

// Garantit qu'une caisse est ouverte pour un paiement espèces ; renvoie l'id de session à lier.
// Choix produit : seuls les paiements espèces exigent une caisse ouverte.
export async function resolveCashSessionForPayment(
  userId: number | undefined,
  paymentMethod?: string | null
): Promise<number | null> {
  if (!userId) return null;
  const session = await getOpenSession(userId);
  if (isCashPaymentMethod(paymentMethod) && !session) {
    throw new AppError(400, 'CASH_001');
  }
  return session?.id ?? null;
}

export async function openSession(cashierId: number, openingFloat: number, notes?: string) {
  const existing = await getOpenSession(cashierId);
  if (existing) throw new AppError(400, 'CASH_002');

  const session = await prisma.cashSession.create({
    data: { cashierId, openingFloat, status: 'ouverte', notes },
  });
  await logAudit({
    userId: cashierId,
    action: 'ouverture_caisse',
    entityType: 'cash_session',
    entityId: session.id,
    details: { openingFloat },
  });
  emitToRole('administrateur', 'cash_session_opened', { sessionId: session.id, cashierId });
  return session;
}

// Écart de caisse = réel compté − théorique attendu (positif = excédent, négatif = manquant).
export function computeDiscrepancy(expectedCash: number, countedCash: number): number {
  return countedCash - expectedCash;
}

// Acomptes de réservation encaissés EN ESPÈCES sur la session (argent physiquement dans le tiroir).
export async function reservationDepositsForSession(sessionId: number): Promise<number> {
  const agg = await prisma.reservation.aggregate({
    _sum: { depositAmount: true },
    where: { depositCashSessionId: sessionId, depositMethod: 'espèces' },
  });
  return agg._sum.depositAmount ?? 0;
}

// Total théorique en caisse = fond + ventes espèces + acomptes réservation espèces de la session.
export async function computeExpectedCash(session: { id: number; openingFloat: number }): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { finalTotal: true },
    where: {
      cashSessionId: session.id,
      paymentMethod: 'espèces',
      isPaid: true,
      isRefunded: false,
      status: { not: 'annulée' },
    },
  });
  const deposits = await reservationDepositsForSession(session.id);
  return session.openingFloat + (agg._sum.finalTotal ?? 0) + deposits;
}

export async function closeSession(
  cashierId: number,
  countedCash: number,
  discrepancyReason: string | undefined,
  closedBy: number | undefined,
  notes?: string
) {
  const session = await getOpenSession(cashierId);
  if (!session) throw new AppError(400, 'CASH_003');

  const expectedCash = await computeExpectedCash(session);
  const discrepancy = computeDiscrepancy(expectedCash, countedCash);
  if (discrepancy !== 0 && !discrepancyReason?.trim()) {
    throw new AppError(400, 'CASH_004', `Justification requise : écart de ${discrepancy} FCFA`);
  }

  const updated = await prisma.cashSession.update({
    where: { id: session.id },
    data: {
      status: 'fermée',
      closedAt: new Date(),
      closedBy,
      expectedCash,
      countedCash,
      discrepancy,
      discrepancyReason: discrepancyReason?.trim() || null,
      notes: notes ?? session.notes,
    },
    include: { cashier: { select: { id: true, username: true } } },
  });
  await logAudit({
    userId: closedBy ?? cashierId,
    action: 'fermeture_caisse',
    entityType: 'cash_session',
    entityId: session.id,
    details: { expectedCash, countedCash, discrepancy },
  });
  emitToRole('administrateur', 'cash_session_closed', { sessionId: session.id, discrepancy });
  return updated;
}

export async function openDrawer(userId: number | undefined, reason?: string) {
  const session = userId ? await getOpenSession(userId) : null;
  await logAudit({
    userId,
    action: 'ouverture_tiroir',
    entityType: 'cash_session',
    entityId: session?.id ?? undefined,
    details: { reason: reason ?? null },
  });
  return { ok: true };
}

// Pourboires espèces encaissés sur la session : physiquement dans le tiroir mais HORS théorique
// (le personnel les récupère). Sert à rappeler le montant à sortir à la fermeture.
export async function cashTipsForSession(sessionId: number): Promise<number> {
  const agg = await prisma.order.aggregate({
    _sum: { tipAmount: true },
    where: { cashSessionId: sessionId, tipMethod: 'espèces', isRefunded: false, status: { not: 'annulée' } },
  });
  return agg._sum.tipAmount ?? 0;
}

// Répartition des ventes payées de la session par moyen de paiement.
async function salesByMethod(sessionId: number) {
  const grouped = await prisma.order.groupBy({
    by: ['paymentMethod'],
    _sum: { finalTotal: true },
    _count: true,
    where: { cashSessionId: sessionId, isPaid: true, isRefunded: false, status: { not: 'annulée' } },
  });
  return grouped.map((g) => ({
    method: g.paymentMethod ?? 'inconnu',
    count: g._count,
    amount: g._sum.finalTotal ?? 0,
  }));
}

// Rapport de la session ouverte du caissier (pour le bandeau Caisse).
export async function getCurrentSessionReport(cashierId: number) {
  const session = await getOpenSession(cashierId);
  if (!session) return null;
  const expectedCash = await computeExpectedCash(session);
  return {
    ...session,
    expectedCash,
    cashTips: await cashTipsForSession(session.id),
    reservationDeposits: await reservationDepositsForSession(session.id),
    salesByMethod: await salesByMethod(session.id),
  };
}

export async function listSessions(limit = 50) {
  return prisma.cashSession.findMany({
    orderBy: { openedAt: 'desc' },
    take: limit,
    include: {
      cashier: { select: { id: true, username: true } },
      closer: { select: { id: true, username: true } },
    },
  });
}

export async function getSessionReport(id: number) {
  const session = await prisma.cashSession.findUnique({
    where: { id },
    include: {
      cashier: { select: { id: true, username: true } },
      closer: { select: { id: true, username: true } },
    },
  });
  if (!session) throw new AppError(404, 'CASH_005');
  const expectedCash =
    session.status === 'ouverte' ? await computeExpectedCash(session) : session.expectedCash ?? 0;
  const orders = await prisma.order.findMany({
    where: { cashSessionId: id, isPaid: true, status: { not: 'annulée' } },
    orderBy: { paidAt: 'desc' },
    select: {
      id: true,
      orderNumber: true,
      finalTotal: true,
      paymentMethod: true,
      isRefunded: true,
      refundReason: true,
      paidAt: true,
    },
  });
  return {
    ...session,
    expectedCash,
    cashTips: await cashTipsForSession(id),
    reservationDeposits: await reservationDepositsForSession(id),
    salesByMethod: await salesByMethod(id),
    orders,
  };
}
