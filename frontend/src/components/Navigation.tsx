import { useState } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  ChefHat,
  ShoppingCart,
  BarChart3,
  Package,
  BellRing,
  LayoutGrid,
  LogOut,
  Menu as MenuIcon,
  X,
  Wifi,
  WifiOff,
  Shield,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';
import { homeForRole } from '../services/auth-helpers';
import { useMemo } from 'react';

interface RouteDef {
  path: string;
  label: string;
  icon: typeof ChefHat;
}

export function Navigation() {
  const { currentUser, currentRole, memberships, activeRestaurantId, selectRestaurant, logout, branding, currentRestaurant } = useAuth();
  const { connected } = useWebSocket();
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const brandColor = useMemo(() => branding?.primaryColor || '#D4AF37', [branding?.primaryColor]);

  if (!currentUser || !currentRole) return null;

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
  routes.push({ path: '/aide', label: 'Aide', icon: HelpCircle });

  const activeMembership = memberships.find((m) => m.restaurantId === activeRestaurantId);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
      isActive ? 'text-black' : 'text-neutral-300 hover:bg-neutral-900'
    }`;

  return (
    <nav className="bg-black border-b border-neutral-800 sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to={homeForRole(currentRole)} className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center overflow-hidden"
              style={{ borderColor: brandColor, borderWidth: 2, borderStyle: 'solid' }}
            >
              {branding?.logoUrl ? (
                <img src={branding.logoUrl} alt="Logo" className="w-9 h-9 rounded-lg object-cover" />
              ) : (
                <ChefHat className="w-6 h-6" style={{ color: brandColor }} />
              )}
            </div>
            <div>
              <h1 className="font-bold text-neutral-100 leading-tight">
                {currentRestaurant?.name ?? activeMembership?.restaurantName ?? 'Restoflow'}
              </h1>
              <p className="text-xs text-neutral-400 capitalize">{currentRole}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                className={linkClass}
                style={({ isActive }) => isActive ? { backgroundColor: brandColor } : undefined}
              >
                <route.icon className="w-5 h-5" />
                {route.label}
              </NavLink>
            ))}
            {currentUser?.isSuperAdmin && (
              <NavLink
                to="/super-admin"
                className={linkClass}
                style={({ isActive }) => isActive ? { backgroundColor: brandColor } : undefined}
              >
                <Shield className="w-5 h-5" /> Super-admin
              </NavLink>
            )}
            <span
              title={connected ? 'Connecté en temps réel' : 'Hors-ligne'}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                connected ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </span>
            {memberships.length > 1 && (
              <select
                value={activeRestaurantId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  selectRestaurant(id)
                    .then((role) => navigate(homeForRole(role)))
                    .catch(console.error);
                }}
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
            <button
              onClick={logout}
              className="ml-2 flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 text-neutral-300"
          >
            {showMobileMenu ? <X /> : <MenuIcon />}
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden py-4 border-t border-neutral-800 space-y-1">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => setShowMobileMenu(false)}
                className={linkClass}
                style={({ isActive }) => isActive ? { backgroundColor: brandColor } : undefined}
              >
                <route.icon className="w-5 h-5" />
                {route.label}
              </NavLink>
            ))}
            {currentUser?.isSuperAdmin && (
              <NavLink
                to="/super-admin"
                onClick={() => setShowMobileMenu(false)}
                className={linkClass}
                style={({ isActive }) => isActive ? { backgroundColor: brandColor } : undefined}
              >
                <Shield className="w-5 h-5" /> Super-admin
              </NavLink>
            )}
            {memberships.length > 1 && (
              <select
                value={activeRestaurantId ?? ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  selectRestaurant(id)
                    .then((role) => { navigate(homeForRole(role)); setShowMobileMenu(false); })
                    .catch(console.error);
                }}
                className="w-full bg-neutral-900 border border-neutral-800 text-neutral-200 text-sm rounded-lg px-3 py-2"
                title="Changer de restaurant"
              >
                {memberships.map((m) => (
                  <option key={m.restaurantId} value={m.restaurantId}>
                    {m.restaurantName}
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-rose-400 hover:bg-rose-500/10 font-medium"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
