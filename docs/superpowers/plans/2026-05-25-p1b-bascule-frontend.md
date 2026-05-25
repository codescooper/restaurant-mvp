# Plan B — Bascule frontend multi-tenant (P1) — Implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adapter le frontend au backend multi-tenant : connexion par **email**, **sélecteur de restaurant** quand l'utilisateur appartient à plusieurs restaurants, rôle issu du restaurant actif, reconnexion WebSocket au changement de restaurant, et alignement des types/affichages (`username` → `displayName`).

**Architecture:** `AuthContext` porte désormais l'utilisateur global (`email`, `displayName`, `isSuperAdmin`), la liste de ses **memberships**, le **restaurant actif** et le **rôle** dans ce restaurant. Le login renvoie les memberships ; un seul → sélection auto (token déjà scopé par le backend), plusieurs → écran `/select-restaurant` qui appelle `switch-restaurant`. Le rôle qui pilote la navigation et `ProtectedRoute` vient du restaurant actif (décodé du JWT / des memberships). La socket se (re)connecte avec le token scopé.

**Tech Stack:** React 18, TypeScript, Vite, React Router, Axios, socket.io-client, Tailwind, Vitest.

**Dépendance :** ce plan suppose le **Plan A (socle backend)** déployé. L'API parle « email » et renvoie `{ user, memberships, accessToken, refreshToken }` au login. Tant que le Plan A n'est pas mergé, le frontend ne pourra pas se connecter (attendu).

**Hors périmètre :** personnalisation/branding (P3), invitations & inscription (P2), console super-admin (P2).

**Référence design :** `docs/superpowers/specs/2026-05-25-plateforme-multitenant-design.md`

---

## Carte des fichiers

**Créés :**
- `frontend/src/services/auth-helpers.ts` — décodage JWT + helpers purs (`homeForRole`, `resolvePostLogin`).
- `frontend/src/services/auth-helpers.test.ts` — tests unitaires des helpers purs.
- `frontend/src/pages/SelectRestaurantPage.tsx` — écran de choix du restaurant (multi-memberships).

**Modifiés :**
- `frontend/src/types/index.ts` — `User` (email/displayName), `MembershipView`, `AuthResponse` (+ memberships), `Role` (+ `propriétaire`), objets imbriqués `username` → `displayName`.
- `frontend/src/services/endpoints.ts` — `authApi` (login email, me, switchRestaurant), `userApi` (email/displayName).
- `frontend/src/services/api.ts` — re-scoping du token au refresh (multi-restaurants).
- `frontend/src/services/socket.ts` — inchangé (déjà token-based) ; vérifié.
- `frontend/src/contexts/AuthContext.tsx` — memberships, restaurant actif, rôle courant, `selectRestaurant`.
- `frontend/src/contexts/WebSocketContext.tsx` — reconnexion sur changement de token/restaurant, suppression de `join_room`.
- `frontend/src/components/ProtectedRoute.tsx` — rôle courant + redirection vers `/select-restaurant`.
- `frontend/src/pages/LoginPage.tsx` — login par email, comptes démo par email, redirection sélecteur.
- `frontend/src/components/Navigation.tsx` — rôle courant, nom du restaurant, sélecteur de restaurant, `displayName`.
- `frontend/src/App.tsx` — route `/select-restaurant`, `propriétaire` dans les `allowedRoles`.
- Divers composants/pages affichant `*.username` (balayage) → `*.displayName`.

**Milestones :**
- **M1** — Types + client API + helpers (+ tests).
- **M2** — AuthContext multi-tenant + reconnexion socket.
- **M3** — Login par email + sélecteur de restaurant + routing.
- **M4** — Balayage `username`→`displayName` + gestion des membres + vérification finale.

---

## MILESTONE 1 — Types, client API, helpers

### Task 1.1 : Types multi-tenant

**Files:**
- Modify: `frontend/src/types/index.ts`

- [ ] **Step 1: `Role`, `User`, `MembershipView`, `AuthResponse`**

Remplacer le haut du fichier (lignes 1-16) par :

```typescript
export type Role = 'propriétaire' | 'administrateur' | 'caissier' | 'cuisinier' | 'serveur';

export interface User {
  id: number;
  email: string;
  displayName?: string | null;
  isSuperAdmin?: boolean;
}

export interface MembershipView {
  restaurantId: number;
  restaurantName: string;
  restaurantSlug: string;
  role: Role;
}

export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  memberships: MembershipView[];
}
```

- [ ] **Step 2: Objets imbriqués `username` → `displayName`**

Dans le même fichier, remplacer toutes les occurrences imbriquées de `username` par `displayName` (le backend renvoie désormais `displayName`) :

- `RestaurantTable.server`: `{ id: number; username: string } | null` → `{ id: number; displayName: string | null } | null`.
- `CashSessionSummary.cashier`: `{ id: number; username: string }` → `{ id: number; displayName: string | null }`.
- `CashSessionSummary.closer`: `{ id: number; username: string } | null` → `{ id: number; displayName: string | null } | null`.
- `AuditLogEntry.user`: `{ id: number; username: string; role: string } | null` → `{ id: number; displayName: string | null } | null`.
- `Employee.user`: `{ id: number; username: string; role: string } | null` → `{ id: number; displayName: string | null } | null`.
- `Expense.creator`: `{ id: number; username: string } | null` → `{ id: number; displayName: string | null } | null`.
- `Inventory.creator`: `{ username: string } | null` → `{ displayName: string | null } | null`.

- [ ] **Step 3: Vérifier la compilation (échecs attendus)**

Run: `cd frontend && npm run build` (ou `npx tsc --noEmit`)
Expected: erreurs de type dans les composants lisant `.username` / `currentUser.role` (corrigées aux tâches suivantes). On ne commit qu'à un point compilable (fin M1 pour types+helpers, le reste suit).

### Task 1.2 : Helpers d'auth purs + tests (TDD)

**Files:**
- Create: `frontend/src/services/auth-helpers.ts`
- Create: `frontend/src/services/auth-helpers.test.ts`

- [ ] **Step 1: Écrire les tests d'abord**

`frontend/src/services/auth-helpers.test.ts` :

```typescript
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
    const payload = Buffer.from(JSON.stringify({ userId: 1, restaurantId: 7, role: 'serveur', isSuperAdmin: false })).toString('base64url');
    const token = `x.${payload}.y`;
    expect(decodeAccessToken(token)).toMatchObject({ restaurantId: 7, role: 'serveur' });
  });
  it('token invalide → objet vide', () => {
    expect(decodeAccessToken('nimporte')).toEqual({});
  });
});
```

- [ ] **Step 2: Lancer (doit échouer : module absent)**

Run: `cd frontend && npx vitest run src/services/auth-helpers.test.ts`
Expected: FAIL (« Cannot find module './auth-helpers' »).

- [ ] **Step 3: Implémenter `auth-helpers.ts`**

```typescript
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
```

> Note test : `decodeAccessToken` utilise `atob` (présent dans jsdom/navigateur). Dans le test, on encode avec `Buffer...base64url`; `atob` décode le base64 standard (le payload de test ne contient pas de caractères `-`/`_`, donc compatible). Si Vitest n'a pas `atob` global, ajouter en tête du test `import { Buffer } from 'node:buffer';` (déjà utilisé) — `atob` est disponible en Node 18+.

- [ ] **Step 4: Tests au vert**

Run: `cd frontend && npx vitest run src/services/auth-helpers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/services/auth-helpers.ts frontend/src/services/auth-helpers.test.ts frontend/src/types/index.ts
git commit -m "feat(front-multitenant): types multi-tenant + helpers d'auth (TDD)"
```

### Task 1.3 : Client API (auth + users) + re-scoping au refresh

**Files:**
- Modify: `frontend/src/services/endpoints.ts`
- Modify: `frontend/src/services/api.ts`

- [ ] **Step 1: `authApi` (login email, me, switch) + `userApi` (email/displayName)**

Dans `endpoints.ts`, remplacer `authApi` (lignes ~68-72) :

```typescript
export const authApi = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }).then((r) => r.data.data as AuthResponse),
  me: () =>
    api.get('/auth/me').then((r) => r.data.data as { user: User; memberships: MembershipView[] }),
  switchRestaurant: (restaurantId: number) =>
    api.post('/auth/switch-restaurant', { restaurantId }).then((r) => r.data.data as AuthResponse),
};
```

Ajouter `MembershipView` à l'import depuis `../types` (en tête du fichier).

Remplacer `userApi` (lignes ~198-206) :

```typescript
export const userApi = {
  list: () => api.get('/users').then((r) => r.data.data as MemberRow[]),
  create: (data: { email: string; password: string; role: Role; displayName?: string }) =>
    api.post('/users', data).then((r) => r.data.data as MemberRow),
  update: (membershipId: number, data: { role?: Role; password?: string; displayName?: string }) =>
    api.put(`/users/${membershipId}`, data).then((r) => r.data.data as MemberRow),
  toggle: (membershipId: number) => api.patch(`/users/${membershipId}/toggle-active`).then((r) => r.data.data as MemberRow),
  remove: (membershipId: number) => api.delete(`/users/${membershipId}`).then((r) => r.data.data),
};
```

Et ajouter le type `MemberRow` près des autres interfaces du fichier (il reflète la vue backend `MemberView`) :

```typescript
export interface MemberRow {
  membershipId: number;
  userId: number;
  email: string;
  displayName: string | null;
  role: Role;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}
```

- [ ] **Step 2: `api.ts` — re-scoping du restaurant au refresh**

Le refresh backend renvoie un token **non scopé** si l'utilisateur a plusieurs restaurants. Pour préserver le restaurant actif, après refresh on ré-applique `switch-restaurant` si nécessaire. Remplacer le bloc `try` de l'intercepteur (lignes ~21-28) par :

```typescript
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
        const tokens = data.data as { accessToken: string; refreshToken: string };
        let accessToken = tokens.accessToken;
        // Multi-restaurants : le refresh n'est pas scopé → on ré-applique le restaurant actif.
        const activeId = Number(localStorage.getItem('activeRestaurantId') || '');
        const claims = decodeAccessToken(accessToken);
        if (activeId && claims.restaurantId !== activeId) {
          const sw = await axios.post(
            `${API_URL}/auth/switch-restaurant`,
            { restaurantId: activeId },
            { headers: { Authorization: `Bearer ${accessToken}` } }
          );
          const swTokens = sw.data.data as { accessToken: string; refreshToken: string };
          accessToken = swTokens.accessToken;
          localStorage.setItem('refreshToken', swTokens.refreshToken);
        } else {
          localStorage.setItem('refreshToken', tokens.refreshToken);
        }
        localStorage.setItem('accessToken', accessToken);
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch (refreshErr) {
```

Ajouter en tête de `api.ts` : `import { decodeAccessToken } from './auth-helpers';`

> Note : pour un utilisateur mono-restaurant, le refresh renvoie déjà un token scopé → pas d'appel `switch` supplémentaire.

- [ ] **Step 3: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans AuthContext/composants (M2-M4). Pas de commit isolé ici (couplé à M2).

---

## MILESTONE 2 — AuthContext multi-tenant + reconnexion socket

### Task 2.1 : Réécrire `AuthContext`

**Files:**
- Modify: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Nouveau contexte**

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, MembershipView, Role } from '../types';
import { authApi } from '../services/endpoints';
import { decodeAccessToken, resolvePostLogin } from '../services/auth-helpers';

interface AuthContextType {
  currentUser: User | null;
  memberships: MembershipView[];
  activeRestaurantId: number | null;
  currentRole: Role | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ autoSelected: boolean }>;
  selectRestaurant: (restaurantId: number) => Promise<Role>;
  logout: () => void;
  isAuthenticated: boolean;
  hasActiveRestaurant: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function persistTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<MembershipView[]>([]);
  const [activeRestaurantId, setActiveRestaurantId] = useState<number | null>(null);
  const [currentRole, setCurrentRole] = useState<Role | null>(null);
  const [loading, setLoading] = useState(true);

  // Restauration de session au montage.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user, memberships: ms }) => {
        setCurrentUser(user);
        setMemberships(ms);
        const claims = decodeAccessToken(token);
        if (claims.restaurantId && ms.some((m) => m.restaurantId === claims.restaurantId)) {
          setActiveRestaurantId(claims.restaurantId);
          setCurrentRole((claims.role as Role) ?? ms.find((m) => m.restaurantId === claims.restaurantId)?.role ?? null);
          localStorage.setItem('activeRestaurantId', String(claims.restaurantId));
        }
      })
      .catch(() => {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('activeRestaurantId');
      })
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const res = await authApi.login(email, password);
    persistTokens(res.accessToken, res.refreshToken);
    setCurrentUser(res.user);
    setMemberships(res.memberships);
    const post = resolvePostLogin(res.memberships);
    if (post.autoSelected) {
      setActiveRestaurantId(post.restaurantId);
      setCurrentRole(post.role);
      localStorage.setItem('activeRestaurantId', String(post.restaurantId));
      return { autoSelected: true };
    }
    setActiveRestaurantId(null);
    setCurrentRole(null);
    localStorage.removeItem('activeRestaurantId');
    return { autoSelected: false };
  };

  const selectRestaurant = async (restaurantId: number) => {
    const res = await authApi.switchRestaurant(restaurantId);
    persistTokens(res.accessToken, res.refreshToken);
    setCurrentUser(res.user);
    setMemberships(res.memberships);
    const role = res.memberships.find((m) => m.restaurantId === restaurantId)?.role
      ?? (decodeAccessToken(res.accessToken).role as Role);
    setActiveRestaurantId(restaurantId);
    setCurrentRole(role ?? null);
    localStorage.setItem('activeRestaurantId', String(restaurantId));
    return role as Role;
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeRestaurantId');
    setCurrentUser(null);
    setMemberships([]);
    setActiveRestaurantId(null);
    setCurrentRole(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        memberships,
        activeRestaurantId,
        currentRole,
        loading,
        login,
        selectRestaurant,
        logout,
        isAuthenticated: !!currentUser,
        hasActiveRestaurant: activeRestaurantId != null,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans composants consommant l'ancien `currentUser.role`/`login(username,...)` (corrigées M3/M4).

### Task 2.2 : Reconnexion WebSocket sur changement de restaurant

**Files:**
- Modify: `frontend/src/contexts/WebSocketContext.tsx`

- [ ] **Step 1: Reconnecter quand le restaurant actif change ; supprimer `join_room`**

Le backend fait rejoindre la room automatiquement d'après le token (restaurantId+role) — plus besoin de `join_room`. La socket doit se reconnecter quand le token scopé change (login, switch).

```typescript
import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { connectSocket, disconnectSocket } from '../services/socket';

interface WebSocketContextType {
  socket: Socket | null;
  connected: boolean;
}

const WebSocketContext = createContext<WebSocketContextType>({ socket: null, connected: false });

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const { currentUser, activeRestaurantId } = useAuth();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Pas connecté ou pas de restaurant sélectionné → pas de socket (le backend exige un token scopé).
    if (!currentUser || activeRestaurantId == null) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }
    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const s = connectSocket(token);
    s.on('connect', () => setConnected(true));
    s.on('disconnect', () => setConnected(false));
    s.on('connect_error', (err) => {
      setConnected(false);
      console.warn('WebSocket indisponible, nouvelle tentative…', err.message);
    });
    setSocket(s);

    return () => {
      s.removeAllListeners();
      disconnectSocket();
    };
    // Reconnexion quand l'utilisateur OU le restaurant actif change (nouveau token scopé).
  }, [currentUser, activeRestaurantId]);

  return (
    <WebSocketContext.Provider value={{ socket, connected }}>{children}</WebSocketContext.Provider>
  );
}

export function useWebSocket(): WebSocketContextType {
  return useContext(WebSocketContext);
}
```

- [ ] **Step 2: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans LoginPage/Navigation/ProtectedRoute (M3).

---

## MILESTONE 3 — Login par email + sélecteur de restaurant + routing

### Task 3.1 : Page de connexion par email

**Files:**
- Modify: `frontend/src/pages/LoginPage.tsx`

- [ ] **Step 1: Login par email + redirection sélecteur**

Remplacer les parties concernées de `LoginPage.tsx` :

- Imports : remplacer `import { Role } from '../types';` par `import { homeForRole } from '../services/auth-helpers';` et garder le reste. Retirer la constante `HOME` locale.
- Comptes démo (lignes 15-20) → emails :

```typescript
const DEMO_ACCOUNTS = [
  { label: 'Propriétaire', emoji: '👑', email: 'admin@restaurant-pilote.local', password: 'admin123' },
  { label: 'Caissier', emoji: '🧾', email: 'caisse1@restaurant-pilote.local', password: 'caisse123' },
  { label: 'Cuisinier', emoji: '👨‍🍳', email: 'chef1@restaurant-pilote.local', password: 'chef123' },
  { label: 'Serveur', emoji: '🧑‍🍽️', email: 'serveur1@restaurant-pilote.local', password: 'serveur123' },
];
```

- État + hook : remplacer `username` par `email`, et adapter la logique :

```typescript
  const { login, isAuthenticated, hasActiveRestaurant, currentRole } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Déjà authentifié avec un restaurant actif → aller à la page du rôle.
  useEffect(() => {
    if (isAuthenticated && hasActiveRestaurant && currentRole) {
      navigate(homeForRole(currentRole), { replace: true });
    }
  }, [isAuthenticated, hasActiveRestaurant, currentRole, navigate]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Veuillez remplir tous les champs');
      return;
    }
    setError('');
    setLoading(true);
    try {
      const { autoSelected } = await login(email, password);
      navigate(autoSelected ? '/' : '/select-restaurant', { replace: true });
      // Si autoSelected, le useEffect ci-dessus redirige vers la page du rôle.
    } catch (err) {
      setError(getApiError(err, 'Email ou mot de passe incorrect'));
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (em: string, p: string) => {
    setEmail(em);
    setPassword(p);
    setError('');
  };
```

- JSX du champ identifiant : libellé « Email », `type="email"`, `value={email}`, `onChange={(e) => setEmail(e.target.value)}`, `ref={emailRef}`, `placeholder="vous@exemple.com"`, `autoComplete="email"`.
- Boucle des comptes démo : `key={acc.email}`, `onClick={() => fillDemo(acc.email, acc.password)}`, et afficher `{acc.email}` au lieu de `{acc.username}`.

> Le `navigate('/')` après autoSelected déclenche le `useEffect` de redirection (qui voit `currentRole`). En cas de course, `/` rend `LoginPage` qui re-redirige correctement.

- [ ] **Step 2: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans Navigation/ProtectedRoute/SelectRestaurant (suite M3).

### Task 3.2 : Écran de sélection du restaurant

**Files:**
- Create: `frontend/src/pages/SelectRestaurantPage.tsx`

- [ ] **Step 1: Composant**

```typescript
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Store, Loader2, AlertCircle, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { homeForRole } from '../services/auth-helpers';
import { getApiError } from '../services/api';

export default function SelectRestaurantPage() {
  const { isAuthenticated, memberships, selectRestaurant, logout, loading } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<number | null>(null);

  useEffect(() => {
    if (!loading && !isAuthenticated) navigate('/', { replace: true });
  }, [loading, isAuthenticated, navigate]);

  const choose = async (restaurantId: number) => {
    setError('');
    setBusy(restaurantId);
    try {
      const role = await selectRestaurant(restaurantId);
      navigate(homeForRole(role), { replace: true });
    } catch (err) {
      setError(getApiError(err, 'Sélection impossible'));
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gold-400/10 ring-1 ring-gold-400/25 rounded-full mb-3">
            <Store className="w-7 h-7 text-gold-400" />
          </div>
          <h1 className="text-xl font-bold text-neutral-100">Choisir un restaurant</h1>
          <p className="text-neutral-400 text-sm">Vous avez accès à plusieurs établissements.</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 rounded-lg p-3 mb-4 text-sm">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {memberships.length === 0 ? (
          <p className="text-neutral-400 text-center text-sm">
            Aucun restaurant actif. Contactez le propriétaire pour une invitation.
          </p>
        ) : (
          <div className="space-y-2">
            {memberships.map((m) => (
              <button
                key={m.restaurantId}
                disabled={busy !== null}
                onClick={() => choose(m.restaurantId)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 rounded-lg text-left transition disabled:opacity-50"
              >
                <div>
                  <div className="font-medium text-neutral-100">{m.restaurantName}</div>
                  <div className="text-xs text-neutral-400 capitalize">{m.role}</div>
                </div>
                {busy === m.restaurantId && <Loader2 className="w-5 h-5 animate-spin text-gold-400" />}
              </button>
            ))}
          </div>
        )}

        <button
          onClick={() => {
            logout();
            navigate('/', { replace: true });
          }}
          className="mt-6 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium text-sm"
        >
          <LogOut className="w-4 h-4" />
          Se déconnecter
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans App/Navigation/ProtectedRoute.

### Task 3.3 : Routing + `ProtectedRoute` + `propriétaire`

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/components/ProtectedRoute.tsx`

- [ ] **Step 1: `ProtectedRoute` utilise le rôle courant + redirige vers le sélecteur**

```typescript
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  allowedRoles: Role[];
}) {
  const { isAuthenticated, hasActiveRestaurant, currentRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement...</div>
    );
  }
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (!hasActiveRestaurant) return <Navigate to="/select-restaurant" replace />;
  if (currentRole && !allowedRoles.includes(currentRole)) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
```

- [ ] **Step 2: `App.tsx` — route sélecteur + `propriétaire` partout où `administrateur` est autorisé**

- Ajouter l'import lazy : `const SelectRestaurantPage = lazy(() => import('./pages/SelectRestaurantPage'));`
- Ajouter la route (hors `ProtectedRoute`, mais après le login) :

```tsx
                <Route path="/select-restaurant" element={<SelectRestaurantPage />} />
```

- Dans chaque `allowedRoles={[...]}` contenant `'administrateur'`, ajouter `'propriétaire'`. Résultat attendu :
  - `/caisse` : `['propriétaire', 'administrateur', 'caissier', 'serveur']`
  - `/salle` : `['propriétaire', 'administrateur', 'caissier', 'serveur']`
  - `/service` : `['propriétaire', 'administrateur', 'caissier', 'serveur']`
  - `/cuisine` : `['propriétaire', 'administrateur', 'cuisinier']`
  - `/admin` : `['propriétaire', 'administrateur']`
  - `/dashboard` : `['propriétaire', 'administrateur', 'caissier']`

- [ ] **Step 3: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes dans Navigation (M4) + composants `username`.

---

## MILESTONE 4 — Navigation, balayage `username`→`displayName`, membres, vérif finale

### Task 4.1 : Navigation (rôle courant, nom du restaurant, sélecteur)

**Files:**
- Modify: `frontend/src/components/Navigation.tsx`

- [ ] **Step 1: Utiliser `currentRole` + afficher le restaurant + sélecteur si multi**

- Remplacer `const { currentUser, logout } = useAuth();` par :

```typescript
  const { currentUser, currentRole, memberships, activeRestaurantId, selectRestaurant, logout } = useAuth();
```

- Remplacer la garde `if (!currentUser) return null;` par `if (!currentUser || !currentRole) return null;`
- Remplacer toutes les occurrences de `currentUser.role` par `currentRole` (construction des `routes` et affichage). Traiter `'propriétaire'` comme `'administrateur'` :

```typescript
  const routes: RouteDef[] = [];
  if (currentRole === 'administrateur' || currentRole === 'propriétaire') {
    routes.push(
      { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { path: '/admin', label: 'Gestion', icon: Package },
      { path: '/caisse', label: 'Caisse', icon: ShoppingCart },
      { path: '/salle', label: 'Salle', icon: LayoutGrid },
      { path: '/service', label: 'Service', icon: BellRing },
      { path: '/cuisine', label: 'Cuisine', icon: ChefHat }
    );
  } else if (currentRole === 'caissier') {
    routes.push(
      { path: '/caisse', label: 'Caisse', icon: ShoppingCart },
      { path: '/salle', label: 'Salle', icon: LayoutGrid },
      { path: '/service', label: 'Service', icon: BellRing },
      { path: '/dashboard', label: 'Statistiques', icon: BarChart3 }
    );
  } else if (currentRole === 'serveur') {
    routes.push(
      { path: '/salle', label: 'Salle', icon: LayoutGrid },
      { path: '/service', label: 'Service', icon: BellRing }
    );
  } else if (currentRole === 'cuisinier') {
    routes.push({ path: '/cuisine', label: 'Cuisine', icon: ChefHat });
  }

  const activeMembership = memberships.find((m) => m.restaurantId === activeRestaurantId);
```

- Remplacer le bloc titre (lignes ~67-73) pour afficher le nom du restaurant + rôle :

```tsx
          <Link to="/" className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-gold-400" />
            <div>
              <h1 className="font-bold text-neutral-100 leading-tight">
                {activeMembership?.restaurantName ?? 'Restaurant'}
              </h1>
              <p className="text-xs text-neutral-400 capitalize">{currentRole}</p>
            </div>
          </Link>
```

- Ajouter un **sélecteur de restaurant** (visible seulement si l'utilisateur a >1 membership), juste avant le bouton Déconnexion dans la barre desktop (`<div className="hidden md:flex ...">`) :

```tsx
            {memberships.length > 1 && (
              <select
                value={activeRestaurantId ?? ''}
                onChange={(e) => selectRestaurant(Number(e.target.value))}
                className="ml-2 bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-2 py-1.5"
                title="Changer de restaurant"
              >
                {memberships.map((m) => (
                  <option key={m.restaurantId} value={m.restaurantId}>
                    {m.restaurantName}
                  </option>
                ))}
              </select>
            )}
```

> `selectRestaurant` ré-émet un token scopé → l'`useEffect` de `WebSocketContext` reconnecte la socket automatiquement (dépendance `activeRestaurantId`). Les pages ouvertes rechargeront leurs données au prochain fetch/navigation.

- [ ] **Step 2: type-check** — Run: `cd frontend && npx tsc --noEmit` — Expected: erreurs restantes uniquement dans les composants lisant `.username` imbriqué (Task 4.2).

### Task 4.2 : Balayage `username` → `displayName` dans les composants

**Files:**
- Modify: divers fichiers `frontend/src/pages/**` et `frontend/src/pages/admin/**` (selon résultats du grep)

- [ ] **Step 1: Localiser les usages**

Run (depuis `frontend/`) : `npx tsc --noEmit` puis lire chaque erreur « Property 'username' does not exist ». OU rechercher dans la base de code les accès `.username` sur les objets API : `server`, `cashier`, `closer`, `creator`, `user` (dans les pages Dashboard, Caisse, Salle, Service, Admin/EmployeesTab, Admin/ExpensesTab, Admin/InventoryTab, audit éventuel).

- [ ] **Step 2: Remplacer chaque accès imbriqué**

Pour chaque occurrence, remplacer `.username` par `.displayName` et prévoir le `null` (le nom peut être vide) avec un repli, p. ex. :

```tsx
{order.server?.displayName ?? '—'}
{session.cashier?.displayName ?? '—'}
{log.user?.displayName ?? 'Système'}
{expense.creator?.displayName ?? '—'}
{inventory.creator?.displayName ?? '—'}
{employee.user?.displayName ?? '—'}
```

> Ne PAS toucher aux `username` qui seraient des libellés non liés à l'API (il n'y en a a priori pas). Le `currentUser.username` n'existe plus : partout où une page affichait l'utilisateur courant, utiliser `currentUser.displayName ?? currentUser.email`.

- [ ] **Step 3: type-check complet** — Run: `cd frontend && npx tsc --noEmit` — Expected: **PASS**.

### Task 4.3 : Écran « Gestion des membres » (anciens utilisateurs)

**Files:**
- Modify: le composant de gestion des utilisateurs dans `frontend/src/pages/AdminPage.tsx` (ou l'onglet dédié)

> L'écran « utilisateurs » liste désormais des **membres** (`MemberRow`) avec `email`/`displayName`/`role`. La création demande `email` + `password` + `role` (+ `displayName` optionnel). Les actions (changer rôle, activer/désactiver, retirer) ciblent le `membershipId`.

- [ ] **Step 1: Adapter l'UI de gestion des utilisateurs**

Lire `frontend/src/pages/AdminPage.tsx`, localiser la section « utilisateurs ». Adapter :
- Colonnes : `displayName` (ou `email`), `email`, `role`, `isActive`, `lastLogin`.
- Formulaire de création : champ `email` (type email) + `password` + `displayName` (optionnel) + `role` (inclure `propriétaire` dans les options de rôle).
- Appels : `userApi.create({ email, password, role, displayName })`, `userApi.update(membershipId, { role, password, displayName })`, `userApi.toggle(membershipId)`, `userApi.remove(membershipId)` — utiliser `row.membershipId` comme identifiant des actions.
- Le rôle `propriétaire` est affiché ; éviter de proposer de retirer son propre accès (le backend le refuse déjà : message d'erreur affiché via `getApiError`).

- [ ] **Step 2: type-check + lint** — Run: `cd frontend && npx tsc --noEmit` — Expected: PASS.

### Task 4.4 : Vérification finale du frontend

- [ ] **Step 1: Build complet**

Run: `cd frontend && npm run build`
Expected: build Vite réussi (0 erreur TypeScript).

- [ ] **Step 2: Tests unitaires**

Run: `cd frontend && npm test`
Expected: `auth-helpers.test.ts` + `format.test.ts` PASS.

- [ ] **Step 3: Smoke manuel (backend Plan A lancé + seedé)**

1. `cd backend && npm run dev` ; `cd frontend && npm run dev`.
2. Se connecter avec `admin@restaurant-pilote.local` / `admin123` → un seul restaurant → redirection directe vers `/dashboard`, nav affiche « Restaurant Pilote » + « propriétaire ».
3. Vérifier la nav (toutes les pages accessibles), le statut temps réel (Wifi), une commande de bout en bout.
4. (Multi-restaurant) créer un 2ᵉ membership pour cet email sur un autre restaurant (via seed/SQL de test) → au login, l'écran `/select-restaurant` apparaît ; choisir un restaurant ; vérifier que le sélecteur de la nav permet de basculer et que la socket se reconnecte.

- [ ] **Step 4: Commit final**

```bash
git add frontend/src
git commit -m "feat(front-multitenant): login email, selecteur de restaurant, role courant, websocket scope"
```

---

## Auto-revue (couverture du spec / Plan A)

| Exigence | Couverte par |
|---|---|
| Login par email | Task 1.3, 3.1 |
| Memberships renvoyés + stockés | Task 1.1, 2.1 |
| Sélecteur de restaurant (multi) | Task 3.2, 4.1 |
| Rôle issu du restaurant actif (nav + garde) | Task 2.1, 3.3, 4.1 |
| `switch-restaurant` | Task 1.3, 2.1, 4.1 |
| Reconnexion socket au switch | Task 2.2 |
| Re-scoping du token au refresh | Task 1.3 |
| Rôle `propriétaire` (routes + nav) | Task 3.3, 4.1 |
| `username` → `displayName` (types + UI) | Task 1.1, 4.2 |
| Gestion des membres (email/role/membershipId) | Task 4.3 |

## Risques d'exécution & points de vigilance

- **Course de redirection après login auto-sélectionné** : `LoginPage` redirige vers `/` puis l'`useEffect` (qui lit `currentRole`) renvoie vers la page du rôle. Si un flash apparaît, rediriger directement vers `homeForRole(currentRole)` une fois `currentRole` défini.
- **`decodeAccessToken`** ne vérifie PAS la signature (usage purement UI pour connaître restaurantId/role) — la sécurité reste côté backend.
- **Balayage `username`** : ne compiler PASSE qu'une fois toutes les occurrences corrigées ; s'appuyer sur `tsc --noEmit` comme liste de tâches.
- **Sélecteur de restaurant** : après `selectRestaurant`, les pages déjà montées gardent leurs données jusqu'au prochain fetch ; acceptable en P1 (l'utilisateur navigue). Une amélioration (invalidation/refresh global) pourra venir plus tard.
- **Comptes démo** : les emails dépendent du seed du Plan A (`*@restaurant-pilote.local`). En production, retirer le bloc démo de `LoginPage`.
