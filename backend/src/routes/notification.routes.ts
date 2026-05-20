import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import { listNotificationsController, markReadController } from '../controllers/notification.controller';

const router = Router();
router.use(authenticate);

router.get('/', listNotificationsController);
router.patch('/:id/read', markReadController);

export default router;
