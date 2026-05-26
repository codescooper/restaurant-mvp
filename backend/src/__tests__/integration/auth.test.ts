import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();
let A: SeededRestaurant; let B: SeededRestaurant;

beforeAll(async () => { ({ A, B } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Auth multi-tenant', () => {
  it('login par email auto-sélectionne quand un seul restaurant', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.data.memberships).toHaveLength(1);
    expect(res.body.data.accessToken).toBeTruthy();
  });

  it('mauvais mot de passe → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'x' });
    expect(res.status).toBe(401);
  });

  it('un token du resto A ne lit pas le stock du resto B', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    const token = login.body.data.accessToken;
    // crée un stock côté B directement
    await runWithTenant(B.id, () => prisma.stockItem.create({ data: { name: 'SecretB', quantity: 5, unit: 'kg' } }));
    const res = await request(app).get('/api/stock').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const names = (res.body.data as { name: string }[]).map((s) => s.name);
    expect(names).not.toContain('SecretB');
  });

  it('switch-restaurant refuse un restaurant sans membership', async () => {
    const login = await request(app).post('/api/auth/login').send({ email: 'owner-resto-a@test.local', password: 'pass123' });
    const token = login.body.data.accessToken;
    const res = await request(app).post('/api/auth/switch-restaurant').set('Authorization', `Bearer ${token}`).send({ restaurantId: B.id });
    expect(res.status).toBe(403);
  });
});

describe('Numéro de commande par restaurant', () => {
  it('chaque restaurant a sa propre séquence', async () => {
    const { createOrder } = await import('../../services/order.service');
    const dishA = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    const dishB = (await runWithTenant(B.id, () => prisma.dish.findMany()))[0];
    const o1 = await runWithTenant(A.id, () => createOrder({ items: [{ dishId: dishA.id, quantity: 1 }] }, A.ownerId));
    const o2 = await runWithTenant(B.id, () => createOrder({ items: [{ dishId: dishB.id, quantity: 1 }] }, B.ownerId));
    // Les deux premières commandes du jour finissent toutes deux en -001 (séquences indépendantes).
    expect(o1.orderNumber.endsWith('-001')).toBe(true);
    expect(o2.orderNumber.endsWith('-001')).toBe(true);
    expect(o1.restaurantId).toBe(A.id);
    expect(o2.restaurantId).toBe(B.id);
  });
});
