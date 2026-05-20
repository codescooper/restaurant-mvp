import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { WebSocketProvider } from './contexts/WebSocketContext';
import { NotificationProvider } from './contexts/NotificationContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Layout } from './components/Layout';

const LoginPage = lazy(() => import('./pages/LoginPage'));
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

export default function App() {
  return (
    <AuthProvider>
      <WebSocketProvider>
        <NotificationProvider>
          <BrowserRouter>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<LoginPage />} />

                <Route
                  path="/caisse"
                  element={
                    <ProtectedRoute allowedRoles={['caissier', 'administrateur', 'serveur']}>
                      <Layout>
                        <CaissePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/salle"
                  element={
                    <ProtectedRoute allowedRoles={['serveur', 'caissier', 'administrateur']}>
                      <Layout>
                        <SallePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/service"
                  element={
                    <ProtectedRoute allowedRoles={['caissier', 'administrateur']}>
                      <Layout>
                        <ServicePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/cuisine"
                  element={
                    <ProtectedRoute allowedRoles={['cuisinier', 'administrateur']}>
                      <Layout>
                        <CuisinePage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/admin"
                  element={
                    <ProtectedRoute allowedRoles={['administrateur']}>
                      <Layout>
                        <AdminPage />
                      </Layout>
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/dashboard"
                  element={
                    <ProtectedRoute allowedRoles={['administrateur', 'caissier']}>
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
                <Route path="*" element={<SimpleMessage title="404" message="Page introuvable." />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </NotificationProvider>
      </WebSocketProvider>
    </AuthProvider>
  );
}
