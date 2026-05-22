import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as supplierService from '../services/supplier.service';

export const listSuppliersController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await supplierService.listSuppliers());
});

export const getSupplierController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.getSupplier(Number(req.params.id)));
});

export const createSupplierController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.createSupplier(req.body), 201);
});

export const updateSupplierController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.updateSupplier(Number(req.params.id), req.body));
});

export const deleteSupplierController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.deleteSupplier(Number(req.params.id)));
});

export const createPurchaseController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.createPurchase(req.body, req.user?.id), 201);
});

export const listPurchasesController = asyncHandler(async (req, res) => {
  const supplierId = req.query.supplierId ? Number(req.query.supplierId) : undefined;
  sendSuccess(res, await supplierService.listPurchases(supplierId));
});

export const markPurchasePaidController = asyncHandler(async (req, res) => {
  sendSuccess(res, await supplierService.markPurchasePaid(Number(req.params.id)));
});
