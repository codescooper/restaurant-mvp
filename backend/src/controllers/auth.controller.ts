import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess, sendError } from '../utils/response';
import * as authService from '../services/auth.service';

export const loginController = asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const result = await authService.login(username, password);
  sendSuccess(res, result);
});

export const refreshController = asyncHandler(async (req, res) => {
  const token = (req.body?.refreshToken as string) || (req.headers['x-refresh-token'] as string);
  if (!token) return sendError(res, 401, 'AUTH_003', 'Refresh token manquant');
  const result = await authService.refresh(token);
  return sendSuccess(res, result);
});

export const meController = asyncHandler(async (req, res) => {
  const user = await authService.getMe(req.user!.id);
  sendSuccess(res, { user });
});
