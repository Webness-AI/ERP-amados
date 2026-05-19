import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AccountingReportFilters } from "../components/AccountingReportFilters";
import {
  getIncomeStatementReportApi,
  type IncomeStatementReport,
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

export function EstadoResultadoPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState<IncomeStatementReport | null>(null);
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
        const data = await getIncomeStatementReportApi({
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

        setError("No se pudo cargar el estado de resultado");
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
          <h2>Estado de Resultado</h2>
          <p>Detalle de ingresos, egresos y resultado neto del periodo.</p>
        </div>
      </header>

      <AccountingReportFilters
        from={from}
        to={to}
        onFromChange={(value) => setRange("from", value)}
        onToChange={(value) => setRange("to", value)}
      />

      {error ? <p className="text-danger">{error}</p> : null}

      {isLoading ? <p>Cargando estado de resultado...</p> : null}

      {!isLoading && report ? (
        <div className="panel-grid">
          <article className="panel">
            <h3>Ingresos</h3>
            <div className="table-wrapper">
              <table className="table table-compact accounting-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Cuenta</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {report.income.map((item) => (
                    <tr key={item.accountCode}>
                      <td>{item.accountCode}</td>
                      <td>{item.accountName}</td>
                      <td className="text-right">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2}>Total ingresos</th>
                    <th className="text-right">
                      {formatMoney(report.totals.income)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="panel">
            <h3>Egresos</h3>
            <div className="table-wrapper">
              <table className="table table-compact accounting-table">
                <thead>
                  <tr>
                    <th>Codigo</th>
                    <th>Cuenta</th>
                    <th className="text-right">Importe</th>
                  </tr>
                </thead>
                <tbody>
                  {report.expenses.map((item) => (
                    <tr key={item.accountCode}>
                      <td>{item.accountCode}</td>
                      <td>{item.accountName}</td>
                      <td className="text-right">{formatMoney(item.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={2}>Total egresos</th>
                    <th className="text-right">
                      {formatMoney(report.totals.expenses)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="panel">
            <h3>Resultado neto</h3>
            <p className="panel-subtitle">
              {formatMoney(report.totals.netResult)}
            </p>
          </article>
        </div>
      ) : null}
    </section>
  );
}