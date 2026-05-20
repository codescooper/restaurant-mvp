import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { sendError } from '../utils/response';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof AppError) {
    return sendError(res, err.statusCode, err.code, err.message, err.details);
  }
  if (err instanceof ZodError) {
    return sendError(res, 400, 'VALIDATION_001', undefined, err.errors);
  }
  // Corps JSON malformé (body-parser) -> 400 plutôt que 500.
  if (err instanceof SyntaxError && 'body' in (err as object)) {
    return sendError(res, 400, 'VALIDATION_001', 'Corps de requête JSON invalide');
  }
  console.error('Erreur non geree:', err);
  return sendError(res, 500, 'INTERNAL_001');
}

export function notFoundHandler(_req: Request, res: Response) {
  return sendError(res, 404, 'INTERNAL_001', 'Route introuvable');
}
