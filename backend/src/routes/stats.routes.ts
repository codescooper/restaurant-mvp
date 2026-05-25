import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { dashboardController, reportController, productReportController } from '../controllers/stats.controller';

const router = Router();
router.use(authenticate, requireRole('administrateur', 'caissier'));

router.get('/dashboard', dashboardController);
// Rapports (PDF/CSV) sur une plage de dates.
// POST (fetch + blob) et GET (téléchargement natif du navigateur, token en query) supportés.
router.post('/report', reportController);
router.get('/report', reportController);
router.post('/product-report', productReportController);
router.get('/product-report', productReportController);

export default router;
