import { asyncHandler } from '../utils/asyncHandler';
import { sendSuccess } from '../utils/response';
import * as articleService from '../services/article.service';

// ─── Lecture publique ────────────────────────────────────────────────────────

export const listPublicController = asyncHandler(async (req, res) => {
  const validated = (req as typeof req & { validated?: Record<string, unknown> }).validated ?? {};
  const type = typeof validated.type === 'string' ? validated.type : undefined;
  const category = typeof validated.category === 'string' ? validated.category : undefined;
  sendSuccess(res, await articleService.listPublic({ type, category }));
});

export const getPublicBySlugController = asyncHandler(async (req, res) => {
  sendSuccess(res, await articleService.getPublicBySlug(req.params.slug));
});

// ─── Super-admin ─────────────────────────────────────────────────────────────

export const listAdminController = asyncHandler(async (_req, res) => {
  sendSuccess(res, await articleService.listAdmin());
});

export const createController = asyncHandler(async (req, res) => {
  const userId = req.user!.id;
  sendSuccess(res, await articleService.createArticle(req.body, userId), 201);
});

export const updateController = asyncHandler(async (req, res) => {
  sendSuccess(res, await articleService.updateArticle(Number(req.params.id), req.body));
});

export const setStatusController = asyncHandler(async (req, res) => {
  sendSuccess(res, await articleService.setStatus(Number(req.params.id), req.body.status));
});

export const removeController = asyncHandler(async (req, res) => {
  await articleService.deleteArticle(Number(req.params.id));
  sendSuccess(res, { deleted: true });
});
