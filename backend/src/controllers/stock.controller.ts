import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as stockService from '../services/stock.service';

export const listStockController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await stockService.listStock());
});

export const createStockController = asyncHandler(async (req, res) => {
  sendSuccess(res, await stockService.createStock(req.body, req.user?.id), 201);
});

export const updateStockController = asyncHandler(async (req, res) => {
  sendSuccess(res, await stockService.updateStock(Number(req.params.id), req.body));
});

export const deleteStockController = asyncHandler(async (req, res) => {
  sendSuccess(res, await stockService.deleteStock(Number(req.params.id)));
});

export const addQuantityController = asyncHandler(async (req, res) => {
  const updated = await stockService.addQuantity(Number(req.params.id), req.body.quantity, req.user?.id);
  await stockService.checkLowStock(updated);
  sendSuccess(res, updated);
});

export const recordLossController = asyncHandler(async (req, res) => {
  const updated = await stockService.recordLoss(
    Number(req.params.id),
    req.body.quantity,
    req.body.cause,
    req.body.note,
    req.user?.id
  );
  sendSuccess(res, updated);
});

export const listMovementsController = asyncHandler(async (req, res) => {
  const stockItemId = req.query.stockItemId ? Number(req.query.stockItemId) : undefined;
  sendSuccess(res, await stockService.listMovements(stockItemId));
});
