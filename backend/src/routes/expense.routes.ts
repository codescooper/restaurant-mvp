import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createExpenseSchema, updateExpenseSchema } from '../validators/schemas';
import {
  listExpensesController,
  getExpenseController,
  createExpenseController,
  updateExpenseController,
  deleteExpenseController,
} from '../controllers/expense.controller';

const router = Router();
// Données financières : réservé à l'administrateur.
router.use(authenticate, requireRole('administrateur'));

router.get('/', listExpensesController);
router.post('/', validate(createExpenseSchema), createExpenseController);
router.get('/:id', getExpenseController);
router.put('/:id', validate(updateExpenseSchema), updateExpenseController);
router.delete('/:id', deleteExpenseController);

export default router;
