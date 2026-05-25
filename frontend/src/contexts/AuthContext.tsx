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
        const claims = decodeAccessToken(localStorage.getItem('accessToken'));
        if (claims.restaurantId && ms.some((m) => m.restaurantId === claims.restaurantId)) {
          setActiveRestaurantId(claims.restaurantId);
          setCurrentRole((claims.role as Role) ?? ms.find((m) => m.restaurantId === claims.restaurantId)?.role ?? null);
          localStorage.setItem('activeRestaurantId', String(claims.restaurantId));
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
      ?? (decodeAccessToken(res.accessToken).role as Role | undefined);
    if (!role) throw new Error(`Restaurant ${restaurantId} introuvable dans la réponse`);
    setActiveRestaurantId(restaurantId);
    setCurrentRole(role);
    localStorage.setItem('activeRestaurantId', String(restaurantId));
    return role;
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
