import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createTableSchema, updateTableSchema, payOrderSchema } from '../validators/schemas';
import {
  listTablesController,
  createTableController,
  updateTableController,
  deleteTableController,
  settleTableController,
} from '../controllers/table.controller';

const router = Router();
router.use(authenticate);

// Lecture du plan de salle : serveur, caissier, admin
router.get('/', requireRole('serveur', 'caissier', 'administrateur'), listTablesController);

// Règlement de l'addition d'une table : caissier, admin
router.post('/:id/settle', requireRole('caissier', 'administrateur'), validate(payOrderSchema), settleTableController);

// Gestion des tables (CRUD) : admin
router.post('/', requireRole('administrateur'), validate(createTableSchema), createTableController);
router.put('/:id', requireRole('administrateur'), validate(updateTableSchema), updateTableController);
router.delete('/:id', requireRole('administrateur'), deleteTableController);

export default router;
