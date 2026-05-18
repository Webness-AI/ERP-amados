import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";

import {
  getMaterialsApi,
  getPurchaseSuggestionsApi,
  type MaterialCategory,
  type MaterialItem,
} from "../services/erp-api";

function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR")}`;
}

const PAGE_SIZE = 10;

export function StockPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<MaterialItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const category = searchParams.get("category") ?? "ALL";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const selectedCategory =
    category === "ALL" ? undefined : (category as MaterialCategory);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const [materialsData, purchaseListData] = await Promise.all([
          getMaterialsApi({
            page: safePage,
            limit: PAGE_SIZE,
            category: selectedCategory,
          }),
          getPurchaseSuggestionsApi({ category: selectedCategory }),
        ]);

        if (!active) {
          return;
        }

        setRows(materialsData.items);
        setTotalPages(Math.max(materialsData.pagination.totalPages, 1));
        setLowStockCount(purchaseListData.pagination.total);
        setEstimatedCost(purchaseListData.totals.estimatedTotalCost);
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudo cargar el stock");
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
  }, [safePage, selectedCategory]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setCategory = (newCategory: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("category", newCategory);
    params.set("page", "1");
    setSearchParams(params);
  };

  const lowStockVisible = rows.filter((row) => row.isLowStock).length;

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Inventario · Control de Stock</p>

      <header className="page-header">
        <div>
          <h2>Control de Inventario</h2>
          <p>Gestión de materiales para producción, faltantes y compras.</p>
        </div>
        <div className="stock-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/purchases")}
          >
            Generar Lista de Compra
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate("/purchases")}
          >
            Ingreso de mercadería
          </button>
        </div>
      </header>

      <div className="stock-kpis">
        <article className="panel stock-alert-card">
          <h3>Alerta de Stock Bajo</h3>
          <p>
            {lowStockCount} materiales críticos detectados. Costo estimado: {" "}
            {formatMoney(estimatedCost)}.
          </p>
        </article>
        <article className="kpi-card">
          <h3>Costo de Reposición Estimado</h3>
          <strong>{formatMoney(estimatedCost)}</strong>
          <small className="kpi-neutral">
            Basado en lista de compra sugerida
          </small>
        </article>
        <article className="kpi-card">
          <h3>Materiales Disponibles</h3>
          <strong>{rows.length}</strong>
          <small>Filtrados por categoría</small>
        </article>
        <article className="kpi-card">
          <h3>Materiales Críticos en Vista</h3>
          <strong className="kpi-negative">{lowStockVisible}</strong>
          <small>Requieren reposición</small>
        </article>
      </div>

      <div className="filter-tabs">
        {[
          { key: "ALL", label: "Todos los Materiales" },
          { key: "MADERA", label: "Madera" },
          { key: "HERRAJES", label: "Herrajes" },
          { key: "OTROS", label: "Otros Materiales" },
        ].map((tab) => (
          <button
            key={tab.key}
            className={`filter-tab ${category === tab.key ? "filter-tab--active" : ""}`}
            onClick={() => setCategory(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <article className="panel">
        <div className="table-wrapper">
          <table className="table stock-table">
            <thead>
              <tr>
                <th>Material / Insumo</th>
                <th>Categoría</th>
                <th className="td-numeric">Cant. Total</th>
                <th className="td-numeric">Reservado</th>
                <th className="td-numeric">Disponible</th>
                <th>Unidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={7} className="text-center">
                    Cargando inventario...
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={7} className="text-negative text-center">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center">
                    No hay materiales para mostrar
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                rows.map((row) => {
                  const reserved = Math.min(row.currentStock, row.minStock);
                  const available = Math.max(row.currentStock - reserved, 0);
                  const unit =
                    row.category === "MADERA"
                      ? "Hojas"
                      : row.category === "HERRAJES"
                        ? "Juegos"
                        : "Unid.";

                  return (
                    <tr key={row.id}>
                      <td>
                        <div className="project-cell">
                          <strong>{row.name}</strong>
                          <small>SKU {row.id.slice(-8).toUpperCase()}</small>
                        </div>
                      </td>
                      <td>{row.category}</td>
                      <td className="td-numeric">{row.currentStock}</td>
                      <td className="td-numeric">{reserved}</td>
                      <td className="td-numeric">{available}</td>
                      <td>{unit}</td>
                      <td>
                        {row.isLowStock ? (
                          <span className="chip chip-produccion">CRITICO</span>
                        ) : (
                          <span className="chip chip-aprobado">SUFICIENTE</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        <Pagination
          page={safePage}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </article>
    </section>
  );
}
