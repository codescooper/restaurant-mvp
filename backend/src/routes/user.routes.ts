import { Router } from 'express';
import { authenticate, requireRole } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { createUserSchema, updateUserSchema } from '../validators/schemas';
import {
  listUsersController,
  createUserController,
  updateUserController,
  toggleUserController,
  deleteUserController,
} from '../controllers/user.controller';

const router = Router();
router.use(authenticate, requireRole('propriétaire', 'administrateur'));

router.get('/', listUsersController);
router.post('/', validate(createUserSchema), createUserController);
router.put('/:id', validate(updateUserSchema), updateUserController);
router.patch('/:id/toggle-active', toggleUserController);
router.delete('/:id', deleteUserController);

export default router;
