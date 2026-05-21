import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";
import {
  getProjectsApi,
  getPurchaseRecommendationsApi,
  type ProjectItem,
  type PurchaseRecommendationItem,
} from "../services/erp-api";

const PAGE_SIZE = 10;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export function FuturePurchasesPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [rows, setRows] = useState<PurchaseRecommendationItem[]>([]);
  const [totals, setTotals] = useState({
    estimatedTotalCost: 0,
    materialCount: 0,
    projectCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const search = searchParams.get("search") ?? "";
  const projectId = searchParams.get("projectId") ?? "";

  useEffect(() => {
    let active = true;

    const loadProjects = async () => {
      try {
        const data = await getProjectsApi({
          page: 1,
          limit: 200,
        });

        if (!active) {
          return;
        }

        setProjects(data.items);
      } catch {
        if (!active) {
          return;
        }

        setProjects([]);
      }
    };

    void loadProjects();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getPurchaseRecommendationsApi({
          search: search || undefined,
          projectId: projectId || undefined,
        });

        if (!active) {
          return;
        }

        setRows(data.items);
        setTotals(data.totals);
      } catch {
        if (!active) {
          return;
        }

        setRows([]);
        setTotals({
          estimatedTotalCost: 0,
          materialCount: 0,
          projectCount: 0,
        });
        setError("No se pudieron cargar las compras futuras");
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
  }, [search, projectId]);

  const totalPages = Math.max(Math.ceil(rows.length / PAGE_SIZE), 1);

  const visibleRows = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return rows.slice(start, start + PAGE_SIZE);
  }, [rows, safePage]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setSearch = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value.trim().length > 0) {
      params.set("search", value.trim());
    } else {
      params.delete("search");
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const setProject = (value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value.length > 0) {
      params.set("projectId", value);
    } else {
      params.delete("projectId");
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Inventario y Flujo · Compras Futuras</p>

      <header className="page-header">
        <div>
          <h2>Compras Futuras</h2>
          <p>
            Recomendaciones de compra según la demanda pendiente de proyectos y
            el stock actual.
          </p>
        </div>
        <div className="stock-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/stock")}
          >
            Ver Stock
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate("/purchases")}
          >
            Ir a Compras
          </button>
        </div>
      </header>

      <div className="stock-kpis">
        <article className="kpi-card">
          <h3>Materiales con Déficit</h3>
          <strong>{totals.materialCount}</strong>
          <small>Con compra sugerida pendiente</small>
        </article>
        <article className="kpi-card">
          <h3>Proyectos Impactados</h3>
          <strong>{totals.projectCount}</strong>
          <small>Con requerimientos de materiales</small>
        </article>
        <article className="kpi-card">
          <h3>Costo Estimado</h3>
          <strong>{formatMoney(totals.estimatedTotalCost)}</strong>
          <small>Basado en últimos costos conocidos</small>
        </article>
      </div>

      <article className="panel">
        <div className="page-filters page-filters__grid">
          <div>
            <label htmlFor="future-purchases-search">Buscar material o proyecto</label>
            <input
              id="future-purchases-search"
              type="search"
              value={search}
              placeholder="Ej. melamina, herraje, Cocina Romero"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div>
            <label htmlFor="future-purchases-project">Filtrar por proyecto</label>
            <select
              id="future-purchases-project"
              value={projectId}
              onChange={(event) => setProject(event.target.value)}
            >
              <option value="">Todos los proyectos</option>
              {projects.map((project) => (
                <option key={project._id} value={project._id}>
                  {project.name} ({project.status})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrapper">
          <table className="table future-purchases-table">
            <thead>
              <tr>
                <th>Material</th>
                <th className="td-numeric">Stock</th>
                <th className="td-numeric">Necesario</th>
                <th className="td-numeric">Comprar</th>
                <th className="td-numeric">Costo</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={5} className="text-center">
                    Cargando recomendaciones...
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={5} className="text-negative text-center">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && visibleRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="text-center">
                    No hay compras futuras pendientes.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                visibleRows.map((row) => (
                  <tr key={row.materialId}>
                    <td>
                      <div className="project-cell">
                        <strong>{row.materialName}</strong>
                        <small>
                          {row.materialSku ? `${row.materialSku} · ` : ""}
                          {row.category} · {row.unit}
                        </small>
                      </div>
                      <div className="future-purchases-projects">
                        {row.projects.map((project) => (
                          <span key={project.projectId}>
                            {project.projectName}: {formatQuantity(project.remainingQuantity)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="td-numeric">{formatQuantity(row.currentStock)}</td>
                    <td className="td-numeric">{formatQuantity(row.requiredQuantity)}</td>
                    <td className="td-numeric">{formatQuantity(row.pendingToPurchase)}</td>
                    <td className="td-numeric">{formatMoney(row.estimatedCost)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
      </article>
    </section>
  );
}
