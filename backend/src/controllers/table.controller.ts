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
    req.user?.id,
    { amount: req.body.tipAmount, method: req.body.tipMethod }
  );
  sendSuccess(res, result);
});

export const billRequestController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.setBillRequested(Number(req.params.id), req.body.requested));
});

export const mergeTableController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.mergeTable(Number(req.params.id), req.body.targetTableId, req.user?.id));
});

export const createReservationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.createReservation(req.body, req.user?.id), 201);
});

export const listReservationsController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await tableService.listReservations());
});

export const cancelReservationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.setReservationStatus(Number(req.params.id), 'annulée'));
});

export const honorReservationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await tableService.setReservationStatus(Number(req.params.id), 'honorée'));
});
