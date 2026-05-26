import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { deleteTable, createTable } from '../../services/table.service';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant;
beforeAll(async () => { ({ A } = await resetAndSeedTwoRestaurants()); });
afterAll(async () => { await basePrisma.$disconnect(); });

describe('deleteTable — garde-fous', () => {
  it("refuse la suppression si la table a une commande active non payee", async () => {
    // Récupère la table A déjà seedée.
    const table = (await runWithTenant(A.id, () => prisma.table.findMany()))[0];
    const dish = (await runWithTenant(A.id, () => prisma.dish.findMany()))[0];
    // Crée une commande active sur la table.
    await basePrisma.order.create({
      data: {
        orderNumber: '20260526-001',
        total: 1000, discountAmount: 0, discountPercent: 0, finalTotal: 1000,
        status: 'commandée', isPaid: false, tableId: table.id, restaurantId: A.id,
        items: { create: [{ dishId: dish.id, dishName: dish.name, dishPrice: 1000, quantity: 1, subtotal: 1000 }] },
      },
    });
    await expect(
      runWithTenant(A.id, () => deleteTable(table.id))
    ).rejects.toMatchObject({ statusCode: 409, code: 'TABLE_001' });
  });

  it("refuse la suppression si la table a une reservation active", async () => {
    // Table propre (créée pour ce test).
    const t = await runWithTenant(A.id, () => createTable({ name: 'Table libre', capacity: 2 }));
    await basePrisma.reservation.create({
      data: {
        tableId: t.id, restaurantId: A.id,
        customerName: 'Test', reservedAt: new Date(), durationMinutes: 90, status: 'active',
      },
    });
    await expect(
      runWithTenant(A.id, () => deleteTable(t.id))
    ).rejects.toMatchObject({ statusCode: 409, code: 'TABLE_001' });
  });

  it("supprime proprement si pas de commande/reservation active", async () => {
    const t = await runWithTenant(A.id, () => createTable({ name: 'Table jetable', capacity: 2 }));
    const before = await runWithTenant(A.id, () => prisma.table.findUnique({ where: { id: t.id } }));
    expect(before).not.toBeNull();
    await runWithTenant(A.id, () => deleteTable(t.id));
    const after = await runWithTenant(A.id, () => prisma.table.findUnique({ where: { id: t.id } }));
    expect(after).toBeNull();
  });
});
