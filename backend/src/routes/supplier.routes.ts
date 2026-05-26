import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createSupplierSchema, updateSupplierSchema, createPurchaseSchema } from '../validators/schemas';
import {
  listSuppliersController,
  getSupplierController,
  createSupplierController,
  updateSupplierController,
  deleteSupplierController,
  createPurchaseController,
  listPurchasesController,
  markPurchasePaidController,
} from '../controllers/supplier.controller';

const router = Router();
router.use(authenticate, requireRole('propriétaire', 'administrateur'));

// Achats (placés avant /:id pour éviter les collisions de routes)
router.get('/purchases', listPurchasesController);
router.post('/purchases', validate(createPurchaseSchema), createPurchaseController);
router.patch('/purchases/:id/pay', markPurchasePaidController);

// Fournisseurs
router.get('/', listSuppliersController);
router.post('/', validate(createSupplierSchema), createSupplierController);
router.get('/:id', getSupplierController);
router.put('/:id', validate(updateSupplierSchema), updateSupplierController);
router.delete('/:id', deleteSupplierController);

export default router;
