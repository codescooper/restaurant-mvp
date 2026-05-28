import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { resetAndSeedTwoRestaurants } from './helpers';

const app = createApp();

beforeAll(async () => {
  await resetAndSeedTwoRestaurants();
  // Ajouter un plat actif sur resto-a pour avoir un menu non vide
  const restoA = await basePrisma.restaurant.findUnique({ where: { slug: 'resto-a' } });
  if (restoA) {
    await basePrisma.dish.createMany({
      data: [
        { name: 'Thiéboudienne', price: 3500, category: 'Plats', isActive: true, restaurantId: restoA.id },
        { name: 'Bissap', price: 500, category: 'Boissons', isActive: true, restaurantId: restoA.id },
        { name: 'Plat désactivé', price: 2000, category: 'Plats', isActive: false, restaurantId: restoA.id },
      ],
    });
  }
});
afterAll(async () => { await basePrisma.$disconnect(); });

describe('GET /api/public/restaurants/:slug — page publique', () => {
  it('resto actif → 200 avec name, branding et menu structuré', async () => {
    const res = await request(app).get('/api/public/restaurants/resto-a');
    expect(res.status).toBe(200);

    const { name, branding, menu } = res.body.data;
    expect(name).toBe('Resto A');

    // Branding defaults (aucun réglage configuré — valeurs par défaut attendues)
    expect(branding).toBeDefined();
    expect(branding.primaryColor).toBe('#D4AF37');
    expect(branding.accentColor).toBe('#E4C86A');
    expect(branding.backgroundColor).toBe('#000000');

    // Menu : tableau de catégories
    expect(Array.isArray(menu)).toBe(true);
    expect(menu.length).toBeGreaterThan(0);

    // Chaque catégorie a { category, items[] }
    for (const cat of menu) {
      expect(cat).toHaveProperty('category');
      expect(Array.isArray(cat.items)).toBe(true);
      // Chaque item doit avoir `available` (booléen)
      for (const item of cat.items) {
        expect(typeof item.available).toBe('boolean');
        // Champs sensibles absents
        expect(item).not.toHaveProperty('quantity');
        expect(item).not.toHaveProperty('unitCost');
        // Le plat désactivé ne doit pas apparaître
        expect(item.name).not.toBe('Plat désactivé');
      }
    }

    // Le plat créé au setup est présent
    const allItems = menu.flatMap((c: { items: { name: string }[] }) => c.items);
    const names = allItems.map((i: { name: string }) => i.name);
    expect(names).toContain('Thiéboudienne');
    expect(names).toContain('Bissap');
  });

  it('resto pending → 404 PUBLIC_001', async () => {
    await basePrisma.restaurant.create({
      data: { name: 'Resto En Attente', slug: 'pending-resto', status: 'pending' },
    });
    const res = await request(app).get('/api/public/restaurants/pending-resto');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLIC_001');
  });

  it('slug inexistant → 404 PUBLIC_001', async () => {
    const res = await request(app).get('/api/public/restaurants/slug-qui-nexiste-pas');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('PUBLIC_001');
  });
});
