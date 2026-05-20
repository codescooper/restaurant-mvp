import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import { Role } from '../constants';

interface AccessTokenPayload {
  userId: number;
  username: string;
  role: Role;
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : undefined;

    if (!token) {
      return sendError(res, 401, 'AUTH_003', 'Token manquant');
    }

    let decoded: AccessTokenPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as AccessTokenPayload;
    } catch (err) {
      const code = err instanceof jwt.TokenExpiredError ? 'AUTH_002' : 'AUTH_003';
      return sendError(res, 401, code);
    }

    const user = await prisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) {
      return sendError(res, 403, 'AUTH_004');
    }

    req.user = { id: user.id, username: user.username, role: user.role as Role };
    return next();
  } catch {
    return sendError(res, 500, 'INTERNAL_001');
  }
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, 'AUTH_005');
    }
    return next();
  };
}
