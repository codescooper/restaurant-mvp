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

async function sumSales(start: Date, end: Date) {
  const result = await prisma.order.aggregate({
    _sum: { finalTotal: true },
    _count: true,
    where: { ...NON_CANCELLED, createdAt: { gte: start, lt: end } },
  });
  return { total: result._sum.finalTotal ?? 0, count: result._count };
}

function growth(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export async function getDashboard(period: Period) {
  const { start, end, prevStart, prevEnd } = getRange(period);

  const orders = await prisma.order.findMany({
    where: { ...NON_CANCELLED, createdAt: { gte: start, lt: end } },
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  const current = { total: orders.reduce((s, o) => s + o.finalTotal, 0), count: orders.length };
  const previous = await sumSales(prevStart, prevEnd);

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
    salesByHour,
    topDishes,
    paymentMethods,
    recentOrders,
  };
}

export type DashboardData = Awaited<ReturnType<typeof getDashboard>>;
