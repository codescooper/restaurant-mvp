import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../app';

const app = createApp();

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
});
