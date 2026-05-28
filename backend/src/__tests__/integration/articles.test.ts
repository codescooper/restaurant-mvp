import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { signAccessToken } from '../../utils/jwt';
import { resetAndSeedTwoRestaurants } from './helpers';

const app = createApp();
let superAdminToken: string;
let ownerToken: string;
let superAdminId: number;

beforeAll(async () => {
  await resetAndSeedTwoRestaurants();

  // Nettoyer les articles éventuellement laissés par d'autres suites
  await basePrisma.article.deleteMany();

  const sa = await basePrisma.user.create({
    data: {
      email: 'sa-articles@test.local',
      passwordHash: await bcrypt.hash('sa', 10),
      displayName: 'SA Articles',
      isSuperAdmin: true,
    },
  });
  superAdminId = sa.id;
  superAdminToken = signAccessToken({ userId: sa.id, isSuperAdmin: true });

  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerToken = login.body.data.accessToken;
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

describe('Articles — super-admin CRUD', () => {
  let articleId: number;
  let articleSlug: string;

  it('POST /api/admin/articles crée un article draft (201, slug généré)', async () => {
    const res = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        type: 'blog',
        title: 'Mon Premier Article',
        content: '# Contenu markdown\n\nCorps de l\'article.',
        excerpt: 'Un aperçu',
        category: 'gestion',
        authorName: 'Alice',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.slug).toBe('mon-premier-article');
    expect(res.body.data.status).toBe('draft');
    expect(res.body.data.publishedAt).toBeNull();
    expect(res.body.data.createdBy).toBe(superAdminId);

    articleId = res.body.data.id;
    articleSlug = res.body.data.slug;
  });

  it('Collision de slug → suffixe -2', async () => {
    const res = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        title: 'Mon Premier Article',
        content: 'Autre contenu.',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('mon-premier-article-2');
  });

  it('GET /api/public/articles ne renvoie PAS les drafts', async () => {
    const res = await request(app).get('/api/public/articles');
    expect(res.status).toBe(200);
    const drafts = (res.body.data as { status: string }[]).filter(a => a.status === 'draft');
    expect(drafts).toHaveLength(0);
  });

  it('POST /api/admin/articles/:id/status publie un article (publishedAt défini)', async () => {
    const res = await request(app)
      .post(`/api/admin/articles/${articleId}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'published' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('published');
    expect(res.body.data.publishedAt).not.toBeNull();
  });

  it('GET /api/public/articles renvoie l\'article publié (sans content)', async () => {
    const res = await request(app).get('/api/public/articles');
    expect(res.status).toBe(200);
    const articles = res.body.data as { slug: string; content?: unknown }[];
    const found = articles.find(a => a.slug === articleSlug);
    expect(found).toBeDefined();
    // La liste publique NE doit pas inclure le content complet
    expect(found).not.toHaveProperty('content');
  });

  it('GET /api/public/articles?type=blog filtre par type', async () => {
    const res = await request(app).get('/api/public/articles?type=blog');
    expect(res.status).toBe(200);
    const articles = res.body.data as { type: string }[];
    expect(articles.every(a => a.type === 'blog')).toBe(true);
  });

  it('GET /api/public/articles/:slug renvoie le contenu complet', async () => {
    const res = await request(app).get(`/api/public/articles/${articleSlug}`);
    expect(res.status).toBe(200);
    expect(res.body.data.slug).toBe(articleSlug);
    expect(res.body.data).toHaveProperty('content');
    expect(typeof res.body.data.content).toBe('string');
  });

  it('GET /api/public/articles/:slug retourne 404 pour un draft', async () => {
    // Le second article (slug -2) est encore draft
    const res = await request(app).get('/api/public/articles/mon-premier-article-2');
    expect(res.status).toBe(404);
  });

  it('PUT /api/admin/articles/:id met à jour un article', async () => {
    const res = await request(app)
      .put(`/api/admin/articles/${articleId}`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ excerpt: 'Nouvel aperçu', category: 'marketing' });

    expect(res.status).toBe(200);
    expect(res.body.data.excerpt).toBe('Nouvel aperçu');
    expect(res.body.data.category).toBe('marketing');
    // Le slug ne change pas (article déjà publié)
    expect(res.body.data.slug).toBe(articleSlug);
  });

  it('GET /api/admin/articles liste tous les articles (draft + published)', async () => {
    const res = await request(app)
      .get('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    const articles = res.body.data as { status: string }[];
    expect(articles.length).toBeGreaterThanOrEqual(2);
    const statuses = [...new Set(articles.map(a => a.status))];
    expect(statuses).toContain('draft');
    expect(statuses).toContain('published');
  });

  it('Propriétaire non super-admin refusé sur POST /api/admin/articles (403)', async () => {
    const res = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ title: 'Hack', content: 'Tentative.' });

    expect(res.status).toBe(403);
  });

  it('DELETE /api/admin/articles/:id supprime un article', async () => {
    // Créer un article à supprimer
    const create = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ title: 'À Supprimer', content: 'Contenu temporaire.' });
    const idToDelete = create.body.data.id;

    const del = await request(app)
      .delete(`/api/admin/articles/${idToDelete}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(del.status).toBe(200);
    expect(del.body.data.deleted).toBe(true);

    // Vérifier que l'article n'existe plus
    const check = await basePrisma.article.findUnique({ where: { id: idToDelete } });
    expect(check).toBeNull();
  });

  it('DELETE /api/admin/articles/:id retourne 404 si inexistant', async () => {
    const res = await request(app)
      .delete('/api/admin/articles/999999')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(404);
  });

  it('POST /api/admin/articles valide le type (VALIDATION_001 si invalide)', async () => {
    const res = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ type: 'inexistant', title: 'X', content: 'Y' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_001');
  });

  it('Success story : featuredName est accepté', async () => {
    const res = await request(app)
      .post('/api/admin/articles')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({
        type: 'success_story',
        title: 'Histoire de Karaté',
        content: 'Contenu success story.',
        featuredName: 'Restaurant Les Délices',
      });

    expect(res.status).toBe(201);
    expect(res.body.data.type).toBe('success_story');
    expect(res.body.data.featuredName).toBe('Restaurant Les Délices');
  });
});
