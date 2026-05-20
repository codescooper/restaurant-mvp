import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createOrderSchema, updateStatusSchema, cancelOrderSchema, payOrderSchema } from '../validators/schemas';
import {
  listOrdersController,
  getOrderController,
  createOrderController,
  updateStatusController,
  cancelOrderController,
  payOrderController,
} from '../controllers/order.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('cuisinier', 'caissier', 'administrateur', 'serveur'), listOrdersController);
router.get('/:id', getOrderController);
router.post('/', requireRole('caissier', 'administrateur', 'serveur'), validate(createOrderSchema), createOrderController);
router.patch(
  '/:id/status',
  requireRole('cuisinier', 'caissier', 'administrateur', 'serveur'),
  validate(updateStatusSchema),
  updateStatusController
);
router.post('/:id/cancel', requireRole('caissier', 'administrateur'), validate(cancelOrderSchema), cancelOrderController);
router.post('/:id/pay', requireRole('caissier', 'administrateur'), validate(payOrderSchema), payOrderController);

export default router;
