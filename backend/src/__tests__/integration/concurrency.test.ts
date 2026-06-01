/**
 * Tests de concurrence — atomicité caisse/stock.
 *
 * Reproduit deux bugs de concurrence sur la prise de commande simultanée :
 *   1. Collision de numéro de commande (généré depuis un count() non atomique) → P2002.
 *   2. Sur-vente de stock (vérification hors transaction + lecture-modification-écriture)
 *      → lost update, stock survendu / négatif.
 *
 * Ces tests lancent deux createOrder EN PARALLÈLE sur le même restaurant pour forcer
 * l'entrelacement. Ils doivent ÉCHOUER sur le code racy et PASSER une fois atomisé.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { basePrisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { createOrder, cancelOrder } from '../../services/order.service';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

let A: SeededRestaurant;

beforeAll(async () => {
  ({ A } = await resetAndSeedTwoRestaurants());
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

/**
 * Crée un article de stock et un plat qui le consomme (recette) dans le restaurant donné.
 * `needPerUnit` = quantité de stock consommée par unité de plat commandée.
 */
async function seedRecipeDish(restaurantId: number, stockQuantity: number, needPerUnit: number) {
  const stock = await basePrisma.stockItem.create({
    data: { name: `Stock-${Math.round(stockQuantity * 1000)}`, quantity: stockQuantity, unit: 'kg', alertThreshold: 0, restaurantId },
  });
  const dish = await basePrisma.dish.create({
    data: {
      name: `Plat-recette-${stock.id}`,
      price: 500,
      restaurantId,
      ingredients: { create: [{ stockItemId: stock.id, quantityNeeded: needPerUnit }] },
    },
  });
  return { stock, dish };
}

/** Lance deux createOrder (1 unité du plat, sans paiement) en parallèle sur le restaurant A. */
function twoConcurrentOrders(dishId: number) {
  const place = () => runWithTenant(A.id, () => createOrder({ items: [{ dishId, quantity: 1 }] }, A.cashierId));
  return Promise.allSettled([place(), place()]);
}

describe('Concurrence — prise de commande simultanée', () => {
  it('deux commandes concurrentes obtiennent des numéros distincts (pas de collision)', async () => {
    const { dish } = await seedRecipeDish(A.id, 1000, 1); // stock abondant : isole le numéro de commande

    const results = await twoConcurrentOrders(dish.id);

    const fulfilled = results.filter((r) => r.status === 'fulfilled') as PromiseFulfilledResult<{ orderNumber: string }>[];
    expect(fulfilled).toHaveLength(2); // les deux doivent réussir
    const numbers = fulfilled.map((r) => r.value.orderNumber);
    expect(new Set(numbers).size).toBe(2); // numéros uniques
  });

  it('deux commandes concurrentes ne peuvent pas survendre le stock', async () => {
    // stock = 3, recette = 2 par commande → assez pour UNE commande, pas deux.
    const { stock, dish } = await seedRecipeDish(A.id, 3, 2);

    const results = await twoConcurrentOrders(dish.id);

    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected') as PromiseRejectedResult[];

    expect(fulfilled).toHaveLength(1); // exactement une commande passe
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: 'STOCK_001' });

    const after = await basePrisma.stockItem.findUnique({ where: { id: stock.id } });
    expect(after?.quantity).toBe(1); // 3 - 2, jamais négatif, jamais survendu
    expect(after?.quantity ?? -1).toBeGreaterThanOrEqual(0);
  });

  it('annulation et nouvelle commande concurrentes ne perdent pas de mise à jour de stock', async () => {
    // stock = 10, recette = 5 → une commande consomme 5.
    const { stock, dish } = await seedRecipeDish(A.id, 10, 5);
    const o1 = await runWithTenant(A.id, () => createOrder({ items: [{ dishId: dish.id, quantity: 1 }] }, A.ownerId));
    // après o1 : stock = 5.

    // Concurremment : annuler o1 (+5, restauration) ET passer une nouvelle commande (-5).
    // Net attendu depuis 5 : +5 - 5 = 5. Un lost update donnerait 0 ou 10.
    await Promise.allSettled([
      runWithTenant(A.id, () => cancelOrder(o1.id, 'test concurrence', A.ownerId, 'propriétaire')),
      runWithTenant(A.id, () => createOrder({ items: [{ dishId: dish.id, quantity: 1 }] }, A.ownerId)),
    ]);

    const after = await basePrisma.stockItem.findUnique({ where: { id: stock.id } });
    expect(after?.quantity).toBe(5);
  });
});
