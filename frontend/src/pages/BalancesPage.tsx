import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AccountingReportFilters } from "../components/AccountingReportFilters";
import {
  getTrialBalanceReportApi,
  type TrialBalanceReport,
} from "../services/erp-api";
import { formatMoney } from "../utils/formatters";

function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function BalancesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [report, setReport] = useState<TrialBalanceReport | null>(null);
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
        const data = await getTrialBalanceReportApi({
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

        setError("No se pudo cargar el balance de comprobacion");
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
          <h2>Balances</h2>
          <p>Balance de comprobacion completo por cuenta contable.</p>
        </div>
      </header>

      <AccountingReportFilters
        from={from}
        to={to}
        onFromChange={(value) => setRange("from", value)}
        onToChange={(value) => setRange("to", value)}
      />

      {error ? <p className="text-danger">{error}</p> : null}

      <article className="panel">
        {isLoading ? <p>Cargando balances...</p> : null}
        {!isLoading && report && report.rows.length === 0 ? (
          <p>No hay movimientos en el rango seleccionado.</p>
        ) : null}

        {!isLoading && report && report.rows.length > 0 ? (
          <div className="table-wrapper">
            <table className="table table-compact accounting-table">
              <thead>
                <tr>
                  <th>Codigo</th>
                  <th>Cuenta</th>
                  <th>Naturaleza</th>
                  <th>Clasificacion</th>
                  <th className="text-right">Debe</th>
                  <th className="text-right">Haber</th>
                  <th className="text-right">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {report.rows.map((row) => (
                  <tr key={row.accountCode}>
                    <td>{row.accountCode}</td>
                    <td>{row.accountName}</td>
                    <td>{row.accountNature}</td>
                    <td>{row.resultClassification ?? "-"}</td>
                    <td className="text-right">{formatMoney(row.totalDebit)}</td>
                    <td className="text-right">{formatMoney(row.totalCredit)}</td>
                    <td className="text-right">{formatMoney(row.balance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th colSpan={4}>Totales</th>
                  <th className="text-right">{formatMoney(report.totals.debit)}</th>
                  <th className="text-right">{formatMoney(report.totals.credit)}</th>
                  <th className="text-right">
                    {formatMoney(report.totals.debit - report.totals.credit)}
                  </th>
                </tr>
              </tfoot>
            </table>
          </div>
        ) : null}
      </article>
    </section>
  );
}