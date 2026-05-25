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
  if (!currentRole) return <Navigate to="/select-restaurant" replace />;
  if (!allowedRoles.includes(currentRole)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}
