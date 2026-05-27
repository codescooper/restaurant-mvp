import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { runWithTenant, runUnscoped } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants } from './helpers';
import * as adminService from '../../services/admin.service';

const app = createApp();

beforeAll(async () => { await resetAndSeedTwoRestaurants(); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Signup', () => {
  it('cree un User + Restaurant pending + Membership proprietaire', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'test-signup@test.local', password: 'pass1234', displayName: 'Test', restaurantName: 'Chez Test',
    });
    expect(res.status).toBe(201);
    const data = res.body.data;
    expect(data.user.email).toBe('test-signup@test.local');
    expect(data.memberships).toHaveLength(1);
    expect(data.memberships[0].role).toBe('propriétaire');
    const resto = await basePrisma.restaurant.findFirst({ where: { name: 'Chez Test' } });
    expect(resto?.status).toBe('pending');
    expect(resto?.slug).toBe('chez-test');
  });

  it('refuse un email deja utilise', async () => {
    await request(app).post('/api/auth/signup').send({ email: 'dup@test.local', password: 'pass1234', displayName: 'A', restaurantName: 'R1' });
    const res = await request(app).post('/api/auth/signup').send({ email: 'dup@test.local', password: 'pass1234', displayName: 'B', restaurantName: 'R2' });
    expect(res.status).toBe(409);
  });

  it('genere un slug unique en cas de collision', async () => {
    // Utilise le service directement pour éviter le rate-limiter signup (max 3 / heure)
    const { signup } = await import('../../services/signup.service');
    await signup({ email: 'a@s.local', password: 'pass1234', displayName: 'A', restaurantName: 'Le Lion' });
    await signup({ email: 'b@s.local', password: 'pass1234', displayName: 'B', restaurantName: 'Le Lion' });
    const lions = await basePrisma.restaurant.findMany({ where: { name: 'Le Lion' }, orderBy: { id: 'asc' } });
    expect(lions[0].slug).toBe('le-lion');
    expect(lions[1].slug).toBe('le-lion-2');
  });
});

describe('Activation avec reset', () => {
  it('supprime les donnees simulation + restaure stock baseline + status active', async () => {
    // Resto pending avec stock baseline 50, qui a "consomme" 5kg via simulation.
    const { resto } = await createPendingRestoWithData();
    await runWithTenant(resto.id, async () => {
      const stock = await basePrisma.stockItem.findFirst({ where: { restaurantId: resto.id } });
      expect(stock?.baselineQuantity).toBe(50);
      expect(stock?.quantity).toBe(45);   // 50 - 5 consommé en simulation
    });
    // Activation.
    const res = await runUnscoped(() => adminService.activateRestaurant(resto.id));
    expect(res.status).toBe('active');
    expect(res.deletedCounts.orders).toBeGreaterThan(0);
    // Verifications post-activation.
    const restoAfter = await basePrisma.restaurant.findUnique({ where: { id: resto.id } });
    expect(restoAfter?.status).toBe('active');
    expect(restoAfter?.activatedAt).toBeTruthy();
    const stockAfter = await basePrisma.stockItem.findFirst({ where: { restaurantId: resto.id } });
    expect(stockAfter?.quantity).toBe(50);            // restaure
    expect(stockAfter?.baselineQuantity).toBeNull();  // nettoye
    const orders = await basePrisma.order.count({ where: { restaurantId: resto.id } });
    expect(orders).toBe(0);
  });
});

async function createPendingRestoWithData() {
  // Cree user + resto pending + 1 stock 50kg + 1 plat + 2 commandes simulation consommant 5kg total
  const user = await basePrisma.user.create({
    data: { email: 'pending-test@s.local', passwordHash: 'x', displayName: 'P', isSuperAdmin: false },
  });
  const resto = await basePrisma.restaurant.create({
    data: { name: 'Pending Test', slug: 'pending-test-' + Date.now(), status: 'pending' },
  });
  await basePrisma.membership.create({ data: { userId: user.id, restaurantId: resto.id, role: 'propriétaire' } });
  const stock = await basePrisma.stockItem.create({
    data: { name: 'Riz', quantity: 45, baselineQuantity: 50, unit: 'kg', restaurantId: resto.id },
  });
  const dish = await basePrisma.dish.create({
    data: { name: 'Riz Sauce', price: 1000, restaurantId: resto.id },
  });
  // 2 commandes de simulation, chacune décrémente 2.5kg
  for (let i = 0; i < 2; i++) {
    await basePrisma.order.create({
      data: {
        orderNumber: `${new Date().toISOString().slice(0,10).replace(/-/g,'')}-00${i+1}`,
        total: 1000, discountAmount: 0, discountPercent: 0, finalTotal: 1000,
        status: 'commandée', isPaid: false, restaurantId: resto.id,
        items: { create: [{ dishId: dish.id, dishName: 'Riz Sauce', dishPrice: 1000, quantity: 1, subtotal: 1000 }] },
      },
    });
    await basePrisma.stockMovement.create({
      data: { stockItemId: stock.id, restaurantId: resto.id, movementType: 'commande', quantity: -2.5, previousQuantity: 0, newQuantity: 0 },
    });
  }
  return { user, resto };
}
