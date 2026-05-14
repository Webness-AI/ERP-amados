import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "../auth/RequireAuth";
import { AppShell } from "../layouts/AppShell";
import { AccountingPage } from "../pages/AccountingPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { StockPage } from "../pages/StockPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: "dashboard", element: <DashboardPage /> },
          { path: "projects", element: <ProjectsPage /> },
          { path: "stock", element: <StockPage /> },
          { path: "accounting", element: <AccountingPage /> },
          {
            path: "clients",
            element: (
              <PlaceholderPage
                title="Clientes"
                description="Integracion con /api/v1/clients"
              />
            ),
          },
          {
            path: "budgets",
            element: (
              <PlaceholderPage
                title="Presupuestos"
                description="Integracion con /api/v1/budgets"
              />
            ),
          },
          {
            path: "purchases",
            element: (
              <PlaceholderPage
                title="Compras"
                description="Integracion con /api/v1/purchases"
              />
            ),
          },
          {
            path: "production",
            element: (
              <PlaceholderPage
                title="Produccion"
                description="Integracion con /api/v1/production-orders"
              />
            ),
          },
          {
            path: "cash-banks",
            element: (
              <PlaceholderPage
                title="Caja y Bancos"
                description="Integracion con /api/v1/cash"
              />
            ),
          },
          {
            path: "fixed-expenses",
            element: (
              <PlaceholderPage
                title="Gastos Fijos"
                description="Integracion con /api/v1/fixed-expenses"
              />
            ),
          },
          {
            path: "settings",
            element: (
              <PlaceholderPage
                title="Configuraciones"
                description="Modulo pendiente segun roadmap"
              />
            ),
          },
          { path: "*", element: <NotFoundPage /> },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
