import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { setMaxDiscountSchema, setManagerPinSchema, setRestaurantNameSchema, brandingSchema } from '../validators/schemas';
import {
  getMaxDiscountController,
  setMaxDiscountController,
  getRestaurantNameController,
  setRestaurantNameController,
  getManagerPinStatusController,
  setManagerPinController,
  getBrandingController,
  setBrandingController,
} from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

router.get('/max-discount', requireRole('serveur', 'caissier', 'propriétaire', 'administrateur'), getMaxDiscountController);
router.put('/max-discount', requireRole('propriétaire', 'administrateur'), validate(setMaxDiscountSchema), setMaxDiscountController);

// Nom du restaurant : lisible par admin/caissier (en-tête des rapports) ; modifiable par l'admin.
router.get('/restaurant-name', requireRole('caissier', 'administrateur'), getRestaurantNameController);
router.put('/restaurant-name', requireRole('administrateur'), validate(setRestaurantNameSchema), setRestaurantNameController);

// Statut lisible par le caissier (pour savoir s'il faut demander le PIN) ; modification réservée à l'admin.
router.get('/manager-pin/status', requireRole('caissier', 'propriétaire', 'administrateur'), getManagerPinStatusController);
router.put('/manager-pin', requireRole('propriétaire', 'administrateur'), validate(setManagerPinSchema), setManagerPinController);

// Branding : lecture ouverte à tous les rôles authentifiés (theming) ; écriture réservée aux admins.
router.get('/branding', getBrandingController);
router.put('/branding', requireRole('propriétaire', 'administrateur'), validate(brandingSchema), setBrandingController);

export default router;
