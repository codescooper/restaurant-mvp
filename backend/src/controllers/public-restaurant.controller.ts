import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as publicRestaurantService from '../services/public-restaurant.service';

export const getPublicRestaurantController = asyncHandler(async (req, res) => {
  sendSuccess(res, await publicRestaurantService.getPublicRestaurant(req.params.slug));
});
