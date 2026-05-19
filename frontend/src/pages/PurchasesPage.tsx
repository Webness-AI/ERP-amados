import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";
import {
  createPurchaseApi,
  deletePurchaseApi,
  getPurchasesApi,
  receivePurchaseApi,
  updatePurchaseStatusApi,
  type PurchaseItemInput,
  type PurchaseRecord,
  type PurchaseStatus,
} from "../services/erp-api";

const PAGE_SIZE = 8;

const statusOptions: Array<{ value: PurchaseStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "ORDERED", label: "Ordenado" },
  { value: "PARTIALLY_RECEIVED", label: "Parcial" },
  { value: "RECEIVED", label: "Recibido" },
  { value: "CANCELED", label: "Cancelado" },
];

type PurchaseFormState = {
  supplierId: string;
  projectId: string;
  currency: string;
  notes: string;
  status: "DRAFT" | "ORDERED";
  items: PurchaseItemInput[];
};

const emptyItem: PurchaseItemInput = {
  materialId: "",
  quantityOrdered: 1,
  unitCost: 0,
};

const emptyFormState: PurchaseFormState = {
  supplierId: "",
  projectId: "",
  currency: "ARS",
  notes: "",
  status: "ORDERED",
  items: [{ ...emptyItem }],
};

function formatMoney(value: number, currency = "ARS"): string {
  return `${currency} ${value.toLocaleString("es-AR")}`;
}

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

function itemTotal(item: PurchaseItemInput): number {
  return Number((item.quantityOrdered * item.unitCost).toFixed(2));
}

function formTotal(items: PurchaseItemInput[]): number {
  return Number(
    items.reduce((acc, item) => acc + itemTotal(item), 0).toFixed(2),
  );
}

export function PurchasesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<PurchaseRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string | null>(
    null,
  );
  const [formState, setFormState] = useState<PurchaseFormState>(emptyFormState);
  const [receiveQuantities, setReceiveQuantities] = useState<
    Record<string, number>
  >({});

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as PurchaseStatus | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getPurchasesApi({
          page: safePage,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
        });

        if (!active) {
          return;
        }
        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
        if (data.items.length === 0) {
          setSelectedPurchaseId(null);
        } else {
          setSelectedPurchaseId((current) => {
            if (current && data.items.some((item) => item._id === current)) {
              return current;
            }
            return data.items[0]._id;
          });
        }
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar las compras");
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
  }, [safePage, search, status]);

  const selectedPurchase = useMemo(
    () => rows.find((purchase) => purchase._id === selectedPurchaseId) ?? null,
    [rows, selectedPurchaseId],
  );

  const metrics = useMemo(() => {
    const total = rows.length;
    const ordered = rows.filter((row) => row.status === "ORDERED").length;
    const received = rows.filter((row) => row.status === "RECEIVED").length;
    const committed = rows.reduce((acc, row) => acc + row.estimatedTotal, 0);
    return { total, ordered, received, committed };
  }, [rows]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const refreshList = async () => {
    const data = await getPurchasesApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));

    if (data.items.length > 0) {
      setSelectedPurchaseId((current) => current ?? data.items[0]._id);
    } else {
      setSelectedPurchaseId(null);
    }
  };

  const appendItem = () => {
    setFormState((current) => ({
      ...current,
      items: [...current.items, { ...emptyItem }],
    }));
  };

  const updateItem = (
    index: number,
    field: keyof PurchaseItemInput,
    value: string | number,
  ) => {
    setFormState((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    }));
  };

  const removeItem = (index: number) => {
    setFormState((current) => ({
      ...current,
      items:
        current.items.length > 1
          ? current.items.filter((_, itemIndex) => itemIndex !== index)
          : current.items,
    }));
  };

  const clearForm = () => {
    setFormState(emptyFormState);
    setFormError(null);
  };

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      supplierId: formState.supplierId.trim(),
      projectId: formState.projectId.trim() || undefined,
      currency: formState.currency.trim() || "ARS",
      notes: formState.notes.trim() || undefined,
      status: formState.status,
      items: formState.items
        .filter((item) => item.materialId.trim().length > 0)
        .map((item) => ({
          materialId: item.materialId.trim(),
          quantityOrdered: Number(item.quantityOrdered),
          unitCost: Number(item.unitCost),
        })),
    };

    if (!payload.supplierId) {
      setFormError("El ID del proveedor es obligatorio");
      setIsSaving(false);
      return;
    }

    if (payload.items.length === 0) {
      setFormError("Agrega al menos un material");
      setIsSaving(false);
      return;
    }

    try {
      await createPurchaseApi(payload);
      await refreshList();
      clearForm();
    } catch {
      setFormError("No se pudo crear la compra");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    purchase: PurchaseRecord,
    nextStatus: PurchaseStatus,
  ) => {
    try {
      await updatePurchaseStatusApi(purchase._id, nextStatus);
      await refreshList();
      setSelectedPurchaseId(purchase._id);
    } catch {
      setFormError("No se pudo actualizar el estado");
    }
  };

  const handleDelete = async (purchase: PurchaseRecord) => {
    if (!window.confirm(`Eliminar compra ${purchase._id.slice(-8)}?`)) {
      return;
    }

    try {
      await deletePurchaseApi(purchase._id);
      await refreshList();
    } catch {
      setFormError("No se pudo eliminar la compra");
    }
  };

  const handleReceive = async (purchase: PurchaseRecord) => {
    const receivedItems = purchase.items
      .map((item) => {
        const key = item.materialId;
        const pending = Number(
          (item.quantityOrdered - item.quantityReceived).toFixed(4),
        );
        const requested = Number(receiveQuantities[key] ?? 0);
        const quantityReceived = Number(
          Math.min(Math.max(requested, 0), pending).toFixed(4),
        );

        return {
          materialId: item.materialId,
          quantityReceived,
        };
      })
      .filter((item) => item.quantityReceived > 0);

    if (receivedItems.length === 0) {
      setFormError("Ingresa cantidades a recibir antes de confirmar");
      return;
    }

    try {
      await receivePurchaseApi(purchase._id, {
        receivedItems,
        note: "Recepción registrada desde frontend",
      });
      setReceiveQuantities({});
      await refreshList();
      setSelectedPurchaseId(purchase._id);
    } catch {
      setFormError("No se pudo registrar la recepción");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Abastecimiento · Compras</p>

      <header className="page-header">
        <div>
          <h2>Compras</h2>
          <p>Alta, seguimiento y recepción de órdenes de compra.</p>
        </div>
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={clearForm}
          >
            Nueva compra
          </button>
          <button className="btn btn-primary" type="button">
            Reporte de compras
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Compras visibles</h3>
          <strong>{metrics.total}</strong>
          <small className="kpi-neutral">Con filtros aplicados</small>
        </article>
        <article className="kpi-card">
          <h3>Ordenadas</h3>
          <strong>{metrics.ordered}</strong>
          <small>Pendientes de recepción</small>
        </article>
        <article className="kpi-card">
          <h3>Recibidas</h3>
          <strong className="kpi-positive">{metrics.received}</strong>
          <small>Cerradas en stock</small>
        </article>
        <article className="kpi-card">
          <h3>Total comprometido</h3>
          <strong>{formatMoney(metrics.committed)}</strong>
          <small>Monto estimado</small>
        </article>
      </div>

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Notas o moneda"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <label className="clients-toggle">
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) => setFilter("status", event.target.value)}
            >
              {statusOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      <div className="panel-grid budgets-layout">
        <article className="panel budgets-table-panel">
          <div className="table-wrapper">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Compra</th>
                  <th>Proveedor</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Recibido</th>
                  <th>Fecha</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando compras...
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
                      No hay compras para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr
                      key={row._id}
                      onClick={() => setSelectedPurchaseId(row._id)}
                    >
                      <td>
                        <div className="project-cell">
                          <strong>OC-{row._id.slice(-8)}</strong>
                          <small>{row.notes ?? "Sin notas"}</small>
                        </div>
                      </td>
                      <td>{row.supplierId.slice(-8)}</td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td>{formatMoney(row.estimatedTotal, row.currency)}</td>
                      <td>{formatMoney(row.receivedTotal, row.currency)}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>
                        <div className="budget-actions">
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() =>
                              void handleStatusChange(row, "ORDERED")
                            }
                          >
                            Ordenar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              void handleStatusChange(row, "CANCELED")
                            }
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleDelete(row)}
                          >
                            Eliminar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </article>

        <div className="budget-side-column">
          <article className="panel budget-detail-panel">
            <div className="budget-detail-header">
              <div>
                <h3>Recepcion</h3>
                <p>Registra ingreso parcial o total de materiales.</p>
              </div>
              {selectedPurchase && (
                <span
                  className={`budget-chip budget-chip--${selectedPurchase.status.toLowerCase()}`}
                >
                  {selectedPurchase.status}
                </span>
              )}
            </div>

            {!selectedPurchase && (
              <p className="text-muted">
                Selecciona una compra para ver detalle.
              </p>
            )}

            {selectedPurchase && (
              <div className="purchase-receive-list">
                {selectedPurchase.items.map((item) => {
                  const pending = Number(
                    (item.quantityOrdered - item.quantityReceived).toFixed(4),
                  );
                  const key = item.materialId;

                  return (
                    <div key={key} className="purchase-receive-item">
                      <div>
                        <strong>{key.slice(-8)}</strong>
                        <small>
                          Pedido: {item.quantityOrdered} | Recibido:{" "}
                          {item.quantityReceived}
                        </small>
                      </div>
                      <div className="purchase-receive-item__input">
                        <span>Pendiente {pending}</span>
                        <input
                          type="number"
                          min={0}
                          max={pending}
                          step="0.0001"
                          value={receiveQuantities[key] ?? ""}
                          onChange={(event) =>
                            setReceiveQuantities((current) => ({
                              ...current,
                              [key]: Number(event.target.value),
                            }))
                          }
                        />
                      </div>
                    </div>
                  );
                })}

                <div className="clients-form-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={() => void handleReceive(selectedPurchase)}
                    disabled={
                      selectedPurchase.status === "CANCELED" ||
                      selectedPurchase.status === "RECEIVED"
                    }
                  >
                    Registrar recepcion
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setReceiveQuantities({})}
                  >
                    Limpiar cantidades
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="panel budget-form-panel">
            <div className="clients-form-header">
              <div>
                <h3>Nueva compra</h3>
                <p>
                  Crea una orden con proveedor, materiales y costos unitarios.
                </p>
              </div>
            </div>

            <form
              className="budget-form"
              onSubmit={(event) => void handleCreate(event)}
            >
              <label>
                <span>ID proveedor *</span>
                <input
                  type="text"
                  value={formState.supplierId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      supplierId: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>ID proyecto</span>
                <input
                  type="text"
                  value={formState.projectId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      projectId: event.target.value,
                    }))
                  }
                />
              </label>
              <div className="budget-form__row">
                <label>
                  <span>Moneda</span>
                  <input
                    type="text"
                    value={formState.currency}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        currency: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Estado inicial</span>
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target.value as "DRAFT" | "ORDERED",
                      }))
                    }
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="ORDERED">Ordenado</option>
                  </select>
                </label>
              </div>

              <label>
                <span>Notas</span>
                <textarea
                  rows={3}
                  value={formState.notes}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>

              <div className="budget-items">
                <div className="budget-items__header">
                  <h4>Items de compra</h4>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={appendItem}
                  >
                    + Agregar item
                  </button>
                </div>

                {formState.items.map((item, index) => (
                  <div
                    key={`${index}-${item.materialId}`}
                    className="budget-item-row"
                  >
                    <label>
                      <span>Material ID</span>
                      <input
                        type="text"
                        value={item.materialId}
                        onChange={(event) =>
                          updateItem(index, "materialId", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Cantidad</span>
                      <input
                        type="number"
                        min={0.0001}
                        step="0.0001"
                        value={item.quantityOrdered}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantityOrdered",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <label>
                      <span>Costo unitario</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitCost}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unitCost",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <div className="budget-item-row__total">
                      <span>Total</span>
                      <strong>
                        {formatMoney(itemTotal(item), formState.currency)}
                      </strong>
                    </div>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => removeItem(index)}
                      disabled={formState.items.length === 1}
                    >
                      Quitar
                    </button>
                  </div>
                ))}
              </div>

              <div className="budget-summary">
                <span>Total estimado</span>
                <strong>
                  {formatMoney(formTotal(formState.items), formState.currency)}
                </strong>
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="clients-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Guardando..." : "Crear compra"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={clearForm}
                >
                  Reiniciar
                </button>
              </div>
            </form>
          </article>
        </div>
      </div>
    </section>
  );
}
