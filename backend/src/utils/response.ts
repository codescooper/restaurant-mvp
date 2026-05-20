import { Response } from 'express';
import { ErrorCode, ErrorCodes } from './errors';

// Format de reponse unifie (§12.4)
export function sendSuccess<T>(res: Response, data: T, status = 200, message?: string) {
  return res.status(status).json({ success: true, data, ...(message ? { message } : {}) });
}

export function sendError(
  res: Response,
  status: number,
  code: ErrorCode,
  message?: string,
  details?: unknown
) {
  return res.status(status).json({
    success: false,
    error: { code, message: message ?? ErrorCodes[code], ...(details ? { details } : {}) },
  });
}
