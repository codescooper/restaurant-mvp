import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { adminReasonSchema, adminListQuerySchema } from '../validators/schemas';
import {
  listRestaurantsController,
  activateController,
  suspendController,
  reactivateController,
  rejectController,
} from '../controllers/admin.controller';

const router = Router();

// Pas de tenantContext — super-admin opère global via basePrisma.
router.use(authenticate, requireSuperAdmin);

router.get('/restaurants', validate(adminListQuerySchema, 'query'), listRestaurantsController);
router.post('/restaurants/:id/activate', activateController);
router.post('/restaurants/:id/suspend', validate(adminReasonSchema), suspendController);
router.post('/restaurants/:id/reactivate', reactivateController);
router.post('/restaurants/:id/reject', validate(adminReasonSchema), rejectController);

export default router;
