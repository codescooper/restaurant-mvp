import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { openCashSessionSchema, closeCashSessionSchema } from '../validators/schemas';
import {
  getCurrentSessionController,
  openSessionController,
  closeSessionController,
  openDrawerController,
  listSessionsController,
  getSessionReportController,
} from '../controllers/cash.controller';

const router = Router();
router.use(authenticate);

// Session courante du caissier connecté + ouverture/fermeture/tiroir : caissier, admin
router.get('/current', requireRole('caissier', 'administrateur'), getCurrentSessionController);
router.post('/open', requireRole('caissier', 'administrateur'), validate(openCashSessionSchema), openSessionController);
router.post('/close', requireRole('caissier', 'administrateur'), validate(closeCashSessionSchema), closeSessionController);
router.post('/drawer', requireRole('caissier', 'administrateur'), openDrawerController);

// Historique des sessions + rapport détaillé : admin
router.get('/sessions', requireRole('administrateur'), listSessionsController);
router.get('/sessions/:id', requireRole('administrateur'), getSessionReportController);

export default router;
