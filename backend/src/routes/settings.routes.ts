import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { setMaxDiscountSchema, setManagerPinSchema, setRestaurantNameSchema } from '../validators/schemas';
import {
  getMaxDiscountController,
  setMaxDiscountController,
  getRestaurantNameController,
  setRestaurantNameController,
  getManagerPinStatusController,
  setManagerPinController,
} from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

router.get('/max-discount', requireRole('serveur', 'caissier', 'administrateur'), getMaxDiscountController);
router.put('/max-discount', requireRole('administrateur'), validate(setMaxDiscountSchema), setMaxDiscountController);

// Nom du restaurant : lisible par admin/caissier (en-tête des rapports) ; modifiable par l'admin.
router.get('/restaurant-name', requireRole('caissier', 'administrateur'), getRestaurantNameController);
router.put('/restaurant-name', requireRole('administrateur'), validate(setRestaurantNameSchema), setRestaurantNameController);

// Statut lisible par le caissier (pour savoir s'il faut demander le PIN) ; modification réservée à l'admin.
router.get('/manager-pin/status', requireRole('caissier', 'administrateur'), getManagerPinStatusController);
router.put('/manager-pin', requireRole('administrateur'), validate(setManagerPinSchema), setManagerPinController);

export default router;
