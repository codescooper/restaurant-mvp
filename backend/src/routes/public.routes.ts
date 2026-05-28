import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { acceptInvitationSchema } from '../validators/schemas';
import {
  peekInvitationController,
  acceptInvitationController,
} from '../controllers/invitation.controller';
import { acceptInviteLimiter, publicReadLimiter } from '../middlewares/rateLimit';
import { getPublicRestaurantController } from '../controllers/public-restaurant.controller';

const router = Router();

// Pas d'auth, pas de tenant context — ces routes sont accessibles à tout le monde.
router.get('/invitations/:token', peekInvitationController);
router.post('/invitations/:token/accept', acceptInviteLimiter, validate(acceptInvitationSchema), acceptInvitationController);

// Page publique restaurant (P2c) — menu + branding, réservé aux restos actifs.
router.get('/restaurants/:slug', publicReadLimiter, getPublicRestaurantController);

export default router;
