import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Layout } from './components/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const SelectRestaurantPage = lazy(() => import('./pages/SelectRestaurantPage'));
const CaissePage = lazy(() => import('./pages/CaissePage'));
const SallePage = lazy(() => import('./pages/SallePage'));
const ServicePage = lazy(() => import('./pages/ServicePage'));
const CuisinePage = lazy(() => import('./pages/CuisinePage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));

function Loading() {
  return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement...</div>;
}

function SimpleMessage({ title, message }: { title: string; message: string }) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center px-4">
      <h1 className="text-3xl font-bold text-gray-800">{title}</h1>
      <p className="text-gray-600">{message}</p>
      <Link to="/" className="px-4 py-2 bg-blue-600 text-white rounded-lg">
        Retour à l'accueil
      </Link>
    </div>
  );
}

// Placeholder minimal pour les écrans de statut bloquant (M6 les remplacera par les vraies pages stylées).
function Placeholder({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-black p-4">
      <div className="bg-neutral-950 border border-neutral-800 rounded-2xl p-8 max-w-md text-center">
        <h1 className="text-xl font-bold text-neutral-100 mb-2">{title}</h1>
        <p className="text-neutral-400 text-sm mb-4">{subtitle}</p>
        <button
          onClick={() => { localStorage.clear(); window.location.href = '/'; }}
          className="px-4 py-2 bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 rounded-lg text-sm"
        >
          Se déconnecter
        </button>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <WebSocketProvider>
          <NotificationProvider>
            <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<LoginPage />} />
                <Route path="/signup" element={<SignupPage />} />
                <Route path="/select-restaurant" element={<SelectRestaurantPage />} />

                <Route
                  path="/caisse"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier', 'serveur']}>
                      <Layout>
                        <CaissePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salle"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier', 'serveur']}>
                      <Layout>
                        <SallePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/service"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier', 'serveur']}>
                      <Layout>
                        <ServicePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cuisine"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'cuisinier']}>
                      <Layout>
                        <CuisinePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur']}>
                      <Layout>
                        <AdminPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['propriétaire', 'administrateur', 'caissier']}>
                      <Layout>
                        <DashboardPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />

                <Route
                  path="/unauthorized"
                  element={<SimpleMessage title="Accès interdit" message="Vous n'avez pas les permissions pour cette page." />}
                />

                {/* Écrans de statut bloquant — placeholders M5, remplacés par StatusBlockedCard en M6 */}
                <Route path="/suspended" element={<Placeholder title="Restaurant suspendu" subtitle="Contactez la plateforme." />} />
                <Route path="/rejected" element={<Placeholder title="Inscription refusée" subtitle="Contactez la plateforme." />} />
                <Route path="/pending-member" element={<Placeholder title="Restaurant en préparation" subtitle="Patientez ou contactez le propriétaire." />} />

                <Route path="*" element={<SimpleMessage title="404" message="Page introuvable." />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
          </NotificationProvider>
        </WebSocketProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}
