import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { dashboardController, exportController } from '../controllers/stats.controller';

const router = Router();
router.use(authenticate, requireRole('administrateur', 'caissier'));

router.get('/dashboard', dashboardController);
router.post('/export', exportController);

export default router;
