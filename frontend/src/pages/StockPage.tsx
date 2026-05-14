import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";

import {
  getMaterialsApi,
  getPurchaseSuggestionsApi,
  type MaterialItem,
} from "../services/erp-api";

function formatMoney(value: number): string {
  return `$ ${value.toLocaleString("es-AR")}`;
}

const PAGE_SIZE = 10;

export function StockPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<MaterialItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
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
        const [materialsData, purchaseListData] = await Promise.all([
          getMaterialsApi({ page: safePage, limit: PAGE_SIZE }),
          getPurchaseSuggestionsApi(),
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
          <h2>Inventario y Stock</h2>
          <p>Control de niveles minimos, costos y faltantes por categoria.</p>
        </div>
      </header>

      <div className="panel panel--warning">
        <h3>Alerta de reposicion</h3>
        <p>
          {lowStockCount} materiales por debajo del minimo. Costo estimado de
          compra: {formatMoney(estimatedCost)}
        </p>
      </div>

      <article className="panel">
        <table className="table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Categoria</th>
              <th>Stock</th>
              <th>Min</th>
              <th>Costo Unitario</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={5}>Cargando inventario...</td>
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
                <td colSpan={5}>No hay materiales cargados</td>
              </tr>
            )}
            {!isLoading &&
              !error &&
              rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.category}</td>
                  <td
                    className={
                      row.isLowStock ? "text-negative" : "text-positive"
                    }
                  >
                    {row.currentStock}
                  </td>
                  <td>{row.minStock}</td>
                  <td>{row.isLowStock ? "Reponer" : "OK"}</td>
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
