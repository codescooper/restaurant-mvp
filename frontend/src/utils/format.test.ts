import { describe, it, expect } from 'vitest';
import { formatFCFA, getElapsedTime } from './format';

describe('formatFCFA', () => {
  it('affiche un montant en FCFA', () => {
    expect(formatFCFA(2500)).toContain('FCFA');
    expect(formatFCFA(2500)).toContain('2');
  });
  it('arrondit a l\'entier', () => {
    expect(formatFCFA(1499.6)).toContain('1');
  });
});

describe('getElapsedTime', () => {
  it('retourne "< 1 min" pour maintenant', () => {
    expect(getElapsedTime(new Date())).toBe('< 1 min');
  });
  it('retourne les minutes ecoulees', () => {
    const fiveMinAgo = new Date(Date.now() - 5 * 60000);
    expect(getElapsedTime(fiveMinAgo)).toBe('5 min');
  });
});
