import { describe, it, expect } from 'vitest';
import { HELP_GUIDES } from './manifest';
import type { Role } from '../types';

describe('manifest des guides', () => {
  it('a des identifiants uniques', () => {
    const ids = HELP_GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('a un contenu non vide pour chaque guide', () => {
    for (const g of HELP_GUIDES) {
      expect(g.content.trim().length, `guide ${g.id}`).toBeGreaterThan(0);
      expect(g.title.trim().length, `titre ${g.id}`).toBeGreaterThan(0);
      expect(g.roles.length, `rôles ${g.id}`).toBeGreaterThan(0);
    }
  });

  it('expose au moins un guide à chaque rôle', () => {
    const roles: Role[] = ['propriétaire', 'administrateur', 'caissier', 'cuisinier', 'serveur'];
    for (const role of roles) {
      const visible = HELP_GUIDES.filter((g) => g.roles.includes(role));
      expect(visible.length, `rôle ${role}`).toBeGreaterThan(0);
    }
  });
});
