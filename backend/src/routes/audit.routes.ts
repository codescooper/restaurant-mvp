import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { listAuditLogsController } from '../controllers/audit.controller';

const router = Router();
router.use(authenticate);

// Journal d'actions : réservé à l'administrateur
router.get('/', requireRole('propriétaire', 'administrateur'), listAuditLogsController);

export default router;
