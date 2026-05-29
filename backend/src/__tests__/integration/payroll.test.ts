/**
 * Tests d'intégration Paie & CNPS.
 *
 * Couvre :
 *   A. GET/PUT /payroll/config — défauts, mise à jour, persistance
 *   B. Isolation tenant des paramètres (le réglage du resto A n'affecte pas B)
 *   C. POST /payroll/payslip — génère un PDF (fiche ou brut surchargé)
 *   D. Isolation tenant du bulletin (resto B ne peut pas générer pour un employé de A → 404)
 *   E. Contrôle de rôle (un caissier est refusé) + validation (pas de brut → 400)
 */

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
let empAId: number; // employé salarié du resto A
let empNoSalaryId: number; // employé du resto A sans salaire

beforeAll(async () => {
  ({ A, B } = await resetAndSeedTwoRestaurants());

  ownerA = signAccessToken({ userId: A.ownerId, isSuperAdmin: false, restaurantId: A.id, role: 'propriétaire' });
  ownerB = signAccessToken({ userId: B.ownerId, isSuperAdmin: false, restaurantId: B.id, role: 'propriétaire' });
  cashierA = signAccessToken({ userId: A.cashierId, isSuperAdmin: false, restaurantId: A.id, role: 'caissier' });

  const emp = await basePrisma.employee.create({
    data: {
      firstName: 'Awa',
      lastName: 'Koné',
      salary: 200_000,
      salaryPeriod: 'mensuel',
      cnpsNumber: 'CI-123456',
      restaurantId: A.id,
    },
  });
  empAId = emp.id;

  const emp2 = await basePrisma.employee.create({
    data: { firstName: 'Sans', lastName: 'Salaire', restaurantId: A.id },
  });
  empNoSalaryId = emp2.id;
});

afterAll(async () => {
  await basePrisma.$disconnect();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('A. /payroll/config', () => {
  it('renvoie les défauts CNPS pour le resto A', async () => {
    const res = await request(app).get('/api/payroll/config').set(auth(ownerA));
    expect(res.status).toBe(200);
    expect(res.body.data.retraite.employee).toBe(6.3);
    expect(res.body.data.retraite.employer).toBe(7.7);
    expect(res.body.data.accidentTravail.employer).toBe(2);
    expect(res.body.data.its.enabled).toBe(false);
  });

  it('met à jour le taux accident (sectoriel 5 %) et persiste', async () => {
    const put = await request(app)
      .put('/api/payroll/config')
      .set(auth(ownerA))
      .send({ accidentTravail: { employer: 5 }, its: { enabled: true } });
    expect(put.status).toBe(200);
    expect(put.body.data.accidentTravail.employer).toBe(5);

    const get = await request(app).get('/api/payroll/config').set(auth(ownerA));
    expect(get.body.data.accidentTravail.employer).toBe(5);
    expect(get.body.data.accidentTravail.ceiling).toBe(70_000); // repli défaut conservé
    expect(get.body.data.its.enabled).toBe(true);
  });
});

describe('B. Isolation tenant des paramètres', () => {
  it('le resto B garde ses défauts malgré le réglage de A', async () => {
    const res = await request(app).get('/api/payroll/config').set(auth(ownerB));
    expect(res.status).toBe(200);
    expect(res.body.data.accidentTravail.employer).toBe(2); // pas le 5 % de A
    expect(res.body.data.its.enabled).toBe(false);
  });
});

describe('C. /payroll/payslip — génération PDF', () => {
  it('génère un bulletin pour un employé salarié (PDF)', async () => {
    const res = await request(app)
      .post('/api/payroll/payslip')
      .set(auth(ownerA))
      .send({ employeeId: empAId, year: 2026, month: 5 });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
    expect(res.headers['content-disposition']).toContain('attachment');
  });

  it('accepte un brut surchargé', async () => {
    const res = await request(app)
      .post('/api/payroll/payslip')
      .set(auth(ownerA))
      .send({ employeeId: empAId, year: 2026, month: 5, grossSalary: 300_000 });
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');
  });
});

describe('D. Isolation tenant du bulletin', () => {
  it('le resto B ne peut pas générer un bulletin pour un employé du resto A (404)', async () => {
    const res = await request(app)
      .post('/api/payroll/payslip')
      .set(auth(ownerB))
      .send({ employeeId: empAId, year: 2026, month: 5 });
    expect(res.status).toBe(404);
  });
});

describe('E. Rôle & validation', () => {
  it('refuse un caissier sur les données de paie (403)', async () => {
    const res = await request(app).get('/api/payroll/config').set(auth(cashierA));
    expect(res.status).toBe(403);
  });

  it('refuse un bulletin sans brut disponible (400)', async () => {
    const res = await request(app)
      .post('/api/payroll/payslip')
      .set(auth(ownerA))
      .send({ employeeId: empNoSalaryId, year: 2026, month: 5 });
    expect(res.status).toBe(400);
  });
});
