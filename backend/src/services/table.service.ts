import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { PaymentMethod, MobileMoneyProvider, TableStatus } from '../constants';
import { emitStatsUpdated, emitToRole } from '../websocket';

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

  return tables.map((t) => {
    const orders = byTable.get(t.id) ?? [];
    const status: TableStatus = orders.length ? 'occupée' : 'libre';
    const total = orders.reduce((s, o) => s + o.finalTotal, 0);
    const unpaidTotal = orders.filter((o) => !o.isPaid).reduce((s, o) => s + o.finalTotal, 0);
    const last = orders[orders.length - 1];
    return {
      id: t.id,
      name: t.name,
      capacity: t.capacity,
      status,
      server: last?.server ?? null,
      total,
      unpaidTotal,
      hasUnpaid: orders.some((o) => !o.isPaid),
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
  userId?: number
) {
  const table = await prisma.table.findUnique({ where: { id } });
  if (!table) throw new AppError(404, 'VALIDATION_001', 'Table introuvable');

  const unpaid = await prisma.order.findMany({
    where: { tableId: id, isPaid: false, status: { not: 'annulée' } },
  });
  if (!unpaid.length) throw new AppError(400, 'ORDER_001', 'Aucune commande à régler pour cette table');

  const total = unpaid.reduce((s, o) => s + o.finalTotal, 0);
  if (paymentMethod === 'espèces') {
    const cash = paymentDetails?.cashGiven ?? 0;
    if (cash < total) throw new AppError(400, 'VALIDATION_001', 'Montant remis insuffisant');
  }
  if (paymentMethod === 'mobile_money' && !paymentDetails?.mobileMoneyProvider) {
    throw new AppError(400, 'VALIDATION_001', 'Service mobile money requis');
  }
  const change = paymentMethod === 'espèces' ? Math.max(0, (paymentDetails?.cashGiven ?? 0) - total) : 0;

  await prisma.$transaction(
    unpaid.map((o, idx) =>
      prisma.order.update({
        where: { id: o.id },
        data: {
          isPaid: true,
          paidAt: new Date(),
          paymentMethod,
          mobileMoneyProvider: paymentMethod === 'mobile_money' ? paymentDetails?.mobileMoneyProvider : undefined,
          // Le détail espèces (remis/monnaie) est porté par la 1re commande du lot.
          cashGiven: paymentMethod === 'espèces' && idx === 0 ? paymentDetails?.cashGiven : undefined,
          changeReturned: paymentMethod === 'espèces' && idx === 0 ? change : undefined,
        },
      })
    )
  );

  void userId;
  emitStatsUpdated({ settledTable: table.name, total });
  emitToRole('caissier', 'table_settled', { tableId: id, tableName: table.name, total });
  return { tableId: id, paidCount: unpaid.length, total, change, paymentMethod };
}
