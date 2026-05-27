import { Router, Request, Response } from 'express';
import { authenticate } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import { sendError } from '../utils/response';
import authRoutes from './auth.routes';
import stockRoutes from './stock.routes';
import dishRoutes from './dish.routes';
import userRoutes from './user.routes';
import orderRoutes from './order.routes';
import tableRoutes from './table.routes';
import statsRoutes from './stats.routes';
import notificationRoutes from './notification.routes';
import syncRoutes from './sync.routes';
import cashRoutes from './cash.routes';
import auditRoutes from './audit.routes';
import supplierRoutes from './supplier.routes';
import employeeRoutes from './employee.routes';
import expenseRoutes from './expense.routes';
import inventoryRoutes from './inventory.routes';
import promotionRoutes from './promotion.routes';
import settingsRoutes from './settings.routes';
import publicRoutes from './public.routes';
import invitationRoutes from './invitation.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', authRoutes);
router.use('/public', publicRoutes);

// Toutes les routes suivantes sont scopées : auth (pose req.restaurantId) puis ouverture du contexte.
// tenantContext est branché par route pour ne pas intercepter les routes inconnues (→ 404).
const tenant = [authenticate, tenantContext] as const;

router.use('/stock', ...tenant, stockRoutes);
router.use('/dishes', ...tenant, dishRoutes);
router.use('/users', ...tenant, userRoutes);
router.use('/orders', ...tenant, orderRoutes);
router.use('/tables', ...tenant, tableRoutes);
router.use('/stats', ...tenant, statsRoutes);
router.use('/notifications', ...tenant, notificationRoutes);
router.use('/sync', ...tenant, syncRoutes);
router.use('/cash', ...tenant, cashRoutes);
router.use('/audit', ...tenant, auditRoutes);
router.use('/suppliers', ...tenant, supplierRoutes);
router.use('/employees', ...tenant, employeeRoutes);
router.use('/expenses', ...tenant, expenseRoutes);
router.use('/inventory', ...tenant, inventoryRoutes);
router.use('/promotions', ...tenant, promotionRoutes);
router.use('/settings', ...tenant, settingsRoutes);
router.use('/invitations', invitationRoutes);

// Route inconnue dans l'espace /api → 404 (l'authenticate ne doit pas intercepter avant le 404 handler global).
router.use((_req: Request, res: Response) => sendError(res, 404, 'INTERNAL_001', 'Route introuvable'));

export default router;
