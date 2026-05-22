import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as auditService from '../services/audit.service';

export const listAuditLogsController = asyncHandler(async (req, res) => {
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const userId = req.query.userId ? Number(req.query.userId) : undefined;
  sendSuccess(
    res,
    await auditService.listAuditLogs({
      action: (req.query.action as string) || undefined,
      entityType: (req.query.entityType as string) || undefined,
      userId,
      limit,
    })
  );
});
