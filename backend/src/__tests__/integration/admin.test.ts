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

beforeAll(async () => {
  await resetAndSeedTwoRestaurants();
  const sa = await basePrisma.user.create({
    data: { email: 'sa@test.local', passwordHash: await bcrypt.hash('sa', 10), displayName: 'SA', isSuperAdmin: true },
  });
  superAdminToken = signAccessToken({ userId: sa.id, isSuperAdmin: true });
  const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerToken = login.body.data.accessToken;
});
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Super-admin', () => {
  it('proprio refuse acces a /api/admin/*', async () => {
    const res = await request(app).get('/api/admin/restaurants').set('Authorization', `Bearer ${ownerToken}`);
    expect(res.status).toBe(403);
  });

  it('super-admin liste tous les restaurants', async () => {
    const res = await request(app).get('/api/admin/restaurants').set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
  });

  it('reject impose une raison sur un pending', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'Spam Resto', slug: 'spam-r', status: 'pending' } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/reject`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'Faux nom' });
    expect(res.status).toBe(200);
    const after = await basePrisma.restaurant.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('rejected');
    expect(after?.rejectedReason).toBe('Faux nom');
  });

  it('suspend uniquement un actif', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'X', slug: 'x-' + Date.now(), status: 'pending' } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/suspend`).set('Authorization', `Bearer ${superAdminToken}`).send({ reason: 'test' });
    expect(res.status).toBe(400);
  });

  it('reactivate fait passer suspended -> active', async () => {
    const r = await basePrisma.restaurant.create({ data: { name: 'Y', slug: 'y-' + Date.now(), status: 'suspended', suspendedAt: new Date() } });
    const res = await request(app).post(`/api/admin/restaurants/${r.id}/reactivate`).set('Authorization', `Bearer ${superAdminToken}`);
    expect(res.status).toBe(200);
    const after = await basePrisma.restaurant.findUnique({ where: { id: r.id } });
    expect(after?.status).toBe('active');
    expect(after?.suspendedAt).toBeNull();
  });
});
