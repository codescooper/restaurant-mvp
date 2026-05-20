import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as userService from '../services/user.service';

export const listUsersController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await userService.listUsers());
});

export const createUserController = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.createUser(req.body), 201);
});

export const updateUserController = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.updateUser(Number(req.params.id), req.body));
});

export const toggleUserController = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.toggleActive(Number(req.params.id), req.user!.id));
});

export const deleteUserController = asyncHandler(async (req, res) => {
  sendSuccess(res, await userService.deleteUser(Number(req.params.id), req.user!.id));
});
