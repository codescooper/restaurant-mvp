import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { sendError } from '../utils/response';

type Source = 'body' | 'query' | 'params';

// Valide et remplace req[source] par la donnee typee (§14.3).
export function validate(schema: ZodSchema, source: Source = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      return sendError(res, 400, 'VALIDATION_001', undefined, result.error.errors);
    }
    // query/params sont en lecture seule selon les versions d'Express : on stocke a part.
    if (source === 'body') {
      req.body = result.data;
    } else {
      (req as Request & { validated?: Record<string, unknown> }).validated = {
        ...(req as Request & { validated?: Record<string, unknown> }).validated,
        ...(result.data as Record<string, unknown>),
      };
    }
    return next();
  };
}
