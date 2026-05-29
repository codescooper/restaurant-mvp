import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { payrollConfigSchema, payslipSchema, payslipPreviewSchema } from '../validators/schemas';
import {
  getPayrollConfigController,
  setPayrollConfigController,
  payslipPreviewController,
  payslipController,
  disaController,
} from '../controllers/payroll.controller';

const router = Router();
// Données RH sensibles (salaires, cotisations) : réservé à l'administrateur / propriétaire.
router.use(authenticate, requireRole('propriétaire', 'administrateur'));

router.get('/config', getPayrollConfigController);
router.put('/config', validate(payrollConfigSchema), setPayrollConfigController);
router.post('/preview', validate(payslipPreviewSchema), payslipPreviewController);
router.post('/payslip', validate(payslipSchema), payslipController);
router.get('/disa', disaController);

export default router;
