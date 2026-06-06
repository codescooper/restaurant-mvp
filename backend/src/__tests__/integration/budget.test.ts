import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { signAccessToken } from '../../utils/jwt';
import { resetAndSeedTwoRestaurants, SeededRestaurant } from './helpers';

const app = createApp();

let A: SeededRestaurant;
let B: SeededRestaurant;
let ownerA: string;
let ownerB: string;
let cashierA: string;

beforeAll(async () => {
  ({ A, B } = await resetAndSeedTwoRestaurants());
  ownerA = signAccessToken({ userId: A.ownerId, isSuperAdmin: false, restaurantId: A.id, role: 'propriétaire' });
  ownerB = signAccessToken({ userId: B.ownerId, isSuperAdmin: false, restaurantId: B.id, role: 'propriétaire' });
  cashierA = signAccessToken({ userId: A.cashierId, isSuperAdmin: false, restaurantId: A.id, role: 'caissier' });

  // Données d'appro pour le resto A : un article catégorisé + un achat (alimente la rotation/suivi).
  const item = await basePrisma.stockItem.create({
    data: { name: 'Poulet', unit: 'kg', unitCost: 2000, quantity: 5, alertThreshold: 10, budgetCategory: 'Cuisine', restaurantId: A.id },
  });
  const supplier = await basePrisma.supplier.create({ data: { name: 'Fournisseur A', restaurantId: A.id } });
  await basePrisma.purchase.create({
    data: { supplierId: supplier.id, stockItemId: item.id, quantity: 10, unitPrice: 2000, totalPrice: 20000, restaurantId: A.id },
  });
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

describe('A. /budget/generate', () => {
  it('propose une répartition dont la somme = budget cible', async () => {
    const res = await request(app)
      .post('/api/budget/generate')
      .set({ Authorization: `Bearer ${ownerA}` })
      .send({ periodLabel: 'Juin 2026', targetTotal: 1_000_000, reservePercent: 20 });
    expect(res.status).toBe(200);
    const { proposal } = res.body.data;
    expect(proposal.reserveAmount).toBe(200_000);
    const total = proposal.sections
      .flatMap((s: { postes: { plannedAmount: number }[] }) => s.postes)
      .reduce((sum: number, p: { plannedAmount: number }) => sum + p.plannedAmount, 0);
    expect(total).toBe(1_000_000);
  });

  it('refuse un caissier (rôle insuffisant)', async () => {
    const res = await request(app)
      .post('/api/budget/generate')
      .set({ Authorization: `Bearer ${cashierA}` })
      .send({ periodLabel: 'Juin 2026', targetTotal: 1_000_000 });
    expect(res.status).toBe(403);
  });
});

describe('B. CRUD + isolation tenant', () => {
  let budgetId: number;

  const payload = {
    title: 'Budget juin',
    periodLabel: 'Juin 2026',
    targetTotal: 1_000_000,
    reservePercent: 20,
    sections: [
      {
        name: 'Cuisine & Exploitation',
        postes: [
          { name: 'Cuisine', plannedAmount: 470_800, lines: [{ label: 'Poulet', amount: 150_000, source: 'historique' }] },
          { name: 'Épicerie et Condiments', plannedAmount: 49_200, lines: [] },
        ],
      },
      { name: 'Réserve stratégique', postes: [{ name: 'Réserve stratégique', plannedAmount: 200_000, lines: [] }] },
    ],
  };

  it('crée un budget (201) et le persiste avec son arborescence', async () => {
    const res = await request(app).post('/api/budget').set({ Authorization: `Bearer ${ownerA}` }).send(payload);
    expect(res.status).toBe(201);
    budgetId = res.body.data.id;
    expect(res.body.data.sections.length).toBe(2);
    const cuisine = res.body.data.sections[0].postes.find((p: { name: string }) => p.name === 'Cuisine');
    expect(cuisine.lines[0].label).toBe('Poulet');
  });

  it('liste les budgets du resto A', async () => {
    const res = await request(app).get('/api/budget').set({ Authorization: `Bearer ${ownerA}` });
    expect(res.status).toBe(200);
    expect(res.body.data.some((b: { id: number }) => b.id === budgetId)).toBe(true);
  });

  it('isolation : le resto B ne voit pas le budget du resto A (404)', async () => {
    const res = await request(app).get(`/api/budget/${budgetId}`).set({ Authorization: `Bearer ${ownerB}` });
    expect(res.status).toBe(404);
  });

  it("isolation : la liste du resto B est vide de tout budget de A", async () => {
    const res = await request(app).get('/api/budget').set({ Authorization: `Bearer ${ownerB}` });
    expect(res.status).toBe(200);
    expect(res.body.data.some((b: { id: number }) => b.id === budgetId)).toBe(false);
  });

  it('met à jour le budget (remplace les sections)', async () => {
    const res = await request(app)
      .put(`/api/budget/${budgetId}`)
      .set({ Authorization: `Bearer ${ownerA}` })
      .send({ title: 'Budget juin (révisé)', status: 'validé' });
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe('Budget juin (révisé)');
    expect(res.body.data.status).toBe('validé');
  });

  it('exporte en PDF (200, application/pdf)', async () => {
    const res = await request(app).get(`/api/budget/${budgetId}/export?format=pdf`).set({ Authorization: `Bearer ${ownerA}` });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });

  it('renvoie le suivi budget vs réel', async () => {
    const res = await request(app).get(`/api/budget/${budgetId}/tracking`).set({ Authorization: `Bearer ${ownerA}` });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.rows)).toBe(true);
    expect(typeof res.body.data.totalPlanned).toBe('number');
  });

  it('supprime le budget (et le retire de la liste)', async () => {
    const del = await request(app).delete(`/api/budget/${budgetId}`).set({ Authorization: `Bearer ${ownerA}` });
    expect(del.status).toBe(200);
    const res = await request(app).get(`/api/budget/${budgetId}`).set({ Authorization: `Bearer ${ownerA}` });
    expect(res.status).toBe(404);
  });
});
