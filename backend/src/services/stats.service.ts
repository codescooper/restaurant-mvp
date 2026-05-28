import {
  startOfDay,
  endOfDay,
  getHours,
  format as formatDate,
} from 'date-fns';
import { prisma } from '../config/prisma';
import { STOCK_PURCHASE_CATEGORY } from '../constants';
import { getRestaurantName } from './settings.service';

export interface Range {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
}

// Construit la plage à partir de deux dates fournies par le caller.
// `prevEnd = start`, `prevStart = start − (end − start)` (période précédente de même durée).
// NOTE: date-fns startOfDay utilise le fuseau du process. Railway tourne en UTC par défaut,
// hypothèse à préserver — sinon le delta start↔end+24h peut ne pas être exactement 24 h.
export function getRangeFromDates(from: Date, to: Date): Range {
  const start = startOfDay(from);
  // On considère `to` inclusif jusqu'à la fin de la journée.
  const end = new Date(to.getTime() + 24 * 60 * 60 * 1000); // = lendemain à 00:00 (borne exclusive)
  const durationMs = end.getTime() - start.getTime();
  const prevEnd = start;
  const prevStart = new Date(start.getTime() - durationMs);
  return { start, end, prevStart, prevEnd };
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

export async function getDashboard(range: Range) {
  const { start, end, prevStart, prevEnd } = range;

  const orders = await prisma.order.findMany({
    where: { ...NON_CANCELLED, createdAt: { gte: start, lt: end } },
    include: { items: true, server: { select: { displayName: true } } },
    orderBy: { createdAt: 'desc' },
  });

  const current = { total: orders.reduce((s, o) => s + o.finalTotal, 0), count: orders.length };

  // Charges = dépenses hors achats de stock (l'approvisionnement est compté via le coût matière, pas ici).
  const chargesOnly = { category: { not: STOCK_PURCHASE_CATEGORY } };

  // Coûts de revient (recettes & coûts unitaires actuels), charges, achats stock, pertes — pour la rentabilité.
  const [stockItems, dishesForCost, prevOrders, expenseSum, prevExpenseSum, expenseByCat, stockPurchaseSum, prevStockPurchaseSum, lossMovements, prevLossMovements] =
    await Promise.all([
      prisma.stockItem.findMany({ select: { id: true, unitCost: true } }),
      prisma.dish.findMany({
        include: {
          ingredients: { include: { stockItem: { select: { unitCost: true } } } },
          variants: { include: { ingredients: { include: { stockItem: { select: { unitCost: true } } } } } },
        },
      }),
      prisma.order.findMany({ where: { ...NON_CANCELLED, createdAt: { gte: prevStart, lt: prevEnd } }, include: { items: true } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: start, lt: end }, ...chargesOnly } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: prevStart, lt: prevEnd }, ...chargesOnly } }),
      prisma.expense.groupBy({ by: ['category'], _sum: { amount: true }, where: { expenseDate: { gte: start, lt: end }, ...chargesOnly } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: start, lt: end }, category: STOCK_PURCHASE_CATEGORY } }),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { expenseDate: { gte: prevStart, lt: prevEnd }, category: STOCK_PURCHASE_CATEGORY } }),
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
  // Achats de stock (trésorerie) : affichés pour info, hors bénéfice net (déjà comptés via le coût matière).
  const stockPurchases = stockPurchaseSum._sum.amount ?? 0;
  const previousStockPurchases = prevStockPurchaseSum._sum.amount ?? 0;

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
        if (v.price == null) continue; // variantes sur plat libre : pas de prix propre
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

  // Modes de paiement (ventilation réelle via OrderPayment — commandes payées, non remboursées, non annulées).
  // Le where aligne exactement sur la sélection des commandes payées de la période : même filtre createdAt
  // que le fetch principal, plus isPaid:true, isRefunded:false, status != 'annulée'.
  // Le pourcentage est calculé sur le montant total encaissé (plus juste que le count quand un paiement
  // mixte génère plusieurs lignes pour une seule commande — comparer des montants est la sémantique métier).
  const payAggRaw = await prisma.orderPayment.groupBy({
    by: ['method'],
    _sum: { amount: true },
    _count: { id: true },
    where: {
      order: {
        ...NON_CANCELLED,
        createdAt: { gte: start, lt: end },
        isPaid: true,
        isRefunded: false,
      },
    },
  });
  const totalPayAmount = payAggRaw.reduce((s, r) => s + (r._sum.amount ?? 0), 0);
  const paymentMethods = payAggRaw
    .map((r) => ({
      method: r.method,
      count: r._count.id,
      amount: r._sum.amount ?? 0,
      percentage: totalPayAmount ? Math.round(((r._sum.amount ?? 0) / totalPayAmount) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

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
    const who = o.server?.displayName ?? 'Maison';
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
    stockPurchases,
    previousStockPurchases,
    stockPurchasesGrowth: growth(stockPurchases, previousStockPurchases),
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

// ─────────────────────────────────────────────────────────────────────────────
// Rapport financier sur une plage de dates (du … au …) — synthèse trésorerie.
// Logique « caisse » (recettes − toutes dépenses) ET bénéfice net (recettes −
// coût matière − pertes − charges) côte à côte. Sert au PDF/CSV téléchargeable.
// ─────────────────────────────────────────────────────────────────────────────

export interface FinancialReport {
  restaurantName: string;
  start: Date;
  end: Date;
  // Section 1 — dépenses enregistrées (toutes catégories, achats stock inclus).
  expenses: { date: Date; label: string; category: string; amount: number }[];
  totalExpenses: number;
  // Section 2 — recettes par jour (chiffre d'affaires des commandes non annulées).
  revenues: { date: Date; amount: number; orders: number }[];
  totalRevenue: number;
  ordersCount: number;
  // Section 3 — résultat.
  simpleProfit: number; // recettes − total dépenses (logique caisse)
  netProfit: number; // recettes − coût matière − pertes − charges
  cogs: number; // coût matière des plats vendus
  lossValue: number; // pertes valorisées
  charges: number; // dépenses hors approvisionnement
  stockPurchases: number; // dépenses d'approvisionnement (achats stock)
  // Section 4 — observations.
  bestDays: { date: Date; amount: number }[];
  topDishes: { name: string; quantity: number; revenue: number }[];
  topExpenseCategories: { category: string; amount: number }[];
}

const dayKey = (d: Date) => formatDate(d, 'yyyy-MM-dd');

export async function getFinancialReport(startInput: Date, endInput: Date): Promise<FinancialReport> {
  const start = startOfDay(startInput);
  const end = endOfDay(endInput);

  const [restaurantName, orders, expenses, stockItems, dishesForCost, lossMovements] = await Promise.all([
    getRestaurantName(),
    prisma.order.findMany({
      where: { ...NON_CANCELLED, createdAt: { gte: start, lte: end } },
      include: { items: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.expense.findMany({
      where: { expenseDate: { gte: start, lte: end } },
      orderBy: { expenseDate: 'asc' },
    }),
    prisma.stockItem.findMany({ select: { id: true, unitCost: true } }),
    prisma.dish.findMany({
      include: {
        ingredients: { include: { stockItem: { select: { unitCost: true } } } },
        variants: { include: { ingredients: { include: { stockItem: { select: { unitCost: true } } } } } },
      },
    }),
    prisma.stockMovement.findMany({
      where: { movementType: 'perte', createdAt: { gte: start, lte: end } },
      select: { quantity: true, stockItemId: true },
    }),
  ]);

  // Coûts de revient (recettes & coûts unitaires actuels) — pour le coût matière (COGS).
  const stockCost = new Map(stockItems.map((s) => [s.id, s.unitCost]));
  const dishCost = new Map<number, number>();
  const variantCost = new Map<number, number>();
  for (const d of dishesForCost) {
    dishCost.set(d.id, recipeCost(d.ingredients));
    for (const v of d.variants) variantCost.set(v.id, recipeCost(v.ingredients));
  }
  const cogs = orders.reduce(
    (sum, o) =>
      sum +
      o.items.reduce(
        (s, it) => s + (it.variantId ? variantCost.get(it.variantId) ?? 0 : dishCost.get(it.dishId) ?? 0) * it.quantity,
        0
      ),
    0
  );
  const lossValue = Math.round(
    lossMovements.reduce((s, m) => s + Math.abs(m.quantity) * (stockCost.get(m.stockItemId) ?? 0), 0)
  );

  // Section 1 — dépenses.
  const expenseRows = expenses.map((e) => ({
    date: e.expenseDate,
    label: e.label,
    category: e.category,
    amount: e.amount,
  }));
  const totalExpenses = expenseRows.reduce((s, e) => s + e.amount, 0);
  const stockPurchases = expenseRows
    .filter((e) => e.category === STOCK_PURCHASE_CATEGORY)
    .reduce((s, e) => s + e.amount, 0);
  const charges = totalExpenses - stockPurchases;

  // Section 2 — recettes par jour (uniquement les jours avec des ventes).
  const revByDay = new Map<string, { date: Date; amount: number; orders: number }>();
  for (const o of orders) {
    const day = startOfDay(o.createdAt);
    const key = dayKey(day);
    const cur = revByDay.get(key) ?? { date: day, amount: 0, orders: 0 };
    cur.amount += o.finalTotal;
    cur.orders += 1;
    revByDay.set(key, cur);
  }
  const revenues = [...revByDay.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
  const totalRevenue = revenues.reduce((s, r) => s + r.amount, 0);

  // Section 3 — résultats.
  const simpleProfit = totalRevenue - totalExpenses;
  const netProfit = totalRevenue - cogs - lossValue - charges;

  // Section 4 — observations.
  const bestDays = [...revenues].sort((a, b) => b.amount - a.amount).slice(0, 3);

  const dishAgg = new Map<string, { quantity: number; revenue: number }>();
  for (const o of orders) {
    for (const it of o.items) {
      const cur = dishAgg.get(it.dishName) ?? { quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.subtotal;
      dishAgg.set(it.dishName, cur);
    }
  }
  const topDishes = [...dishAgg.entries()]
    .map(([name, v]) => ({ name, quantity: v.quantity, revenue: v.revenue }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  const catAgg = new Map<string, number>();
  for (const e of expenseRows) catAgg.set(e.category, (catAgg.get(e.category) ?? 0) + e.amount);
  const topExpenseCategories = [...catAgg.entries()]
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount);

  return {
    restaurantName,
    start,
    end,
    expenses: expenseRows,
    totalExpenses,
    revenues,
    totalRevenue,
    ordersCount: orders.length,
    simpleProfit,
    netProfit,
    cogs,
    lossValue,
    charges,
    stockPurchases,
    bestDays,
    topDishes,
    topExpenseCategories,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Rapport des ventes par produit sur une plage de dates — performance produit.
// Agrège chaque produit réellement vendu (plat + variante) : quantité & revenu,
// regroupés par catégorie de menu. Chiffres exacts (pas d'estimation).
// ─────────────────────────────────────────────────────────────────────────────

const UNCLASSIFIED = 'Non classé';

export interface ProductLine {
  name: string;
  category: string;
  quantity: number;
  revenue: number;
}

export interface ProductReport {
  restaurantName: string;
  start: Date;
  end: Date;
  // Une section par catégorie ayant des ventes (triées par revenu décroissant).
  categories: { category: string; quantity: number; revenue: number; products: ProductLine[] }[];
  totalQuantity: number;
  totalRevenue: number;
  // Observations (data uniquement).
  topByRevenue: ProductLine[];
  topByQuantity: ProductLine[];
}

export async function getProductReport(startInput: Date, endInput: Date): Promise<ProductReport> {
  const start = startOfDay(startInput);
  const end = endOfDay(endInput);

  const [restaurantName, orders, dishes] = await Promise.all([
    getRestaurantName(),
    prisma.order.findMany({
      where: { ...NON_CANCELLED, createdAt: { gte: start, lte: end } },
      include: { items: true },
    }),
    prisma.dish.findMany({ select: { id: true, category: true } }),
  ]);

  const catOf = new Map(dishes.map((d) => [d.id, d.category ?? UNCLASSIFIED]));

  // Agrégation par produit (clé = nom du plat + variante éventuelle).
  const agg = new Map<string, ProductLine>();
  for (const o of orders) {
    for (const it of o.items) {
      const name = it.variantName ? `${it.dishName} (${it.variantName})` : it.dishName;
      const category = catOf.get(it.dishId) ?? UNCLASSIFIED;
      const cur = agg.get(name) ?? { name, category, quantity: 0, revenue: 0 };
      cur.quantity += it.quantity;
      cur.revenue += it.subtotal;
      agg.set(name, cur);
    }
  }
  const products = [...agg.values()];

  // Regroupement par catégorie.
  const byCat = new Map<string, { category: string; quantity: number; revenue: number; products: ProductLine[] }>();
  for (const p of products) {
    const cur = byCat.get(p.category) ?? { category: p.category, quantity: 0, revenue: 0, products: [] };
    cur.quantity += p.quantity;
    cur.revenue += p.revenue;
    cur.products.push(p);
    byCat.set(p.category, cur);
  }
  const categories = [...byCat.values()].sort((a, b) => b.revenue - a.revenue);
  for (const c of categories) c.products.sort((a, b) => b.revenue - a.revenue);

  const totalQuantity = products.reduce((s, p) => s + p.quantity, 0);
  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);

  const topByRevenue = [...products].sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topByQuantity = [...products].sort((a, b) => b.quantity - a.quantity).slice(0, 5);

  return {
    restaurantName,
    start,
    end,
    categories,
    totalQuantity,
    totalRevenue,
    topByRevenue,
    topByQuantity,
  };
}
