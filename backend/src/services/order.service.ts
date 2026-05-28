import { format } from 'date-fns';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { roundQty, checkLowStock } from './stock.service';
import { createNotification } from './notification.service';
import { resolveCashSessionForPayment } from './cash.service';
import { logAudit } from './audit.service';
import { findActiveHappyHour, findValidCoupon } from './promotion.service';
import { getMaxDiscountPercent, verifyManagerApproval } from './settings.service';
import {
  emitNewOrder,
  emitOrderReady,
  emitOrderStatusChanged,
  emitStatsUpdated,
} from '../websocket';
import {
  STATUS_TRANSITIONS,
  PaymentMethod,
  MobileMoneyProvider,
  SalesChannel,
  DeliveryPlatform,
  Role,
  isCashPaymentMethod,
} from '../constants';
import { getTenantIdOrThrow } from '../config/tenant-context';

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const orderInclude = { items: true } as const;

export interface OrderItemInput {
  dishId: number;
  variantId?: number;
  // Prix saisi en caisse pour un plat à prix libre.
  customPrice?: number;
  offered?: boolean;
  quantity: number;
  notes?: string;
}

// --- Paiement mixte ---

export interface PaymentSplit {
  method: string;
  amount: number;
  mobileMoneyProvider?: string;
  cashGiven?: number;
  changeReturned?: number;
}

export interface ResolvedPayment {
  splits: PaymentSplit[];
  summaryMethod: string;          // 'mixte' si >1 split, sinon le moyen unique
  cashGiven?: number;             // résumé : valeur de la ligne espèces (ou mono espèces)
  changeReturned?: number;        // résumé : rendu de monnaie (ligne espèces)
  mobileMoneyProvider?: string;   // résumé : provider de la 1re ligne mobile_money
  hasCash: boolean;               // au moins une ligne espèces
  hasPayment: boolean;            // false = commande différée sans paiement
}

/**
 * Unifie les trois modes d'entrée (payments[], paymentMethod mono, ou aucun paiement)
 * en une structure normalisée et valide les règles métier.
 *
 * `due` = montant exact à encaisser (déjà net de pourboire et d'acompte côté appelant).
 */
export function resolvePayments(
  input: {
    payments?: PaymentSplit[];
    paymentMethod?: string;
    paymentDetails?: { mobileMoneyProvider?: string; cashGiven?: number; changeReturned?: number };
  },
  due: number
): ResolvedPayment {
  // Cas 1 : aucun paiement fourni → commande différée.
  if (!input.payments?.length && !input.paymentMethod) {
    return { splits: [], summaryMethod: '', hasCash: false, hasPayment: false };
  }

  // Construction des splits.
  let splits: PaymentSplit[];
  if (input.payments?.length) {
    splits = input.payments;
  } else {
    // Mono via paymentMethod legacy.
    splits = [{
      method: input.paymentMethod!,
      amount: due,
      mobileMoneyProvider: input.paymentDetails?.mobileMoneyProvider,
      cashGiven: input.paymentDetails?.cashGiven,
      changeReturned: input.paymentDetails?.changeReturned,
    }];
  }

  // Validation : somme des splits = due.
  const total = splits.reduce((s, sp) => s + sp.amount, 0);
  if (total !== due) {
    throw new AppError(400, 'VALIDATION_001', 'Le total des paiements doit égaler le montant dû');
  }

  // Validation par split.
  for (const sp of splits) {
    if (isCashPaymentMethod(sp.method)) {
      const given = sp.cashGiven ?? sp.amount;
      if (given < sp.amount) {
        throw new AppError(400, 'VALIDATION_001', 'Montant remis insuffisant');
      }
    }
    if (sp.method === 'mobile_money' && !sp.mobileMoneyProvider) {
      throw new AppError(400, 'VALIDATION_001', 'Service mobile money requis');
    }
  }

  const summaryMethod = splits.length > 1 ? 'mixte' : splits[0].method;
  const hasCash = splits.some((s) => isCashPaymentMethod(s.method));

  // Résumé espèces (ticket + compat Order.cashGiven / changeReturned).
  const cashSplit = splits.find((s) => isCashPaymentMethod(s.method));
  const cashGiven = cashSplit ? (cashSplit.cashGiven ?? cashSplit.amount) : undefined;
  const changeReturned = cashSplit
    ? (cashSplit.changeReturned ?? Math.max(0, (cashSplit.cashGiven ?? cashSplit.amount) - cashSplit.amount))
    : undefined;

  // Résumé mobile_money (1re ligne).
  const mmSplit = splits.find((s) => s.method === 'mobile_money');
  const mobileMoneyProvider = mmSplit?.mobileMoneyProvider;

  return { splits, summaryMethod, cashGiven, changeReturned, mobileMoneyProvider, hasCash, hasPayment: true };
}

// --- Fin paiement mixte ---

export interface CreateOrderInput {
  items: OrderItemInput[];
  couponCode?: string;
  discountAmount?: number;
  discountPercent?: number;
  // Paiement optionnel : si absent, la commande est créée non payée (réglée plus tard à la caisse).
  paymentMethod?: PaymentMethod;
  paymentDetails?: {
    mobileMoneyProvider?: MobileMoneyProvider;
    cashGiven?: number;
    changeReturned?: number;
  };
  // Paiement mixte : si présent, source de vérité (remplace paymentMethod/paymentDetails).
  payments?: PaymentSplit[];
  // Pourboire (hors total / hors CA / hors caisse) : enregistré seulement à l'encaissement.
  tipAmount?: number;
  tipMethod?: PaymentMethod;
  tableId?: number;
  serverId?: number;
  channel?: SalesChannel;
  deliveryPlatform?: DeliveryPlatform;
  customerName?: string;
  customerPhone?: string;
}

// Formatage pur du numero de commande YYYYMMDD-NNN (§13.2 regle 1).
export function formatOrderNumber(prefix: string, existingCount: number): string {
  return `${prefix}-${String(existingCount + 1).padStart(3, '0')}`;
}

async function generateOrderNumber(tx: Tx): Promise<string> {
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

// Résout le prix unitaire d'un plat à prix libre : montant exigé et validé contre les bornes.
export function resolveLibrePrice(
  dish: { name: string; priceMin: number | null; priceMax: number | null },
  customPrice?: number
): number {
  if (customPrice == null) {
    throw new AppError(400, 'VALIDATION_001', `Prix requis pour ${dish.name}`);
  }
  const min = dish.priceMin ?? 0;
  const max = dish.priceMax ?? Number.MAX_SAFE_INTEGER;
  if (customPrice < min || customPrice > max) {
    throw new AppError(400, 'VALIDATION_001', `Prix de ${dish.name} hors limites (${min} – ${max})`);
  }
  return customPrice;
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
    include: { ingredients: true, variants: { include: { ingredients: true } } },
  });
  const dishMap = new Map(dishes.map((d) => [d.id, d]));

  // Agrege les besoins en stock sur toute la commande.
  const required = new Map<number, number>();
  let subtotal = 0;
  const orderItemsData = input.items.map((item) => {
    const dish = dishMap.get(item.dishId);
    if (!dish) throw new AppError(404, 'DISH_001', `Plat ${item.dishId} introuvable`);
    if (!dish.isActive) throw new AppError(400, 'DISH_002', `${dish.name} indisponible`);

    // Prix et recette : prix libre saisi, sinon variante choisie, sinon le plat lui-même.
    let unitPrice = dish.price;
    let variantId: number | undefined;
    let variantName: string | undefined;
    let recipe: { stockItemId: number; quantityNeeded: number }[] = dish.ingredients;
    const activeVariants = dish.variants.filter((v) => v.isActive);
    if (dish.priceType === 'libre') {
      // Prix libre : re-validé contre les bornes du plat (jamais confiance au client).
      unitPrice = resolveLibrePrice(dish, item.customPrice);
      // Si le plat a des variantes actives, le caissier doit en choisir une (recette + nom).
      if (activeVariants.length > 0) {
        if (!item.variantId) throw new AppError(400, 'VALIDATION_001', `Variante requise pour ${dish.name}`);
        const variant = dish.variants.find((v) => v.id === item.variantId);
        if (!variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
        if (!variant.isActive) throw new AppError(400, 'DISH_002', `${dish.name} (${variant.name}) indisponible`);
        variantId = variant.id;
        variantName = variant.name;
        recipe = variant.ingredients;
      }
    } else if (item.variantId) {
      const variant = dish.variants.find((v) => v.id === item.variantId);
      if (!variant) throw new AppError(404, 'DISH_001', `Variante introuvable pour ${dish.name}`);
      if (!variant.isActive) throw new AppError(400, 'DISH_002', `${dish.name} (${variant.name}) indisponible`);
      if (variant.price == null) throw new AppError(400, 'VALIDATION_001', `Variante sans prix sur plat fixe`);
      unitPrice = variant.price;
      variantId = variant.id;
      variantName = variant.name;
      recipe = variant.ingredients;
    } else if (activeVariants.length > 0) {
      throw new AppError(400, 'VALIDATION_001', `Variante requise pour ${dish.name}`);
    }

    for (const ing of recipe) {
      required.set(ing.stockItemId, (required.get(ing.stockItemId) ?? 0) + ing.quantityNeeded * item.quantity);
    }
    // Produit offert : sous-total 0 (gratuit) mais le stock est quand même décompté.
    const sub = item.offered ? 0 : unitPrice * item.quantity;
    subtotal += sub;
    return {
      dishId: dish.id,
      dishName: dish.name,
      dishPrice: unitPrice,
      variantId,
      variantName,
      isOffered: !!item.offered,
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

  // Remise : coupon > happy hour > remise manuelle (pas de cumul).
  let discountAmount = 0;
  let discountPercent = 0;
  let promotionId: number | undefined;
  let promoLabel: string | undefined;
  let couponToConsume: number | undefined;

  if (input.couponCode) {
    const coupon = await findValidCoupon(input.couponCode.trim());
    if (coupon.discountType === 'percent') discountPercent = coupon.discountValue;
    else discountAmount = coupon.discountValue;
    promotionId = coupon.id;
    promoLabel = `Coupon ${coupon.code}`;
    couponToConsume = coupon.id;
  } else {
    const hh = await findActiveHappyHour();
    if (hh) {
      if (hh.discountType === 'percent') discountPercent = hh.discountValue;
      else discountAmount = hh.discountValue;
      promotionId = hh.id;
      promoLabel = `Happy hour (${hh.name})`;
    } else {
      // Remise manuelle : soumise au plafond configurable.
      discountAmount = input.discountAmount ?? 0;
      discountPercent = input.discountPercent ?? 0;
      if (discountAmount > 0 || discountPercent > 0) {
        const cap = await getMaxDiscountPercent();
        const effectivePct = discountPercent > 0 ? discountPercent : total > 0 ? (discountAmount / total) * 100 : 0;
        if (effectivePct > cap) {
          throw new AppError(400, 'VALIDATION_001', `Remise supérieure au plafond autorisé (${cap}%)`);
        }
      }
    }
  }

  const finalTotal = computeFinalTotal(total, discountAmount, discountPercent);

  // Pourboire : uniquement si la commande est encaissée maintenant ; jamais ajouté au total.
  const hasPaymentInput = !!(input.payments?.length || input.paymentMethod);
  const tipAmount = hasPaymentInput ? Math.max(0, Math.round(input.tipAmount ?? 0)) : 0;
  const tipMethod = tipAmount > 0 ? input.tipMethod ?? (input.paymentMethod as PaymentMethod | undefined) ?? null : null;

  // Résoudre les splits de paiement. Le due pour createOrder = finalTotal (pas d'acompte ici).
  const pay = resolvePayments(input, finalTotal);

  // Paiement immédiat en espèces : une caisse ouverte est requise ; on lie la session.
  const cashSessionId = pay.hasPayment
    ? (pay.hasCash ? await resolveCashSessionForPayment(userId, 'espèces') : null)
    : null;

  // restaurantId du tenant courant (nécessaire pour les lignes OrderPayment dans la tx).
  const restaurantId = pay.hasPayment ? getTenantIdOrThrow() : null;

  const order = await prisma.$transaction(async (tx) => {
    const orderNumber = await generateOrderNumber(tx);
    const created = await tx.order.create({
      data: {
        orderNumber,
        total,
        discountAmount,
        discountPercent,
        finalTotal,
        paymentMethod: pay.hasPayment ? pay.summaryMethod : null,
        paymentDetails: (input.paymentDetails as Prisma.InputJsonValue) ?? undefined,
        mobileMoneyProvider: pay.mobileMoneyProvider ?? null,
        cashGiven: pay.cashGiven ?? null,
        changeReturned: pay.changeReturned ?? null,
        channel: input.channel ?? 'sur_place',
        deliveryPlatform: input.channel === 'livraison' ? input.deliveryPlatform ?? null : null,
        customerName: input.customerName?.trim() || null,
        customerPhone: input.customerPhone?.trim() || null,
        promotionId: promotionId ?? null,
        promoLabel: promoLabel ?? null,
        tipAmount,
        tipMethod,
        isPaid: pay.hasPayment,
        paidAt: pay.hasPayment ? new Date() : null,
        cashSessionId,
        status: 'commandée',
        tableId: input.tableId ?? null,
        serverId: input.serverId ?? null,
        createdBy: userId,
        isSynced: markSynced,
        items: { create: orderItemsData },
      },
      include: orderInclude,
    });

    // Lignes OrderPayment (source de vérité des encaissements). Absentes si commande différée.
    if (pay.hasPayment && pay.splits.length > 0 && restaurantId != null) {
      await tx.orderPayment.createMany({
        data: pay.splits.map((s) => ({
          orderId: created.id,
          method: s.method,
          amount: s.amount,
          mobileMoneyProvider: s.mobileMoneyProvider ?? null,
          cashGiven: s.cashGiven ?? null,
          changeReturned: s.changeReturned ?? null,
          restaurantId,
        })),
      });
    }

    // Comptabilise l'utilisation du coupon.
    if (couponToConsume) {
      await tx.promotion.update({ where: { id: couponToConsume }, data: { usedCount: { increment: 1 } } });
    }

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
  // Commande prise par un serveur (non payée) : prévenir la caisse qu'il y a une addition à encaisser.
  if (order.serverId && !order.isPaid) {
    await createNotification({
      userRole: 'caissier',
      title: 'Commande à encaisser',
      message: `Commande ${order.orderNumber} (serveur) à régler à la caisse`,
      type: 'nouvelle_commande',
      relatedOrderId: order.id,
    });
  }
  emitStatsUpdated({ lastOrderNumber: order.orderNumber, finalTotal: order.finalTotal });

  // Journal d'audit : remise appliquée à la création, puis paiement immédiat (§C).
  if (discountAmount > 0 || discountPercent > 0) {
    await logAudit({
      userId,
      action: 'remise',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, discountAmount, discountPercent, finalTotal },
    });
  }
  if (pay.hasPayment) {
    await logAudit({
      userId,
      action: 'paiement',
      entityType: 'order',
      entityId: order.id,
      details: { orderNumber: order.orderNumber, amount: order.finalTotal, method: pay.summaryMethod },
    });
  }

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

// Annulation : restaure le stock (§13.2 regle 4). Validation manager (PIN) exigée pour le caissier.
export async function cancelOrder(id: number, reason: string, userId?: number, role?: Role, pin?: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');
  if (order.status === 'servie') throw new AppError(400, 'ORDER_002', 'Commande déjà servie');
  if (order.status === 'annulée') throw new AppError(400, 'ORDER_002', 'Commande déjà annulée');

  const validatedByPin = await verifyManagerApproval(role, pin);

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
      data: { status: 'annulée', cancelledAt: new Date(), cancelledBy: userId ?? null, cancellationReason: reason },
    });
  });

  await logAudit({
    userId,
    action: 'annulation',
    entityType: 'order',
    entityId: id,
    details: { orderNumber: order.orderNumber, reason, wasPaid: order.isPaid, validatedByPin },
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
  paymentMethod: PaymentMethod | undefined,
  paymentDetails?: { mobileMoneyProvider?: MobileMoneyProvider; cashGiven?: number; changeReturned?: number },
  userId?: number,
  tip?: { amount?: number; method?: PaymentMethod },
  payments?: PaymentSplit[]
) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');
  if (order.status === 'annulée') throw new AppError(400, 'ORDER_002', 'Commande annulée');
  if (order.isPaid) throw new AppError(400, 'ORDER_002', 'Commande déjà payée');

  // Pourboire (hors total) : hors splits, traité séparément.
  const tipAmount = Math.max(0, Math.round(tip?.amount ?? 0));
  const tipMethod = tipAmount > 0 ? tip?.method ?? paymentMethod ?? null : null;

  // Les splits encaissent le finalTotal (hors pourboire) ; le pourboire est porté séparément sur l'Order.
  const dueSplits = order.finalTotal;

  const pay = resolvePayments({ payments, paymentMethod, paymentDetails }, dueSplits);
  if (!pay.hasPayment) {
    throw new AppError(400, 'VALIDATION_001', 'Moyen de paiement requis');
  }

  // Espèces : une caisse doit être ouverte ; on lie la commande à la session.
  const cashSessionId = pay.hasCash
    ? await resolveCashSessionForPayment(userId, 'espèces')
    : null;

  // restaurantId pour les lignes OrderPayment dans la transaction.
  const restaurantId = getTenantIdOrThrow();

  const updated = await prisma.$transaction(async (tx) => {
    const o = await tx.order.update({
      where: { id },
      data: {
        isPaid: true,
        paidAt: new Date(),
        paymentMethod: pay.summaryMethod,
        cashSessionId,
        tipAmount,
        tipMethod,
        mobileMoneyProvider: pay.mobileMoneyProvider ?? null,
        cashGiven: pay.cashGiven ?? null,
        changeReturned: pay.changeReturned ?? null,
      },
      include: orderInclude,
    });

    // Lignes OrderPayment.
    if (pay.splits.length > 0) {
      await tx.orderPayment.createMany({
        data: pay.splits.map((s) => ({
          orderId: id,
          method: s.method,
          amount: s.amount,
          mobileMoneyProvider: s.mobileMoneyProvider ?? null,
          cashGiven: s.cashGiven ?? null,
          changeReturned: s.changeReturned ?? null,
          restaurantId,
        })),
      });
    }

    return o;
  });

  await logAudit({
    userId,
    action: 'paiement',
    entityType: 'order',
    entityId: id,
    details: { orderNumber: updated.orderNumber, amount: updated.finalTotal, method: pay.summaryMethod },
  });
  emitStatsUpdated({ orderNumber: updated.orderNumber, paid: true });
  return updated;
}

// Remboursement d'une commande déjà payée (§G). Ne restaure pas le stock (plat consommé).
// Validation manager (PIN) exigée pour le caissier.
export async function refundOrder(id: number, reason: string, userId?: number, role?: Role, pin?: string) {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new AppError(404, 'ORDER_001');
  if (!order.isPaid) throw new AppError(400, 'ORDER_003');
  if (order.isRefunded) throw new AppError(400, 'ORDER_004');

  const validatedByPin = await verifyManagerApproval(role, pin);

  // Charger les lignes de paiement pour les inclure dans l'audit.
  const payments = await prisma.orderPayment.findMany({
    where: { orderId: id },
    select: { method: true, amount: true },
  });

  const updated = await prisma.order.update({
    where: { id },
    data: {
      isRefunded: true,
      refundedAt: new Date(),
      refundedBy: userId ?? null,
      refundReason: reason,
    },
    include: orderInclude,
  });
  await logAudit({
    userId,
    action: 'remboursement',
    entityType: 'order',
    entityId: id,
    details: {
      orderNumber: updated.orderNumber,
      amount: updated.finalTotal,
      method: updated.paymentMethod,
      payments: payments.map((p) => ({ method: p.method, amount: p.amount })),
      reason,
      validatedByPin,
    },
  });
  emitStatsUpdated({ orderNumber: updated.orderNumber, refunded: true });
  return updated;
}
