import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { auditQuerySchema } from '../validators/schemas';
import { listAuditLogsController } from '../controllers/audit.controller';

const router = Router();
router.use(authenticate);

// Journal d'actions : réservé à l'administrateur
router.get('/', requireRole('propriétaire', 'administrateur'), validate(auditQuerySchema, 'query'), listAuditLogsController);

export default router;
