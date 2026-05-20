import { Router } from 'express';
import authRoutes from './auth.routes';
import stockRoutes from './stock.routes';
import dishRoutes from './dish.routes';
import userRoutes from './user.routes';
import orderRoutes from './order.routes';
import tableRoutes from './table.routes';
import statsRoutes from './stats.routes';
import notificationRoutes from './notification.routes';
import syncRoutes from './sync.routes';

const router = Router();

router.get('/health', (_req, res) => res.json({ success: true, data: { status: 'ok' } }));

router.use('/auth', authRoutes);
router.use('/stock', stockRoutes);
router.use('/dishes', dishRoutes);
router.use('/users', userRoutes);
router.use('/orders', orderRoutes);
router.use('/tables', tableRoutes);
router.use('/stats', statsRoutes);
router.use('/notifications', notificationRoutes);
router.use('/sync', syncRoutes);

export default router;
