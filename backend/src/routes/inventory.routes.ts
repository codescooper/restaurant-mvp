import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createInventorySchema, saveInventoryCountsSchema } from '../validators/schemas';
import {
  listInventoriesController,
  getInventoryController,
  createInventoryController,
  saveCountsController,
  validateInventoryController,
} from '../controllers/inventory.controller';

const router = Router();
router.use(authenticate, requireRole('administrateur'));

router.get('/', listInventoriesController);
router.post('/', validate(createInventorySchema), createInventoryController);
router.get('/:id', getInventoryController);
router.put('/:id/counts', validate(saveInventoryCountsSchema), saveCountsController);
router.post('/:id/validate', validateInventoryController);

export default router;
