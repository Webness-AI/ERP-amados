import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";

import {
  getJournalEntriesApi,
  type JournalEntryItem,
} from "../services/erp-api";

function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-AR");
}

const PAGE_SIZE = 12;

export function AccountingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<JournalEntryItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getJournalEntriesApi({
          page: safePage,
          limit: PAGE_SIZE,
        });
        if (!active) {
          return;
        }

        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudo cargar el libro diario");
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
  }, [safePage]);

  const totalDebe = rows.reduce((acc, row) => acc + row.totalDebit, 0);
  const totalHaber = rows.reduce((acc, row) => acc + row.totalCredit, 0);
  const diferencia = totalDebe - totalHaber;

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Libro Diario</h2>
          <p>
            Asientos contables, filtros por origen y trazabilidad por evento.
          </p>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Total Debe</h3>
          <strong>{formatMoney(totalDebe)}</strong>
        </article>
        <article className="kpi-card">
          <h3>Total Haber</h3>
          <strong>{formatMoney(totalHaber)}</strong>
        </article>
        <article className="kpi-card">
          <h3>Diferencia</h3>
          <strong>{formatMoney(diferencia)}</strong>
        </article>
      </div>

      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Asiento</th>
              <th>Fecha</th>
              <th>Origen</th>
              <th>Debe</th>
              <th>Haber</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5}>Cargando asientos...</td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={5} className="text-negative">
                  {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={5}>No hay asientos para mostrar</td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              rows.map((row) => (
                <tr key={row._id}>
                  <td>{row._id.slice(-8)}</td>
                  <td>{formatDate(row.entryDate)}</td>
                  <td>{row.originEvent ?? "manual"}</td>
                  <td>{formatMoney(row.totalDebit)}</td>
                  <td>{formatMoney(row.totalCredit)}</td>
                </tr>
              ))}
          </tbody>
        </table>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </article>
    </section>
  );
}
