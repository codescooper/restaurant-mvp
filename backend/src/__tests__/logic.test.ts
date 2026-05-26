import { describe, it, expect } from 'vitest';
import { computeFinalTotal, formatOrderNumber, resolveLibrePrice } from '../services/order.service';
import { roundQty } from '../services/stock.service';
import { computeDiscrepancy } from '../services/cash.service';
import { evaluateManagerApproval } from '../services/settings.service';
import { STATUS_TRANSITIONS, isCashPaymentMethod } from '../constants';

describe('computeFinalTotal', () => {
  it('applique une réduction en montant', () => {
    expect(computeFinalTotal(5000, 1000, 0)).toBe(4000);
  });
  it('applique une réduction en pourcentage', () => {
    expect(computeFinalTotal(5000, 0, 10)).toBe(4500);
  });
  it('ne descend jamais sous 0', () => {
    expect(computeFinalTotal(1000, 5000, 0)).toBe(0);
  });
  it('sans réduction', () => {
    expect(computeFinalTotal(3000, 0, 0)).toBe(3000);
  });
});

describe('resolveLibrePrice (plat à prix libre)', () => {
  const dish = { name: 'Poisson du jour', priceMin: 2000, priceMax: 6000 };
  it('accepte un prix dans les bornes', () => {
    expect(resolveLibrePrice(dish, 3500)).toBe(3500);
  });
  it('accepte les valeurs aux bornes (inclusives)', () => {
    expect(resolveLibrePrice(dish, 2000)).toBe(2000);
    expect(resolveLibrePrice(dish, 6000)).toBe(6000);
  });
  it('refuse un prix sous le minimum', () => {
    expect(() => resolveLibrePrice(dish, 1500)).toThrowError(/hors limites/);
  });
  it('refuse un prix au-dessus du maximum', () => {
    expect(() => resolveLibrePrice(dish, 9000)).toThrowError(/hors limites/);
  });
  it('refuse un prix manquant', () => {
    expect(() => resolveLibrePrice(dish, undefined)).toThrowError(/Prix requis/);
  });
});

describe('formatOrderNumber', () => {
  it('formate avec padding sur 3 chiffres', () => {
    expect(formatOrderNumber('20260519', 0)).toBe('20260519-001');
    expect(formatOrderNumber('20260519', 11)).toBe('20260519-012');
  });
});

describe('roundQty', () => {
  it('arrondit à 2 décimales (évite la dérive flottante)', () => {
    expect(roundQty(0.1 + 0.2)).toBe(0.3);
    expect(roundQty(49.5 - 0.3)).toBe(49.2);
  });
});

describe('STATUS_TRANSITIONS', () => {
  it('autorise commandée -> en_cours', () => {
    expect(STATUS_TRANSITIONS['commandée']).toContain('en_cours');
  });
  it('interdit de revenir en arrière', () => {
    expect(STATUS_TRANSITIONS['prête']).not.toContain('en_cours');
  });
  it('servie est un état terminal', () => {
    expect(STATUS_TRANSITIONS['servie']).toEqual([]);
  });
});

describe('computeDiscrepancy (écart de caisse)', () => {
  it('caisse juste = écart nul', () => {
    expect(computeDiscrepancy(50000, 50000)).toBe(0);
  });
  it('excédent = écart positif', () => {
    expect(computeDiscrepancy(50000, 52000)).toBe(2000);
  });
  it('manquant = écart négatif', () => {
    expect(computeDiscrepancy(50000, 48500)).toBe(-1500);
  });
});

describe('isCashPaymentMethod', () => {
  it('espèces nécessite une caisse', () => {
    expect(isCashPaymentMethod('espèces')).toBe(true);
  });
  it('carte et mobile_money ne nécessitent pas de caisse', () => {
    expect(isCashPaymentMethod('carte')).toBe(false);
    expect(isCashPaymentMethod('mobile_money')).toBe(false);
    expect(isCashPaymentMethod(null)).toBe(false);
  });
});

describe('evaluateManagerApproval (PIN annulation/remboursement)', () => {
  // Comparateur factice : simule bcrypt en testant l'égalité « pin === hash » (hash = "HASH:" + pin).
  const verify = (pin: string, hash: string) => hash === `HASH:${pin}`;
  it("l'administrateur est exempt (aucun PIN requis)", () => {
    expect(evaluateManagerApproval('administrateur', 'HASH:1234', undefined, verify)).toBe(false);
    expect(evaluateManagerApproval('administrateur', null, undefined, verify)).toBe(false);
  });
  it('le propriétaire est exempt (aucun PIN requis)', () => {
    expect(evaluateManagerApproval('propriétaire', 'HASH:1234', undefined, verify)).toBe(false);
    expect(evaluateManagerApproval('propriétaire', null, undefined, verify)).toBe(false);
  });
  it('opt-in : libre tant qu\'aucun PIN n\'est configuré', () => {
    expect(evaluateManagerApproval('caissier', null, undefined, verify)).toBe(false);
  });
  it('caissier avec le bon PIN : validé', () => {
    expect(evaluateManagerApproval('caissier', 'HASH:1234', '1234', verify)).toBe(true);
    expect(evaluateManagerApproval('caissier', 'HASH:1234', ' 1234 ', verify)).toBe(true);
  });
  it('caissier avec un mauvais PIN : refusé (PIN_001)', () => {
    expect(() => evaluateManagerApproval('caissier', 'HASH:1234', '0000', verify)).toThrowError(/Code manager/);
  });
  it('caissier sans PIN alors qu\'un PIN est requis : refusé', () => {
    expect(() => evaluateManagerApproval('caissier', 'HASH:1234', undefined, verify)).toThrowError(/Code manager/);
  });
});

import { createDishSchema, updateDishSchema, dashboardRangeSchema } from '../validators/schemas';

describe('createDishSchema — variantes en libre', () => {
  it('autorise un plat libre avec variantes sans prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Poisson du jour',
      price: 3000,
      priceType: 'libre',
      priceMin: 2000,
      priceMax: 6000,
      variants: [{ name: 'Petit' }, { name: 'Grand' }],
    });
    expect(res.success).toBe(true);
  });
  it('refuse un plat fixe avec variante sans prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Plat',
      price: 3000,
      priceType: 'fixe',
      variants: [{ name: 'Petit' }],
    });
    expect(res.success).toBe(false);
  });
  it('refuse un plat libre avec variante portant un prix', () => {
    const res = createDishSchema.safeParse({
      name: 'Plat',
      price: 3000,
      priceType: 'libre',
      priceMin: 1000,
      priceMax: 5000,
      variants: [{ name: 'Petit', price: 2000 }],
    });
    expect(res.success).toBe(false);
  });
});

describe('updateDishSchema — partial sans priceType', () => {
  it('updateDishSchema : sans priceType, variantes sans prix → traitees comme fixe → KO', () => {
    const res = updateDishSchema.safeParse({
      variants: [{ name: 'Petit' }],
    });
    expect(res.success).toBe(false);
  });
});

import { getRangeFromDates } from '../services/stats.service';

describe('getRangeFromDates', () => {
  it('plage 1 jour : prevEnd = start, prev de meme duree', () => {
    const from = new Date('2026-05-14T00:00:00Z');
    const to = new Date('2026-05-14T00:00:00Z');
    const r = getRangeFromDates(from, to);
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
    expect(r.end.getTime() - r.start.getTime()).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
  });
  it('plage 7 jours : duree preservee', () => {
    const r = getRangeFromDates(new Date('2026-05-01'), new Date('2026-05-07'));
    const dur = r.end.getTime() - r.start.getTime();
    expect(dur).toBe(r.prevEnd.getTime() - r.prevStart.getTime());
    expect(r.prevEnd.getTime()).toBe(r.start.getTime());
  });
});

describe('dashboardRangeSchema', () => {
  it('accepte une plage valide YYYY-MM-DD avec from <= to', () => {
    const res = dashboardRangeSchema.safeParse({ from: '2026-05-01', to: '2026-05-07' });
    expect(res.success).toBe(true);
  });
  it('refuse from > to', () => {
    const res = dashboardRangeSchema.safeParse({ from: '2026-05-20', to: '2026-05-01' });
    expect(res.success).toBe(false);
  });
  it('refuse une plage > 366 jours', () => {
    const res = dashboardRangeSchema.safeParse({ from: '2024-01-01', to: '2025-12-31' });
    expect(res.success).toBe(false);
  });
  it('refuse un format de date invalide', () => {
    const res = dashboardRangeSchema.safeParse({ from: '01/05/2026', to: '07/05/2026' });
    expect(res.success).toBe(false);
  });
});
