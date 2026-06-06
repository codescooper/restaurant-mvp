// ─────────────────────────────────────────────────────────────────────────────
// Budget d'approvisionnement — service de données : collecte des signaux (achats,
// rotation, seuils), génération de proposition (moteur déterministe), persistance
// (CRUD en transaction) et suivi budget vs achats réels.
// Montants en entiers FCFA. Scoping tenant automatique (extension Prisma).
// ─────────────────────────────────────────────────────────────────────────────
import { subMonths } from 'date-fns';
import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import {
  DEFAULT_BUDGET_CONFIG,
  BudgetConfig,
  SETTING_BUDGET_CONFIG,
  BUDGET_DEFAULT_POSTE,
} from '../constants';
import { getSetting, setSetting } from './settings.service';
import { computeAllocation, DemandSignal, BudgetProposal } from './budget-engine.service';

const NON_CANCELLED = { status: { not: 'annulée' } };

// Arborescence complète (sections → postes → lignes) triée pour l'affichage.
const budgetInclude = {
  sections: {
    orderBy: { sortOrder: 'asc' as const },
    include: {
      postes: {
        orderBy: { sortOrder: 'asc' as const },
        include: { lines: { orderBy: { sortOrder: 'asc' as const } } },
      },
    },
  },
} as const;

// ── Configuration du moteur (réglage par restaurant via app_settings) ──────────
export async function getBudgetConfig(): Promise<BudgetConfig> {
  const raw = await getSetting(SETTING_BUDGET_CONFIG);
  if (!raw) return DEFAULT_BUDGET_CONFIG;
  try {
    const p = JSON.parse(raw) as Partial<BudgetConfig>;
    return {
      reservePercent: p.reservePercent ?? DEFAULT_BUDGET_CONFIG.reservePercent,
      historyMonths: p.historyMonths ?? DEFAULT_BUDGET_CONFIG.historyMonths,
      weights: { ...DEFAULT_BUDGET_CONFIG.weights, ...(p.weights ?? {}) },
    };
  } catch {
    return DEFAULT_BUDGET_CONFIG;
  }
}

export async function setBudgetConfig(cfg: BudgetConfig): Promise<BudgetConfig> {
  await setSetting(SETTING_BUDGET_CONFIG, JSON.stringify(cfg), 'Paramètres du moteur de budget');
  return cfg;
}

// ── Collecte des signaux de demande par article ───────────────────────────────
export async function collectSignals(historyMonths: number): Promise<DemandSignal[]> {
  const months = Math.max(1, historyMonths);
  const start = subMonths(new Date(), months);

  const [stockItems, purchaseByItem, orders, dishes, recentPurchases] = await Promise.all([
    prisma.stockItem.findMany({
      select: {
        id: true,
        name: true,
        unit: true,
        unitCost: true,
        quantity: true,
        alertThreshold: true,
        budgetCategory: true,
      },
    }),
    prisma.purchase.groupBy({ by: ['stockItemId'], _sum: { totalPrice: true }, where: { createdAt: { gte: start } } }),
    prisma.order.findMany({ where: { ...NON_CANCELLED, createdAt: { gte: start } }, include: { items: true } }),
    prisma.dish.findMany({
      include: {
        ingredients: { select: { stockItemId: true, quantityNeeded: true } },
        variants: { include: { ingredients: { select: { stockItemId: true, quantityNeeded: true } } } },
      },
    }),
    prisma.purchase.findMany({
      where: { createdAt: { gte: start } },
      orderBy: { createdAt: 'desc' },
      select: { stockItemId: true, unitPrice: true },
    }),
  ]);

  const purchaseSpendOf = new Map(purchaseByItem.map((p) => [p.stockItemId, p._sum.totalPrice ?? 0]));

  // Dernier prix unitaire connu par article (achats triés du plus récent au plus ancien).
  const lastUnitPrice = new Map<number, number>();
  for (const p of recentPurchases) if (!lastUnitPrice.has(p.stockItemId)) lastUnitPrice.set(p.stockItemId, p.unitPrice);

  // Recettes : ingrédients par plat / variante.
  const dishIng = new Map<number, { stockItemId: number; quantityNeeded: number }[]>();
  const variantIng = new Map<number, { stockItemId: number; quantityNeeded: number }[]>();
  for (const d of dishes) {
    dishIng.set(d.id, d.ingredients);
    for (const v of d.variants) variantIng.set(v.id, v.ingredients);
  }

  // Consommation (unités) déduite des commandes via les recettes.
  const consumedUnits = new Map<number, number>();
  for (const o of orders) {
    for (const it of o.items) {
      const ings = it.variantId ? variantIng.get(it.variantId) : dishIng.get(it.dishId);
      if (!ings) continue;
      for (const ing of ings) {
        consumedUnits.set(ing.stockItemId, (consumedUnits.get(ing.stockItemId) ?? 0) + ing.quantityNeeded * it.quantity);
      }
    }
  }

  return stockItems.map((si) => {
    const purchaseSpend = Math.round((purchaseSpendOf.get(si.id) ?? 0) / months);
    const consumed = consumedUnits.get(si.id) ?? 0;
    const rotationSpend = Math.round((consumed * si.unitCost) / months);
    const replenishSpend =
      si.quantity < si.alertThreshold ? Math.round((si.alertThreshold - si.quantity) * si.unitCost) : 0;
    return {
      stockItemId: si.id,
      label: si.name,
      unit: si.unit,
      unitPrice: lastUnitPrice.get(si.id) ?? Math.round(si.unitCost),
      poste: si.budgetCategory?.trim() || BUDGET_DEFAULT_POSTE,
      purchaseSpend,
      rotationSpend,
      replenishSpend,
    };
  });
}

// ── Génération d'une proposition (déterministe, sans persistance) ──────────────
export interface GenerateParams {
  targetTotal: number;
  reservePercent?: number;
  historyMonths?: number;
  useHistory?: boolean;
  useRotation?: boolean;
  useThreshold?: boolean;
}

export async function generateProposal(p: GenerateParams): Promise<BudgetProposal> {
  const cfg = await getBudgetConfig();
  const historyMonths = p.historyMonths ?? cfg.historyMonths;
  const signals = await collectSignals(historyMonths);
  const weights = {
    purchases: p.useHistory === false ? 0 : cfg.weights.purchases,
    rotation: p.useRotation === false ? 0 : cfg.weights.rotation,
    threshold: p.useThreshold === false ? 0 : cfg.weights.threshold,
  };
  return computeAllocation({
    targetTotal: p.targetTotal,
    reservePercent: p.reservePercent ?? cfg.reservePercent,
    weights,
    signals,
  });
}

// ── Persistance (CRUD) ─────────────────────────────────────────────────────────
export interface BudgetLineInput {
  label: string;
  stockItemId?: number | null;
  quantity?: number | null;
  unit?: string | null;
  unitPrice?: number | null;
  amount: number;
  source?: string;
  sortOrder?: number;
}
export interface BudgetPosteInput {
  name: string;
  plannedAmount?: number;
  sortOrder?: number;
  lines?: BudgetLineInput[];
}
export interface BudgetSectionInput {
  name: string;
  sortOrder?: number;
  postes?: BudgetPosteInput[];
}
export interface BudgetInput {
  title: string;
  periodLabel: string;
  periodStart?: string | null;
  periodEnd?: string | null;
  targetTotal: number;
  reservePercent?: number;
  status?: string;
  conclusion?: string | null;
  aiSuggestions?: string | null;
  sections?: BudgetSectionInput[];
}

const toDate = (v?: string | null) => (v ? new Date(v) : null);

// Construit le bloc `sections.create` imbriqué (Prisma) à partir des sections fournies.
function nestedSections(sections: BudgetSectionInput[]) {
  return {
    create: sections.map((s, si) => ({
      name: s.name,
      sortOrder: s.sortOrder ?? si,
      postes: {
        create: (s.postes ?? []).map((p, pi) => ({
          name: p.name,
          plannedAmount: p.plannedAmount ?? 0,
          sortOrder: p.sortOrder ?? pi,
          lines: {
            create: (p.lines ?? []).map((l, li) => ({
              label: l.label,
              stockItemId: l.stockItemId ?? null,
              quantity: l.quantity ?? null,
              unit: l.unit ?? null,
              unitPrice: l.unitPrice ?? null,
              amount: l.amount,
              source: l.source ?? 'manuel',
              sortOrder: l.sortOrder ?? li,
            })),
          },
        })),
      },
    })),
  };
}

export async function listBudgets() {
  return prisma.budget.findMany({
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: {
      id: true,
      title: true,
      periodLabel: true,
      targetTotal: true,
      reservePercent: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
    },
  });
}

export async function getBudget(id: number) {
  const budget = await prisma.budget.findUnique({ where: { id }, include: budgetInclude });
  if (!budget) throw new AppError(404, 'BUDGET_001');
  return budget;
}

export async function createBudget(data: BudgetInput, actorId?: number) {
  return prisma.budget.create({
    data: {
      title: data.title.trim(),
      periodLabel: data.periodLabel.trim(),
      periodStart: toDate(data.periodStart),
      periodEnd: toDate(data.periodEnd),
      targetTotal: data.targetTotal,
      reservePercent: data.reservePercent ?? 20,
      status: data.status ?? 'brouillon',
      conclusion: data.conclusion ?? null,
      aiSuggestions: data.aiSuggestions ?? null,
      createdBy: actorId ?? null,
      sections: nestedSections(data.sections ?? []),
    },
    include: budgetInclude,
  });
}

export async function updateBudget(id: number, data: Partial<BudgetInput>, _actorId?: number) {
  await getBudget(id); // lecture scopée : vérifie l'appartenance au restaurant

  return prisma.$transaction(async (tx) => {
    await tx.budget.update({
      where: { id },
      data: {
        ...(data.title !== undefined ? { title: data.title.trim() } : {}),
        ...(data.periodLabel !== undefined ? { periodLabel: data.periodLabel.trim() } : {}),
        ...(data.periodStart !== undefined ? { periodStart: toDate(data.periodStart) } : {}),
        ...(data.periodEnd !== undefined ? { periodEnd: toDate(data.periodEnd) } : {}),
        ...(data.targetTotal !== undefined ? { targetTotal: data.targetTotal } : {}),
        ...(data.reservePercent !== undefined ? { reservePercent: data.reservePercent } : {}),
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.conclusion !== undefined ? { conclusion: data.conclusion } : {}),
        ...(data.aiSuggestions !== undefined ? { aiSuggestions: data.aiSuggestions } : {}),
      },
    });

    // Si des sections sont fournies, elles remplacent intégralement l'arborescence.
    if (data.sections) {
      await tx.budgetSection.deleteMany({ where: { budgetId: id } }); // cascade postes/lignes
      for (const [si, s] of data.sections.entries()) {
        await tx.budgetSection.create({
          data: {
            budgetId: id,
            name: s.name,
            sortOrder: s.sortOrder ?? si,
            postes: {
              create: (s.postes ?? []).map((p, pi) => ({
                name: p.name,
                plannedAmount: p.plannedAmount ?? 0,
                sortOrder: p.sortOrder ?? pi,
                lines: {
                  create: (p.lines ?? []).map((l, li) => ({
                    label: l.label,
                    stockItemId: l.stockItemId ?? null,
                    quantity: l.quantity ?? null,
                    unit: l.unit ?? null,
                    unitPrice: l.unitPrice ?? null,
                    amount: l.amount,
                    source: l.source ?? 'manuel',
                    sortOrder: l.sortOrder ?? li,
                  })),
                },
              })),
            },
          },
        });
      }
    }

    return tx.budget.findUnique({ where: { id }, include: budgetInclude });
  });
}

export async function deleteBudget(id: number, _actorId?: number) {
  await getBudget(id); // lecture scopée
  await prisma.budget.delete({ where: { id } }); // cascade sections/postes/lignes
  return { id };
}

// ── Suivi budget vs achats réels ───────────────────────────────────────────────
export interface TrackingRow {
  poste: string;
  planned: number;
  actual: number;
  diff: number; // planned − actual (positif = sous le budget)
}
export interface BudgetTracking {
  budgetId: number;
  title: string;
  periodLabel: string;
  periodStart: Date;
  periodEnd: Date;
  rows: TrackingRow[];
  totalPlanned: number;
  totalActual: number;
}

export async function getTracking(id: number): Promise<BudgetTracking> {
  const budget = await getBudget(id);
  const periodStart = budget.periodStart ?? budget.createdAt;
  const periodEnd = budget.periodEnd ?? new Date();

  // Prévu par poste (somme des postes de toutes les sections, réserve incluse).
  const planned = new Map<string, number>();
  for (const s of budget.sections) {
    for (const p of s.postes) planned.set(p.name, (planned.get(p.name) ?? 0) + p.plannedAmount);
  }

  // Réel : achats de la période regroupés par catégorie budgétaire de l'article.
  const purchases = await prisma.purchase.findMany({
    where: { createdAt: { gte: periodStart, lte: periodEnd } },
    select: { totalPrice: true, stockItem: { select: { budgetCategory: true } } },
  });
  const actual = new Map<string, number>();
  for (const p of purchases) {
    const poste = p.stockItem?.budgetCategory?.trim() || BUDGET_DEFAULT_POSTE;
    actual.set(poste, (actual.get(poste) ?? 0) + p.totalPrice);
  }

  const posteNames = new Set<string>([...planned.keys(), ...actual.keys()]);
  const rows: TrackingRow[] = [...posteNames]
    .map((poste) => {
      const pl = planned.get(poste) ?? 0;
      const ac = actual.get(poste) ?? 0;
      return { poste, planned: pl, actual: ac, diff: pl - ac };
    })
    .sort((a, b) => b.planned - a.planned);

  return {
    budgetId: budget.id,
    title: budget.title,
    periodLabel: budget.periodLabel,
    periodStart,
    periodEnd,
    rows,
    totalPlanned: rows.reduce((s, r) => s + r.planned, 0),
    totalActual: rows.reduce((s, r) => s + r.actual, 0),
  };
}

// Type complet d'un budget chargé avec son arborescence (pour l'export PDF/CSV).
export type BudgetWithTree = Awaited<ReturnType<typeof getBudget>>;
