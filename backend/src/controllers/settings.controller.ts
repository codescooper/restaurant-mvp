import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as settings from '../services/settings.service';
import { SETTING_MAX_DISCOUNT } from '../constants';

export const getMaxDiscountController = asyncHandler(async (_req, res) => {
  sendSuccess(res, { maxDiscountPercent: await settings.getMaxDiscountPercent() });
});

export const setMaxDiscountController = asyncHandler(async (req, res) => {
  await settings.setSetting(SETTING_MAX_DISCOUNT, String(req.body.maxDiscountPercent), 'Plafond de remise manuelle (%)');
  sendSuccess(res, { maxDiscountPercent: req.body.maxDiscountPercent });
});

export const getRestaurantNameController = asyncHandler(async (_req, res) => {
  sendSuccess(res, { restaurantName: await settings.getRestaurantName() });
});

export const setRestaurantNameController = asyncHandler(async (req, res) => {
  const restaurantName = await settings.setRestaurantName(String(req.body.restaurantName ?? ''));
  sendSuccess(res, { restaurantName });
});

// Statut du PIN manager (booléen seulement — on n'expose jamais le code).
export const getManagerPinStatusController = asyncHandler(async (_req, res) => {
  sendSuccess(res, { configured: await settings.isManagerPinSet() });
});

export const setManagerPinController = asyncHandler(async (req, res) => {
  await settings.setManagerPin(String(req.body.pin ?? ''));
  sendSuccess(res, { configured: await settings.isManagerPinSet() });
});

// --- Branding (P2b) ---
export const getBrandingController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await settings.getBranding());
});

export const setBrandingController = asyncHandler(async (req, res) => {
  sendSuccess(res, await settings.setBranding(req.body));
});
