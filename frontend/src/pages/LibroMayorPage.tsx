import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { AccountingReportFilters } from "../components/AccountingReportFilters";
import {
  getAccountsApi,
  getGeneralLedgerReportApi,
  type AccountRecord,
  type GeneralLedgerReport,
} from "../services/erp-api";
import { formatDateTime as formatDate, formatMoney } from "../utils/formatters";

function toIsoDate(value: string): string | undefined {
  if (!value) {
    return undefined;
  }

  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

export function LibroMayorPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [report, setReport] = useState<GeneralLedgerReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const accountCode = searchParams.get("accountCode") ?? "";
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";

  useEffect(() => {
    let active = true;

    const loadAccounts = async () => {
      setAccountsLoading(true);

      try {
        const result = await getAccountsApi({
          page: 1,
          limit: 9999,
          activeOnly: true,
        });

        if (!active) {
          return;
        }

        const sorted = [...result.items].sort((a, b) =>
          a.code.localeCompare(b.code),
        );
        setAccounts(sorted);
      } finally {
        if (active) {
          setAccountsLoading(false);
        }
      }
    };

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    if (!accountCode) {
      return;
    }

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getGeneralLedgerReportApi({
          accountCode,
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

        setError("No se pudo cargar el libro mayor para la cuenta seleccionada");
        setReport(null);
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
  }, [accountCode, from, to]);

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    if (key !== "accountCode") {
      next.set("accountCode", accountCode);
    }

    setSearchParams(next);
  };

  const selectedAccount = useMemo(
    () => accounts.find((item) => item.code === accountCode) ?? null,
    [accounts, accountCode],
  );

  const visibleError = accountCode ? error : null;

  return (
    <section className="page-section">
      <header className="section-header">
        <div>
          <h2>Libro Mayor</h2>
          <p>Movimientos por cuenta con saldo acumulado.</p>
        </div>
      </header>

      <AccountingReportFilters
        from={from}
        to={to}
        onFromChange={(value) => setParam("from", value)}
        onToChange={(value) => setParam("to", value)}
      >
        <label className="accounting-filter">
          <span>Cuenta</span>
          <select
            className="accounting-filter__select"
            value={accountCode}
            onChange={(event) => setParam("accountCode", event.target.value)}
            disabled={accountsLoading}
          >
            <option value="">Seleccionar cuenta</option>
            {accounts.map((account) => (
              <option key={account._id} value={account.code}>
                {account.code} - {account.name}
              </option>
            ))}
          </select>
        </label>
      </AccountingReportFilters>

      {visibleError ? <p className="text-danger">{visibleError}</p> : null}

      {!accountCode ? (
        <article className="panel">
          <p>Selecciona una cuenta para consultar su libro mayor.</p>
        </article>
      ) : null}

      {accountCode && isLoading ? <p>Cargando libro mayor...</p> : null}

      {accountCode && !isLoading && report ? (
        <>
          <article className="panel">
            <h3>
              Cuenta: {report.account.code} - {report.account.name}
            </h3>
            <p className="panel-subtitle">
              Naturaleza: {report.account.naturaleza}
              {selectedAccount?.resultClassification
                ? ` | Clasificacion: ${selectedAccount.resultClassification}`
                : ""}
            </p>
          </article>

          <article className="panel">
            <div className="table-wrapper">
              <table className="table table-compact accounting-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Asiento</th>
                    <th>Descripcion</th>
                    <th className="text-right">Debe</th>
                    <th className="text-right">Haber</th>
                    <th className="text-right">Saldo acumulado</th>
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((movement) => (
                    <tr key={`${movement.entryId}-${movement.entryDate}`}>
                      <td>{formatDate(movement.entryDate)}</td>
                      <td>{movement.entryId.slice(-8).toUpperCase()}</td>
                      <td>
                        {movement.entryDescription}
                        {movement.lineDescription
                          ? ` (${movement.lineDescription})`
                          : ""}
                      </td>
                      <td className="text-right">{formatMoney(movement.debit)}</td>
                      <td className="text-right">{formatMoney(movement.credit)}</td>
                      <td className="text-right">
                        {formatMoney(movement.runningBalance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3}>Totales</th>
                    <th className="text-right">{formatMoney(report.totals.debit)}</th>
                    <th className="text-right">{formatMoney(report.totals.credit)}</th>
                    <th className="text-right">
                      {formatMoney(report.totals.endingBalance)}
                    </th>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>
        </>
      ) : null}
    </section>
  );
}