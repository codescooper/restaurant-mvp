import { basePrisma } from '../config/prisma';
import { AppError } from '../utils/errors';
import { slugify } from '../utils/slug';

// Champs publics renvoyés dans les listes (sans le content complet).
const PUBLIC_LIST_SELECT = {
  id: true,
  type: true,
  title: true,
  slug: true,
  excerpt: true,
  coverUrl: true,
  category: true,
  authorName: true,
  featuredName: true,
  publishedAt: true,
} as const;

// Trouve un slug libre en ajoutant un suffixe -2, -3… en cas de collision.
async function findFreeSlug(base: string, excludeId?: number): Promise<string> {
  let candidate = base || 'article';
  let suffix = 1;
  for (;;) {
    const taken = await basePrisma.article.findUnique({ where: { slug: candidate } });
    if (!taken || taken.id === excludeId) return candidate;
    suffix += 1;
    candidate = `${base}-${suffix}`.slice(0, 220);
  }
}

// ─── Lecture publique ────────────────────────────────────────────────────────

export async function listPublic(filter: { type?: string; category?: string }) {
  return basePrisma.article.findMany({
    where: {
      status: 'published',
      ...(filter.type ? { type: filter.type } : {}),
      ...(filter.category ? { category: filter.category } : {}),
    },
    orderBy: { publishedAt: 'desc' },
    select: PUBLIC_LIST_SELECT,
    take: 100, // garde-fou : éviter une liste non bornée si le catalogue grandit
  });
}

export async function getPublicBySlug(slug: string) {
  const article = await basePrisma.article.findUnique({ where: { slug } });
  if (!article || article.status !== 'published') {
    throw new AppError(404, 'ARTICLE_001');
  }
  return article;
}

// ─── Administration ──────────────────────────────────────────────────────────

export async function listAdmin(filter?: { type?: string; status?: string }) {
  return basePrisma.article.findMany({
    where: {
      ...(filter?.type ? { type: filter.type } : {}),
      ...(filter?.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: {
      creator: { select: { id: true, displayName: true, email: true } },
    },
  });
}

export async function createArticle(
  input: {
    type?: string;
    title: string;
    excerpt?: string;
    content: string;
    coverUrl?: string;
    category?: string;
    authorName?: string;
    featuredName?: string;
    status?: string;
  },
  userId: number
) {
  const baseSlug = slugify(input.title);
  const slug = await findFreeSlug(baseSlug);

  const status = input.status ?? 'draft';
  const publishedAt = status === 'published' ? new Date() : null;

  return basePrisma.article.create({
    data: {
      type: input.type ?? 'blog',
      title: input.title,
      slug,
      excerpt: input.excerpt ?? null,
      content: input.content,
      coverUrl: input.coverUrl ?? null,
      category: input.category ?? null,
      authorName: input.authorName ?? null,
      featuredName: input.featuredName ?? null,
      status,
      publishedAt,
      createdBy: userId,
    },
  });
}

export async function updateArticle(
  id: number,
  input: {
    type?: string;
    title?: string;
    excerpt?: string;
    content?: string;
    coverUrl?: string;
    category?: string;
    authorName?: string;
    featuredName?: string;
    status?: string;
  }
) {
  const existing = await basePrisma.article.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'ARTICLE_001');

  // Si le titre change mais qu'aucun slug explicite n'est fourni :
  // ne casse pas un slug déjà publié — on garde l'existant.
  // (Un slug explicite n'est pas dans l'input ; si un jour on l'expose, on régénère.)
  let slug = existing.slug;
  if (input.title && input.title !== existing.title && existing.status !== 'published') {
    const baseSlug = slugify(input.title);
    slug = await findFreeSlug(baseSlug, id);
  }

  // Gestion du publishedAt si on passe à published via update
  let publishedAt = existing.publishedAt;
  if (input.status === 'published' && !existing.publishedAt) {
    publishedAt = new Date();
  }

  return basePrisma.article.update({
    where: { id },
    data: {
      ...(input.type !== undefined ? { type: input.type } : {}),
      ...(input.title !== undefined ? { title: input.title, slug } : {}),
      ...(input.excerpt !== undefined ? { excerpt: input.excerpt } : {}),
      ...(input.content !== undefined ? { content: input.content } : {}),
      ...(input.coverUrl !== undefined ? { coverUrl: input.coverUrl } : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.authorName !== undefined ? { authorName: input.authorName } : {}),
      ...(input.featuredName !== undefined ? { featuredName: input.featuredName } : {}),
      ...(input.status !== undefined ? { status: input.status, publishedAt } : {}),
    },
  });
}

export async function setStatus(id: number, status: 'draft' | 'published') {
  const existing = await basePrisma.article.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'ARTICLE_001');

  const publishedAt =
    status === 'published' && !existing.publishedAt ? new Date() : existing.publishedAt;

  return basePrisma.article.update({
    where: { id },
    data: { status, publishedAt },
  });
}

export async function deleteArticle(id: number) {
  const existing = await basePrisma.article.findUnique({ where: { id } });
  if (!existing) throw new AppError(404, 'ARTICLE_001');
  return basePrisma.article.delete({ where: { id } });
}
