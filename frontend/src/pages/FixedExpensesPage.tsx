import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { Pagination } from "../components/Pagination";
import {
  createFixedExpenseApi,
  deleteFixedExpenseApi,
  getFixedExpensesApi,
  payFixedExpenseApi,
  refreshFixedExpenseAlertsApi,
  updateFixedExpenseApi,
  type FixedExpenseFrequency,
  type FixedExpenseRecord,
  type FixedExpenseStatus,
} from "../services/erp-api";
import {
  formatDate,
  formatMoneyWithCurrency as formatMoney,
  isDueSoon,
  isOverdue,
  toDatetimeLocal,
} from "../utils/formatters";

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: FixedExpenseStatus | ""; label: string }> =
  [
    { value: "", label: "Todos" },
    { value: "ACTIVO", label: "Activo" },
    { value: "PAUSADO", label: "Pausado" },
  ];

const frequencyOptions: Array<{ value: FixedExpenseFrequency; label: string }> =
  [
    { value: "MENSUAL", label: "Mensual" },
    { value: "BIMESTRAL", label: "Bimestral" },
    { value: "TRIMESTRAL", label: "Trimestral" },
    { value: "ANUAL", label: "Anual" },
  ];

type FixedExpenseFormState = {
  name: string;
  amount: number;
  currency: string;
  frequency: FixedExpenseFrequency;
  nextDueDate: string;
  notes: string;
};

const emptyFormState: FixedExpenseFormState = {
  name: "",
  amount: 0,
  currency: "ARS",
  frequency: "MENSUAL",
  nextDueDate: "",
  notes: "",
};

export function FixedExpensesPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<FixedExpenseRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | null>(
    null,
  );
  const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<FixedExpenseFormState>(emptyFormState);
  const [alerts, setAlerts] = useState<{
    overdue: number;
    dueSoon: number;
  } | null>(null);
  const formPanelRef = useRef<HTMLElement | null>(null);
  const nameInputRef = useRef<HTMLInputElement | null>(null);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as FixedExpenseStatus | "";
  const dueOnly = searchParams.get("dueOnly") === "true";
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const canWrite =
    user?.role === "ADMIN_GENERAL" || user?.role === "ADMIN";

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getFixedExpensesApi({
          page: safePage,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(dueOnly ? { dueOnly: true } : {}),
          ...(overdueOnly ? { overdueOnly: true } : {}),
        });

        if (!active) {
          return;
        }
        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
        if (data.items.length > 0) {
          setSelectedExpenseId((current) => current ?? data.items[0]._id);
        }
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar los gastos fijos");
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
  }, [safePage, search, status, dueOnly, overdueOnly]);

  const selectedExpense = useMemo(
    () => rows.find((expense) => expense._id === selectedExpenseId) ?? null,
    [rows, selectedExpenseId],
  );

  const metrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.status === "ACTIVO").length;
    const overdue = rows.filter(
      (row) => isOverdue(row.nextDueDate) && row.status === "ACTIVO",
    ).length;
    const dueSoon = rows.filter(
      (row) => isDueSoon(row.nextDueDate) && row.status === "ACTIVO",
    ).length;

    return { total, active, overdue, dueSoon };
  }, [rows]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setFilter = (key: string, value?: string) => {
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const setDueFilter = (mode: "all" | "due" | "overdue") => {
    const params = new URLSearchParams(searchParams);

    if (mode === "due") {
      params.set("dueOnly", "true");
      params.delete("overdueOnly");
    } else if (mode === "overdue") {
      params.set("overdueOnly", "true");
      params.delete("dueOnly");
    } else {
      params.delete("dueOnly");
      params.delete("overdueOnly");
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const refreshList = async () => {
    const data = await getFixedExpensesApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(dueOnly ? { dueOnly: true } : {}),
      ...(overdueOnly ? { overdueOnly: true } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));

    if (data.items.length > 0) {
      setSelectedExpenseId((current) => current ?? data.items[0]._id);
    } else {
      setSelectedExpenseId(null);
    }
  };

  const resetForm = () => {
    setEditingExpenseId(null);
    setFormState(emptyFormState);
    setFormError(null);
  };

  const openNewExpenseForm = () => {
    resetForm();
    setSelectedExpenseId(null);
    formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.requestAnimationFrame(() => {
      nameInputRef.current?.focus();
    });
  };

  const startEdit = (expense: FixedExpenseRecord) => {
    setEditingExpenseId(expense._id);
    setSelectedExpenseId(expense._id);
    setFormState({
      name: expense.name,
      amount: expense.amount,
      currency: expense.currency,
      frequency: expense.frequency,
      nextDueDate: toDatetimeLocal(expense.nextDueDate),
      notes: expense.notes ?? "",
    });
    setFormError(null);
    formPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canWrite) {
      setFormError("Tu rol actual es solo lectura para gastos fijos.");
      return;
    }

    setIsSaving(true);
    setFormError(null);

    const payload = {
      name: formState.name.trim(),
      amount: Number(formState.amount),
      currency: formState.currency.trim() || "ARS",
      frequency: formState.frequency,
      nextDueDate: formState.nextDueDate
        ? new Date(formState.nextDueDate).toISOString()
        : "",
      notes: formState.notes.trim() || undefined,
    };

    if (!payload.name || payload.name.length < 2) {
      setFormError("El nombre debe tener al menos 2 caracteres");
      setIsSaving(false);
      return;
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      setFormError("El monto debe ser mayor a 0");
      setIsSaving(false);
      return;
    }

    if (!payload.nextDueDate) {
      setFormError("La proxima fecha de vencimiento es obligatoria");
      setIsSaving(false);
      return;
    }

    try {
      if (editingExpenseId) {
        await updateFixedExpenseApi(editingExpenseId, {
          name: payload.name,
          amount: payload.amount,
          currency: payload.currency,
          frequency: payload.frequency,
          nextDueDate: payload.nextDueDate,
          notes: formState.notes.trim() || null,
        });
      } else {
        await createFixedExpenseApi(payload);
      }

      await refreshList();
      resetForm();
    } catch {
      setFormError("No se pudo guardar el gasto fijo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    expense: FixedExpenseRecord,
    nextStatus: FixedExpenseStatus,
  ) => {
    try {
      await updateFixedExpenseApi(expense._id, { status: nextStatus });
      await refreshList();
      setSelectedExpenseId(expense._id);
    } catch {
      setFormError("No se pudo actualizar el estado");
    }
  };

  const handlePay = async (expense: FixedExpenseRecord) => {
    try {
      await payFixedExpenseApi(expense._id);
      await refreshList();
      setSelectedExpenseId(expense._id);
    } catch {
      setFormError("No se pudo registrar el pago");
    }
  };

  const handleRefreshAlerts = async () => {
    try {
      const response = await refreshFixedExpenseAlertsApi();
      setAlerts(response);
      await refreshList();
    } catch {
      setFormError("No se pudieron recalcular alertas");
    }
  };

  const handleDelete = async (expense: FixedExpenseRecord) => {
    if (!window.confirm(`Eliminar gasto fijo ${expense.name}?`)) {
      return;
    }

    try {
      await deleteFixedExpenseApi(expense._id);
      await refreshList();
      if (selectedExpenseId === expense._id) {
        setSelectedExpenseId(null);
      }
    } catch {
      setFormError("No se pudo eliminar el gasto fijo");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Finanzas · Gastos Fijos</p>

      <header className="page-header">
        <div>
          <h2>Gastos Fijos</h2>
          <p>
            Programacion, seguimiento y pago de gastos recurrentes del negocio.
          </p>
        </div>
        <div className="view-controls">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={openNewExpenseForm}
            disabled={!canWrite}
          >
            Nuevo gasto
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void handleRefreshAlerts()}
            disabled={!canWrite}
          >
            Recalcular alertas
          </button>
        </div>
      </header>

      {!canWrite && (
        <article className="panel panel--warning">
          <h3>Modo solo lectura</h3>
          <p>Tu rol no permite crear, editar, pagar o eliminar gastos fijos.</p>
        </article>
      )}

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Gastos visibles</h3>
          <strong>{metrics.total}</strong>
          <small className="kpi-neutral">Con filtros activos</small>
        </article>
        <article className="kpi-card">
          <h3>Activos</h3>
          <strong>{metrics.active}</strong>
          <small>En seguimiento</small>
        </article>
        <article className="kpi-card">
          <h3>Vencidos</h3>
          <strong className="kpi-negative">{metrics.overdue}</strong>
          <small>Requieren pago inmediato</small>
        </article>
        <article className="kpi-card">
          <h3>Vencen pronto</h3>
          <strong>{metrics.dueSoon}</strong>
          <small>Ventana 72 horas</small>
        </article>
      </div>

      {alerts && (
        <article className="panel panel--warning">
          <h3>Alertas recalculadas</h3>
          <p>
            Vencidos: {alerts.overdue} | Próximos 72 h: {alerts.dueSoon}
          </p>
        </article>
      )}

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Nombre o moneda"
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
          <label className="clients-toggle">
            <span>Vencimiento</span>
            <select
              value={overdueOnly ? "overdue" : dueOnly ? "due" : "all"}
              onChange={(event) =>
                setDueFilter(event.target.value as "all" | "due" | "overdue")
              }
            >
              <option value="all">Todos</option>
              <option value="due">Próximos 72 h</option>
              <option value="overdue">Vencidos</option>
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
                  <th>Gasto</th>
                  <th>Frecuencia</th>
                  <th>Estado</th>
                  <th>Vencimiento</th>
                  <th>Último pago</th>
                  <th>Monto</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando gastos...
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
                      No hay gastos para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr
                      key={row._id}
                      className={
                        selectedExpenseId === row._id ? "table-row-active" : ""
                      }
                      onClick={() => setSelectedExpenseId(row._id)}
                    >
                      <td>
                        <div className="project-cell">
                          <strong>{row.name}</strong>
                          <small>{row.notes ?? "Sin notas"}</small>
                        </div>
                      </td>
                      <td>{row.frequency}</td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td
                        className={
                          isOverdue(row.nextDueDate) ? "text-negative" : ""
                        }
                      >
                        {formatDate(row.nextDueDate)}
                      </td>
                      <td>{formatDate(row.lastPaidAt)}</td>
                      <td className="td-numeric">
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td>
                        <div className="budget-actions">
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() => startEdit(row)}
                            disabled={!canWrite}
                          >
                            Editar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handlePay(row)}
                            disabled={!canWrite || row.status !== "ACTIVO"}
                          >
                            Pagar
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleDelete(row)}
                            disabled={!canWrite}
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
                <h3>Control de estado</h3>
                <p>Pausa o reactiva el gasto seleccionado.</p>
              </div>
              {selectedExpense && (
                <span
                  className={`budget-chip budget-chip--${selectedExpense.status.toLowerCase()}`}
                >
                  {selectedExpense.status}
                </span>
              )}
            </div>

            {!selectedExpense && (
              <p className="text-muted">
                Selecciona un gasto para operar su estado.
              </p>
            )}

            {selectedExpense && (
              <div className="clients-form-actions">
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() =>
                    void handleStatusChange(selectedExpense, "ACTIVO")
                  }
                  disabled={!canWrite || selectedExpense.status === "ACTIVO"}
                >
                  Marcar activo
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    void handleStatusChange(selectedExpense, "PAUSADO")
                  }
                  disabled={!canWrite || selectedExpense.status === "PAUSADO"}
                >
                  Pausar
                </button>
              </div>
            )}
          </article>

          <article className="panel budget-form-panel" ref={formPanelRef}>
            <div className="clients-form-header">
              <div>
                <h3>{editingExpenseId ? "Editar gasto" : "Nuevo gasto"}</h3>
                <p>
                  {editingExpenseId
                    ? "Actualiza datos del gasto recurrente."
                    : "Registra un nuevo gasto fijo para control financiero."}
                </p>
              </div>
              {editingExpenseId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetForm}
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
                <span>Nombre *</span>
                <input
                  type="text"
                  ref={nameInputRef}
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  required
                />
              </label>
              <div className="budget-form__row">
                <label>
                  <span>Monto *</span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={formState.amount}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        amount: Number(event.target.value),
                      }))
                    }
                    required
                  />
                </label>
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
              </div>
              <div className="budget-form__row">
                <label>
                  <span>Frecuencia</span>
                  <select
                    value={formState.frequency}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        frequency: event.target.value as FixedExpenseFrequency,
                      }))
                    }
                  >
                    {frequencyOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Próximo vencimiento *</span>
                  <input
                    type="datetime-local"
                    value={formState.nextDueDate}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        nextDueDate: event.target.value,
                      }))
                    }
                    required
                  />
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

              {formError && <p className="form-error">{formError}</p>}

              <div className="clients-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Guardando..."
                    : editingExpenseId
                      ? "Guardar cambios"
                      : "Crear gasto"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={resetForm}
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
