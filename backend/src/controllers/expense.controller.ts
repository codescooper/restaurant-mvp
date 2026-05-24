import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as expenseService from '../services/expense.service';

export const listExpensesController = asyncHandler(async (req, res) => {
  const category = typeof req.query.category === 'string' ? req.query.category : undefined;
  sendSuccess(res, await expenseService.listExpenses(category));
});

export const getExpenseController = asyncHandler(async (req, res) => {
  sendSuccess(res, await expenseService.getExpense(Number(req.params.id)));
});

export const createExpenseController = asyncHandler(async (req, res) => {
  sendSuccess(res, await expenseService.createExpense(req.body, req.user?.id), 201);
});

export const updateExpenseController = asyncHandler(async (req, res) => {
  sendSuccess(res, await expenseService.updateExpense(Number(req.params.id), req.body, req.user?.id));
});

export const deleteExpenseController = asyncHandler(async (req, res) => {
  sendSuccess(res, await expenseService.deleteExpense(Number(req.params.id), req.user?.id));
});
