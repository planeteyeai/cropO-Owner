import { Suspense, useCallback, useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { BrandLogo } from './BrandLogo';
import { ErrorBoundary } from './ErrorBoundary';
import { PageLoader } from './PageLoader';

function navClass({ isActive }: { isActive: boolean }): string {
  return isActive ? 'sidebar-link active' : 'sidebar-link';
}

export function AppShell() {
  const { user, logout } = useAuth();

  const initials = useMemo(
    () => (user?.first_name?.[0] || user?.username?.[0] || 'O').toUpperCase(),
    [user?.first_name, user?.username],
  );

  const onLogout = useCallback(() => {
    logout();
  }, [logout]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <BrandLogo to="/farmers" size="sm" className="brand-logo-nav" />
          <div className="topbar-title-block">
            <span className="topbar-product">Owner Dashboard</span>
            <span className="topbar-hint">Read-only business view</span>
          </div>
        </div>

        <div className="topbar-actions">
          {user && (
            <div className="user-chip">
              <span className="user-avatar" aria-hidden="true">
                {initials}
              </span>
              <span className="user-meta">
                <span className="user-name">
                  {user.first_name} {user.last_name}
                </span>
                <span className="user-phone">{user.phone_number}</span>
              </span>
            </div>
          )}
          <button type="button" className="btn btn-ghost" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      <div className="app-body">
        <aside className="sidebar" aria-label="Owner navigation">
          <p className="sidebar-label">Menu</p>
          <nav className="sidebar-nav">
            <NavLink to="/farmers" className={navClass}>
              <span className="sidebar-link-title">Farmer records</span>
              <span className="sidebar-link-desc">Profiles, plots & field reports</span>
            </NavLink>
            <NavLink to="/shipments" className={navClass}>
              <span className="sidebar-link-title">Shipment records</span>
              <span className="sidebar-link-desc">Warehouse & transport requests</span>
            </NavLink>
          </nav>
        </aside>

        <main className="main-content">
          <ErrorBoundary label="Page">
            <Suspense fallback={<PageLoader label="Loading page…" />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
