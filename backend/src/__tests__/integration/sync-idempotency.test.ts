/**
 * Tests d'intégration — idempotence du sync hors-ligne.
 *
 * Bug : `clientId` (UUID généré au moment de la mise en file côté caisse) n'est ni persisté
 * ni vérifié au sync. Si la réponse HTTP se perd (timeout réseau), la commande reste dans la
 * file Dexie et est ré-envoyée → createOrder s'exécute une 2e fois → DOUBLON (double vente,
 * double décrément de stock, double encaissement).
 *
 * Invariant attendu : rejouer le même `clientId` ne doit créer qu'UNE commande et renvoyer
 * `status: 'duplicate'` pour les rejeux, avec le stock décrémenté une seule fois.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { syncOrders } from '../../services/sync.service';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant;

beforeAll(async () => {
  ({ A } = await resetAndSeedTwoRestaurants());
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

/** Crée un article de stock (qty initiale) + un plat qui en consomme `needPerUnit` par unité. */
async function seedRecipeDish(restaurantId: number, stockQuantity: number, needPerUnit: number) {
  const stock = await basePrisma.stockItem.create({
    data: { name: `Stock-sync-${Math.round(stockQuantity * 1000)}`, quantity: stockQuantity, unit: 'kg', alertThreshold: 0, restaurantId },
  });
  const dish = await basePrisma.dish.create({
    data: { name: `Plat-sync-${stock.id}`, price: 500, restaurantId, ingredients: { create: [{ stockItemId: stock.id, quantityNeeded: needPerUnit }] } },
  });
  return { stock, dish };
}

describe('Sync offline — idempotence (clientId)', () => {
  it('rejouer le même clientId ne crée pas de doublon', async () => {
    const { stock, dish } = await seedRecipeDish(A.id, 10, 2);
    const offlineOrder = { clientId: 'client-uuid-fixe-1', items: [{ dishId: dish.id, quantity: 1 }] };

    const before = await basePrisma.order.count({ where: { restaurantId: A.id } });

    const r1 = await runWithTenant(A.id, () => syncOrders([offlineOrder], A.cashierId));
    const r2 = await runWithTenant(A.id, () => syncOrders([offlineOrder], A.cashierId)); // rejeu (réponse perdue)

    expect(r1[0].status).toBe('synced');
    expect(r2[0].status).toBe('duplicate'); // le rejeu est reconnu, pas recréé
    expect(r2[0].orderId).toBe(r1[0].orderId); // même commande renvoyée

    const after = await basePrisma.order.count({ where: { restaurantId: A.id } });
    expect(after - before).toBe(1); // une seule commande malgré le double envoi

    const stockAfter = await basePrisma.stockItem.findUnique({ where: { id: stock.id } });
    expect(stockAfter?.quantity).toBe(8); // 10 - 2, décrémenté une seule fois
  });

  it('deux clientId différents créent deux commandes distinctes', async () => {
    const { dish } = await seedRecipeDish(A.id, 100, 1);
    const before = await basePrisma.order.count({ where: { restaurantId: A.id } });

    const r = await runWithTenant(A.id, () => syncOrders(
      [
        { clientId: 'uuid-distinct-a', items: [{ dishId: dish.id, quantity: 1 }] },
        { clientId: 'uuid-distinct-b', items: [{ dishId: dish.id, quantity: 1 }] },
      ],
      A.cashierId
    ));

    expect(r.map((x) => x.status)).toEqual(['synced', 'synced']);
    const after = await basePrisma.order.count({ where: { restaurantId: A.id } });
    expect(after - before).toBe(2);
  });

  it('deux rejeux simultanés du même clientId ne créent qu\'une commande (anti-course)', async () => {
    const { stock, dish } = await seedRecipeDish(A.id, 50, 1);
    const offlineOrder = { clientId: 'uuid-course-1', items: [{ dishId: dish.id, quantity: 1 }] };
    const before = await basePrisma.order.count({ where: { restaurantId: A.id } });

    const [r1, r2] = await Promise.all([
      runWithTenant(A.id, () => syncOrders([offlineOrder], A.cashierId)),
      runWithTenant(A.id, () => syncOrders([offlineOrder], A.cashierId)),
    ]);

    // L'un crée, l'autre est reconnu comme doublon — jamais deux 'synced'.
    expect([r1[0].status, r2[0].status].sort()).toEqual(['duplicate', 'synced']);
    const after = await basePrisma.order.count({ where: { restaurantId: A.id } });
    expect(after - before).toBe(1);
    const stockAfter = await basePrisma.stockItem.findUnique({ where: { id: stock.id } });
    expect(stockAfter?.quantity).toBe(49); // 50 - 1, décrémenté une seule fois
  });
});
