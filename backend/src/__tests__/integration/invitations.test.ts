import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcrypt';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();
let A: SeededRestaurant;
let ownerToken: string;

beforeAll(async () => {
  ({ A } = await resetAndSeedTwoRestaurants());
  // Login le proprietaire pour avoir un token scope sur resto A
  const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerToken = login.body.data.accessToken;
});
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Invitations lifecycle', () => {
  it('cree une invitation + URL', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'newbie@test.local', role: 'serveur' });
    expect(res.status).toBe(201);
    expect(res.body.data.token).toHaveLength(64);
    expect(res.body.data.url).toContain('/invite/');
  });

  it('refuse une 2e invitation pendante pour le meme email', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'newbie@test.local', role: 'cuisinier' });
    expect(res.status).toBe(409);
  });

  it('peek public renvoie infos sans secrets', async () => {
    const list = await request(app).get('/api/invitations').set('Authorization', `Bearer ${ownerToken}`);
    const token = list.body.data[0].token;
    const res = await request(app).get(`/api/public/invitations/${token}`);
    expect(res.status).toBe(200);
    expect(res.body.data.restaurantName).toBe('Resto A');
    expect(res.body.data.emailExists).toBe(false);
  });

  it('accept (nouveau user) cree User + Membership', async () => {
    const list = await request(app).get('/api/invitations').set('Authorization', `Bearer ${ownerToken}`);
    const token = list.body.data[0].token;
    const res = await request(app).post(`/api/public/invitations/${token}/accept`)
      .send({ password: 'newpass1', displayName: 'Newbie' });
    expect(res.status).toBe(200);
    expect(res.body.data.memberships.some((m: { restaurantId: number }) => m.restaurantId === A.id)).toBe(true);
    const inv = await basePrisma.invitation.findUnique({ where: { token } });
    expect(inv?.status).toBe('accepted');
  });

  it('accept (email existant) demande login-first', async () => {
    // Cree un user pre-existant
    await basePrisma.user.create({ data: { email: 'existing@test.local', passwordHash: await bcrypt.hash('mypwd123', 10), displayName: 'Ex', isSuperAdmin: false } });
    const inv = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'existing@test.local', role: 'caissier' });
    const token = inv.body.data.token;
    const peek = await request(app).get(`/api/public/invitations/${token}`);
    expect(peek.body.data.emailExists).toBe(true);
    // Mauvais password -> 401
    const wrong = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'wrongpwd' });
    expect(wrong.status).toBe(401);
    // Bon password -> 200
    const ok = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'mypwd123' });
    expect(ok.status).toBe(200);
  });

  it('revoke marque status revoked', async () => {
    const create = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'tobe-revoked@test.local', role: 'serveur' });
    const id = create.body.data.id;
    await request(app).delete(`/api/invitations/${id}`).set('Authorization', `Bearer ${ownerToken}`);
    const inv = await basePrisma.invitation.findUnique({ where: { id } });
    expect(inv?.status).toBe('revoked');
  });

  it('accept sur lien revoke renvoie 410', async () => {
    const create = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'revoke-then@test.local', role: 'serveur' });
    const { token, id } = create.body.data;
    await request(app).delete(`/api/invitations/${id}`).set('Authorization', `Bearer ${ownerToken}`);
    const res = await request(app).post(`/api/public/invitations/${token}/accept`).send({ password: 'pwd123' });
    expect(res.status).toBe(410);
  });

  it('refuse role proprietaire', async () => {
    const res = await request(app).post('/api/invitations').set('Authorization', `Bearer ${ownerToken}`)
      .send({ email: 'evil@test.local', role: 'propriétaire' });
    expect(res.status).toBe(400);
  });
});
