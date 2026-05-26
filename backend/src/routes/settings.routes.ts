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

router.get('/max-discount', requireRole('serveur', 'caissier', 'propriétaire', 'administrateur'), getMaxDiscountController);
router.put('/max-discount', requireRole('propriétaire', 'administrateur'), validate(setMaxDiscountSchema), setMaxDiscountController);

// Statut lisible par le caissier (pour savoir s'il faut demander le PIN) ; modification réservée à l'admin.
router.get('/manager-pin/status', requireRole('caissier', 'propriétaire', 'administrateur'), getManagerPinStatusController);
router.put('/manager-pin', requireRole('propriétaire', 'administrateur'), validate(setManagerPinSchema), setManagerPinController);

export default router;
