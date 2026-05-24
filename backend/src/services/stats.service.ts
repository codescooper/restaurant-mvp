import {
  startOfDay,
  startOfWeek,
  startOfMonth,
  subDays,
  subWeeks,
  subMonths,
  getHours,
} from 'date-fns';
import { prisma } from '../config/prisma';

export type Period = 'today' | 'week' | 'month';

interface Range {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

function getRange(period: Period): Range {
  const now = new Date();
  switch (period) {
    case 'week': {
      const start = startOfWeek(now, { weekStartsOn: 1 });
      return { start, end: now, prevStart: subWeeks(start, 1), prevEnd: start };
    }
    case 'month': {
      const start = startOfMonth(now);
      return { start, end: now, prevStart: subMonths(start, 1), prevEnd: start };
    }
    case 'today':
    default: {
      const start = startOfDay(now);
      return { start, end: now, prevStart: subDays(start, 1), prevEnd: start };
    }
  }
}

const NON_CANCELLED = { status: { not: 'annulée' } };

// Coût de revient d'une recette = Σ (quantité × coût unitaire de l'ingrédient), arrondi au FCFA.
function recipeCost(ings: { quantityNeeded: number; stockItem: { unitCost: number } }[]): number {
  return Math.round(ings.reduce((s, i) => s + i.quantityNeeded * (i.stockItem?.unitCost ?? 0), 0));
}

function growth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboard(period: Period) {
  const { start, end, prevStart, prevEnd } = getRange(period);

  const orders = await prisma.order.findMany({
    where: { ...NON_CANCELLED, createdAt: { gte: start, lt: end } },
    include: { items: true, server: { select: { username: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const current = { total: orders.reduce((s, o) => s + o.finalTotal, 0), count: orders.length };

  // Coûts de revient (recettes & coûts unitaires actuels), dépenses, pertes — pour la rentabilité.
  const [stockItems, dishesForCost, prevOrders, expenseSum, prevExpenseSum, expenseByCat, lossMovements, prevLossMovements] =
    await Promise.all([
      prisma.stockItem.findMany({ select: { id: true, unitCost: true } }),
      prisma.dish.findMany({
        include: {
          ingredients: { include: { stockItem: { select: { unitCost: true } } } },
          variants: { include: { ingredients: { include: { stockItem: { select: { unitCost: true } } } } } },
        },
      }),
      prisma.order.findMany({ where: { ...NON_CANCELLED, createdAt: { gte: prevStart, lt: prevEnd } }, include: { items: true } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: start, lt: end } } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: prevStart, lt: prevEnd } } }),
      prisma.expense.groupBy({ by: ['category'], _sum: { amount: true }, where: { expenseDate: { gte: start, lt: end } } }),
      prisma.stockMovement.findMany({ where: { movementType: 'perte', createdAt: { gte: start, lt: end } }, select: { quantity: true, stockItemId: true } }),
      prisma.stockMovement.findMany({ where: { movementType: 'perte', createdAt: { gte: prevStart, lt: prevEnd } }, select: { quantity: true, stockItemId: true } }),
    ]);

  const stockCost = new Map(stockItems.map((s) => [s.id, s.unitCost]));
  const dishCost = new Map<number, number>();
  const variantCost = new Map<number, number>();
  for (const d of dishesForCost) {
    dishCost.set(d.id, recipeCost(d.ingredients));
    for (const v of d.variants) variantCost.set(v.id, recipeCost(v.ingredients));
  }
  // Coût matière (COGS) = coût de revient des plats/variantes réellement vendus (offerts inclus : la matière est consommée).
  const cogsOf = (list: { items: { variantId: number | null; dishId: number; quantity: number }[] }[]) =>
    list.reduce(
      (sum, o) => sum + o.items.reduce((s, it) => s + (it.variantId ? variantCost.get(it.variantId) ?? 0 : dishCost.get(it.dishId) ?? 0) * it.quantity, 0),
      0
    );
  const lossOf = (movs: { quantity: number; stockItemId: number }[]) =>
    Math.round(movs.reduce((s, m) => s + Math.abs(m.quantity) * (stockCost.get(m.stockItemId) ?? 0), 0));

  const previous = { total: prevOrders.reduce((s, o) => s + o.finalTotal, 0), count: prevOrders.length };

  const cogs = cogsOf(orders);
  const prevCogs = cogsOf(prevOrders);
  const lossValue = lossOf(lossMovements);
  const prevLossValue = lossOf(prevLossMovements);
  const totalExpenses = expenseSum._sum.amount ?? 0;
  const previousExpenses = prevExpenseSum._sum.amount ?? 0;

  const grossMargin = current.total - cogs; // marge brute (avant pertes & charges)
  const grossMarginPct = current.total ? Math.round((grossMargin / current.total) * 100) : 0;
  const foodCostPct = current.total ? Math.round((cogs / current.total) * 100) : 0;
  const netProfit = current.total - cogs - lossValue - totalExpenses;
  const previousNetProfit = previous.total - prevCogs - prevLossValue - previousExpenses;

  const expensesByCategory = expenseByCat
    .map((e) => ({ category: e.category, amount: e._sum.amount ?? 0 }))
    .sort((a, b) => b.amount - a.amount);

  // Marge par plat (plats actifs ; variantes listées séparément ; plats à prix libre exclus car sans prix fixe).
  const dishMargins: { name: string; cost: number; price: number; marginPct: number }[] = [];
  for (const d of dishesForCost) {
    if (!d.isActive) continue;
    const activeVariants = d.variants.filter((v) => v.isActive);
    if (activeVariants.length) {
      for (const v of activeVariants) {
        const cost = variantCost.get(v.id) ?? 0;
        dishMargins.push({ name: `${d.name} (${v.name})`, cost, price: v.price, marginPct: v.price ? Math.round(((v.price - cost) / v.price) * 100) : 0 });
      }
    } else if (d.priceType !== 'libre') {
      const cost = dishCost.get(d.id) ?? 0;
      dishMargins.push({ name: d.name, cost, price: d.price, marginPct: d.price ? Math.round(((d.price - cost) / d.price) * 100) : 0 });
    }
  }
  dishMargins.sort((a, b) => a.marginPct - b.marginPct);

  const averageTicket = current.count ? Math.round(current.total / current.count) : 0;
  const previousTicket = previous.count ? Math.round(previous.total / previous.count) : 0;

  // Ventes par heure (8h -> 20h).
  const hours: Record<number, { amount: number; orders: number }> = {};
  for (let h = 8; h <= 20; h++) hours[h] = { amount: 0, orders: 0 };
  for (const o of orders) {
    const h = getHours(o.createdAt);
    if (hours[h]) {
      hours[h].amount += o.finalTotal;
      hours[h].orders += 1;
    }
  }
  const salesByHour = Object.entries(hours).map(([h, v]) => ({
    hour: `${h.padStart(2, '0')}h`,
    amount: v.amount,
    orders: v.orders,
  }));
  const peak = salesByHour.reduce((max, s) => (s.amount > max.amount ? s : max), salesByHour[0] ?? { hour: '-', amount: 0, orders: 0 });

  // Top plats.
  const dishAgg = new Map<string, { quantity: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = dishAgg.get(it.dishName) ?? { quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.subtotal;
      dishAgg.set(it.dishName, cur);
    }
  }
  const totalDishRevenue = [...dishAgg.values()].reduce((s, d) => s + d.revenue, 0);
  const topDishes = [...dishAgg.entries()]
    .map(([name, v]) => ({
      name,
      quantity: v.quantity,
      revenue: v.revenue,
      percentage: totalDishRevenue ? Math.round((v.revenue / totalDishRevenue) * 100) : 0,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  // Modes de paiement (uniquement les commandes payées).
  const payAgg = new Map<string, { count: number; amount: number }>();
  let paidCount = 0;
  for (const o of orders) {
    if (!o.paymentMethod) continue;
    paidCount += 1;
    const cur = payAgg.get(o.paymentMethod) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += o.finalTotal;
    payAgg.set(o.paymentMethod, cur);
  }
  const paymentMethods = [...payAgg.entries()].map(([method, v]) => ({
    method,
    count: v.count,
    amount: v.amount,
    percentage: paidCount ? Math.round((v.count / paidCount) * 100) : 0,
  }));

  // Répartition des ventes par canal (sur place / emporter / livraison).
  const channelAgg = new Map<string, { count: number; amount: number }>();
  for (const o of orders) {
    const ch = o.channel ?? 'sur_place';
    const cur = channelAgg.get(ch) ?? { count: 0, amount: 0 };
    cur.count += 1;
    cur.amount += o.finalTotal;
    channelAgg.set(ch, cur);
  }
  const salesByChannel = [...channelAgg.entries()].map(([channel, v]) => ({
    channel,
    count: v.count,
    amount: v.amount,
    percentage: current.count ? Math.round((v.count / current.count) * 100) : 0,
  }));

  // Pourboires (hors CA) : total + répartition par serveur (« Maison » = sans serveur) et par méthode.
  const tipped = orders.filter((o) => (o.tipAmount ?? 0) > 0);
  const tipsTotal = tipped.reduce((s, o) => s + o.tipAmount, 0);
  const tipByServer = new Map<string, number>();
  const tipByMethod = new Map<string, number>();
  for (const o of tipped) {
    const who = o.server?.username ?? 'Maison';
    tipByServer.set(who, (tipByServer.get(who) ?? 0) + o.tipAmount);
    const m = o.tipMethod ?? 'inconnu';
    tipByMethod.set(m, (tipByMethod.get(m) ?? 0) + o.tipAmount);
  }
  const tips = {
    total: tipsTotal,
    byServer: [...tipByServer.entries()].map(([server, amount]) => ({ server, amount })).sort((a, b) => b.amount - a.amount),
    byMethod: [...tipByMethod.entries()].map(([method, amount]) => ({ method, amount })).sort((a, b) => b.amount - a.amount),
  };

  // Commandes recentes (toutes, y compris annulees, 5 dernieres).
  const recent = await prisma.order.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { items: true },
  });
  const recentOrders = recent.map((o) => ({
    orderNumber: o.orderNumber,
    time: o.createdAt,
    amount: o.finalTotal,
    items: o.items.reduce((s, i) => s + i.quantity, 0),
    status: o.status,
  }));

  return {
    totalSales: current.total,
    totalOrders: current.count,
    averageTicket,
    peakHour: peak.hour,
    peakHourSales: peak.amount,
    previousPeriodSales: previous.total,
    previousPeriodOrders: previous.count,
    previousPeriodTicket: previousTicket,
    salesGrowth: growth(current.total, previous.total),
    ordersGrowth: growth(current.count, previous.count),
    ticketGrowth: growth(averageTicket, previousTicket),
    totalExpenses,
    previousPeriodExpenses: previousExpenses,
    expensesGrowth: growth(totalExpenses, previousExpenses),
    foodCost: cogs,
    foodCostPct,
    grossMargin,
    grossMarginPct,
    lossValue,
    netProfit,
    previousNetProfit,
    profitGrowth: growth(netProfit, previousNetProfit),
    expensesByCategory,
    dishMargins,
    salesByHour,
    topDishes,
    paymentMethods,
    salesByChannel,
    tips,
    recentOrders,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
