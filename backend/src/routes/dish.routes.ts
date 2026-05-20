import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createDishSchema, updateDishSchema } from '../validators/schemas';
import {
  listDishesController,
  listMenuController,
  availabilityController,
  createDishController,
  updateDishController,
  toggleDishController,
  deleteDishController,
} from '../controllers/dish.controller';

const router = Router();
router.use(authenticate);

// Lectures
router.get('/menu', requireRole('caissier', 'administrateur', 'cuisinier', 'serveur'), listMenuController);
router.get('/:id/availability', requireRole('caissier', 'administrateur'), availabilityController);
router.get('/', requireRole('administrateur', 'cuisinier'), listDishesController);

// Ecritures (admin)
router.post('/', requireRole('administrateur'), validate(createDishSchema), createDishController);
router.put('/:id', requireRole('administrateur'), validate(updateDishSchema), updateDishController);
router.patch('/:id/toggle-active', requireRole('administrateur'), toggleDishController);
router.delete('/:id', requireRole('administrateur'), deleteDishController);

export default router;
