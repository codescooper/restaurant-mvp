import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as syncService from '../services/sync.service';

export const syncController = asyncHandler(async (req, res) => {
  const results = await syncService.syncOrders(req.body.orders, req.user?.id);
  sendSuccess(res, { results });
});
