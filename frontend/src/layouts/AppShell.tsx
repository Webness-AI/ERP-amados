import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/projects", label: "Proyectos" },
  { to: "/stock", label: "Stock" },
  { to: "/accounting", label: "Libro Diario" },
  { to: "/clients", label: "Clientes" },
  { to: "/budgets", label: "Presupuestos" },
  { to: "/purchases", label: "Compras" },
  { to: "/production", label: "Produccion" },
  { to: "/cash-banks", label: "Caja y Bancos" },
  { to: "/fixed-expenses", label: "Gastos Fijos" },
  { to: "/settings", label: "Configuraciones" },
];

export function AppShell() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <h1>Amado's ERP</h1>
          <p>Operacion y Contabilidad</p>
        </div>
        <nav className="sidebar__nav" aria-label="Principal">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }: { isActive: boolean }) =>
                `sidebar__link${isActive ? " sidebar__link--active" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-shell__content">
        <header className="topbar">
          <div className="topbar__search">
            <input
              type="search"
              placeholder="Buscar cliente, proyecto, movimiento..."
            />
          </div>
          <div className="topbar__actions">
            <span className="topbar__user">
              {user
                ? `${user.firstName} ${user.lastName} (${user.role})`
                : "Sin sesion"}
            </span>
            <button type="button" className="btn btn-secondary">
              Generar Lista Compra
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void logout()}
            >
              Cerrar sesion
            </button>
          </div>
        </header>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
