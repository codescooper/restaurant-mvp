import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createEmployeeSchema, updateEmployeeSchema } from '../validators/schemas';
import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  deleteEmployeeController,
} from '../controllers/employee.controller';

const router = Router();
// Données RH sensibles (salaires) : réservé à l'administrateur.
router.use(authenticate, requireRole('administrateur'));

router.get('/', listEmployeesController);
router.post('/', validate(createEmployeeSchema), createEmployeeController);
router.get('/:id', getEmployeeController);
router.put('/:id', validate(updateEmployeeSchema), updateEmployeeController);
router.delete('/:id', deleteEmployeeController);

export default router;
