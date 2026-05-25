import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { syncSchema } from '../validators/schemas';
import { syncController } from '../controllers/sync.controller';

const router = Router();
router.use(authenticate, requireRole('caissier', 'propriétaire', 'administrateur'));

router.post('/', validate(syncSchema), syncController);

export default router;
