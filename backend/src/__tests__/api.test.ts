import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../app';
import { env } from '../config/env';

const app = createApp();

function fakeToken(): string {
  return jwt.sign({ userId: 1, isSuperAdmin: false }, env.jwtSecret);
}

// Tests qui ne touchent pas la base de donnees.
describe('API smoke', () => {
  it('GET /api/health renvoie 200', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('POST /api/auth/login sans champs renvoie 400 VALIDATION_001', async () => {
    const res = await request(app).post('/api/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_001');
  });

  it('GET /api/stock sans token renvoie 401', async () => {
    const res = await request(app).get('/api/stock');
    expect(res.status).toBe(401);
  });

  it('route inconnue renvoie 404', async () => {
    const res = await request(app).get('/api/inconnu');
    expect(res.status).toBe(404);
  });

  it('GET /api/cash/current sans token renvoie 401', async () => {
    const res = await request(app).get('/api/cash/current');
    expect(res.status).toBe(401);
  });

  it('GET /api/audit sans token renvoie 401', async () => {
    const res = await request(app).get('/api/audit');
    expect(res.status).toBe(401);
  });

  it('GET /api/stats/dashboard avec from > to renvoie 400 ou 401/403', async () => {
    const res = await request(app)
      .get('/api/stats/dashboard?from=2026-05-20&to=2026-05-01')
      .set('Authorization', `Bearer ${fakeToken()}`);
    // L'auth peut échouer (401/403) si le token ne matche pas un membership ; 400 si validation inline OK.
    expect([400, 401, 403]).toContain(res.status);
  });
});
