import { Request, Response, NextFunction } from 'express';
import { runWithTenant } from '../config/tenant-context';
import { sendError } from '../utils/response';

// Ouvre le contexte tenant pour la durée du traitement de la requête.
// À placer APRÈS `authenticate` (qui pose req.restaurantId), sur les routes scopées.
// Aucun restaurant sélectionné → 403 propre (l'utilisateur doit choisir un restaurant).
export function tenantContext(req: Request, res: Response, next: NextFunction) {
  const restaurantId = req.restaurantId;
  if (restaurantId == null) {
    return sendError(res, 403, 'AUTH_006', 'Aucun restaurant sélectionné');
  }
  return runWithTenant(restaurantId, () => next());
}
