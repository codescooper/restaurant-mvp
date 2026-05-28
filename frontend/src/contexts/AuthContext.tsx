import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';
import { User, MembershipView, Role, CurrentRestaurant, Branding } from '../types';
import { authApi, brandingApi } from '../services/endpoints';
import { decodeAccessToken, resolvePostLogin } from '../services/auth-helpers';

interface AuthContextType {
  currentUser: User | null;
  memberships: MembershipView[];
  activeRestaurantId: number | null;
  currentRole: Role | null;
  currentRestaurant: CurrentRestaurant | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<{ autoSelected: boolean; role: Role | null }>;
  selectRestaurant: (restaurantId: number) => Promise<Role>;
  logout: () => void;
  isAuthenticated: boolean;
  hasActiveRestaurant: boolean;
  branding: Branding | null;
  refreshBranding: () => Promise<void>;
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
  const [currentRestaurant, setCurrentRestaurant] = useState<CurrentRestaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [branding, setBranding] = useState<Branding | null>(null);

  // Restauration de session au montage.
  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }
    authApi
      .me()
      .then(({ user, memberships: ms, currentRestaurant: cr }) => {
        setCurrentUser(user);
        setMemberships(ms);
        setCurrentRestaurant(cr ?? null);
        const claims = decodeAccessToken(localStorage.getItem('accessToken'));
        if (claims.restaurantId && ms.some((m) => m.restaurantId === claims.restaurantId)) {
          setActiveRestaurantId(claims.restaurantId);
          setCurrentRole((claims.role as Role) ?? ms.find((m) => m.restaurantId === claims.restaurantId)?.role ?? null);
          localStorage.setItem('activeRestaurantId', String(claims.restaurantId));
          // Charger le branding maintenant qu'on est authentifié avec un restaurant actif.
          brandingApi.get().then(setBranding).catch(() => { /* silencieux */ });
        } else {
          localStorage.removeItem('activeRestaurantId');
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
      // Synchronise currentRestaurant depuis /auth/me (round-trip supplémentaire acceptable).
      // En cas d'erreur réseau, on ne touche pas currentRestaurant : le statut sera revérifié
      // au prochain me() (restore de session au rechargement).
      try {
        const me = await authApi.me();
        setCurrentRestaurant(me.currentRestaurant ?? null);
      } catch (err) {
        console.warn('me() failed après login, currentRestaurant non rafraîchi', err);
      }
      // Charger le branding maintenant qu'on est authentifié avec un restaurant actif.
      brandingApi.get().then(setBranding).catch(() => { /* silencieux */ });
      return { autoSelected: true, role: post.role };
    }
    setActiveRestaurantId(null);
    setCurrentRole(null);
    setCurrentRestaurant(null);
    localStorage.removeItem('activeRestaurantId');
    return { autoSelected: false, role: null };
  };

  const selectRestaurant = async (restaurantId: number) => {
    const res = await authApi.switchRestaurant(restaurantId);
    persistTokens(res.accessToken, res.refreshToken);
    setCurrentUser(res.user);
    setMemberships(res.memberships);
    const role = res.memberships.find((m) => m.restaurantId === restaurantId)?.role
      ?? (decodeAccessToken(res.accessToken).role as Role | undefined);
    if (!role) throw new Error(`Restaurant ${restaurantId} introuvable dans la réponse`);
    setActiveRestaurantId(restaurantId);
    setCurrentRole(role);
    localStorage.setItem('activeRestaurantId', String(restaurantId));
    // Synchronise currentRestaurant depuis /auth/me (round-trip supplémentaire acceptable).
    // En cas d'erreur réseau, on ne touche pas currentRestaurant : le statut sera revérifié
    // au prochain me() (restore de session au rechargement).
    try {
      const me = await authApi.me();
      setCurrentRestaurant(me.currentRestaurant ?? null);
    } catch (err) {
      console.warn('me() failed après selectRestaurant, currentRestaurant non rafraîchi', err);
    }
    // Charger le branding du nouveau restaurant sélectionné.
    brandingApi.get().then(setBranding).catch(() => { /* silencieux */ });
    return role;
  };

  const refreshBranding = useCallback(async () => {
    try {
      const b = await brandingApi.get();
      setBranding(b);
    } catch (err) {
      console.warn('refreshBranding: impossible de charger le branding', err);
    }
  }, []);

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('activeRestaurantId');
    setCurrentUser(null);
    setMemberships([]);
    setActiveRestaurantId(null);
    setCurrentRole(null);
    setCurrentRestaurant(null);
    setBranding(null);
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        memberships,
        activeRestaurantId,
        currentRole,
        currentRestaurant,
        loading,
        login,
        selectRestaurant,
        logout,
        isAuthenticated: !!currentUser,
        hasActiveRestaurant: activeRestaurantId != null,
        branding,
        refreshBranding,
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
