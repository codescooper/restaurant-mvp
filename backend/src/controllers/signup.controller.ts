import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as signupService from '../services/signup.service';

export const signupController = asyncHandler(async (req, res) => {
  const result = await signupService.signup(req.body);
  sendSuccess(res, result, 201);
});
