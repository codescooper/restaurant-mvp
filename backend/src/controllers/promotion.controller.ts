import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as promo from '../services/promotion.service';

export const listPromotionsController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await promo.listPromotions());
});

export const createPromotionController = asyncHandler(async (req, res) => {
  sendSuccess(res, await promo.createPromotion(req.body), 201);
});

export const updatePromotionController = asyncHandler(async (req, res) => {
  sendSuccess(res, await promo.updatePromotion(Number(req.params.id), req.body));
});

export const deletePromotionController = asyncHandler(async (req, res) => {
  sendSuccess(res, await promo.deletePromotion(Number(req.params.id)));
});

// Happy hour actif en ce moment (pour le bandeau caisse) ; renvoie null si aucun.
export const activeHappyHourController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await promo.findActiveHappyHour());
});

// Valide un code coupon et renvoie la remise (pour aperçu à la caisse).
export const checkCouponController = asyncHandler(async (req, res) => {
  const c = await promo.findValidCoupon(req.params.code);
  sendSuccess(res, { id: c.id, name: c.name, discountType: c.discountType, discountValue: c.discountValue });
});
