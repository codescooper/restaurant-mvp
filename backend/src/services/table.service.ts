import { startOfDay, endOfDay } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { PaymentMethod, MobileMoneyProvider, TableStatus } from '../constants';
import { resolveCashSessionForPayment } from './cash.service';
import { logAudit } from './audit.service';
import { emitStatsUpdated, emitToRole, emitToAll } from '../websocket';

// Une commande "occupe" sa table si elle n'est ni annulée, ni (servie ET payée).
const OCCUPYING_WHERE: Prisma.OrderWhereInput = {
  status: { not: 'annulée' },
  OR: [{ status: { not: 'servie' } }, { isPaid: false }],
};

interface PaymentDetails {
  mobileMoneyProvider?: MobileMoneyProvider;
  cashGiven?: number;
  changeReturned?: number;
}

export async function listTablesWithStatus() {
  const tables = await prisma.table.findMany({ orderBy: { name: 'asc' } });
  const activeOrders = await prisma.order.findMany({
    where: { tableId: { not: null }, ...OCCUPYING_WHERE },
    include: {
      items: { select: { id: true, dishName: true, quantity: true } },
      server: { select: { id: true, username: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const byTable = new Map<number, typeof activeOrders>();
  for (const o of activeOrders) {
    if (o.tableId == null) continue;
    const arr = byTable.get(o.tableId) ?? [];
    arr.push(o);
    byTable.set(o.tableId, arr);
  }

  // Réservations actives du jour (pour le statut « réservée »).
  const reservations = await prisma.reservation.findMany({
    where: { status: 'active', reservedAt: { gte: startOfDay(new Date()), lte: endOfDay(new Date()) } },
    orderBy: { reservedAt: 'asc' },
  });
  const resByTable = new Map<number, (typeof reservations)[number]>();
  for (const r of reservations) {
    if (!resByTable.has(r.tableId)) resByTable.set(r.tableId, r); // 1re réservation du jour
  }

  return tables.map((t) => {
    const orders = byTable.get(t.id) ?? [];
    const reservation = resByTable.get(t.id) ?? null;
    let status: TableStatus;
    if (orders.length) status = t.billRequested ? 'addition_demandée' : 'occupée';
    else if (reservation) status = 'réservée';
    else status = 'libre';
    const total = orders.reduce((s, o) => s + o.finalTotal, 0);
    const unpaidTotal = orders.filter((o) => !o.isPaid).reduce((s, o) => s + o.finalTotal, 0);
    const last = orders[orders.length - 1];
    return {
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      status,
      billRequested: t.billRequested,
      server: last?.server ?? null,
      total,
      unpaidTotal,
      hasUnpaid: orders.some((o) => !o.isPaid),
      reservation: reservation
        ? { id: reservation.id, customerName: reservation.customerName, reservedAt: reservation.reservedAt, partySize: reservation.partySize }
        : null,
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        finalTotal: o.finalTotal,
        isPaid: o.isPaid,
        items: o.items,
      })),
    };
  });
}

export async function listTables() {
  return prisma.table.findMany({ orderBy: { name: 'asc' } });
}

export async function createTable(data: { name: string; capacity?: number }) {
  const existing = await prisma.table.findUnique({ where: { name: data.name } });
  if (existing) throw new AppError(409, 'VALIDATION_001', 'Une table porte déjà ce nom');
  return prisma.table.create({ data: { name: data.name, capacity: data.capacity ?? 4 } });
}

export async function updateTable(id: number, data: { name?: string; capacity?: number }) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');
  if (data.name && data.name !== table.name) {
    const dup = await prisma.table.findUnique({ where: { name: data.name } });
    if (dup) throw new AppError(409, 'VALIDATION_001', 'Une table porte déjà ce nom');
  }
  return prisma.table.update({
    where: { id },
    data: { ...(data.name ? { name: data.name } : {}), ...(data.capacity !== undefined ? { capacity: data.capacity } : {}) },
  });
}

export async function deleteTable(id: number) {
  const occupying = await prisma.order.findFirst({ where: { tableId: id, ...OCCUPYING_WHERE } });
  if (occupying) throw new AppError(400, 'VALIDATION_001', 'Table occupée, suppression impossible');
  await prisma.order.updateMany({ where: { tableId: id }, data: { tableId: null } });
  await prisma.table.delete({ where: { id } });
  return { id };
}

// Règlement de l'addition : paie toutes les commandes non payées (et non annulées) de la table.
export async function settleTable(
  id: number,
  paymentMethod: PaymentMethod,
  paymentDetails: PaymentDetails | undefined,
  userId?: number,
  tip?: { amount?: number; method?: PaymentMethod }
) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');

  const unpaid = await prisma.order.findMany({
    where: { tableId: id, isPaid: false, status: { not: 'annulée' } },
  });
  if (!unpaid.length) throw new AppError(400, 'ORDER_001', 'Aucune commande à régler pour cette table');

  const total = unpaid.reduce((s, o) => s + o.finalTotal, 0);
  // Pourboire (hors total) attribué au serveur de la table ; le dû espèces l'inclut.
  const tipAmount = Math.max(0, Math.round(tip?.amount ?? 0));
  const tipMethod = tipAmount > 0 ? tip?.method ?? paymentMethod : null;
  const due = total + tipAmount;
  if (paymentMethod === 'espèces') {
    const cash = paymentDetails?.cashGiven ?? 0;
    if (cash < due) throw new AppError(400, 'VALIDATION_001', 'Montant remis insuffisant');
  }
  if (paymentMethod === 'mobile_money' && !paymentDetails?.mobileMoneyProvider) {
    throw new AppError(400, 'VALIDATION_001', 'Service mobile money requis');
  }
  // Espèces : une caisse doit être ouverte ; on lie les commandes réglées à la session.
  const cashSessionId = await resolveCashSessionForPayment(userId, paymentMethod);
  const change = paymentMethod === 'espèces' ? Math.max(0, (paymentDetails?.cashGiven ?? 0) - due) : 0;

  await prisma.$transaction(
    unpaid.map((o, idx) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentMethod,
          cashSessionId,
          mobileMoneyProvider: paymentMethod === 'mobile_money' ? paymentDetails?.mobileMoneyProvider : undefined,
          // Le détail espèces (remis/monnaie) et le pourboire sont portés par la 1re commande du lot.
          cashGiven: paymentMethod === 'espèces' && idx === 0 ? paymentDetails?.cashGiven : undefined,
          changeReturned: paymentMethod === 'espèces' && idx === 0 ? change : undefined,
          tipAmount: idx === 0 ? tipAmount : undefined,
          tipMethod: idx === 0 ? tipMethod : undefined,
        },
      })
    )
  );

  // L'addition est réglée : on retombe la demande d'addition.
  if (table.billRequested) await prisma.table.update({ where: { id }, data: { billRequested: false } });

  await logAudit({
    userId,
    action: 'paiement',
    entityType: 'table',
    entityId: id,
    details: { tableName: table.name, amount: total, tip: tipAmount, method: paymentMethod, orderCount: unpaid.length },
  });
  emitStatsUpdated({ settledTable: table.name, total });
  emitToRole('caissier', 'table_settled', { tableId: id, tableName: table.name, total });
  return { tableId: id, paidCount: unpaid.length, total, tip: tipAmount, change, paymentMethod };
}

// Le serveur signale (ou annule) une demande d'addition ; la caisse est notifiée en temps réel.
export async function setBillRequested(id: number, requested: boolean) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');
  const updated = await prisma.table.update({ where: { id }, data: { billRequested: requested } });
  emitToAll('table_status_changed', { tableId: id });
  if (requested) {
    emitToRole('caissier', 'bill_requested', { tableId: id, tableName: table.name });
  }
  return { id: updated.id, billRequested: updated.billRequested };
}

// Fusion : déplace les commandes en cours d'une table source vers une table cible (addition commune).
export async function mergeTable(sourceId: number, targetId: number, userId?: number) {
  if (sourceId === targetId) throw new AppError(400, 'VALIDATION_001', 'Tables identiques');
  const [source, target] = await Promise.all([
    prisma.table.findUnique({ where: { id: sourceId } }),
    prisma.table.findUnique({ where: { id: targetId } }),
  ]);
  if (!source || !target) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');

  const moved = await prisma.order.updateMany({
    where: { tableId: sourceId, ...OCCUPYING_WHERE },
    data: { tableId: targetId },
  });
  if (!moved.count) throw new AppError(400, 'ORDER_001', 'Aucune commande à déplacer sur cette table');
  await prisma.table.update({ where: { id: sourceId }, data: { billRequested: false } });

  await logAudit({
    userId,
    action: 'correction_commande',
    entityType: 'table',
    entityId: sourceId,
    details: { fusion: true, source: source.name, cible: target.name, commandes: moved.count },
  });
  emitToAll('table_status_changed', { tableId: sourceId, targetId });
  return { sourceId, targetId, moved: moved.count };
}

// --- Réservations ---
export interface ReservationInput {
  tableId: number;
  customerName: string;
  customerPhone?: string;
  partySize?: number;
  reservedAt: string;
  note?: string;
}

export async function createReservation(input: ReservationInput, userId?: number) {
  const table = await prisma.table.findUnique({ where: { id: input.tableId } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');
  const reservation = await prisma.reservation.create({
    data: {
      tableId: input.tableId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      partySize: input.partySize,
      reservedAt: new Date(input.reservedAt),
      note: input.note,
      createdBy: userId,
    },
  });
  emitToAll('table_status_changed', { tableId: input.tableId });
  return reservation;
}

export async function listReservations() {
  return prisma.reservation.findMany({
    where: { status: 'active', reservedAt: { gte: startOfDay(new Date()) } },
    orderBy: { reservedAt: 'asc' },
    take: 100,
    include: { table: { select: { id: true, name: true } } },
  });
}

export async function setReservationStatus(id: number, status: 'annulée' | 'honorée') {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) throw new AppError(404, 'VALIDATION_001', 'Réservation introuvable');
  const updated = await prisma.reservation.update({ where: { id }, data: { status } });
  emitToAll('table_status_changed', { tableId: reservation.tableId });
  return updated;
}
