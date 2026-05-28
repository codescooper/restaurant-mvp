import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../app';
import { basePrisma } from '../../config/prisma';
import { resetAndSeedTwoRestaurants } from './helpers';

const app = createApp();
let ownerTokenA: string;
let ownerTokenB: string;
let cashierTokenA: string;

// Petite data URL PNG 1×1 valide (format attendu par le validateur)
const VALID_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

beforeAll(async () => {
  await resetAndSeedTwoRestaurants();

  // Tokens obtenus par login (scopés sur le restaurant du user via restaurantId)
  const loginA = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner-resto-a@test.local', password: 'pass123' });
  ownerTokenA = loginA.body.data.accessToken;

  const loginB = await request(app)
    .post('/api/auth/login')
    .send({ email: 'owner-resto-b@test.local', password: 'pass123' });
  ownerTokenB = loginB.body.data.accessToken;

  const loginCashierA = await request(app)
    .post('/api/auth/login')
    .send({ email: 'cashier-resto-a@test.local', password: 'pass123' });
  cashierTokenA = loginCashierA.body.data.accessToken;
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

describe('Branding — GET /api/settings/branding', () => {
  it('renvoie les défauts (primaryColor #D4AF37, images null) pour un resto sans branding configuré', async () => {
    const res = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.data.primaryColor).toBe('#D4AF37');
    expect(res.body.data.logoUrl).toBeNull();
    expect(res.body.data.coverUrl).toBeNull();
    expect(res.body.data.backgroundUrl).toBeNull();
  });
});

describe('Branding — PUT /api/settings/branding', () => {
  it('proprio/admin met à jour primaryColor et la valeur persiste (re-GET confirme)', async () => {
    const putRes = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ primaryColor: '#FF5733' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.data.primaryColor).toBe('#FF5733');

    // Re-GET pour confirmer la persistance
    const getRes = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.primaryColor).toBe('#FF5733');
  });

  it('accepte une data URL image valide pour logoUrl', async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ logoUrl: VALID_PNG });
    expect(res.status).toBe(200);
    expect(res.body.data.logoUrl).toBe(VALID_PNG);
  });

  it("accepte une chaîne vide pour effacer l'image", async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ logoUrl: '' });
    expect(res.status).toBe(200);
  });

  it('rejette une couleur hex invalide → 400', async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ primaryColor: 'rouge' });
    expect(res.status).toBe(400);
  });

  it("rejette une image qui n'est pas une data URL (URL http) → 400", async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ logoUrl: 'http://evil.com/x.png' });
    expect(res.status).toBe(400);
  });

  it("rejette une image qui n'est pas une data URL (type non image) → 400", async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ logoUrl: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==' });
    expect(res.status).toBe(400);
  });

  it('caissier (rôle non autorisé) → 403', async () => {
    const res = await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${cashierTokenA}`)
      .send({ primaryColor: '#123456' });
    expect(res.status).toBe(403);
  });
});

describe('Branding — isolation tenant', () => {
  it('le branding configuré sur le resto A n\'est PAS visible depuis un token scopé sur le resto B', async () => {
    // Configurer une couleur distinctive sur A
    await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ primaryColor: '#AABBCC' });

    // B doit avoir ses propres paramètres indépendants (défauts ou autre couleur)
    const resB = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(resB.status).toBe(200);
    // Le branding de B ne doit PAS avoir la couleur configurée pour A
    expect(resB.body.data.primaryColor).not.toBe('#AABBCC');

    // Vérifier que A a bien la couleur configurée
    const resA = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.primaryColor).toBe('#AABBCC');
  });

  it('configurer le branding sur B ne modifie pas celui de A', async () => {
    // Mettre une couleur sur A
    await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`)
      .send({ primaryColor: '#111111' });

    // Mettre une couleur différente sur B
    await request(app)
      .put('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenB}`)
      .send({ primaryColor: '#999999' });

    // A doit toujours avoir sa propre couleur
    const resA = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenA}`);
    expect(resA.status).toBe(200);
    expect(resA.body.data.primaryColor).toBe('#111111');

    // B doit avoir sa couleur
    const resB = await request(app)
      .get('/api/settings/branding')
      .set('Authorization', `Bearer ${ownerTokenB}`);
    expect(resB.status).toBe(200);
    expect(resB.body.data.primaryColor).toBe('#999999');
  });
});
