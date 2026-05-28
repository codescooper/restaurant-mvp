/**
 * Milestone 6 — Tests d'intégration paiement mixte.
 *
 * Couvre :
 *   A. Création / paiement / settle en mode mixte (OrderPayment rows, paymentMethod='mixte')
 *   B. Réconciliation caisse (computeExpectedCash, salesByMethod) — cas mono et mixte
 *   C. Rejets de validation (Σ ≠ due, cashGiven trop faible, mobile_money sans provider)
 *   D. Isolation tenant (les OrderPayment du resto A ne contaminent pas le resto B)
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma, prisma } from '../../config/prisma';
import { runWithTenant } from '../../config/tenant-context';
import { signAccessToken } from '../../utils/jwt';
import { openSession, computeExpectedCash, salesByMethod } from '../../services/cash.service';
import { createOrder, payOrder } from '../../services/order.service';
import { settleTable } from '../../services/table.service';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();

let A: SeededRestaurant;
let B: SeededRestaurant;

/** Token HTTP caissier du resto A (contient restaurantId → middleware tenantContext l'injecte). */
let tokenA: string;

beforeAll(async () => {
  ({ A, B } = await resetAndSeedTwoRestaurants());

  tokenA = signAccessToken({ userId: A.cashierId, isSuperAdmin: false, restaurantId: A.id, role: 'caissier' });
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

// ---------------------------------------------------------------------------
// Helpers locaux
// ---------------------------------------------------------------------------

/** Ouvre une session de caisse pour le caissier du restaurant A (via service direct). */
async function openSessionA(openingFloat = 10000) {
  return runWithTenant(A.id, () => openSession(A.cashierId, openingFloat));
}

/** Ouvre une session de caisse pour le caissier du restaurant B. */
async function openSessionB(openingFloat = 5000) {
  return runWithTenant(B.id, () => openSession(B.cashierId, openingFloat));
}

/** Récupère le premier plat du restaurant A/B. */
async function getDishA() {
  const [dish] = await runWithTenant(A.id, () => prisma.dish.findMany());
  return dish;
}

async function getDishB() {
  const [dish] = await runWithTenant(B.id, () => prisma.dish.findMany());
  return dish;
}

/** Récupère la première table du restaurant A. */
async function getTableA() {
  const [table] = await runWithTenant(A.id, () => prisma.table.findMany());
  return table;
}

// ---------------------------------------------------------------------------
// A. Création / paiement / settleTable en mixte
// ---------------------------------------------------------------------------

describe('A. Paiement mixte — création directe (createOrder)', () => {
  it('A1 — createOrder mixte : 2 lignes OrderPayment, paymentMethod=mixte, isPaid=true', async () => {
    const session = await openSessionA();
    const dish = await getDishA();

    // Commande dont le finalTotal sera 1000 (prix du plat).
    // Paiement mixte : espèces 600 + mobile_money 400.
    const order = await runWithTenant(A.id, () =>
      createOrder(
        {
          items: [{ dishId: dish.id, quantity: 1 }],
          payments: [
            { method: 'espèces', amount: 600, cashGiven: 600 },
            { method: 'mobile_money', amount: 400, mobileMoneyProvider: 'wave' },
          ],
        },
        A.cashierId
      )
    );

    expect(order.isPaid).toBe(true);
    expect(order.paymentMethod).toBe('mixte');
    expect(order.cashSessionId).toBe(session.id);

    const payments = await basePrisma.orderPayment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(2);

    const cash = payments.find((p) => p.method === 'espèces');
    const mm = payments.find((p) => p.method === 'mobile_money');
    expect(cash?.amount).toBe(600);
    expect(mm?.amount).toBe(400);
    expect(mm?.mobileMoneyProvider).toBe('wave');
  });

  it('A2 — payOrder mixte sur commande différée : 2 lignes, paymentMethod=mixte', async () => {
    // Récupère la session déjà ouverte (openSessionA lèverait CASH_002 si appelé à nouveau).
    const session = await runWithTenant(A.id, () =>
      prisma.cashSession.findFirst({ where: { cashierId: A.cashierId, status: 'ouverte' } })
    );
    expect(session).not.toBeNull();

    const dish = await getDishA();

    // Commande différée (sans paiement).
    const deferred = await runWithTenant(A.id, () =>
      createOrder({ items: [{ dishId: dish.id, quantity: 1 }] }, A.cashierId)
    );
    expect(deferred.isPaid).toBe(false);
    expect(deferred.paymentMethod).toBeNull();

    // Règlement mixte ensuite.
    const paid = await runWithTenant(A.id, () =>
      payOrder(
        deferred.id,
        undefined,
        undefined,
        A.cashierId,
        undefined,
        [
          { method: 'espèces', amount: 700, cashGiven: 1000, changeReturned: 300 },
          { method: 'mobile_money', amount: 300, mobileMoneyProvider: 'orange_money' },
        ]
      )
    );

    expect(paid.isPaid).toBe(true);
    expect(paid.paymentMethod).toBe('mixte');
    expect(paid.cashSessionId).toBe(session!.id);

    const payments = await basePrisma.orderPayment.findMany({ where: { orderId: deferred.id } });
    expect(payments).toHaveLength(2);
    const cash = payments.find((p) => p.method === 'espèces');
    expect(cash?.cashGiven).toBe(1000);
    expect(cash?.changeReturned).toBe(300);
  });

  it('A3 — settleTable mixte : lignes OrderPayment créées sur la commande porteuse', async () => {
    const session = await runWithTenant(A.id, () =>
      prisma.cashSession.findFirst({ where: { cashierId: A.cashierId, status: 'ouverte' } })
    );
    const dish = await getDishA();
    const table = await getTableA();

    // Commande non payée sur la table.
    const order = await runWithTenant(A.id, () =>
      createOrder({ items: [{ dishId: dish.id, quantity: 1 }], tableId: table.id }, A.cashierId)
    );
    expect(order.isPaid).toBe(false);

    // Règlement de l'addition en mixte.
    const result = await runWithTenant(A.id, () =>
      settleTable(
        table.id,
        undefined,
        undefined,
        A.cashierId,
        undefined,
        [
          { method: 'espèces', amount: 500, cashGiven: 500 },
          { method: 'mobile_money', amount: 500, mobileMoneyProvider: 'wave' },
        ]
      )
    );

    expect(result.paymentMethod).toBe('mixte');

    // Les lignes OrderPayment doivent exister sur la commande porteuse.
    const payments = await basePrisma.orderPayment.findMany({ where: { orderId: order.id } });
    expect(payments).toHaveLength(2);
    expect(payments.find((p) => p.method === 'espèces')?.amount).toBe(500);
    expect(payments.find((p) => p.method === 'mobile_money')?.amount).toBe(500);

    // La commande doit être marquée payée et liée à la session.
    const updatedOrder = await basePrisma.order.findUnique({ where: { id: order.id } });
    expect(updatedOrder?.isPaid).toBe(true);
    expect(updatedOrder?.cashSessionId).toBe(session!.id);
  });
});

// ---------------------------------------------------------------------------
// B. Réconciliation caisse
// ---------------------------------------------------------------------------

describe('B. Réconciliation caisse', () => {
  let sessionB4: { id: number; openingFloat: number };

  beforeAll(async () => {
    // Session fraîche pour le resto A — ouverte par le proprio (caissier est déjà utilisé).
    // On réutilise une nouvelle clé : ouvrir la caisse avec un proprio dédié.
    // Pour éviter les conflits avec les sessions ouvertes précédemment dans A,
    // on utilise le resto B dont la caisse n'a pas encore été ouverte.
    sessionB4 = await openSessionB(10000);
  });

  it('B4 — mono espèces : computeExpectedCash = fond + vente', async () => {
    const dish = await getDishB();

    // Commande 2000 payée espèces.
    await runWithTenant(B.id, () =>
      createOrder(
        {
          items: [{ dishId: dish.id, quantity: 2 }],
          paymentMethod: 'espèces',
          paymentDetails: { cashGiven: 2000 },
        },
        B.cashierId
      )
    );

    const expected = await runWithTenant(B.id, () => computeExpectedCash(sessionB4));
    expect(expected).toBe(10000 + 2000);
  });

  it('B5 — mixte : computeExpectedCash augmente de la part espèces seulement', async () => {
    const dish = await getDishB();
    const expectedBefore = await runWithTenant(B.id, () => computeExpectedCash(sessionB4));

    // Commande 1000 (2×500 : espèces 600 + mobile_money 400).
    // Note : le plat vaut 1000 FCFA. On crée une commande d'1 unité = finalTotal=1000.
    // On scinde : espèces 600, mobile_money 400.
    await runWithTenant(B.id, () =>
      createOrder(
        {
          items: [{ dishId: dish.id, quantity: 1 }],
          payments: [
            { method: 'espèces', amount: 600, cashGiven: 600 },
            { method: 'mobile_money', amount: 400, mobileMoneyProvider: 'wave' },
          ],
        },
        B.cashierId
      )
    );

    const expectedAfter = await runWithTenant(B.id, () => computeExpectedCash(sessionB4));
    // Seule la part espèces (600) doit s'ajouter, pas le total de la commande (1000).
    expect(expectedAfter).toBe(expectedBefore + 600);
  });

  it('B6 — salesByMethod ventile correctement espèces et mobile_money', async () => {
    const sales = await runWithTenant(B.id, () => salesByMethod(sessionB4.id));

    const cashEntry = sales.find((s) => s.method === 'espèces');
    const mmEntry = sales.find((s) => s.method === 'mobile_money');

    // B4 a généré 2000 d'espèces, B5 a ajouté 600 → total espèces = 2600.
    expect(cashEntry?.amount).toBe(2600);
    // B5 a généré 400 de mobile_money.
    expect(mmEntry?.amount).toBe(400);
  });
});

// ---------------------------------------------------------------------------
// C. Rejets de validation
// ---------------------------------------------------------------------------

describe('C. Rejets de validation', () => {
  it('C7 — Σ amount ≠ due → 400 VALIDATION_001', async () => {
    const dish = await getDishA();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ dishId: dish.id, quantity: 1 }],
        // finalTotal sera 1000 mais les splits somment à 900 (erreur intentionnelle).
        payments: [
          { method: 'espèces', amount: 500, cashGiven: 500 },
          { method: 'mobile_money', amount: 400, mobileMoneyProvider: 'wave' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_001');
  });

  it('C8 — ligne espèces avec cashGiven < amount → 400 VALIDATION_001', async () => {
    const dish = await getDishA();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ dishId: dish.id, quantity: 1 }],
        payments: [
          { method: 'espèces', amount: 600, cashGiven: 400 }, // cashGiven insuffisant
          { method: 'mobile_money', amount: 400, mobileMoneyProvider: 'wave' },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_001');
  });

  it('C9 — ligne mobile_money sans provider → 400 VALIDATION_001', async () => {
    const dish = await getDishA();

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        items: [{ dishId: dish.id, quantity: 1 }],
        payments: [
          { method: 'espèces', amount: 600, cashGiven: 600 },
          { method: 'mobile_money', amount: 400 }, // provider manquant
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_001');
  });
});

// ---------------------------------------------------------------------------
// D. Isolation tenant
// ---------------------------------------------------------------------------

describe('D. Isolation tenant — les OrderPayment de A ne contaminent pas B', () => {
  it('D10 — salesByMethod de B ne compte pas les ventes de A', async () => {
    // Récupère la session ouverte de B (créée dans B4/B5/B6).
    const sessionB = await runWithTenant(B.id, () =>
      prisma.cashSession.findFirst({ where: { cashierId: B.cashierId, status: 'ouverte' } })
    );
    expect(sessionB).not.toBeNull();

    // Vérifie que les ventes de B sont bien scopées : la somme espèces (2600) doit correspondre
    // exactement aux ventes de B, sans fuite depuis A.
    const salesB = await runWithTenant(B.id, () => salesByMethod(sessionB!.id));
    const cashB = salesB.find((s) => s.method === 'espèces')?.amount ?? 0;

    // Des ventes espèces ont été faites dans A aussi (session A) : elles ne doivent PAS
    // apparaître dans salesB. Le total B doit rester 2600 (B4=2000 + B5=600).
    expect(cashB).toBe(2600);

    // Vérification inverse : compter les OrderPayments bruts de chaque restaurant.
    const countA = await basePrisma.orderPayment.count({ where: { restaurantId: A.id } });
    const countB = await basePrisma.orderPayment.count({ where: { restaurantId: B.id } });
    // Les deux restaurants ont des paiements distincts ; aucun chevauchement.
    expect(countA).toBeGreaterThan(0);
    expect(countB).toBeGreaterThan(0);

    // computeExpectedCash de B ne doit pas inclure les encaissements espèces de A.
    const sessionA = await runWithTenant(A.id, () =>
      prisma.cashSession.findFirst({ where: { cashierId: A.cashierId, status: 'ouverte' } })
    );
    if (sessionA) {
      const expectedA = await runWithTenant(A.id, () => computeExpectedCash(sessionA));
      const expectedB = await runWithTenant(B.id, () => computeExpectedCash(sessionB!));

      // A a fond 10000 + ses propres encaissements espèces (≥ 0).
      // B a fond 10000 + ses encaissements espèces (2600).
      // Ils doivent être indépendants.
      expect(expectedA).toBeGreaterThanOrEqual(10000);
      expect(expectedB).toBe(10000 + 2600);
      // Les deux valeurs ne doivent pas être identiques à moins d'une coïncidence parfaite.
      // On se contente de vérifier que B est bien 12600 (valeur connue).
      expect(expectedB).toBe(12600);
    }
  });
});
