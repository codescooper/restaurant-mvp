import { startOfDay, endOfDay } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import {
  PaymentMethod,
  MobileMoneyProvider,
  TableStatus,
  RESERVATION_GRACE_MINUTES,
  RESERVATION_CLEANING_MINUTES,
  RESERVATION_DEFAULT_DURATION_MINUTES,
  isCashPaymentMethod,
} from '../constants';
import { resolveCashSessionForPayment, getOpenSession } from './cash.service';
import { createOrder } from './order.service';
import { logAudit } from './audit.service';
import { emitStatsUpdated, emitToRole, emitToRestaurant } from '../websocket';

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
      server: { select: { id: true, displayName: true } },
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
  const now = new Date();
  const reservations = await prisma.reservation.findMany({
    where: { status: 'active', reservedAt: { gte: startOfDay(now), lte: endOfDay(now) } },
    orderBy: { reservedAt: 'asc' },
    include: { items: { orderBy: { id: 'asc' } } },
  });
  // 1re réservation du jour encore pertinente : table pas encore libérée (marges incluses),
  // OU portant un acompte non encore déduit (à montrer/déduire au règlement).
  const resByTable = new Map<number, (typeof reservations)[number]>();
  for (const r of reservations) {
    if (resByTable.has(r.tableId)) continue;
    const { availableAgainAt } = reservationWindow(r.reservedAt, r.durationMinutes);
    if (availableAgainAt > now || (r.depositAmount > 0 && !r.depositConsumed)) resByTable.set(r.tableId, r);
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
        ? (() => {
            const w = reservationWindow(reservation.reservedAt, reservation.durationMinutes);
            return {
              id: reservation.id,
              customerName: reservation.customerName,
              reservedAt: reservation.reservedAt,
              partySize: reservation.partySize,
              durationMinutes: reservation.durationMinutes,
              endAt: w.endAt,
              availableAgainAt: w.availableAgainAt,
              hasPreOrder: reservation.hasPreOrder,
              totalAmount: reservation.totalAmount,
              depositAmount: reservation.depositAmount,
              remaining: Math.max(0, reservation.totalAmount - reservation.depositAmount),
              paymentStatus: reservation.paymentStatus,
              items: reservation.items.map((it) => ({
                id: it.id,
                dishName: it.dishName,
                variantName: it.variantName,
                quantity: it.quantity,
                subtotal: it.subtotal,
              })),
            };
          })()
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
  const existing = await prisma.table.findFirst({ where: { name: data.name } });
  if (existing) throw new AppError(409, 'VALIDATION_001', 'Une table porte déjà ce nom');
  return prisma.table.create({ data: { name: data.name, capacity: data.capacity ?? 4 } });
}

export async function updateTable(id: number, data: { name?: string; capacity?: number }) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');
  if (data.name && data.name !== table.name) {
    const dup = await prisma.table.findFirst({ where: { name: data.name } });
    if (dup) throw new AppError(409, 'VALIDATION_001', 'Une table porte déjà ce nom');
  }
  return prisma.table.update({
    where: { id },
    data: { ...(data.name ? { name: data.name } : {}), ...(data.capacity !== undefined ? { capacity: data.capacity } : {}) },
  });
}

export async function deleteTable(id: number) {
  // Garde-fou 1 : commande active (non annulée et non payée OU non servie).
  const occupying = await prisma.order.findFirst({ where: { tableId: id, ...OCCUPYING_WHERE } });
  if (occupying) {
    throw new AppError(409, 'TABLE_001', 'Table occupée par une commande active');
  }
  // Garde-fou 2 : réservation active.
  const activeRes = await prisma.reservation.findFirst({ where: { tableId: id, status: 'active' } });
  if (activeRes) {
    throw new AppError(409, 'TABLE_001', 'Table avec une réservation active');
  }
  // OK : on détache les commandes historiques (FK SetNull manuel pour cohérence) puis on supprime.
  // Les réservations annulées/honorées sont cascade-supprimées par la FK (acceptable : pas de données financières dessus).
  await prisma.$transaction([
    prisma.order.updateMany({ where: { tableId: id }, data: { tableId: null } }),
    prisma.table.delete({ where: { id } }),
  ]);
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

  // Acompte de réservation déjà encaissé → déduit du dû (plafonné au total). Marqué consommé ensuite.
  const depositRes = await prisma.reservation.findFirst({
    where: { tableId: id, depositAmount: { gt: 0 }, depositConsumed: false, status: { not: 'annulée' } },
    orderBy: { reservedAt: 'desc' },
  });
  const depositApplied = depositRes ? Math.min(depositRes.depositAmount, total) : 0;

  // Pourboire (hors total) attribué au serveur de la table ; le dû espèces l'inclut.
  const tipAmount = Math.max(0, Math.round(tip?.amount ?? 0));
  const tipMethod = tipAmount > 0 ? tip?.method ?? paymentMethod : null;
  // Dû = total − acompte déjà versé + pourboire.
  const due = total - depositApplied + tipAmount;
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

  await prisma.$transaction(async (tx) => {
    for (const [idx, o] of unpaid.entries()) {
      await tx.order.update({
        where: { id: o.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentMethod,
          cashSessionId,
          mobileMoneyProvider: paymentMethod === 'mobile_money' ? paymentDetails?.mobileMoneyProvider : undefined,
          // Le détail espèces (remis/monnaie), le pourboire et l'acompte déduit sont portés par la 1re commande du lot.
          cashGiven: paymentMethod === 'espèces' && idx === 0 ? paymentDetails?.cashGiven : undefined,
          changeReturned: paymentMethod === 'espèces' && idx === 0 ? change : undefined,
          tipAmount: idx === 0 ? tipAmount : undefined,
          tipMethod: idx === 0 ? tipMethod : undefined,
          depositApplied: idx === 0 ? depositApplied : undefined,
        },
      });
    }
    // L'acompte est consommé : on clôt la réservation (honorée) pour ne pas le déduire deux fois.
    if (depositRes) {
      await tx.reservation.update({ where: { id: depositRes.id }, data: { depositConsumed: true, status: 'honorée' } });
    }
  });

  // L'addition est réglée : on retombe la demande d'addition.
  if (table.billRequested) await prisma.table.update({ where: { id }, data: { billRequested: false } });

  await logAudit({
    userId,
    action: 'paiement',
    entityType: 'table',
    entityId: id,
    details: { tableName: table.name, amount: total, deposit: depositApplied, tip: tipAmount, method: paymentMethod, orderCount: unpaid.length },
  });
  emitStatsUpdated({ settledTable: table.name, total });
  emitToRole('caissier', 'table_settled', { tableId: id, tableName: table.name, total });
  return { tableId: id, paidCount: unpaid.length, total, depositApplied, due, tip: tipAmount, change, paymentMethod };
}

// Le serveur signale (ou annule) une demande d'addition ; la caisse est notifiée en temps réel.
export async function setBillRequested(id: number, requested: boolean) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');
  const updated = await prisma.table.update({ where: { id }, data: { billRequested: requested } });
  emitToRestaurant('table_status_changed', { tableId: id });
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
  emitToRestaurant('table_status_changed', { tableId: sourceId, targetId });
  return { sourceId, targetId, moved: moved.count };
}

// --- Réservations ---
export interface ReservationItemInput {
  dishId: number;
  variantId?: number;
  quantity: number;
  notes?: string;
}
export interface ReservationInput {
  tableId: number;
  customerName: string;
  customerPhone?: string;
  partySize?: number;
  reservedAt: string;
  durationMinutes?: number;
  note?: string;
  // Pré-commande (informative) + montants / acompte.
  hasPreOrder?: boolean;
  items?: ReservationItemInput[];
  totalAmount?: number;
  depositAmount?: number;
  depositMethod?: string;
}

// Marge totale ajoutée après la fin du repas avant que la table soit de nouveau libre.
const RESERVATION_BUFFER_MINUTES = RESERVATION_GRACE_MINUTES + RESERVATION_CLEANING_MINUTES;

const reservationInclude = {
  table: { select: { id: true, name: true } },
  items: { orderBy: { id: 'asc' } },
} as const;

// Calcule les jalons d'une réservation à partir de l'heure de début et de la durée :
//   endAt           = fin du repas (heure communiquée au client)
//   availableAgainAt = endAt + marge client + nettoyage (table de nouveau libre)
export function reservationWindow(reservedAt: Date, durationMinutes: number) {
  const endAt = new Date(reservedAt.getTime() + durationMinutes * 60_000);
  const availableAgainAt = new Date(endAt.getTime() + RESERVATION_BUFFER_MINUTES * 60_000);
  return { endAt, availableAgainAt };
}

// Statut de paiement dérivé des montants.
export function computePaymentStatus(totalAmount: number, depositAmount: number): 'aucun' | 'avance' | 'réglé' {
  if (depositAmount <= 0) return 'aucun';
  if (totalAmount > 0 && depositAmount >= totalAmount) return 'réglé';
  return 'avance';
}

// Annote une réservation de ses jalons + reste à payer (pour les réponses API).
function withComputed<T extends { reservedAt: Date; durationMinutes: number; totalAmount?: number; depositAmount?: number }>(r: T) {
  const { endAt, availableAgainAt } = reservationWindow(r.reservedAt, r.durationMinutes);
  const remaining = Math.max(0, (r.totalAmount ?? 0) - (r.depositAmount ?? 0));
  return { ...r, endAt, availableAgainAt, remaining, graceMinutes: RESERVATION_GRACE_MINUTES, cleaningMinutes: RESERVATION_CLEANING_MINUTES };
}

// Construit les lignes de pré-commande avec prix figé (depuis la base, jamais le client) + total matière.
async function buildReservationItems(items: ReservationItemInput[]) {
  const dishIds = [...new Set(items.map((i) => i.dishId))];
  const dishes = await prisma.dish.findMany({ where: { id: { in: dishIds } }, include: { variants: true } });
  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  let itemsTotal = 0;
  const data = items
    .filter((i) => i.quantity > 0)
    .map((i) => {
      const dish = dishMap.get(i.dishId);
      if (!dish) throw new AppError(404, 'DISH_001', `Plat ${i.dishId} introuvable`);
      const variant = i.variantId ? dish.variants.find((v) => v.id === i.variantId) : undefined;
      if (i.variantId && !variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
      // variant.price est null pour les variantes sur plat libre → on utilise dish.price (prix suggéré).
      const unitPrice = (variant?.price != null ? variant.price : null) ?? dish.price;
      const subtotal = unitPrice * i.quantity;
      itemsTotal += subtotal;
      return {
        dishId: dish.id,
        dishName: dish.name,
        dishPrice: unitPrice,
        variantId: variant?.id ?? null,
        variantName: variant?.name ?? null,
        quantity: i.quantity,
        subtotal,
        notes: i.notes ?? null,
      };
    });
  return { data, itemsTotal };
}

// Résout l'acompte : un acompte en espèces exige une caisse ouverte et y est rattaché (compté au théorique).
async function resolveDeposit(depositAmount: number, depositMethod: string | undefined, userId?: number) {
  if (!depositAmount || depositAmount <= 0) {
    return { depositAmount: 0, depositMethod: null, depositAt: null, depositCashSessionId: null };
  }
  const method = depositMethod ?? 'espèces';
  let depositCashSessionId: number | null = null;
  if (isCashPaymentMethod(method)) {
    const session = userId ? await getOpenSession(userId) : null;
    if (!session) throw new AppError(400, 'CASH_001');
    depositCashSessionId = session.id;
  }
  return { depositAmount, depositMethod: method, depositAt: new Date(), depositCashSessionId };
}

// Anti-chevauchement : aucune autre réservation active de la table ne doit recouvrir
// le créneau [début, table de nouveau libre] (marges incluses). excludeId : réservation en cours d'édition.
async function assertNoOverlap(tableId: number, reservedAt: Date, availableAgainAt: Date, excludeId?: number) {
  const sameDay = await prisma.reservation.findMany({
    where: {
      tableId,
      status: 'active',
      ...(excludeId ? { id: { not: excludeId } } : {}),
      reservedAt: { gte: startOfDay(reservedAt), lte: endOfDay(availableAgainAt) },
    },
  });
  for (const r of sameDay) {
    const w = reservationWindow(r.reservedAt, r.durationMinutes);
    if (reservedAt < w.availableAgainAt && r.reservedAt < availableAgainAt) {
      throw new AppError(
        409,
        'VALIDATION_001',
        `Créneau indisponible : la table est déjà réservée jusqu'à ${w.availableAgainAt.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} (nettoyage inclus)`
      );
    }
  }
}

export async function createReservation(input: ReservationInput, userId?: number) {
  const table = await prisma.table.findUnique({ where: { id: input.tableId } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');

  const reservedAt = new Date(input.reservedAt);
  if (Number.isNaN(reservedAt.getTime())) throw new AppError(400, 'VALIDATION_001', 'Heure de réservation invalide');
  const durationMinutes = input.durationMinutes ?? RESERVATION_DEFAULT_DURATION_MINUTES;
  const { availableAgainAt } = reservationWindow(reservedAt, durationMinutes);

  await assertNoOverlap(input.tableId, reservedAt, availableAgainAt);

  const { data: itemsData, itemsTotal } = await buildReservationItems(input.items ?? []);
  const hasPreOrder = input.hasPreOrder ?? itemsData.length > 0;
  // Coût total : valeur saisie si fournie, sinon somme des plats pré-commandés.
  const totalAmount = input.totalAmount != null ? input.totalAmount : itemsTotal;
  const deposit = await resolveDeposit(input.depositAmount ?? 0, input.depositMethod, userId);
  const paymentStatus = computePaymentStatus(totalAmount, deposit.depositAmount);

  const reservation = await prisma.reservation.create({
    data: {
      tableId: input.tableId,
      customerName: input.customerName,
      customerPhone: input.customerPhone,
      partySize: input.partySize,
      reservedAt,
      durationMinutes,
      note: input.note,
      hasPreOrder,
      totalAmount,
      paymentStatus,
      ...deposit,
      createdBy: userId,
      items: itemsData.length ? { create: itemsData } : undefined,
    },
    include: reservationInclude,
  });
  emitToRestaurant('table_status_changed', { tableId: input.tableId });
  return withComputed(reservation);
}

export async function updateReservation(id: number, input: ReservationInput, userId?: number) {
  const existing = await prisma.reservation.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'VALIDATION_001', 'Réservation introuvable');
  if (existing.status !== 'active') throw new AppError(400, 'VALIDATION_001', 'Seule une réservation active peut être modifiée');

  const tableId = input.tableId ?? existing.tableId;
  const reservedAt = input.reservedAt ? new Date(input.reservedAt) : existing.reservedAt;
  if (Number.isNaN(reservedAt.getTime())) throw new AppError(400, 'VALIDATION_001', 'Heure de réservation invalide');
  const durationMinutes = input.durationMinutes ?? existing.durationMinutes;
  const { availableAgainAt } = reservationWindow(reservedAt, durationMinutes);

  await assertNoOverlap(tableId, reservedAt, availableAgainAt, id);

  // Lignes de pré-commande : remplacées seulement si fournies.
  const replaceItems = input.items !== undefined;
  const { data: itemsData, itemsTotal } = replaceItems ? await buildReservationItems(input.items ?? []) : { data: [], itemsTotal: 0 };
  const hasPreOrder = input.hasPreOrder ?? (replaceItems ? itemsData.length > 0 : existing.hasPreOrder);
  const totalAmount = input.totalAmount != null ? input.totalAmount : replaceItems ? itemsTotal : existing.totalAmount;
  const deposit = await resolveDeposit(
    input.depositAmount ?? existing.depositAmount,
    input.depositMethod ?? existing.depositMethod ?? undefined,
    userId
  );
  const paymentStatus = computePaymentStatus(totalAmount, deposit.depositAmount);

  const updated = await prisma.$transaction(async (tx) => {
    if (replaceItems) {
      await tx.reservationItem.deleteMany({ where: { reservationId: id } });
    }
    return tx.reservation.update({
      where: { id },
      data: {
        tableId,
        customerName: input.customerName ?? existing.customerName,
        customerPhone: input.customerPhone !== undefined ? input.customerPhone : existing.customerPhone,
        partySize: input.partySize !== undefined ? input.partySize : existing.partySize,
        reservedAt,
        durationMinutes,
        note: input.note !== undefined ? input.note : existing.note,
        hasPreOrder,
        totalAmount,
        paymentStatus,
        ...deposit,
        ...(replaceItems && itemsData.length ? { items: { create: itemsData } } : {}),
      },
      include: reservationInclude,
    });
  });
  emitToRestaurant('table_status_changed', { tableId });
  if (tableId !== existing.tableId) emitToRestaurant('table_status_changed', { tableId: existing.tableId });
  return withComputed(updated);
}

export async function listReservations() {
  const reservations = await prisma.reservation.findMany({
    where: { status: 'active', reservedAt: { gte: startOfDay(new Date()) } },
    orderBy: { reservedAt: 'asc' },
    take: 100,
    include: reservationInclude,
  });
  return reservations.map(withComputed);
}

export async function setReservationStatus(id: number, status: 'annulée' | 'honorée') {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) throw new AppError(404, 'VALIDATION_001', 'Réservation introuvable');
  const updated = await prisma.reservation.update({ where: { id }, data: { status } });
  emitToRestaurant('table_status_changed', { tableId: reservation.tableId });
  return updated;
}

// Annule une réservation. Si un acompte non consommé a été versé, on peut le rembourser
// (l'argent ressort → retiré du théorique de caisse) ou le conserver (pénalité no-show → reste compté).
export async function cancelReservation(id: number, refundDeposit: boolean, userId?: number) {
  const reservation = await prisma.reservation.findUnique({ where: { id } });
  if (!reservation) throw new AppError(404, 'VALIDATION_001', 'Réservation introuvable');
  const refundable = reservation.depositAmount > 0 && !reservation.depositConsumed && !reservation.depositRefunded;
  const doRefund = refundDeposit && refundable;
  const updated = await prisma.reservation.update({
    where: { id },
    data: {
      status: 'annulée',
      ...(doRefund ? { depositRefunded: true, depositRefundedAt: new Date() } : {}),
    },
  });
  if (doRefund) {
    await logAudit({
      userId,
      action: 'remboursement',
      entityType: 'reservation',
      entityId: id,
      details: { customerName: reservation.customerName, deposit: reservation.depositAmount, method: reservation.depositMethod },
    });
  }
  emitToRestaurant('table_status_changed', { tableId: reservation.tableId });
  return updated;
}

// Le client est arrivé : si une pré-commande existe, elle est envoyée en cuisine (vraie commande sur la table).
// La réservation reste active (l'acompte reste rattaché à la table et sera déduit au règlement).
// Sans pré-commande, rien n'est créé : le serveur prend la commande normalement ; l'acompte sera déduit à l'addition.
export async function arriveReservation(id: number, userId?: number) {
  const reservation = await prisma.reservation.findUnique({ where: { id }, include: { items: true } });
  if (!reservation) throw new AppError(404, 'VALIDATION_001', 'Réservation introuvable');
  if (reservation.status !== 'active') throw new AppError(400, 'VALIDATION_001', 'Réservation déjà clôturée');

  const orderableItems = reservation.items.filter((it) => it.dishId != null);
  let order = null;
  if (reservation.hasPreOrder && orderableItems.length) {
    order = await createOrder(
      {
        tableId: reservation.tableId,
        serverId: userId,
        channel: 'sur_place',
        customerName: reservation.customerName,
        customerPhone: reservation.customerPhone ?? undefined,
        items: orderableItems.map((it) => ({
          dishId: it.dishId as number,
          variantId: it.variantId ?? undefined,
          // Plat à prix libre : on réutilise le prix figé lors de la pré-commande.
          customPrice: it.dishPrice,
          quantity: it.quantity,
          notes: it.notes ?? undefined,
        })),
      },
      userId
    );
  }
  emitToRestaurant('table_status_changed', { tableId: reservation.tableId });
  return { reservationId: id, orderCreated: !!order, order };
}
