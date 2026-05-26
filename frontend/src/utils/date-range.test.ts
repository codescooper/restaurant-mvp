import { describe, it, expect } from 'vitest';
import { shortcutToRange, Shortcut } from './date-range';

const ANCHOR = new Date('2026-05-14T10:00:00Z');

describe('shortcutToRange', () => {
  it('today renvoie la meme date deux fois', () => {
    const r = shortcutToRange('today', ANCHOR);
    expect(r.from).toBe('2026-05-14');
    expect(r.to).toBe('2026-05-14');
  });
  it('last7 renvoie [anchor-6, anchor]', () => {
    const r = shortcutToRange('last7', ANCHOR);
    expect(r.from).toBe('2026-05-08');
    expect(r.to).toBe('2026-05-14');
  });
  it('thisMonth renvoie [1er du mois, anchor]', () => {
    const r = shortcutToRange('thisMonth', ANCHOR);
    expect(r.from).toBe('2026-05-01');
    expect(r.to).toBe('2026-05-14');
  });
  it('lastMonth renvoie tout le mois precedent', () => {
    const r = shortcutToRange('lastMonth', ANCHOR);
    expect(r.from).toBe('2026-04-01');
    expect(r.to).toBe('2026-04-30');
  });
  it.each(['today', 'last7', 'thisMonth', 'lastMonth'] as Shortcut[])('chaque shortcut a from <= to', (s) => {
    const r = shortcutToRange(s, ANCHOR);
    expect(r.from <= r.to).toBe(true);
  });
});
