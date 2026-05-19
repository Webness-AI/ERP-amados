import { createBrowserRouter, Navigate } from "react-router-dom";

import { RequireAuth } from "../auth/RequireAuth";
import { AppShell } from "../layouts/AppShell";
import { AccountingPage } from "../pages/AccountingPage";
import { BalancesPage } from "../pages/BalancesPage";
import { BudgetsPage } from "../pages/BudgetsPage";
import { CashBanksPage } from "../pages/CashBanksPage";
import { ClientsPage } from "../pages/ClientsPage";
import { CollectionsPage } from "../pages/CollectionsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { EstadoContablePage } from "../pages/EstadoContablePage";
import { EstadoResultadoPage } from "../pages/EstadoResultadoPage";
import { FixedExpensesPage } from "../pages/FixedExpensesPage";
import { LibroMayorPage } from "../pages/LibroMayorPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PurchasesPage } from "../pages/PurchasesPage";
import { ProductionPage } from "../pages/ProductionPage";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SettingsPage } from "../pages/SettingsPage";
import { StockPage } from "../pages/StockPage";
import { SuppliersPage } from "../pages/SuppliersPage";

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
          {
            path: "accounting",
            element: <Navigate to="/accounting/diario" replace />,
          },
          { path: "accounting/diario", element: <AccountingPage /> },
          { path: "accounting/libro-mayor", element: <LibroMayorPage /> },
          {
            path: "accounting/estado-resultado",
            element: <EstadoResultadoPage />,
          },
          {
            path: "accounting/estado-contable",
            element: <EstadoContablePage />,
          },
          { path: "accounting/balances", element: <BalancesPage /> },
          { path: "clients", element: <ClientsPage /> },
          {
            path: "budgets",
            element: <BudgetsPage />,
          },
          {
            path: "purchases",
            element: <PurchasesPage />,
          },
          {
            path: "production",
            element: <ProductionPage />,
          },
          {
            path: "cash-banks",
            element: <CashBanksPage />,
          },
          {
            path: "fixed-expenses",
            element: <FixedExpensesPage />,
          },
          {
            path: "suppliers",
            element: <SuppliersPage />,
          },
          {
            path: "collections",
            element: <CollectionsPage />,
          },
          {
            path: "settings",
            element: <SettingsPage />,
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
