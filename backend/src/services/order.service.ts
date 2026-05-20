import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { roundQty, checkLowStock } from './stock.service';
import { createNotification } from './notification.service';
import {
  emitNewOrder,
  emitOrderReady,
  emitOrderStatusChanged,
  emitStatsUpdated,
} from '../websocket';
import { STATUS_TRANSITIONS, PaymentMethod, MobileMoneyProvider } from '../constants';

const orderInclude = { items: true } as const;

export interface OrderItemInput {
  dishId: number;
  quantity: number;
  notes?: string;
}

export interface CreateOrderInput {
  items: OrderItemInput[];
  discountAmount?: number;
  discountPercent?: number;
  // Paiement optionnel : si absent, la commande est créée non payée (réglée plus tard à la caisse).
  paymentMethod?: PaymentMethod;
  paymentDetails?: {
    mobileMoneyProvider?: MobileMoneyProvider;
    cashGiven?: number;
    changeReturned?: number;
  };
  tableId?: number;
  serverId?: number;
}

// Formatage pur du numero de commande YYYYMMDD-NNN (§13.2 regle 1).
export function formatOrderNumber(prefix: string, existingCount: number): string {
  return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`;
}

async function generateOrderNumber(tx: Prisma.TransactionClient): Promise<string> {
  const prefix = format(new Date(), 'yyyyMMdd');
  const count = await tx.order.count({ where: { orderNumber: { startsWith: prefix } } });
  return formatOrderNumber(prefix, count);
}

export async function getOrder(id: number) {
  const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
  if (!order) throw new AppError(404, 'ORDER_001');
  return order;
}

export async function listOrders(statuses?: string[]) {
  return prisma.order.findMany({
    where: statuses && statuses.length ? { status: { in: statuses } } : undefined,
    orderBy: { createdAt: 'desc' },
    include: orderInclude,
  });
}

export function computeFinalTotal(total: number, discountAmount: number, discountPercent: number): number {
  let final = total;
  if (discountPercent > 0) {
    final = Math.round(total * (1 - discountPercent / 100));
  } else if (discountAmount > 0) {
    final = total - discountAmount;
  }
  return final < 0 ? 0 : final;
}

export async function createOrder(input: CreateOrderInput, userId?: number, markSynced = true) {
  if (!input.items.length) throw new AppError(400, 'VALIDATION_001', 'Aucun article dans la commande');

  const dishIds = [...new Set(input.items.map((i) => i.dishId))];
  const dishes = await prisma.dish.findMany({
    where: { id: { in: dishIds } },
    include: { ingredients: true },
  });
  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  // Agrege les besoins en stock sur toute la commande.
  const required = new Map<number, number>();
  let subtotal = 0;
  const orderItemsData = input.items.map((item) => {
    const dish = dishMap.get(item.dishId);
    if (!dish) throw new AppError(404, 'DISH_001', `Plat ${item.dishId} introuvable`);
    if (!dish.isActive) throw new AppError(400, 'DISH_002', `${dish.name} indisponible`);
    for (const ing of dish.ingredients) {
      required.set(ing.stockItemId, (required.get(ing.stockItemId) ?? 0) + ing.quantityNeeded * item.quantity);
    }
    const sub = dish.price * item.quantity;
    subtotal += sub;
    return {
      dishId: dish.id,
      dishName: dish.name,
      dishPrice: dish.price,
      quantity: item.quantity,
      subtotal: sub,
      notes: item.notes,
    };
  });

  // Verifie la disponibilite du stock (§13.1 regle 3).
  if (required.size) {
    const stockItems = await prisma.stockItem.findMany({ where: { id: { in: [...required.keys()] } } });
    for (const si of stockItems) {
      const need = required.get(si.id) ?? 0;
      if (si.quantity < need) {
        throw new AppError(400, 'STOCK_001', `Stock insuffisant : ${si.name}`);
      }
    }
  }

  const total = subtotal;
  const discountAmount = input.discountAmount ?? 0;
  const discountPercent = input.discountPercent ?? 0;
  const finalTotal = computeFinalTotal(total, discountAmount, discountPercent);

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        total,
        discountAmount,
        discountPercent,
        finalTotal,
        paymentMethod: input.paymentMethod ?? null,
        paymentDetails: (input.paymentDetails as Prisma.InputJsonValue) ?? undefined,
        mobileMoneyProvider: input.paymentDetails?.mobileMoneyProvider,
        cashGiven: input.paymentDetails?.cashGiven,
        changeReturned: input.paymentDetails?.changeReturned,
        isPaid: !!input.paymentMethod,
        paidAt: input.paymentMethod ? new Date() : null,
        status: 'commandée',
        tableId: input.tableId ?? null,
        serverId: input.serverId ?? null,
        createdBy: userId,
        isSynced: markSynced,
        items: { create: orderItemsData },
      },
      include: orderInclude,
    });

    // Decrement automatique du stock + mouvements (§13.1 regle 1).
    for (const [stockItemId, qty] of required) {
      const si = await tx.stockItem.findUnique({ where: { id: stockItemId } });
      if (!si) continue;
      const newQuantity = roundQty(si.quantity - qty);
      await tx.stockItem.update({
        where: { id: stockItemId },
        data: { quantity: newQuantity, lastUpdated: new Date() },
      });
      await tx.stockMovement.create({
        data: {
          stockItemId,
          movementType: 'commande',
          quantity: roundQty(-qty),
          previousQuantity: si.quantity,
          newQuantity,
          orderId: created.id,
          createdBy: userId,
        },
      });
    }
    return created;
  });

  // Notifications temps reel (§7.7).
  emitNewOrder({
    orderId: order.id,
    orderNumber: order.orderNumber,
    items: order.items.map((i) => ({ id: i.id, name: i.dishName, quantity: i.quantity, notes: i.notes })),
    status: order.status,
    createdAt: order.createdAt,
  });
  await createNotification({
    userRole: 'cuisinier',
    title: 'Nouvelle commande',
    message: `Commande ${order.orderNumber} reçue`,
    type: 'nouvelle_commande',
    relatedOrderId: order.id,
  });
  emitStatsUpdated({ lastOrderNumber: order.orderNumber, finalTotal: order.finalTotal });

  // Alertes de stock faible apres decrement.
  for (const stockItemId of required.keys()) {
    const si = await prisma.stockItem.findUnique({ where: { id: stockItemId } });
    if (si) await checkLowStock(si);
  }

  return order;
}

// Transitions sequentielles strictes (§13.2 regle 2). 'annulée' passe par cancelOrder.
export async function updateStatus(id: number, newStatus: string, _userId?: number) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');

  const allowed = STATUS_TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(newStatus)) {
    throw new AppError(400, 'ORDER_002', `Transition ${order.status} -> ${newStatus} invalide`);
  }

  const timestamps: Record<string, Date> = {};
  if (newStatus === 'en_cours') timestamps.preparedAt = new Date();
  if (newStatus === 'prête') timestamps.readyAt = new Date();
  if (newStatus === 'servie') timestamps.servedAt = new Date();

  const updated = await prisma.order.update({
    where: { id },
    data: { status: newStatus, ...timestamps },
    include: orderInclude,
  });

  emitOrderStatusChanged({
    orderId: id,
    orderNumber: updated.orderNumber,
    newStatus,
    timestamp: new Date().toISOString(),
  });

  if (newStatus === 'prête') {
    emitOrderReady({ orderId: id, orderNumber: updated.orderNumber });
    await createNotification({
      userRole: 'caissier',
      title: 'Commande prête',
      message: `Commande ${updated.orderNumber} prête à servir`,
      type: 'commande_prête',
      relatedOrderId: id,
    });
  }
  emitStatsUpdated({ orderNumber: updated.orderNumber, status: newStatus });
  return updated;
}

// Annulation : restaure le stock (§13.2 regle 4).
export async function cancelOrder(id: number, reason: string, userId?: number) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');
  if (order.status === 'servie') throw new AppError(400, 'ORDER_002', 'Commande déjà servie');
  if (order.status === 'annulée') throw new AppError(400, 'ORDER_002', 'Commande déjà annulée');

  await prisma.$transaction(async (tx) => {
    const movements = await tx.stockMovement.findMany({
      where: { orderId: id, movementType: 'commande' },
    });
    for (const mv of movements) {
      const si = await tx.stockItem.findUnique({ where: { id: mv.stockItemId } });
      if (!si) continue;
      // mv.quantity est negatif : restaurer = retirer cette valeur negative.
      const restored = roundQty(si.quantity - mv.quantity);
      await tx.stockItem.update({
        where: { id: mv.stockItemId },
        data: { quantity: restored, lastUpdated: new Date() },
      });
      await tx.stockMovement.create({
        data: {
          stockItemId: mv.stockItemId,
          movementType: 'ajustement',
          quantity: roundQty(-mv.quantity),
          previousQuantity: si.quantity,
          newQuantity: restored,
          orderId: id,
          createdBy: userId,
          note: 'Annulation commande',
        },
      });
    }
    await tx.order.update({
      where: { id },
      data: { status: 'annulée', cancelledAt: new Date(), cancellationReason: reason },
    });
  });

  emitOrderStatusChanged({
    orderId: id,
    orderNumber: order.orderNumber,
    newStatus: 'annulée',
    timestamp: new Date().toISOString(),
  });
  return getOrder(id);
}

// Règlement d'une commande différée (paiement à la caisse).
export async function payOrder(
  id: number,
  paymentMethod: PaymentMethod,
  paymentDetails?: { mobileMoneyProvider?: MobileMoneyProvider; cashGiven?: number; changeReturned?: number }
) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');
  if (order.status === 'annulée') throw new AppError(400, 'ORDER_002', 'Commande annulée');
  if (order.isPaid) throw new AppError(400, 'ORDER_002', 'Commande déjà payée');

  if (paymentMethod === 'espèces' && (paymentDetails?.cashGiven ?? 0) < order.finalTotal) {
    throw new AppError(400, 'VALIDATION_001', 'Montant remis insuffisant');
  }
  if (paymentMethod === 'mobile_money' && !paymentDetails?.mobileMoneyProvider) {
    throw new AppError(400, 'VALIDATION_001', 'Service mobile money requis');
  }
  const change =
    paymentMethod === 'espèces' ? Math.max(0, (paymentDetails?.cashGiven ?? 0) - order.finalTotal) : 0;

  const updated = await prisma.order.update({
    where: { id },
    data: {
      isPaid: true,
      paidAt: new Date(),
      paymentMethod,
      mobileMoneyProvider: paymentMethod === 'mobile_money' ? paymentDetails?.mobileMoneyProvider : undefined,
      cashGiven: paymentMethod === 'espèces' ? paymentDetails?.cashGiven : undefined,
      changeReturned: paymentMethod === 'espèces' ? change : undefined,
    },
    include: orderInclude,
  });
  emitStatsUpdated({ orderNumber: updated.orderNumber, paid: true });
  return updated;
}
