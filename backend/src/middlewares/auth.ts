import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { basePrisma } from '../config/prisma';
import { env } from '../config/env';
import { sendError } from '../utils/response';
import { Role } from '../constants';
import { AccessPayload } from '../utils/jwt';

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const queryToken = typeof req.query.token === 'string' ? req.query.token : undefined;
    const token = header?.startsWith('Bearer ') ? header.slice(7) : queryToken;
    if (!token) return sendError(res, 401, 'AUTH_003', 'Token manquant');

    let decoded: AccessPayload;
    try {
      decoded = jwt.verify(token, env.jwtSecret) as AccessPayload;
    } catch (err) {
      const code = err instanceof jwt.TokenExpiredError ? 'AUTH_002' : 'AUTH_003';
      return sendError(res, 401, code);
    }

    const user = await basePrisma.user.findUnique({ where: { id: decoded.userId } });
    if (!user || !user.isActive) return sendError(res, 403, 'AUTH_004');

    req.user = { id: user.id, isSuperAdmin: user.isSuperAdmin };

    // Contexte restaurant : vérifie que le membership est toujours actif.
    // Le filtre `restaurant.status === 'active'` est retiré intentionnellement : un propriétaire
    // d'un resto pending/suspended doit pouvoir s'authentifier pour appeler /auth/me et être routé
    // vers les écrans dédiés côté frontend (ProtectedRoute M5). Le routage par statut est géré
    // côté frontend, pas ici.
    if (decoded.restaurantId != null) {
      const membership = await basePrisma.membership.findFirst({
        where: { userId: user.id, restaurantId: decoded.restaurantId, isActive: true },
      });
      if (!membership) return sendError(res, 403, 'AUTH_005');
      req.restaurantId = decoded.restaurantId;
      req.membership = { restaurantId: decoded.restaurantId, role: membership.role };
    }
    return next();
  } catch {
    return sendError(res, 500, 'INTERNAL_001');
  }
}

// Exige un restaurant sélectionné ET un rôle autorisé (rôle du membership courant).
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.membership) return sendError(res, 403, 'AUTH_006', 'Aucun restaurant sélectionné');
    if (!roles.includes(req.membership.role as Role)) return sendError(res, 403, 'AUTH_005');
    return next();
  };
}

// Réservé au super-admin plateforme.
export function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isSuperAdmin) return sendError(res, 403, 'AUTH_005');
  return next();
}
