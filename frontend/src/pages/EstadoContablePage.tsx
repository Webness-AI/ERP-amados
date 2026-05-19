import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AccountingReportFilters } from "../components/AccountingReportFilters";
import {
  getFinancialStatementReportApi,
  type FinancialStatementReport,
  type TrialBalanceRow,
} from "../services/erp-api";

function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR")}`;
}

function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

function AccountSection({
  title,
  rows,
}: {
  title: string;
  rows: TrialBalanceRow[];
}) {
  return (
    <article className="panel">
      <h3>{title}</h3>
      <div className="table-wrapper">
        <table className="table table-compact accounting-table">
          <thead>
            <tr>
              <th>Codigo</th>
              <th>Cuenta</th>
              <th className="text-right">Saldo</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.accountCode}>
                <td>{row.accountCode}</td>
                <td>{row.accountName}</td>
                <td className="text-right">{formatMoney(row.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </article>
  );
}

export function EstadoContablePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState<FinancialStatementReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getFinancialStatementReportApi({
          from: toIsoDate(from),
          to: toIsoDate(to),
        });

        if (!active) {
          return;
        }

        setReport(data);
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudo cargar el estado contable");
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
  }, [from, to]);

  const setRange = (key: "from" | "to", value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }
    setSearchParams(next);
  };

  return (
    <section className="page-section">
      <header className="section-header">
        <div>
          <h2>Estado Contable</h2>
          <p>Vista consolidada de Balance General y Estado de Resultado.</p>
        </div>
      </header>

      <AccountingReportFilters
        from={from}
        to={to}
        onFromChange={(value) => setRange("from", value)}
        onToChange={(value) => setRange("to", value)}
      />

      {error ? <p className="text-danger">{error}</p> : null}
      {isLoading ? <p>Cargando estado contable...</p> : null}

      {!isLoading && report ? (
        <>
          <div className="kpi-grid">
            <article className="kpi-card">
              <small>Activos</small>
              <strong>{formatMoney(report.summary.assets)}</strong>
            </article>
            <article className="kpi-card">
              <small>Pasivos + Patrimonio</small>
              <strong>{formatMoney(report.summary.liabilitiesPlusEquity)}</strong>
            </article>
            <article className="kpi-card">
              <small>Resultado neto</small>
              <strong>{formatMoney(report.summary.netResult)}</strong>
            </article>
            <article className="kpi-card">
              <small>Diferencia contable</small>
              <strong>{formatMoney(report.summary.equationGap)}</strong>
            </article>
          </div>

          <div className="panel-grid">
            <AccountSection
              title="Activos"
              rows={report.balanceSheet.assets}
            />
            <AccountSection
              title="Pasivos"
              rows={report.balanceSheet.liabilities}
            />
            <AccountSection
              title="Patrimonio Neto"
              rows={report.balanceSheet.equity}
            />
          </div>

          <article className="panel">
            <h3>Estado de resultado (resumen)</h3>
            <p className="panel-subtitle">
              Ingresos: {formatMoney(report.incomeStatement.totals.income)} | 
              Egresos: {formatMoney(report.incomeStatement.totals.expenses)} | 
              Neto: {formatMoney(report.incomeStatement.totals.netResult)}
            </p>
          </article>
        </>
      ) : null}
    </section>
  );
}