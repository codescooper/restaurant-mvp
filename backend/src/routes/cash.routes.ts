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
router.get('/current', requireRole('caissier', 'propriétaire', 'administrateur'), getCurrentSessionController);
router.post('/open', requireRole('caissier', 'propriétaire', 'administrateur'), validate(openCashSessionSchema), openSessionController);
router.post('/close', requireRole('caissier', 'propriétaire', 'administrateur'), validate(closeCashSessionSchema), closeSessionController);
router.post('/drawer', requireRole('caissier', 'propriétaire', 'administrateur'), openDrawerController);

// Historique des sessions + rapport détaillé : admin
router.get('/sessions', requireRole('propriétaire', 'administrateur'), listSessionsController);
router.get('/sessions/:id', requireRole('propriétaire', 'administrateur'), getSessionReportController);

export default router;
