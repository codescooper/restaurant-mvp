import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { setMaxDiscountSchema, setManagerPinSchema, setRestaurantNameSchema, setReceiptWidthSchema, brandingSchema } from '../validators/schemas';
import {
  getMaxDiscountController,
  setMaxDiscountController,
  getRestaurantNameController,
  setRestaurantNameController,
  getManagerPinStatusController,
  setManagerPinController,
  getReceiptWidthController,
  setReceiptWidthController,
  getBrandingController,
  setBrandingController,
} from '../controllers/settings.controller';

const router = Router();
router.use(authenticate);

router.get('/max-discount', requireRole('serveur', 'caissier', 'propriétaire', 'administrateur'), getMaxDiscountController);
router.put('/max-discount', requireRole('propriétaire', 'administrateur'), validate(setMaxDiscountSchema), setMaxDiscountController);

// Nom du restaurant : lisible par tous ceux qui impriment un ticket (en-tête reçu/rapports) ;
// modifiable par le propriétaire/admin.
router.get('/restaurant-name', requireRole('serveur', 'caissier', 'propriétaire', 'administrateur'), getRestaurantNameController);
router.put('/restaurant-name', requireRole('propriétaire', 'administrateur'), validate(setRestaurantNameSchema), setRestaurantNameController);

// Statut lisible par le caissier (pour savoir s'il faut demander le PIN) ; modification réservée à l'admin.
router.get('/manager-pin/status', requireRole('caissier', 'propriétaire', 'administrateur'), getManagerPinStatusController);
router.put('/manager-pin', requireRole('propriétaire', 'administrateur'), validate(setManagerPinSchema), setManagerPinController);

// Largeur du ticket : lisible par ceux qui impriment (serveur en salle, caissier) ; réglage réservé à l'admin.
router.get('/receipt-width', requireRole('serveur', 'caissier', 'propriétaire', 'administrateur'), getReceiptWidthController);
router.put('/receipt-width', requireRole('propriétaire', 'administrateur'), validate(setReceiptWidthSchema), setReceiptWidthController);

// Branding : lecture ouverte à tous les rôles authentifiés (theming) ; écriture réservée aux admins.
router.get('/branding', getBrandingController);
router.put('/branding', requireRole('propriétaire', 'administrateur'), validate(brandingSchema), setBrandingController);

export default router;
