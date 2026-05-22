import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as cashService from '../services/cash.service';

// req.user est garanti par le middleware authenticate sur toutes ces routes.
export const getCurrentSessionController = asyncHandler(async (req, res) => {
  sendSuccess(res, await cashService.getCurrentSessionReport(req.user!.id));
});

export const openSessionController = asyncHandler(async (req, res) => {
  const session = await cashService.openSession(req.user!.id, req.body.openingFloat, req.body.notes);
  sendSuccess(res, session, 201);
});

export const closeSessionController = asyncHandler(async (req, res) => {
  const session = await cashService.closeSession(
    req.user!.id,
    req.body.countedCash,
    req.body.discrepancyReason,
    req.user!.id,
    req.body.notes
  );
  sendSuccess(res, session);
});

export const openDrawerController = asyncHandler(async (req, res) => {
  sendSuccess(res, await cashService.openDrawer(req.user?.id, req.body?.reason));
});

export const listSessionsController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await cashService.listSessions());
});

export const getSessionReportController = asyncHandler(async (req, res) => {
  sendSuccess(res, await cashService.getSessionReport(Number(req.params.id)));
});
