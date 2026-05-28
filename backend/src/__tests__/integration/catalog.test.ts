import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { signAccessToken } from '../../utils/jwt';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();

let A: SeededRestaurant;
let ownerTokenA: string;
let ownerTokenB: string;
let superAdminToken: string;

beforeAll(async () => {
  ({ A } = await resetAndSeedTwoRestaurants());

  // Super-admin
  const sa = await basePrisma.user.create({
    data: {
      email: 'sa-catalog@test.local',
      passwordHash: await bcrypt.hash('sa', 10),
      displayName: 'SA',
      isSuperAdmin: true,
    },
  });
  superAdminToken = signAccessToken({ userId: sa.id, isSuperAdmin: true });

  // Login comme propriétaire de A
  const loginA = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerTokenA = loginA.body.data.accessToken;

  // Login comme propriétaire de B
  const loginB = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner-resto-b@test.local', password: 'pass123' });
  ownerTokenB = loginB.body.data.accessToken;
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

describe('Catalog requests — tenant (restaurant)', () => {
  it('proprio A crée une demande → 201', async () => {
    const res = await request(app)
      .post('/api/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ platforms: ['Yango Food', 'Glovo'], message: 'Nous souhaitons être référencés.' });

    expect(res.status).toBe(201);
    expect(res.body.data.platforms).toEqual(['Yango Food', 'Glovo']);
    expect(res.body.data.status).toBe('pending');
    expect(res.body.data.restaurantId).toBe(A.id);
  });

  it('2e demande pending même resto → 409 CATALOG_002', async () => {
    const res = await request(app)
      .post('/api/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ platforms: ['Uber Eats'] });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CATALOG_002');
  });

  it('listMine du resto A liste sa propre demande', async () => {
    const res = await request(app)
      .get('/api/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
    expect(res.body.data.every((d: { restaurantId: number }) => d.restaurantId === A.id)).toBe(true);
  });

  it('isolation : listMine du resto B ne voit PAS les demandes de A', async () => {
    const res = await request(app)
      .get('/api/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenB}`);

    expect(res.status).toBe(200);
    // Le resto B n'a aucune demande → tableau vide, ou aucune demande appartenant à A
    expect(res.body.data.every((d: { restaurantId: number }) => d.restaurantId !== A.id)).toBe(true);
  });

  it('proprio refusé sur /admin/catalog-requests → 403', async () => {
    const res = await request(app)
      .get('/api/admin/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenA}`);

    expect(res.status).toBe(403);
  });
});

describe('Catalog requests — super-admin', () => {
  it('super-admin GET /admin/catalog-requests voit la demande avec infos restaurant', async () => {
    const res = await request(app)
      .get('/api/admin/catalog-requests')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);

    const req = res.body.data.find((d: { restaurantId: number }) => d.restaurantId === A.id);
    expect(req).toBeDefined();
    expect(req.restaurant).toBeDefined();
    expect(req.restaurant.name).toBe('Resto A');
  });

  it('super-admin setStatus → in_progress (processedAt set)', async () => {
    // Récupérer l'id de la demande de A
    const list = await request(app)
      .get('/api/admin/catalog-requests')
      .set('Authorization', `Bearer ${superAdminToken}`);
    const catalogReq = list.body.data.find((d: { restaurantId: number }) => d.restaurantId === A.id);

    const res = await request(app)
      .post(`/api/admin/catalog-requests/${catalogReq.id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'in_progress', adminNote: 'En cours de traitement.' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('in_progress');
    expect(res.body.data.processedAt).not.toBeNull();
    expect(res.body.data.adminNote).toBe('En cours de traitement.');
  });

  it('super-admin setStatus → done (processedAt mis à jour)', async () => {
    const list = await request(app)
      .get('/api/admin/catalog-requests')
      .set('Authorization', `Bearer ${superAdminToken}`);
    const catalogReq = list.body.data.find((d: { restaurantId: number }) => d.restaurantId === A.id);

    const res = await request(app)
      .post(`/api/admin/catalog-requests/${catalogReq.id}/status`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'done' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('done');
    expect(res.body.data.processedAt).not.toBeNull();
  });

  it('super-admin filtre par status=done', async () => {
    const res = await request(app)
      .get('/api/admin/catalog-requests?status=done')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.every((d: { status: string }) => d.status === 'done')).toBe(true);
  });

  it('setStatus 404 sur id inexistant → CATALOG_001', async () => {
    const res = await request(app)
      .post('/api/admin/catalog-requests/999999/status')
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({ status: 'rejected' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('CATALOG_001');
  });

  it('proprio du resto A peut créer une nouvelle demande après que la précédente est done', async () => {
    // La précédente est maintenant "done" — plus de blocage
    const res = await request(app)
      .post('/api/catalog-requests')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ platforms: ['Jumia Food'] });

    expect(res.status).toBe(201);
    expect(res.body.data.status).toBe('pending');
  });
});
