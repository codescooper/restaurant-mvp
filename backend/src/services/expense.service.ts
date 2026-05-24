import { prisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { logAudit } from './audit.service';
import { ExpenseCategory, ExpensePaymentMethod } from '../constants';

export interface ExpenseInput {
  label: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  paymentMethod?: ExpensePaymentMethod;
  note?: string;
}

const creatorSelect = { select: { id: true, username: true } } as const;

function nz(v?: string): string | null {
  if (v == null) return null;
  const t = v.trim();
  return t === '' ? null : t;
}

export async function listExpenses(category?: string) {
  return prisma.expense.findMany({
    where: category ? { category } : undefined,
    orderBy: { expenseDate: 'desc' },
    take: 300,
    include: { creator: creatorSelect },
  });
}

export async function getExpense(id: number) {
  const expense = await prisma.expense.findUnique({ where: { id }, include: { creator: creatorSelect } });
  if (!expense) throw new AppError(404, 'VALIDATION_001', 'Dépense introuvable');
  return expense;
}

function buildData(data: ExpenseInput) {
  return {
    label: data.label.trim(),
    category: data.category,
    amount: data.amount,
    expenseDate: new Date(data.expenseDate),
    paymentMethod: data.paymentMethod ?? null,
    note: nz(data.note),
  };
}

export async function createExpense(data: ExpenseInput, actorId?: number) {
  const expense = await prisma.expense.create({
    data: { ...buildData(data), createdBy: actorId },
    include: { creator: creatorSelect },
  });
  await logAudit({
    userId: actorId,
    action: 'depense_creation',
    entityType: 'expense',
    entityId: expense.id,
    details: { label: expense.label, category: expense.category, amount: expense.amount },
  });
  return expense;
}

// Enregistre automatiquement un achat de stock comme dépense (catégorie 'approvisionnement').
// Visible en trésorerie mais exclu du bénéfice net (le coût matière est déjà compté via le COGS).
export async function recordStockPurchase(params: {
  stockName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  isInitial?: boolean;
  actorId?: number;
}) {
  const amount = Math.round(params.quantity * params.unitCost);
  if (amount <= 0) return null;
  const prefix = params.isInitial ? 'Achat stock' : 'Réappro';
  return createExpense(
    {
      label: `${prefix} : ${params.stockName} (${params.quantity} ${params.unit})`,
      category: 'approvisionnement',
      amount,
      expenseDate: new Date().toISOString(),
      note: 'Généré automatiquement depuis le stock',
    },
    params.actorId
  );
}

export async function updateExpense(id: number, data: ExpenseInput, actorId?: number) {
  await getExpense(id);
  const expense = await prisma.expense.update({
    where: { id },
    data: buildData(data),
    include: { creator: creatorSelect },
  });
  await logAudit({
    userId: actorId,
    action: 'depense_modification',
    entityType: 'expense',
    entityId: expense.id,
    details: { label: expense.label, category: expense.category, amount: expense.amount },
  });
  return expense;
}

export async function deleteExpense(id: number, actorId?: number) {
  const expense = await getExpense(id);
  await prisma.expense.delete({ where: { id } });
  await logAudit({
    userId: actorId,
    action: 'depense_suppression',
    entityType: 'expense',
    entityId: id,
    details: { label: expense.label, amount: expense.amount },
  });
  return { id };
}
