import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "../auth/RequireAuth";

export const router = createBrowserRouter([
  {
    path: "/login",
    lazy: async () => {
      const module = await import("../pages/LoginPage");
      return { Component: module.LoginPage };
    },
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: "/",
        lazy: async () => {
          const module = await import("../layouts/AppShell");
          return { Component: module.AppShell };
        },
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          {
            path: "dashboard",
            lazy: async () => {
              const module = await import("../pages/DashboardPage");
              return { Component: module.DashboardPage };
            },
          },
          {
            path: "projects",
            lazy: async () => {
              const module = await import("../pages/ProjectsPage");
              return { Component: module.ProjectsPage };
            },
          },
          {
            path: "stock",
            lazy: async () => {
              const module = await import("../pages/StockPage");
              return { Component: module.StockPage };
            },
          },
          {
            path: "accounting",
            element: <Navigate to="/accounting/diario" replace />,
          },
          {
            path: "accounting/diario",
            lazy: async () => {
              const module = await import("../pages/AccountingPage");
              return { Component: module.AccountingPage };
            },
          },
          {
            path: "accounting/libro-mayor",
            lazy: async () => {
              const module = await import("../pages/LibroMayorPage");
              return { Component: module.LibroMayorPage };
            },
          },
          {
            path: "accounting/estado-resultado",
            lazy: async () => {
              const module = await import("../pages/EstadoResultadoPage");
              return { Component: module.EstadoResultadoPage };
            },
          },
          {
            path: "accounting/estado-contable",
            lazy: async () => {
              const module = await import("../pages/EstadoContablePage");
              return { Component: module.EstadoContablePage };
            },
          },
          {
            path: "accounting/balances",
            lazy: async () => {
              const module = await import("../pages/BalancesPage");
              return { Component: module.BalancesPage };
            },
          },
          {
            path: "clients",
            lazy: async () => {
              const module = await import("../pages/ClientsPage");
              return { Component: module.ClientsPage };
            },
          },
          {
            path: "budgets",
            lazy: async () => {
              const module = await import("../pages/BudgetsPage");
              return { Component: module.BudgetsPage };
            },
          },
          {
            path: "purchases",
            lazy: async () => {
              const module = await import("../pages/PurchasesPage");
              return { Component: module.PurchasesPage };
            },
          },
          {
            path: "future-purchases",
            lazy: async () => {
              const module = await import("../pages/FuturePurchasesPage");
              return { Component: module.FuturePurchasesPage };
            },
          },
          {
            path: "production",
            lazy: async () => {
              const module = await import("../pages/ProductionPage");
              return { Component: module.ProductionPage };
            },
          },
          {
            path: "cash-banks",
            lazy: async () => {
              const module = await import("../pages/CashBanksPage");
              return { Component: module.CashBanksPage };
            },
          },
          {
            path: "fixed-expenses",
            lazy: async () => {
              const module = await import("../pages/FixedExpensesPage");
              return { Component: module.FixedExpensesPage };
            },
          },
          {
            path: "suppliers",
            lazy: async () => {
              const module = await import("../pages/SuppliersPage");
              return { Component: module.SuppliersPage };
            },
          },
          {
            path: "collections",
            lazy: async () => {
              const module = await import("../pages/CollectionsPage");
              return { Component: module.CollectionsPage };
            },
          },
          {
            path: "settings",
            lazy: async () => {
              const module = await import("../pages/SettingsPage");
              return { Component: module.SettingsPage };
            },
          },
          {
            path: "*",
            lazy: async () => {
              const module = await import("../pages/NotFoundPage");
              return { Component: module.NotFoundPage };
            },
          },
        ],
      },
    ],
  },
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
