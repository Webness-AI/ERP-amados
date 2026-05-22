import { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../auth/useAuth";

type ShellIconName =
  | "dashboard"
  | "clients"
  | "budgets"
  | "projects"
  | "stock"
  | "purchases"
  | "production"
  | "fixed-expenses"
  | "cash-banks"
  | "accounting"
  | "settings"
  | "suppliers"
  | "collections"
  | "search"
  | "bell"
  | "help"
  | "quote";

type NavRouteItem = {
  kind: "route";
  to: string;
  label: string;
  icon: ShellIconName;
  isActive?: (pathname: string) => boolean;
};

type NavSection = {
  id: "ventas" | "inventario" | "contabilidad" | "flujo" | "operaciones";
  label: string;
  items: readonly NavRouteItem[];
};

function ShellIcon({ name }: { name: ShellIconName }) {
  switch (name) {
    case "dashboard":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" />
        </svg>
      );
    case "clients":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm-8 2a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 1c-3.3 0-6 1.7-6 4v1h12v-1c0-2.3-2.7-4-6-4zM8 15c-2.8 0-5 1.4-5 3.3V20h5.7a5.6 5.6 0 0 1 1.6-4A6.9 6.9 0 0 0 8 15z" />
        </svg>
      );
    case "budgets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3h14v18H5zM8 7h8v2H8zm0 4h8v2H8zm0 4h5v2H8z" />
        </svg>
      );
    case "projects":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2l4 7h-8l4-7zm-8 20l4-7h8l4 7H4zm2-8h12v-2H6z" />
        </svg>
      );
    case "stock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6l9-4 9 4-9 4-9-4zm0 3l9 4 9-4v9l-9 4-9-4V9zm4 2v5l3 1.4V12.4L7 11z" />
        </svg>
      );
    case "purchases":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h-2l-1 2h2l3.6 7.6-1.3 2.4A1.5 1.5 0 0 0 9.6 18H19v-2h-9l1.1-2h6.6a2 2 0 0 0 1.8-1.1L22 7H8.4L7.5 5.2A2 2 0 0 0 7 4zm3 15a2 2 0 1 0 0 4 2 2 0 0 0 0-4zm8 0a2 2 0 1 0 0 4 2 2 0 0 0 0-4z" />
        </svg>
      );
    case "production":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 3h4v4h-4zM4 9h16v2H4zm2 4h12v8H6zM8 15h3v4H8zm5 0h3v4h-3z" />
        </svg>
      );
    case "fixed-expenses":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18v12H3zM6 9h12v6H6zm4 1h4v4h-4z" />
        </svg>
      );
    case "cash-banks":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l10 5v2H2V8l10-5zm8 9v7h2v2H2v-2h2v-7h2v7h3v-7h2v7h3v-7h2v7h4v-7z" />
        </svg>
      );
    case "accounting":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3h14v18H5zM8 7h8v2H8zm0 4h8v2H8zm0 4h4v2H8zm7-1h2v3h-2z" />
        </svg>
      );
    case "settings":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 8a4 4 0 1 0 4 4 4 4 0 0 0-4-4zm9 5l-2.2.8a7.5 7.5 0 0 1-.6 1.4l1 2.1-2.1 2.1-2.1-1a7.5 7.5 0 0 1-1.4.6L13 21h-2l-.8-2.2a7.5 7.5 0 0 1-1.4-.6l-2.1 1-2.1-2.1 1-2.1a7.5 7.5 0 0 1-.6-1.4L3 13v-2l2.2-.8a7.5 7.5 0 0 1 .6-1.4l-1-2.1 2.1-2.1 2.1 1a7.5 7.5 0 0 1 1.4-.6L11 3h2l.8 2.2a7.5 7.5 0 0 1 1.4.6l2.1-1 2.1 2.1-1 2.1a7.5 7.5 0 0 1 .6 1.4L21 11z" />
        </svg>
      );
    case "suppliers":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7h11v13H3zM16 10h5v10h-5zM5 9h7v2H5zm0 4h7v2H5zm13 0h2v2h-2z" />
        </svg>
      );
    case "collections":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 5h18v14H3zM5 8h14v2H5zm0 4h8v2H5zm11-1a2 2 0 1 0 2 2 2 2 0 0 0-2-2z" />
        </svg>
      );
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M10 2a8 8 0 1 0 5.3 14l4.4 4.4 1.3-1.3-4.4-4.4A8 8 0 0 0 10 2zm0 2a6 6 0 1 1-6 6 6 6 0 0 1 6-6z" />
        </svg>
      );
    case "bell":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3a5 5 0 0 0-5 5v2.4L5 14v1h14v-1l-2-3.6V8a5 5 0 0 0-5-5zm0 18a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21z" />
        </svg>
      );
    case "help":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 17a1.3 1.3 0 1 1 1.3-1.3A1.3 1.3 0 0 1 12 19zm1.4-5.5a2.3 2.3 0 0 0-1 1.9h-1.9a4 4 0 0 1 1.9-3.4 1.8 1.8 0 1 0-2.7-1.6H7.8a3.8 3.8 0 1 1 5.6 3.1z" />
        </svg>
      );
    case "quote":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 3h14v18H5zM8 7h8v2H8zm0 4h8v2H8zm0 4h5v2H8zM18 17h2v2h-2z" />
        </svg>
      );
    default:
      return null;
  }
}

const navSections: readonly NavSection[] = [
  {
    id: "ventas",
    label: "Ventas",
    items: [
      { kind: "route", to: "/clients", label: "Clientes", icon: "clients" },
      { kind: "route", to: "/budgets", label: "Presupuestos", icon: "budgets" },
      { kind: "route", to: "/projects", label: "Proyectos", icon: "projects" },
    ],
  },
  {
    id: "inventario",
    label: "Inventario",
    items: [
      { kind: "route", to: "/stock", label: "Stock", icon: "stock" },
      { kind: "route", to: "/purchases", label: "Compras", icon: "purchases" },
      {
        kind: "route",
        to: "/future-purchases",
        label: "Compras Futuras",
        icon: "purchases",
      },
    ],
  },
  {
    id: "contabilidad",
    label: "Contabilidad",
    items: [
      {
        kind: "route",
        to: "/accounting/diario",
        label: "Libro Diario",
        icon: "accounting",
        isActive: (pathname) => pathname.startsWith("/accounting/diario"),
      },
      {
        kind: "route",
        to: "/accounting/libro-mayor",
        label: "Libro Mayor",
        icon: "accounting",
        isActive: (pathname) => pathname.startsWith("/accounting/libro-mayor"),
      },
      {
        kind: "route",
        to: "/accounting/estado-resultado",
        label: "Estado de Resultados",
        icon: "accounting",
        isActive: (pathname) => pathname.startsWith("/accounting/estado-resultado"),
      },
      {
        kind: "route",
        to: "/accounting/estado-contable",
        label: "Estados Contables",
        icon: "accounting",
        isActive: (pathname) => pathname.startsWith("/accounting/estado-contable"),
      },
      {
        kind: "route",
        to: "/accounting/balances",
        label: "Balances",
        icon: "accounting",
        isActive: (pathname) => pathname.startsWith("/accounting/balances"),
      },
    ],
  },
  {
    id: "flujo",
    label: "Flujo",
    items: [
      {
        kind: "route",
        to: "/cash-banks",
        label: "Caja y Bancos",
        icon: "cash-banks",
      },
      {
        kind: "route",
        to: "/suppliers",
        label: "Proveedores",
        icon: "suppliers",
      },
      {
        kind: "route",
        to: "/collections",
        label: "Cobranzas",
        icon: "collections",
      },
      {
        kind: "route",
        to: "/future-purchases",
        label: "Compras Futuras",
        icon: "purchases",
      },
    ],
  },
  {
    id: "operaciones",
    label: "Operaciones",
    items: [
      {
        kind: "route",
        to: "/production",
        label: "Produccion",
        icon: "production",
      },
      {
        kind: "route",
        to: "/fixed-expenses",
        label: "Gastos Fijos",
        icon: "fixed-expenses",
      },
    ],
  },
];

function isRouteItemActive(item: NavRouteItem, pathname: string) {
  if (item.isActive) {
    return item.isActive(pathname);
  }

  return pathname === item.to;
}

export function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [expandedSections, setExpandedSections] = useState<Record<NavSection["id"], boolean>>(
    () => ({
      ventas: true,
      inventario: true,
      contabilidad: true,
      flujo: true,
      operaciones: false,
    }),
  );

  const activeSectionIds = useMemo(() => {
    return navSections
      .filter((section) =>
        section.items.some(
          (item) =>
            item.kind === "route" && isRouteItemActive(item, location.pathname),
        ),
      )
      .map((section) => section.id);
  }, [location.pathname]);

  const userName = user
    ? `${user.firstName} ${user.lastName}`.trim()
    : "Usuario Admin";
  const userRole = user ? user.role.replaceAll("_", " ") : "ADMIN GENERAL";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar__brand">
          <h1>Amado's</h1>
          <p>SISTEMA DE GESTION</p>
        </div>
        <nav className="sidebar__nav" aria-label="Principal">
          <NavLink
            to="/dashboard"
            className={({ isActive }: { isActive: boolean }) =>
              `sidebar__link${isActive ? " sidebar__link--active" : ""}`
            }
          >
            <span className="app-icon" aria-hidden="true">
              <ShellIcon name="dashboard" />
            </span>
            <span>Tablero</span>
          </NavLink>

          {navSections.map((section) => {
            const isSectionActive = activeSectionIds.includes(section.id);
            const isExpanded = expandedSections[section.id] || isSectionActive;

            return (
              <section
                key={section.id}
                className={`sidebar__section${
                  isSectionActive ? " sidebar__section--active" : ""
                }`}
              >
                <button
                  type="button"
                  className="sidebar__section-toggle"
                  aria-expanded={isExpanded}
                  onClick={() =>
                    setExpandedSections((prev) => ({
                      ...prev,
                      [section.id]: !prev[section.id],
                    }))
                  }
                >
                  <span>{section.label}</span>
                  <span aria-hidden="true">{isExpanded ? "-" : "+"}</span>
                </button>

                {isExpanded ? (
                  <div className="sidebar__section-items">
                    {section.items.map((item) => (
                      <NavLink
                        key={`${section.id}-${item.to}`}
                        to={item.to}
                        className={({ isActive }: { isActive: boolean }) =>
                          `sidebar__link${isActive ? " sidebar__link--active" : ""}`
                        }
                      >
                        <span className="app-icon" aria-hidden="true">
                          <ShellIcon name={item.icon} />
                        </span>
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                ) : null}
              </section>
            );
          })}

          <NavLink
            to="/settings"
            className={({ isActive }: { isActive: boolean }) =>
              `sidebar__link${isActive ? " sidebar__link--active" : ""}`
            }
          >
            <span className="app-icon" aria-hidden="true">
              <ShellIcon name="settings" />
            </span>
            <span>Configuracion</span>
          </NavLink>
        </nav>

        <div className="sidebar__footer">
          <button
            type="button"
            className="btn btn-primary sidebar__cta"
            onClick={() => navigate("/budgets")}
          >
            <span className="app-icon" aria-hidden="true">
              <ShellIcon name="quote" />
            </span>
            <span>Nuevo Presupuesto</span>
          </button>

          <div className="sidebar__user-card">
            <div className="sidebar__user-avatar" aria-hidden="true">
              {userName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <strong>{userName}</strong>
              <small>{userRole}</small>
            </div>
          </div>
        </div>
      </aside>

      <div className="app-shell__content">
        <header className="topbar">
          <div className="topbar__search">
            <span className="app-icon" aria-hidden="true">
              <ShellIcon name="search" />
            </span>
            <input
              type="search"
              placeholder="Buscar proyectos, clientes o facturas..."
            />
          </div>
          <div className="topbar__actions">
            <button
              type="button"
              className="btn btn-primary topbar__cta"
              onClick={() => navigate("/projects")}
            >
              Crear proyecto
            </button>
            <button type="button" className="btn btn-icon" aria-label="Notificaciones">
              <ShellIcon name="bell" />
            </button>
            <button type="button" className="btn btn-icon" aria-label="Ayuda">
              <ShellIcon name="help" />
            </button>
            <span className="topbar__user" role="status" aria-live="polite">
              <strong>{userName}</strong>
              <small>{userRole}</small>
            </span>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void logout()}
            >
              Salir
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
