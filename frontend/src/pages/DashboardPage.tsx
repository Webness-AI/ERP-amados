import { useEffect, useState } from "react";

import {
  getDashboardAlertsApi,
  getDashboardOverviewApi,
  type DashboardAlerts,
  type DashboardOverview,
} from "../services/erp-api";

function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR")}`;
}

function formatDate(value: string): string {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-AR");
}

export function DashboardPage() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [alerts, setAlerts] = useState<DashboardAlerts | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch {
        if (!active) {
          return;
        }

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

  const areaRows = overview.projects.byStatus.slice(0, 4);
  const alertsList = [
    ...alerts.projects.deliveryDueSoon.map(
      (item) => `${item.name} entrega ${formatDate(item.deliveryDate)}`,
    ),
    ...alerts.collections.dueSoon.map(
      (item) =>
        `Cobranza ${item.id.slice(-6)} vence ${formatDate(item.dueDate)}`,
    ),
    ...alerts.fixedExpenses.dueSoon.map(
      (item) => `${item.name} vence ${formatDate(item.nextDueDate)}`,
    ),
  ].slice(0, 4);

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Dashboard · Resumen Ejecutivo</p>

      <header className="page-header">
        <div>
          <h2>Dashboard Ejecutivo</h2>
          <p>
            Bienvenido de nuevo. Aquí tienes un resumen de la producción y
            finanzas de hoy.
          </p>
        </div>
      </header>

      {/* KPI Cards Row 1 */}
      <div className="kpi-grid">
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ↗
          </span>
          <small className="kpi-positive">+12.6% ↑</small>
          <h3>Ventas mensuales</h3>
          <strong>{formatMoney(overview.cash.income)}</strong>
        </article>
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ▣
          </span>
          <h3>Cobranzas pendientes</h3>
          <strong>{formatMoney(overview.cash.expense)}</strong>
          <small className="kpi-neutral">Vencido 35% del total</small>
        </article>
        <article className="kpi-card kpi-card--metric">
          <span className="kpi-card__icon" aria-hidden="true">
            ◇
          </span>
          <small className="kpi-positive">8 nuevos</small>
          <h3>Proyectos activos</h3>
          <strong>{overview.projects.totalActive}</strong>
          <small className="kpi-neutral">Módulos en producción</small>
        </article>
        <article className="kpi-card kpi-card--metric kpi-card--critical">
          <span className="kpi-card__icon" aria-hidden="true">
            ⚠
          </span>
          <small className="kpi-negative">Crítico</small>
          <h3>Alertas de stock</h3>
          <strong>{overview.stock.lowStockMaterials} SKU</strong>
          <small className="kpi-neutral">Principalmente herrajes</small>
        </article>
      </div>

      <div className="dashboard-main-grid">
        <div className="dashboard-main-column">
          <article className="panel panel-large">
            <h3>Flujo de Caja vs Gastos Fijos</h3>
            <p className="panel-subtitle">
              Comparativa semestral de rendimiento operativo
            </p>
            <div className="chart-placeholder">Gráfico de barras: Ingresos vs Gastos</div>
          </article>

          <article className="panel panel-large">
            <div className="dashboard-section-header">
              <h3>Producción en Curso</h3>
              <button type="button" className="btn btn-tertiary">
                Ver todos
              </button>
            </div>
            <table className="table-compact">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Monto</th>
                </tr>
              </thead>
              <tbody>
                {areaRows.slice(0, 3).map((row) => (
                  <tr key={row.status}>
                    <td>Cliente demo</td>
                    <td>Proyecto ejemplo</td>
                    <td>
                      <span className={`chip chip-${row.status.toLowerCase()}`}>
                        {row.status}
                      </span>
                    </td>
                    <td className="td-numeric">{formatMoney(row.count * 10000)}</td>
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
              <button className="quick-action-item" type="button">
                <strong>Nuevo Proyecto</strong>
                <small>Cargar diseño y materiales</small>
              </button>
              <button className="quick-action-item" type="button">
                <strong>Nueva Venta</strong>
                <small>Generar orden de pago</small>
              </button>
              <button className="quick-action-item" type="button">
                <strong>Agregar Stock</strong>
                <small>Registrar entrada de insumos</small>
              </button>
            </div>
          </article>

          <article className="panel">
            <h3>Actividad Reciente</h3>
            <ul className="activity-list">
              {alertsList.length === 0 && (
                <li className="activity-item">Sin actividad reciente</li>
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
        <span>© 2024 Crafted for Meticulous Production.</span>
        <span>Support</span>
        <span>Privacy Policy</span>
        <span className="kpi-positive">System Status</span>
      </footer>
    </section>
  );
}
