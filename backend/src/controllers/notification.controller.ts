import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as notificationService from '../services/notification.service';

export const listNotificationsController = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.listNotifications(req.user!.role));
});

export const markReadController = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markAsRead(Number(req.params.id), req.user!.id));
});
