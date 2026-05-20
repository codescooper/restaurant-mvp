import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as dishService from '../services/dish.service';

// Liste complete (admin) avec recettes.
export const listDishesController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await dishService.listDishes());
});

// Menu pour la caisse : plats actifs + flag de disponibilite.
export const listMenuController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await dishService.listMenuWithAvailability());
});

export const availabilityController = asyncHandler(async (req, res) => {
  const quantity = req.query.quantity ? Number(req.query.quantity) : 1;
  const available = await dishService.isDishAvailable(Number(req.params.id), quantity);
  sendSuccess(res, { available });
});

export const createDishController = asyncHandler(async (req, res) => {
  sendSuccess(res, await dishService.createDish(req.body), 201);
});

export const updateDishController = asyncHandler(async (req, res) => {
  sendSuccess(res, await dishService.updateDish(Number(req.params.id), req.body));
});

export const toggleDishController = asyncHandler(async (req, res) => {
  sendSuccess(res, await dishService.toggleActive(Number(req.params.id)));
});

export const deleteDishController = asyncHandler(async (req, res) => {
  sendSuccess(res, await dishService.deleteDish(Number(req.params.id)));
});
