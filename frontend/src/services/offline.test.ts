import { describe, it, expect } from 'vitest';
import { isSyncResultCleared } from './offline';

describe('isSyncResultCleared', () => {
  it('retire de la file une commande synchronisée', () => {
    expect(isSyncResultCleared('synced')).toBe(true);
  });

  it('retire de la file un doublon reconnu (idempotence : déjà créée côté serveur)', () => {
    expect(isSyncResultCleared('duplicate')).toBe(true);
  });

  it('conserve en file une commande en erreur (à retenter)', () => {
    expect(isSyncResultCleared('error')).toBe(false);
  });
});
