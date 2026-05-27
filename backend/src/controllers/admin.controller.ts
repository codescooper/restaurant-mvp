import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as adminService from '../services/admin.service';
import type { RestaurantStatus } from '../services/admin.service';

export const listRestaurantsController = asyncHandler(async (req, res) => {
  const status = typeof req.query.status === 'string'
    ? (req.query.status as RestaurantStatus)
    : undefined;
  sendSuccess(res, await adminService.listRestaurants({ status }));
});

export const activateController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.activateRestaurant(Number(req.params.id)));
});

export const suspendController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.suspendRestaurant(Number(req.params.id), req.body?.reason));
});

export const reactivateController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.reactivateRestaurant(Number(req.params.id)));
});

export const rejectController = asyncHandler(async (req, res) => {
  sendSuccess(res, await adminService.rejectRestaurant(Number(req.params.id), req.body?.reason));
});
