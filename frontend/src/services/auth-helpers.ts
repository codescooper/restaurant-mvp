import { Role, MembershipView } from '../types';

const HOME: Record<Role, string> = {
  propriétaire: '/dashboard',
  administrateur: '/dashboard',
  caissier: '/caisse',
  cuisinier: '/cuisine',
  serveur: '/salle',
};

export function homeForRole(role: Role): string {
  return HOME[role] ?? '/';
}

export type PostLogin =
  | { autoSelected: true; restaurantId: number; role: Role }
  | { autoSelected: false };

// Décide quoi faire après login : 1 membership → auto-sélection ; sinon écran de sélection.
export function resolvePostLogin(memberships: MembershipView[]): PostLogin {
  if (memberships.length === 1) {
    return { autoSelected: true, restaurantId: memberships[0].restaurantId, role: memberships[0].role };
  }
  return { autoSelected: false };
}

export interface TokenClaims {
  userId?: number;
  restaurantId?: number;
  role?: Role;
  isSuperAdmin?: boolean;
}

// Décode (sans vérifier) le payload d'un JWT. Renvoie {} si le token est mal formé.
export function decodeAccessToken(token: string | null | undefined): TokenClaims {
  if (!token) return {};
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const json = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as TokenClaims;
  } catch {
    return {};
  }
}
