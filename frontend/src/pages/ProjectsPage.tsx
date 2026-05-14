import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";

import { getProjectsApi, type ProjectItem } from "../services/erp-api";

function formatDate(value?: string | null): string {
  if (!value) {
    return "Sin fecha";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return date.toLocaleDateString("es-AR");
}

const PAGE_SIZE = 8;

export function ProjectsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ProjectItem[]>([]);
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
        const data = await getProjectsApi({ page: safePage, limit: PAGE_SIZE });
        if (!active) {
          return;
        }

        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar los proyectos");
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

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  return (
    <section>
      <header className="page-header">
        <div>
          <h2>Gestion de Proyectos</h2>
          <p>Seguimiento por estado, fecha de entrega y avance.</p>
        </div>
      </header>

      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Cliente</th>
              <th>Proyecto</th>
              <th>Estado</th>
              <th>Entrega</th>
              <th>Avance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6}>Cargando proyectos...</td>
              </tr>
            )}
            {!isLoading && error && (
              <tr>
                <td colSpan={6} className="text-negative">
                  {error}
                </td>
              </tr>
            )}
            {!isLoading && !error && rows.length === 0 && (
              <tr>
                <td colSpan={6}>No hay proyectos para mostrar</td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              rows.map((row) => (
                <tr key={row._id}>
                  <td>{row._id.slice(-8)}</td>
                  <td>{row.clientId.slice(-8)}</td>
                  <td>{row.name}</td>
                  <td>
                    <span className={`chip chip-${row.status.toLowerCase()}`}>
                      {row.status}
                    </span>
                  </td>
                  <td>{formatDate(row.deliveryDate)}</td>
                  <td>{formatDate(row.createdAt)}</td>
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
