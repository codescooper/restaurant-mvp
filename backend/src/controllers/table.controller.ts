import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as tableService from '../services/table.service';

export const listTablesController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await tableService.listTablesWithStatus());
});

export const createTableController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.createTable(req.body), 201);
});

export const updateTableController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.updateTable(Number(req.params.id), req.body));
});

export const deleteTableController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.deleteTable(Number(req.params.id)));
});

export const settleTableController = asyncHandler(async (req, res) => {
  const result = await tableService.settleTable(
    Number(req.params.id),
    req.body.paymentMethod,
    req.body.paymentDetails,
    req.user?.id
  );
  sendSuccess(res, result);
});
