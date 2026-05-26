import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant, runUnscoped } from '../../config/tenant-context';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant; let B: SeededRestaurant;

beforeAll(async () => { ({ A, B } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('Isolation tenant (stratégie A)', () => {
  it('findMany ne renvoie que les données du restaurant courant', async () => {
    const dishesA = await runWithTenant(A.id, () => prisma.dish.findMany());
    const dishesB = await runWithTenant(B.id, () => prisma.dish.findMany());
    expect(dishesA).toHaveLength(1);
    expect(dishesB).toHaveLength(1);
    expect(dishesA[0].restaurantId).toBe(A.id);
    expect(dishesB[0].restaurantId).toBe(B.id);
  });

  it('create injecte automatiquement le restaurantId courant', async () => {
    const created = await runWithTenant(A.id, () => prisma.stockItem.create({ data: { name: 'Riz', quantity: 10, unit: 'kg' } }));
    expect(created.restaurantId).toBe(A.id);
  });

  it('findUnique (réécrit en findFirst) refuse un id d\'un autre restaurant', async () => {
    const dishA = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    const seenFromB = await runWithTenant(B.id, () => prisma.dish.findUnique({ where: { id: dishA.id } }));
    expect(seenFromB).toBeNull();
  });

  it('count/aggregate sont scopés', async () => {
    const countA = await runWithTenant(A.id, () => prisma.dish.count());
    expect(countA).toBe(1);
  });

  it('updateMany d\'un restaurant n\'affecte pas l\'autre', async () => {
    await runWithTenant(A.id, () => prisma.dish.updateMany({ data: { isActive: false } }));
    const stillActiveB = await runWithTenant(B.id, () => prisma.dish.findMany({ where: { isActive: true } }));
    expect(stillActiveB).toHaveLength(1);
  });

  it('refus par défaut : une opération tenant hors contexte lève', async () => {
    await expect(prisma.dish.findMany()).rejects.toThrow(/TENANT_CONTEXT_MISSING/);
  });

  it('runUnscoped permet au super-admin de voir tous les restaurants', async () => {
    const all = await runUnscoped(() => prisma.dish.findMany());
    expect(all.length).toBeGreaterThanOrEqual(2);
  });
});
