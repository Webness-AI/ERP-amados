import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import {
  getDashboardAlertsApi,
  getDashboardOverviewApi,
  type DashboardAlerts,
  type DashboardOverview,
} from "../services/erp-api";
import { formatDate, formatMoney } from "../utils/formatters";

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [overviewData, alertsData] = await Promise.all([
          getDashboardOverviewApi(),
          getDashboardAlertsApi(4),
        ]);

        if (!active) {
          return;
        }

        setOverview(overviewData);
        setAlerts(alertsData);
      } catch (caughtError) {
        if (!active) {
          return;
        }

        console.error("Dashboard load failed", caughtError);
        setError("No se pudo cargar el dashboard");
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  if (isLoading) {
    return <article className="panel">Cargando dashboard...</article>;
  }

  if (error || !overview || !alerts) {
    return (
      <article className="panel panel--error">
        {error ?? "Sin datos de dashboard"}
      </article>
    );
  }

  const productionRows = overview.production.byStatus.slice(0, 4);
  const alertsList = [
    ...alerts.projects.deliveryDueSoon.map(
      (item) => `Proyecto ${item.name} entrega ${formatDate(item.deliveryDate)}`,
    ),
    ...alerts.projects.deliveryOverdue.map(
      (item) => `Atrasado: ${item.name} venció ${formatDate(item.deliveryDate)}`,
    ),
    ...alerts.collections.dueSoon.map(
      (item) =>
        `Cobranza ${item.id.slice(-6)} vence ${formatDate(item.dueDate)}`,
    ),
    ...alerts.collections.overdue.map(
      (item) =>
        `Cobranza ${item.id.slice(-6)} vencida ${formatDate(item.dueDate)}`,
    ),
    ...alerts.fixedExpenses.dueSoon.map(
      (item) => `${item.name} vence ${formatDate(item.nextDueDate)}`,
    ),
    ...alerts.fixedExpenses.overdue.map(
      (item) => `${item.name} vencido ${formatDate(item.nextDueDate)}`,
    ),
  ].slice(0, 4);

  const quickActions = [
    { title: "Nuevo proyecto", subtitle: "Ir a proyectos", to: "/projects" },
    { title: "Ver cobranzas", subtitle: "Abrir cuentas por cobrar", to: "/collections" },
    { title: "Revisar stock", subtitle: "Abrir inventario", to: "/stock" },
    { title: "Registrar compra", subtitle: "Abrir compras", to: "/purchases" },
    { title: "Ir a contabilidad", subtitle: "Abrir libro diario", to: "/accounting/diario" },
  ];

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Dashboard · Resumen Ejecutivo</p>

      <header className="page-header">
        <div>
          <h2>Dashboard Ejecutivo</h2>
          <p>
            Resumen operativo y financiero conectado con todos los módulos.
          </p>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ↗
          </span>
          <small className="kpi-positive">Mayor contable</small>
          <h3>Ventas acumuladas</h3>
          <strong>{formatMoney(overview.sales.accumulatedAmount)}</strong>
          <small>{overview.sales.approvedBudgets} presupuestos aprobados</small>
        </article>
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ▣
          </span>
          <h3>Cobranzas pendientes</h3>
          <strong>{formatMoney(overview.collections.pendingAmount)}</strong>
          <small className="kpi-neutral">
            Vencidas: {overview.collections.overdueCount} | Próximas: {overview.collections.dueSoonCount}
          </small>
        </article>
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ◇
          </span>
          <h3>Proyectos activos</h3>
          <strong>{overview.projects.totalActive}</strong>
          <small className="kpi-neutral">
            Entrega próxima: {overview.projects.deliveryDueSoon} | Atrasados: {overview.projects.deliveryOverdue}
          </small>
        </article>
        <article className="kpi-card kpi-card--metric kpi-card--critical">
          <span className="kpi-card__icon" aria-hidden="true">
            ⚠
          </span>
          <small className="kpi-negative">Crítico</small>
          <h3>Alertas de stock</h3>
          <strong>{overview.stock.lowStockMaterials} SKU</strong>
          <small className="kpi-neutral">
            CMV contable: {formatMoney(overview.stock.currentCmv)} | Sugerencias de compra: {overview.stock.purchaseSuggestions}
          </small>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-main-column">
          <article className="panel panel-large">
            <h3>Resumen contable</h3>
            <p className="panel-subtitle">
              Ingresos, egresos y resultado del período.
            </p>
            <div className="kpi-grid">
              <article className="kpi-card">
                <h3>Ingresos contables</h3>
                <strong>{formatMoney(overview.accounting.income)}</strong>
              </article>
              <article className="kpi-card">
                <h3>Egresos contables</h3>
                <strong>{formatMoney(overview.accounting.expenses)}</strong>
              </article>
              <article className="kpi-card">
                <h3>Resultado neto</h3>
                <strong>{formatMoney(overview.accounting.netResult)}</strong>
              </article>
              <article className="kpi-card">
                <h3>Asientos del período</h3>
                <strong>{overview.accounting.journalEntriesInPeriod}</strong>
              </article>
            </div>
          </article>

          <article className="panel panel-large">
            <div className="dashboard-section-header">
              <h3>Producción por estado</h3>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => navigate("/production")}
              >
                Ver todos
              </button>
            </div>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Estado</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {productionRows.length === 0 && (
                  <tr>
                    <td colSpan={2}>No hay órdenes registradas</td>
                  </tr>
                )}
                {productionRows.map((row) => (
                  <tr key={row.status}>
                    <td>
                      <span className={`chip chip-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="td-numeric">{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </article>
        </div>

        <aside className="dashboard-side-column">
          <article className="panel quick-actions-panel">
            <h3>Acciones Rápidas</h3>
            <div className="quick-actions quick-actions--stacked">
              {quickActions.map((action) => (
                <button
                  key={action.to}
                  className="quick-action-item"
                  type="button"
                  onClick={() => navigate(action.to)}
                >
                  <strong>{action.title}</strong>
                  <small>{action.subtitle}</small>
                </button>
              ))}
            </div>
          </article>

          <article className="panel">
            <div className="dashboard-section-header">
              <h3>Actividad Reciente</h3>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={() => navigate("/collections")}
              >
                Ver cobranzas
              </button>
            </div>
            <ul className="activity-list">
              {alertsList.length === 0 && (
                <li className="activity-item">Sin alertas próximas</li>
              )}
              {alertsList.slice(0, 4).map((item) => (
                <li key={item} className="activity-item">
                  <span className="activity-icon">•</span>
                  <span className="activity-text">{item}</span>
                </li>
              ))}
            </ul>
          </article>
        </aside>
      </div>

      <footer className="dashboard-footer">
        <strong>Amado's Amoblamientos</strong>
        <span>© 2024 Desarrollado para una produccion meticulosa.</span>
        <button type="button" className="btn btn-link" onClick={() => navigate("/dashboard")}>Tablero</button>
        <button type="button" className="btn btn-link" onClick={() => navigate("/accounting/diario")}>Contabilidad</button>
        <span className="kpi-positive">Estado del sistema</span>
      </footer>
    </section>
  );
}
