import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createStockSchema,
  updateStockSchema,
  addQuantitySchema,
  recordLossSchema,
} from '../validators/schemas';
import {
  listStockController,
  createStockController,
  updateStockController,
  deleteStockController,
  addQuantityController,
  recordLossController,
  listMovementsController,
} from '../controllers/stock.controller';

const router = Router();
router.use(authenticate, requireRole('administrateur'));

router.get('/', listStockController);
router.get('/movements', listMovementsController);
router.post('/', validate(createStockSchema), createStockController);
router.put('/:id', validate(updateStockSchema), updateStockController);
router.delete('/:id', deleteStockController);
router.post('/:id/add-quantity', validate(addQuantitySchema), addQuantityController);
router.post('/:id/loss', validate(recordLossSchema), recordLossController);

export default router;
