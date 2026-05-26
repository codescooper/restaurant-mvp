import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { dashboardController, exportController } from '../controllers/stats.controller';
import { validate } from '../middlewares/validate';
import { dashboardRangeSchema, exportRangeSchema } from '../validators/schemas';

const router = Router();
router.use(authenticate, requireRole('propriétaire', 'administrateur', 'caissier'));

router.get('/dashboard', validate(dashboardRangeSchema, 'query'), dashboardController);
// POST (fetch + blob) et GET (téléchargement natif du navigateur, token en query) supportés.
router.post('/export', validate(exportRangeSchema), exportController);
router.get('/export', validate(exportRangeSchema, 'query'), exportController);

export default router;
