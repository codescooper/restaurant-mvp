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
// IMPORTANT : décodage UTF-8. `atob` seul produit une "binary string" (1 char = 1 octet) :
// les caractères multi-octets comme le « é » de « propriétaire » seraient corrompus en « Ã© »,
// faussant le rôle au rechargement (→ /unauthorized pour les propriétaires). On repasse donc
// les octets dans un TextDecoder UTF-8.
export function decodeAccessToken(token: string | null | undefined): TokenClaims {
  if (!token) return {};
  const parts = token.split('.');
  if (parts.length < 2) return {};
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    const json = new TextDecoder('utf-8').decode(bytes);
    return JSON.parse(json) as TokenClaims;
  } catch {
    return {};
  }
}
