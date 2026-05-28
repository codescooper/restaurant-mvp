import { Router } from 'express';
import { authenticate, requireRole, requireActiveRestaurant } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import { validate } from '../middlewares/validate';
import { createCatalogRequestSchema } from '../validators/schemas';
import {
  listMineController,
  createController,
} from '../controllers/catalog.controller';

const router = Router();

router.use(authenticate, tenantContext, requireActiveRestaurant);

router.get('/', requireRole('propriétaire', 'administrateur'), listMineController);
router.post('/', requireRole('propriétaire', 'administrateur'), validate(createCatalogRequestSchema), createController);

export default router;
