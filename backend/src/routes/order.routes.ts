import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import {
  createOrderSchema,
  updateStatusSchema,
  cancelOrderSchema,
  payOrderSchema,
  refundOrderSchema,
} from '../validators/schemas';
import {
  listOrdersController,
  getOrderController,
  createOrderController,
  updateStatusController,
  cancelOrderController,
  payOrderController,
  refundOrderController,
} from '../controllers/order.controller';

const router = Router();
router.use(authenticate);

router.get('/', requireRole('cuisinier', 'caissier', 'propriétaire', 'administrateur', 'serveur'), listOrdersController);
router.get('/:id', getOrderController);
router.post('/', requireRole('caissier', 'propriétaire', 'administrateur', 'serveur'), validate(createOrderSchema), createOrderController);
router.patch(
  '/:id/status',
  requireRole('cuisinier', 'caissier', 'propriétaire', 'administrateur', 'serveur'),
  validate(updateStatusSchema),
  updateStatusController
);
router.post('/:id/cancel', requireRole('caissier', 'propriétaire', 'administrateur'), validate(cancelOrderSchema), cancelOrderController);
router.post('/:id/pay', requireRole('caissier', 'propriétaire', 'administrateur'), validate(payOrderSchema), payOrderController);
router.post('/:id/refund', requireRole('caissier', 'propriétaire', 'administrateur'), validate(refundOrderSchema), refundOrderController);

export default router;
