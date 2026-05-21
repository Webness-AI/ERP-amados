import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";

import {
  createBudgetApi,
  deleteBudgetApi,
  getBudgetsApi,
  updateBudgetStatusApi,
  reviseBudgetApi,
  type BudgetItemInput,
  type BudgetRecord,
  type BudgetStatus,
} from "../services/erp-api";
import {
  formatDate,
  formatMoneyWithCurrency as formatMoney,
} from "../utils/formatters";

const PAGE_SIZE = 8;

const statusOptions: Array<{ value: BudgetStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviado" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "CANCELED", label: "Cancelado" },
];

type BudgetFormState = {
  clientId: string;
  title: string;
  description: string;
  currency: string;
  status: BudgetStatus;
  items: BudgetItemInput[];
};

const emptyItem: BudgetItemInput = {
  description: "",
  quantity: 1,
  unitPrice: 0,
};

const emptyFormState: BudgetFormState = {
  clientId: "",
  title: "",
  description: "",
  currency: "ARS",
  status: "DRAFT",
  items: [{ ...emptyItem }],
};

function buildFormFromBudget(budget?: BudgetRecord | null): BudgetFormState {
  if (!budget) {
    return emptyFormState;
  }

  return {
    clientId: budget.clientId,
    title: budget.title,
    description: budget.description ?? "",
    currency: budget.currency,
    status: budget.status,
    items:
      budget.items.length > 0
        ? budget.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : [{ ...emptyItem }],
  };
}

function calculateItemTotal(item: BudgetItemInput): number {
  return Number((item.quantity * item.unitPrice).toFixed(2));
}

function calculateBudgetTotal(items: BudgetItemInput[]): number {
  return Number(
    items.reduce((acc, item) => acc + calculateItemTotal(item), 0).toFixed(2),
  );
}

export function BudgetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<BudgetRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(null);
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [formState, setFormState] = useState<BudgetFormState>(emptyFormState);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as BudgetStatus | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getBudgetsApi({
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

        if (!selectedBudgetId && data.items.length > 0) {
          setSelectedBudgetId(data.items[0]._id);
        }
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar los presupuestos");
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

  useEffect(() => {
    if (!selectedBudgetId && rows.length > 0) {
      setSelectedBudgetId(rows[0]._id);
    }
  }, [rows, selectedBudgetId]);

  const selectedBudget = useMemo(
    () => rows.find((budget) => budget._id === selectedBudgetId) ?? null,
    [rows, selectedBudgetId],
  );

  const metrics = useMemo(() => {
    const total = rows.length;
    const approvedTotal = rows
      .filter((budget) => budget.status === "APPROVED")
      .reduce((acc, budget) => acc + budget.total, 0);
    const draftCount = rows.filter(
      (budget) => budget.status === "DRAFT",
    ).length;
    const average =
      total > 0
        ? rows.reduce((acc, budget) => acc + budget.total, 0) / total
        : 0;

    return { total, approvedTotal, draftCount, average };
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

  const startCreate = () => {
    setEditingBudgetId(null);
    setSelectedBudgetId(null);
    setFormState(emptyFormState);
    setFormError(null);
  };

  const startEdit = (budget: BudgetRecord) => {
    setEditingBudgetId(budget._id);
    setSelectedBudgetId(budget._id);
    setFormState(buildFormFromBudget(budget));
    setFormError(null);
  };

  const appendItem = () => {
    setFormState((current) => ({
      ...current,
      items: [...current.items, { ...emptyItem }],
    }));
  };

  const updateItem = (
    index: number,
    field: keyof BudgetItemInput,
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

  const refreshList = async () => {
    const data = await getBudgetsApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));
    if (data.items.length > 0) {
      setSelectedBudgetId((current) => current ?? data.items[0]._id);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      clientId: formState.clientId.trim(),
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      currency: formState.currency.trim() || "ARS",
      items: formState.items
        .filter((item) => item.description.trim().length > 0)
        .map((item) => ({
          description: item.description.trim(),
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
        })),
      status: formState.status,
    };

    if (!payload.clientId) {
      setFormError("El clientId es obligatorio para crear un presupuesto");
      setIsSaving(false);
      return;
    }

    if (payload.items.length === 0) {
      setFormError("Agrega al menos un item al presupuesto");
      setIsSaving(false);
      return;
    }

    try {
      if (editingBudgetId) {
        await reviseBudgetApi(editingBudgetId, {
          title: payload.title,
          description: payload.description,
          currency: payload.currency,
          items: payload.items,
          status: payload.status,
        });
      } else {
        await createBudgetApi(payload);
      }

      await refreshList();
      startCreate();
    } catch {
      setFormError("No se pudo guardar el presupuesto");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    budget: BudgetRecord,
    nextStatus: BudgetStatus,
  ) => {
    try {
      await updateBudgetStatusApi(budget._id, nextStatus);
      await refreshList();
      setSelectedBudgetId(budget._id);
    } catch {
      setFormError("No se pudo actualizar el estado del presupuesto");
    }
  };

  const handleDelete = async (budget: BudgetRecord) => {
    if (!window.confirm(`Eliminar ${budget.title}?`)) {
      return;
    }

    try {
      await deleteBudgetApi(budget._id);
      await refreshList();

      if (selectedBudgetId === budget._id) {
        setSelectedBudgetId(null);
      }
    } catch {
      setFormError("No se pudo eliminar el presupuesto");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Comercial · Presupuestos</p>

      <header className="page-header">
        <div>
          <h2>Presupuestos</h2>
          <p>
            Flujo comercial de alta, revision y aprobacion antes del paso a
            proyecto.
          </p>
        </div>
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={startCreate}
          >
            Nuevo presupuesto
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate("/projects")}
          >
            Ir a proyectos
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Presupuestos visibles</h3>
          <strong>{metrics.total}</strong>
          <small className="kpi-neutral">Resultado de filtros activos</small>
        </article>
        <article className="kpi-card">
          <h3>Monto aprobado</h3>
          <strong>{formatMoney(metrics.approvedTotal)}</strong>
          <small className="kpi-positive">Potencial de conversión</small>
        </article>
        <article className="kpi-card">
          <h3>Borradores</h3>
          <strong>{metrics.draftCount}</strong>
          <small>Listos para envío</small>
        </article>
        <article className="kpi-card">
          <h3>Ticket promedio</h3>
          <strong>{formatMoney(metrics.average)}</strong>
          <small>Promedio de la página actual</small>
        </article>
      </div>

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Título, descripción o grupo"
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
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Versión</th>
                  <th>Total</th>
                  <th>Actualizado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando presupuestos...
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
                      No hay presupuestos para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((budget) => (
                    <tr
                      key={budget._id}
                      onClick={() => setSelectedBudgetId(budget._id)}
                    >
                      <td>
                        <div className="project-cell">
                          <strong>{budget.title}</strong>
                          <small>{budget.versionGroupId.slice(-8)}</small>
                        </div>
                      </td>
                      <td>{budget.clientId.slice(-8)}</td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${budget.status.toLowerCase()}`}
                        >
                          {budget.status}
                        </span>
                      </td>
                      <td>v{budget.version}</td>
                      <td>{formatMoney(budget.total, budget.currency)}</td>
                      <td>{formatDate(budget.updatedAt)}</td>
                      <td>
                        <div className="budget-actions">
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() => startEdit(budget)}
                          >
                            Revisar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() =>
                              void handleStatusChange(budget, "APPROVED")
                            }
                          >
                            Aprobar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleDelete(budget)}
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
                <h3>Detalle</h3>
                <p>Resumen operativo del presupuesto seleccionado.</p>
              </div>
              {selectedBudget && (
                <span
                  className={`budget-chip budget-chip--${selectedBudget.status.toLowerCase()}`}
                >
                  {selectedBudget.status}
                </span>
              )}
            </div>

            {selectedBudget ? (
              <div className="budget-detail">
                <div className="budget-detail__meta">
                  <div>
                    <span>Cliente</span>
                    <strong>{selectedBudget.clientId}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {formatMoney(
                        selectedBudget.total,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatMoney(
                        selectedBudget.subtotal,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Actualizado</span>
                    <strong>{formatDate(selectedBudget.updatedAt)}</strong>
                  </div>
                </div>

                <div className="budget-detail__items">
                  {selectedBudget.items.map((item) => (
                    <div
                      key={`${item.description}-${item.total}`}
                      className="budget-detail__item"
                    >
                      <div>
                        <strong>{item.description}</strong>
                        <small>
                          {item.quantity} x{" "}
                          {formatMoney(item.unitPrice, selectedBudget.currency)}
                        </small>
                      </div>
                      <strong>
                        {formatMoney(item.total, selectedBudget.currency)}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted">
                Selecciona un presupuesto para ver su detalle.
              </p>
            )}
          </article>

          <article className="panel budget-form-panel">
            <div className="clients-form-header">
              <div>
                <h3>
                  {editingBudgetId
                    ? "Revisar presupuesto"
                    : "Nuevo presupuesto"}
                </h3>
                <p>
                  {editingBudgetId
                    ? "Genera una revision a partir del presupuesto seleccionado."
                    : "Carga un presupuesto nuevo y deja listo el flujo comercial."}
                </p>
              </div>
              {editingBudgetId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={startCreate}
                >
                  Limpiar
                </button>
              )}
            </div>

            <form
              className="budget-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <label>
                <span>ID cliente *</span>
                <input
                  type="text"
                  value={formState.clientId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      clientId: event.target.value,
                    }))
                  }
                  disabled={Boolean(editingBudgetId)}
                  required
                />
              </label>
              <label>
                <span>Título *</span>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <label>
                <span>Descripción</span>
                <textarea
                  rows={4}
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
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
                  <span>Estado</span>
                  <select
                    value={formState.status}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        status: event.target.value as BudgetStatus,
                      }))
                    }
                  >
                    <option value="DRAFT">Borrador</option>
                    <option value="SENT">Enviado</option>
                    <option value="APPROVED">Aprobado</option>
                    <option value="REJECTED">Rechazado</option>
                    <option value="CANCELED">Cancelado</option>
                  </select>
                </label>
              </div>

              <div className="budget-items">
                <div className="budget-items__header">
                  <h4>Items</h4>
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
                    key={`${index}-${item.description}`}
                    className="budget-item-row"
                  >
                    <label>
                      <span>Descripción</span>
                      <input
                        type="text"
                        value={item.description}
                        onChange={(event) =>
                          updateItem(index, "description", event.target.value)
                        }
                      />
                    </label>
                    <label>
                      <span>Cantidad</span>
                      <input
                        type="number"
                        min={0.0001}
                        step="0.0001"
                        value={item.quantity}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "quantity",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <label>
                      <span>Precio unitario</span>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          updateItem(
                            index,
                            "unitPrice",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <div className="budget-item-row__total">
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          calculateItemTotal(item),
                          formState.currency,
                        )}
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
                  {formatMoney(
                    calculateBudgetTotal(formState.items),
                    formState.currency,
                  )}
                </strong>
              </div>

              {formError && <p className="form-error">{formError}</p>}

              <div className="clients-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Guardando..."
                    : editingBudgetId
                      ? "Guardar revision"
                      : "Crear presupuesto"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={startCreate}
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
