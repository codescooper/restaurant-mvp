import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as notificationService from '../services/notification.service';
import { Role } from '../constants';

export const listNotificationsController = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.listNotifications(req.membership!.role as Role));
});

export const markReadController = asyncHandler(async (req, res) => {
  sendSuccess(res, await notificationService.markAsRead(Number(req.params.id), req.user!.id));
});
