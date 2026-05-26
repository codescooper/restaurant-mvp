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

const SERVICE = ['serveur', 'caissier', 'propriétaire', 'administrateur'] as const;

// Lecture caisse (avant /:id)
router.get('/happy-hour/active', requireRole(...SERVICE), activeHappyHourController);
router.get('/coupon/:code', requireRole(...SERVICE), checkCouponController);

// Gestion : admin
router.get('/', requireRole('propriétaire', 'administrateur'), listPromotionsController);
router.post('/', requireRole('propriétaire', 'administrateur'), validate(createPromotionSchema), createPromotionController);
router.put('/:id', requireRole('propriétaire', 'administrateur'), validate(updatePromotionSchema), updatePromotionController);
router.delete('/:id', requireRole('propriétaire', 'administrateur'), deletePromotionController);

export default router;
