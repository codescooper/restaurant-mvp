import { Router } from 'express';
import { loginController, refreshController, meController, switchRestaurantController } from '../controllers/auth.controller';
import { validate } from '../middlewares/validate';
import { loginSchema, refreshSchema, switchRestaurantSchema } from '../validators/schemas';
import { loginLimiter } from '../middlewares/rateLimit';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/login', loginLimiter, validate(loginSchema), loginController);
router.post('/refresh', validate(refreshSchema), refreshController);
router.post('/switch-restaurant', authenticate, validate(switchRestaurantSchema), switchRestaurantController);
router.get('/me', authenticate, meController);

export default router;
