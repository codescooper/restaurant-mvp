import { Router } from 'express';
import { authenticate, requireSuperAdmin } from '../middlewares/auth';
import { validate } from '../middlewares/validate';
import { adminReasonSchema, adminListQuerySchema, createArticleSchema, updateArticleSchema, articleStatusSchema } from '../validators/schemas';
import {
  listRestaurantsController,
  activateController,
  suspendController,
  reactivateController,
  rejectController,
} from '../controllers/admin.controller';
import {
  listAdminController,
  createController,
  updateController,
  setStatusController,
  removeController,
} from '../controllers/article.controller';

const router = Router();

// Pas de tenantContext — super-admin opère global via basePrisma.
router.use(authenticate, requireSuperAdmin);

router.get('/restaurants', validate(adminListQuerySchema, 'query'), listRestaurantsController);
router.post('/restaurants/:id/activate', activateController);
router.post('/restaurants/:id/suspend', validate(adminReasonSchema), suspendController);
router.post('/restaurants/:id/reactivate', reactivateController);
router.post('/restaurants/:id/reject', validate(adminReasonSchema), rejectController);

// Articles — blog & success stories (contenu plateforme).
router.get('/articles', listAdminController);
router.post('/articles', validate(createArticleSchema), createController);
router.put('/articles/:id', validate(updateArticleSchema), updateController);
router.post('/articles/:id/status', validate(articleStatusSchema), setStatusController);
router.delete('/articles/:id', removeController);

export default router;
