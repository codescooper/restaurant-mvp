import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as invitationService from '../services/invitation.service';
import { Role } from '../constants';

export const listInvitationsController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await invitationService.listInvitations());
});

export const createInvitationController = asyncHandler(async (req, res) => {
  const { email, role } = req.body as { email: string; role: Role };
  sendSuccess(res, await invitationService.createInvitation({ email, role }, req.user!.id), 201);
});

export const revokeInvitationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await invitationService.revokeInvitation(Number(req.params.id)));
});

export const peekInvitationController = asyncHandler(async (req, res) => {
  sendSuccess(res, await invitationService.peekInvitation(req.params.token));
});

export const acceptInvitationController = asyncHandler(async (req, res) => {
  const { password, displayName } = req.body as { password: string; displayName?: string };
  sendSuccess(res, await invitationService.acceptInvitation(req.params.token, { password, displayName }));
});
