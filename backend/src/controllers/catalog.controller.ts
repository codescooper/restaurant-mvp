import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as catalogService from '../services/catalog.service';

// --- Tenant routes ---

export const listMineController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await catalogService.listMine());
});

export const createController = asyncHandler(async (req, res) => {
  const { platforms, message } = req.body as { platforms: string[]; message?: string };
  sendSuccess(res, await catalogService.createRequest({ platforms, message }, req.user?.id), 201);
});

// --- Super-admin routes ---

export const listAllController = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string' ? req.query.status : undefined;
  sendSuccess(res, await catalogService.listAll({ status }));
});

export const setStatusController = asyncHandler(async (req, res) => {
  const { status, adminNote } = req.body as { status: string; adminNote?: string };
  sendSuccess(res, await catalogService.setStatus(Number(req.params.id), status, adminNote));
});
