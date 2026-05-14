import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "./useAuth";

export function RequireAuth() {
  const { isAuthenticated, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return (
      <main className="auth-page">
        <article className="auth-card">
          <h1>Cargando sesion</h1>
          <p>Validando credenciales con el backend...</p>
        </article>
      </main>
    );
  }

  if (!isAuthenticated) {
    const redirectTo = `${location.pathname}${location.search}`;
    return <Navigate to="/login" replace state={{ redirectTo }} />;
  }

  return <Outlet />;
}
