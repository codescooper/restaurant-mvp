import { Request } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as auditService from '../services/audit.service';

type ValidatedReq = Request & { validated?: Record<string, unknown> };

export const listAuditLogsController = asyncHandler(async (req, res) => {
  const v = (req as ValidatedReq).validated ?? {};
  sendSuccess(
    res,
    await auditService.listAuditLogs({
      action: (v.action as string) || undefined,
      entityType: (v.entityType as string) || undefined,
      userId: v.userId as number | undefined,
      limit: v.limit as number | undefined,
    })
  );
});
