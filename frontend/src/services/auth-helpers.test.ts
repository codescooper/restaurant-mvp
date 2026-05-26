import { describe, it, expect } from 'vitest';
import { homeForRole, resolvePostLogin, decodeAccessToken } from './auth-helpers';
import { MembershipView } from '../types';

describe('homeForRole', () => {
  it('propriétaire et administrateur vont au dashboard', () => {
    expect(homeForRole('propriétaire')).toBe('/dashboard');
    expect(homeForRole('administrateur')).toBe('/dashboard');
  });
  it('chaque rôle a sa page', () => {
    expect(homeForRole('caissier')).toBe('/caisse');
    expect(homeForRole('cuisinier')).toBe('/cuisine');
    expect(homeForRole('serveur')).toBe('/salle');
  });
});

describe('resolvePostLogin', () => {
  const m = (restaurantId: number, role: MembershipView['role']): MembershipView =>
    ({ restaurantId, role, restaurantName: 'R', restaurantSlug: 's' });
  it('un seul membership → sélection auto', () => {
    expect(resolvePostLogin([m(1, 'caissier')])).toEqual({ autoSelected: true, restaurantId: 1, role: 'caissier' });
  });
  it('plusieurs memberships → sélection requise', () => {
    expect(resolvePostLogin([m(1, 'caissier'), m(2, 'serveur')])).toEqual({ autoSelected: false });
  });
  it('aucun membership → sélection requise (rien à ouvrir)', () => {
    expect(resolvePostLogin([])).toEqual({ autoSelected: false });
  });
});

describe('decodeAccessToken', () => {
  it('décode le payload restaurantId/role', () => {
    // JWT factice : header.payload.signature (payload base64url de {restaurantId:7,role:"serveur"})
    const json = JSON.stringify({ userId: 1, restaurantId: 7, role: 'serveur', isSuperAdmin: false });
    const payload = btoa(json).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const token = `x.${payload}.y`;
    expect(decodeAccessToken(token)).toMatchObject({ restaurantId: 7, role: 'serveur' });
  });
  it('token invalide → objet vide', () => {
    expect(decodeAccessToken('nimporte')).toEqual({});
  });
  it('payload non décodable → objet vide', () => {
    expect(decodeAccessToken('x.!!!.y')).toEqual({});
  });
});
