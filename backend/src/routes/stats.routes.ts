import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { dashboardController, exportController } from '../controllers/stats.controller';

const router = Router();
router.use(authenticate, requireRole('administrateur', 'caissier'));

router.get('/dashboard', dashboardController);
// POST (fetch + blob) et GET (téléchargement natif du navigateur, token en query) supportés.
router.post('/export', exportController);
router.get('/export', exportController);

export default router;
