import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { tenantContext } from '../middlewares/tenant';
import { validate } from '../middlewares/validate';
import { createInvitationSchema } from '../validators/schemas';
import {
  listInvitationsController,
  createInvitationController,
  revokeInvitationController,
} from '../controllers/invitation.controller';

const router = Router();

router.use(authenticate, tenantContext);
router.get('/', requireRole('propriétaire', 'administrateur'), listInvitationsController);
router.post('/', requireRole('propriétaire', 'administrateur'), validate(createInvitationSchema), createInvitationController);
router.delete('/:id', requireRole('propriétaire', 'administrateur'), revokeInvitationController);

export default router;
