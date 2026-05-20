import { Request, Response, NextFunction } from 'express';
import { sanitizeDeep } from '../utils/sanitize';

// Nettoie le corps des requetes pour eviter les injections HTML/XSS (§14.6).
export function sanitizeBody(req: Request, _res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeDeep(req.body);
  }
  next();
}
