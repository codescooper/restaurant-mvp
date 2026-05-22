import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { setMaxDiscountSchema, setManagerPinSchema } from '../validators/schemas';
import {
  getMaxDiscountController,
  setMaxDiscountController,
  getManagerPinStatusController,
  setManagerPinController,
} from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

router.get('/max-discount', requireRole('serveur', 'caissier', 'administrateur'), getMaxDiscountController);
router.put('/max-discount', requireRole('administrateur'), validate(setMaxDiscountSchema), setMaxDiscountController);

// Statut lisible par le caissier (pour savoir s'il faut demander le PIN) ; modification réservée à l'admin.
router.get('/manager-pin/status', requireRole('caissier', 'administrateur'), getManagerPinStatusController);
router.put('/manager-pin', requireRole('administrateur'), validate(setManagerPinSchema), setManagerPinController);

export default router;
