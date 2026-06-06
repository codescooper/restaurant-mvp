import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { generateBudgetSchema, createBudgetSchema, updateBudgetSchema } from '../validators/schemas';
import {
  generateBudgetController,
  listBudgetsController,
  getBudgetController,
  createBudgetController,
  updateBudgetController,
  deleteBudgetController,
  budgetTrackingController,
  exportBudgetController,
} from '../controllers/budget.controller';

const router = Router();
// Données financières : réservé au propriétaire / administrateur.
router.use(authenticate, requireRole('propriétaire', 'administrateur'));

// Génération d'une proposition (sans persistance).
router.post('/generate', validate(generateBudgetSchema), generateBudgetController);

router.get('/', listBudgetsController);
router.post('/', validate(createBudgetSchema), createBudgetController);
router.get('/:id', getBudgetController);
router.put('/:id', validate(updateBudgetSchema), updateBudgetController);
router.delete('/:id', deleteBudgetController);

// Suivi budget vs achats réels.
router.get('/:id/tracking', budgetTrackingController);

// Export PDF / CSV (POST via fetch + blob, GET pour le téléchargement natif du navigateur).
router.post('/:id/export', exportBudgetController);
router.get('/:id/export', exportBudgetController);

export default router;
