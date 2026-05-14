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
    <section>
      <header className="page-header">
        <div>
          <h2>Dashboard Ejecutivo</h2>
          <p>Resumen operativo y financiero en tiempo real.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Ingresos</h3>
          <strong>{formatMoney(overview.cash.income)}</strong>
          <small className="kpi-positive">Periodo actual</small>
        </article>
        <article className="kpi-card">
          <h3>Egresos</h3>
          <strong>{formatMoney(overview.cash.expense)}</strong>
          <small className="kpi-negative">Periodo actual</small>
        </article>
        <article className="kpi-card">
          <h3>Proyectos activos</h3>
          <strong>{overview.projects.totalActive}</strong>
          <small>Estados operativos vigentes</small>
        </article>
        <article className="kpi-card">
          <h3>Stock bajo</h3>
          <strong>{overview.stock.lowStockMaterials} materiales</strong>
          <small>
            Compra estimada {formatMoney(overview.stock.estimatedPurchaseCost)}
          </small>
        </article>
      </div>

      <div className="panel-grid">
        <article className="panel">
          <h3>Alertas proximas</h3>
          <ul className="list">
            {alertsList.length === 0 && <li>Sin alertas proximas</li>}
            {alertsList.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="panel">
          <h3>Estado por area</h3>
          <ul className="list">
            {areaRows.length === 0 && <li>Sin estados activos</li>}
            {areaRows.map((row) => (
              <li key={row.status}>
                <span className={`chip chip-${row.status.toLowerCase()}`}>
                  {row.status}
                </span>{" "}
                {row.count}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
