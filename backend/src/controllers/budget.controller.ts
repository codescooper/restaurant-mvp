import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as budgetService from '../services/budget.service';
import { enrichBudget, isAiEnabled } from '../services/budget-ai.service';
import { getRestaurantName } from '../services/settings.service';
import { streamBudgetProposalPdf, budgetToCsv, BudgetExport } from '../utils/export';

// Génère une proposition (sans persistance) ; enrichissement IA optionnel.
export const generateBudgetController = asyncHandler(async (req, res) => {
  const b = req.body as {
    targetTotal: number;
    reservePercent?: number;
    historyMonths?: number;
    useHistory?: boolean;
    useRotation?: boolean;
    useThreshold?: boolean;
    withAi?: boolean;
  };

  const proposal = await budgetService.generateProposal({
    targetTotal: b.targetTotal,
    reservePercent: b.reservePercent,
    historyMonths: b.historyMonths,
    useHistory: b.useHistory,
    useRotation: b.useRotation,
    useThreshold: b.useThreshold,
  });

  let ai = null;
  if (b.withAi && isAiEnabled()) {
    const restaurantName = await getRestaurantName();
    const postes = proposal.sections.flatMap((s) => s.postes.map((p) => ({ name: p.name, planned: p.plannedAmount })));
    ai = await enrichBudget({
      restaurantName,
      targetTotal: proposal.targetTotal,
      reserveAmount: proposal.reserveAmount,
      operatingTotal: proposal.operatingTotal,
      postes,
      existingPostes: postes.map((p) => p.name),
    });
  }

  sendSuccess(res, { proposal, ai, aiAvailable: isAiEnabled() });
});

export const listBudgetsController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await budgetService.listBudgets());
});

export const getBudgetController = asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetService.getBudget(Number(req.params.id)));
});

export const createBudgetController = asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetService.createBudget(req.body, req.user?.id), 201);
});

export const updateBudgetController = asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetService.updateBudget(Number(req.params.id), req.body, req.user?.id));
});

export const deleteBudgetController = asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetService.deleteBudget(Number(req.params.id), req.user?.id));
});

export const budgetTrackingController = asyncHandler(async (req, res) => {
  sendSuccess(res, await budgetService.getTracking(Number(req.params.id)));
});

// Mappe le budget persisté vers la structure d'export PDF/CSV.
function toExport(budget: budgetService.BudgetWithTree, restaurantName: string): BudgetExport {
  return {
    restaurantName,
    title: budget.title,
    periodLabel: budget.periodLabel,
    targetTotal: budget.targetTotal,
    reservePercent: budget.reservePercent,
    conclusion: budget.conclusion,
    sections: budget.sections.map((s) => ({
      name: s.name,
      postes: s.postes.map((p) => ({
        name: p.name,
        plannedAmount: p.plannedAmount,
        lines: p.lines.map((l) => ({
          label: l.label,
          amount: l.amount,
          quantity: l.quantity,
          unit: l.unit,
          unitPrice: l.unitPrice,
        })),
      })),
    })),
  };
}

export const exportBudgetController = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const [budget, restaurantName] = await Promise.all([budgetService.getBudget(id), getRestaurantName()]);
  const data = toExport(budget, restaurantName);
  const format = (req.body?.format ?? req.query.format) === 'csv' ? 'csv' : 'pdf';

  if (format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="budget-${id}.csv"`);
    return res.send('﻿' + budgetToCsv(data));
  }
  return streamBudgetProposalPdf(res, data);
});
