import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import { AppShell } from './components/AppShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PageLoader } from './components/PageLoader';
import { ProtectedRoute } from './components/ProtectedRoute';

const LoginPage = lazy(() =>
  import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })),
);
const FarmerListPage = lazy(() =>
  import('./pages/FarmerListPage').then((m) => ({ default: m.FarmerListPage })),
);
const FarmerDetailPage = lazy(() =>
  import('./pages/FarmerDetailPage').then((m) => ({ default: m.FarmerDetailPage })),
);
const ShipmentListPage = lazy(() =>
  import('./pages/ShipmentListPage').then((m) => ({ default: m.ShipmentListPage })),
);
const ShipmentDetailPage = lazy(() =>
  import('./pages/ShipmentDetailPage').then((m) => ({ default: m.ShipmentDetailPage })),
);

function RootRedirect() {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/farmers' : '/login'} replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ErrorBoundary label="App">
          <Suspense fallback={<PageLoader label="Loading page…" />}>
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route element={<ProtectedRoute />}>
                <Route element={<AppShell />}>
                  <Route path="/farmers" element={<FarmerListPage />} />
                  <Route path="/farmers/:id" element={<FarmerDetailPage />} />
                  <Route path="/shipments" element={<ShipmentListPage />} />
                  <Route path="/shipments/:type/:id" element={<ShipmentDetailPage />} />
                </Route>
              </Route>
              <Route path="/" element={<RootRedirect />} />
              <Route path="*" element={<RootRedirect />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </AuthProvider>
    </BrowserRouter>
  );
}
