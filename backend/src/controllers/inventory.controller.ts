import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as inventoryService from '../services/inventory.service';

export const listInventoriesController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await inventoryService.listInventories());
});

export const getInventoryController = asyncHandler(async (req, res) => {
  sendSuccess(res, await inventoryService.getInventory(Number(req.params.id)));
});

export const createInventoryController = asyncHandler(async (req, res) => {
  sendSuccess(res, await inventoryService.createInventory(req.body.type, req.body.note, req.user?.id), 201);
});

export const saveCountsController = asyncHandler(async (req, res) => {
  sendSuccess(res, await inventoryService.saveCounts(Number(req.params.id), req.body.lines));
});

export const validateInventoryController = asyncHandler(async (req, res) => {
  sendSuccess(res, await inventoryService.validateInventory(Number(req.params.id), req.user?.id));
});
