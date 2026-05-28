import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Role } from '../types';

export function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles: Role[] }) {
  const { isAuthenticated, hasActiveRestaurant, currentRole, currentRestaurant, loading } = useAuth();

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement...</div>;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!hasActiveRestaurant || !currentRole) return <Navigate to="/select-restaurant" replace />;

  // Aiguillage par statut du restaurant courant.
  // Les pages /suspended, /rejected, /pending-member seront créées en M6.
  const status = currentRestaurant?.status;
  if (status === 'suspended') return <Navigate to="/suspended" replace />;
  if (status === 'rejected') return <Navigate to="/rejected" replace />;
  if (status === 'pending' && currentRole !== 'propriétaire') return <Navigate to="/pending-member" replace />;
  // Le propriétaire en mode pending peut accéder à toutes les routes ; un bandeau simulation
  // s'affichera côté Layout (M6) pour signaler que les données seront effacées à l'activation.

  if (!allowedRoles.includes(currentRole)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
