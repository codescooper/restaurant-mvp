import { Router } from 'express';
import { validate } from '../middlewares/validate';
import { acceptInvitationSchema } from '../validators/schemas';
import {
  peekInvitationController,
  acceptInvitationController,
} from '../controllers/invitation.controller';

const router = Router();

// Pas d'auth, pas de tenant context — ces routes sont accessibles à tout le monde.
router.get('/invitations/:token', peekInvitationController);
router.post('/invitations/:token/accept', validate(acceptInvitationSchema), acceptInvitationController);

export default router;
