import { Router } from 'express';
import { loginController, refreshController, meController, switchRestaurantController } from '../controllers/auth.controller';
import { signupController } from '../controllers/signup.controller';
import { validate } from '../middlewares/validate';
import { loginSchema, refreshSchema, switchRestaurantSchema, signupSchema } from '../validators/schemas';
import { loginLimiter, signupLimiter } from '../middlewares/rateLimit';
import { authenticate } from '../middlewares/auth';

const router = Router();

router.post('/signup', signupLimiter, validate(signupSchema), signupController);
router.post('/login', loginLimiter, validate(loginSchema), loginController);
router.post('/refresh', validate(refreshSchema), refreshController);
router.post('/switch-restaurant', authenticate, validate(switchRestaurantSchema), switchRestaurantController);
router.get('/me', authenticate, meController);

export default router;
