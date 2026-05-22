import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createPromotionSchema, updatePromotionSchema } from '../validators/schemas';
import {
  listPromotionsController,
  createPromotionController,
  updatePromotionController,
  deletePromotionController,
  activeHappyHourController,
  checkCouponController,
} from '../controllers/promotion.controller';

const router = Router();
router.use(authenticate);

const SERVICE = ['serveur', 'caissier', 'administrateur'] as const;

// Lecture caisse (avant /:id)
router.get('/happy-hour/active', requireRole(...SERVICE), activeHappyHourController);
router.get('/coupon/:code', requireRole(...SERVICE), checkCouponController);

// Gestion : admin
router.get('/', requireRole('administrateur'), listPromotionsController);
router.post('/', requireRole('administrateur'), validate(createPromotionSchema), createPromotionController);
router.put('/:id', requireRole('administrateur'), validate(updatePromotionSchema), updatePromotionController);
router.delete('/:id', requireRole('administrateur'), deletePromotionController);

export default router;
