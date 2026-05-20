import { useState } from 'react';
import { Link, NavLink } from 'react-router-dom';
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
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useWebSocket } from '../contexts/WebSocketContext';

interface RouteDef {
  path: string;
  label: string;
  icon: typeof ChefHat;
}

export function Navigation() {
  const { currentUser, logout } = useAuth();
  const { connected } = useWebSocket();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  if (!currentUser) return null;

  const routes: RouteDef[] = [];
  if (currentUser.role === 'administrateur') {
    routes.push(
      { path: '/dashboard', label: 'Dashboard', icon: BarChart3 },
      { path: '/admin', label: 'Gestion', icon: Package },
      { path: '/caisse', label: 'Caisse', icon: ShoppingCart },
      { path: '/salle', label: 'Salle', icon: LayoutGrid },
      { path: '/service', label: 'Service', icon: BellRing },
      { path: '/cuisine', label: 'Cuisine', icon: ChefHat }
    );
  } else if (currentUser.role === 'caissier') {
    routes.push(
      { path: '/caisse', label: 'Caisse', icon: ShoppingCart },
      { path: '/salle', label: 'Salle', icon: LayoutGrid },
      { path: '/service', label: 'Service', icon: BellRing },
      { path: '/dashboard', label: 'Statistiques', icon: BarChart3 }
    );
  } else if (currentUser.role === 'serveur') {
    routes.push({ path: '/salle', label: 'Salle', icon: LayoutGrid });
  } else if (currentUser.role === 'cuisinier') {
    routes.push({ path: '/cuisine', label: 'Cuisine', icon: ChefHat });
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-2 px-3 py-2 rounded-lg font-medium transition ${
      isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100'
    }`;

  return (
    <nav className="bg-white border-b shadow-sm sticky top-0 z-40 no-print">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center gap-3">
            <ChefHat className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="font-bold text-gray-800 leading-tight">Restaurant Pilote</h1>
              <p className="text-xs text-gray-500 capitalize">{currentUser.role}</p>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-2">
            {routes.map((route) => (
              <NavLink key={route.path} to={route.path} className={linkClass}>
                <route.icon className="w-5 h-5" />
                {route.label}
              </NavLink>
            ))}
            <span
              title={connected ? 'Connecté en temps réel' : 'Hors-ligne'}
              className={`flex items-center gap-1 px-2 py-1 rounded text-xs ${
                connected ? 'text-green-600' : 'text-red-500'
              }`}
            >
              {connected ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            </span>
            <button
              onClick={logout}
              className="ml-2 flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium"
            >
              <LogOut className="w-5 h-5" />
              Déconnexion
            </button>
          </div>

          <button
            onClick={() => setShowMobileMenu(!showMobileMenu)}
            className="md:hidden p-2 text-gray-600"
          >
            {showMobileMenu ? <X /> : <MenuIcon />}
          </button>
        </div>

        {showMobileMenu && (
          <div className="md:hidden py-4 border-t space-y-1">
            {routes.map((route) => (
              <NavLink
                key={route.path}
                to={route.path}
                onClick={() => setShowMobileMenu(false)}
                className={linkClass}
              >
                <route.icon className="w-5 h-5" />
                {route.label}
              </NavLink>
            ))}
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-red-600 hover:bg-red-50 font-medium"
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
