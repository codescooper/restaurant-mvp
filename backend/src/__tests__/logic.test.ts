import { describe, it, expect } from 'vitest';
import { computeFinalTotal, formatOrderNumber } from '../services/order.service';
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
