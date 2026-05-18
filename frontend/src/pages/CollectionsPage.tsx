import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { Pagination } from "../components/Pagination";
import {
  createCollectionApi,
  getCollectionsApi,
  refreshCollectionDueStatusApi,
  registerCollectionPaymentApi,
  type CollectionItem,
  type CollectionPaymentMethod,
  type CollectionStatus,
} from "../services/erp-api";

const PAGE_SIZE = 10;

const statusOptions: Array<{ value: CollectionStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "SENADO", label: "Señado" },
  { value: "PARCIAL", label: "Parcial" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "VENCIDO", label: "Vencido" },
];

const paymentMethodOptions: CollectionPaymentMethod[] = [
  "EFECTIVO",
  "TRANSFERENCIA",
  "TARJETA",
  "CHEQUE",
  "OTRO",
];

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

export function CollectionsPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "ADMIN_GENERAL" || user?.role === "ADMIN";

  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<CollectionItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [alerts, setAlerts] = useState<{
    overdue: number;
    dueSoon: number;
  } | null>(null);

  const [clientId, setClientId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [totalAmount, setTotalAmount] = useState(0);
  const [laborAmountPending, setLaborAmountPending] = useState(0);
  const [currency, setCurrency] = useState("ARS");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");

  const page = Number(searchParams.get("page") ?? "1");
  const status = (searchParams.get("status") ?? "") as CollectionStatus | "";
  const dueOnly = searchParams.get("dueOnly") === "true";
  const overdueOnly = searchParams.get("overdueOnly") === "true";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const load = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getCollectionsApi({
        page: safePage,
        limit: PAGE_SIZE,
        ...(status ? { status } : {}),
        ...(dueOnly ? { dueOnly: true } : {}),
        ...(overdueOnly ? { overdueOnly: true } : {}),
      });

      setRows(data.items);
      setTotalPages(Math.max(data.pagination.totalPages, 1));
    } catch {
      setError("No se pudieron cargar las cobranzas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [safePage, status, dueOnly, overdueOnly]);

  const stats = useMemo(() => {
    const total = rows.length;
    const pending = rows.filter((row) => row.status !== "COBRADO").length;
    const overdue = rows.filter((row) => row.status === "VENCIDO").length;
    const pendingAmount = rows.reduce((acc, row) => acc + row.pendingAmount, 0);

    return { total, pending, overdue, pendingAmount };
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (!clientId.trim()) {
      setFormError("El ID de cliente es obligatorio");
      return;
    }
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      setFormError("El monto total debe ser mayor a 0");
      return;
    }

    setIsSaving(true);
    try {
      await createCollectionApi({
        clientId: clientId.trim(),
        projectId: projectId.trim() || undefined,
        totalAmount,
        laborAmountPending,
        currency: currency.trim() || "ARS",
        dueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
        notes: notes.trim() || undefined,
      });

      setClientId("");
      setProjectId("");
      setTotalAmount(0);
      setLaborAmountPending(0);
      setCurrency("ARS");
      setDueDate("");
      setNotes("");
      await load();
    } catch {
      setFormError("No se pudo crear la cobranza");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePay = async (row: CollectionItem) => {
    const amountRaw = window.prompt(
      "Monto a cobrar",
      String(row.pendingAmount),
    );
    if (!amountRaw) {
      return;
    }

    const amount = Number(amountRaw);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Monto inválido");
      return;
    }

    const methodRaw = window.prompt(
      `Método (${paymentMethodOptions.join("/")})`,
      "EFECTIVO",
    );
    if (!methodRaw) {
      return;
    }

    const method = methodRaw.toUpperCase() as CollectionPaymentMethod;
    if (!paymentMethodOptions.includes(method)) {
      setFormError("Método de pago inválido");
      return;
    }

    const note = window.prompt("Nota del pago", "") ?? undefined;

    try {
      await registerCollectionPaymentApi(row._id, {
        amount,
        paymentMethod: method,
        ...(note?.trim() ? { note: note.trim() } : {}),
      });
      await load();
    } catch {
      setFormError("No se pudo registrar el cobro");
    }
  };

  const handleRefreshAlerts = async () => {
    try {
      const result = await refreshCollectionDueStatusApi();
      setAlerts(result);
      await load();
    } catch {
      setFormError("No se pudo refrescar el estado de vencimientos");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Finanzas · Cobranzas</p>

      <header className="page-header">
        <div>
          <h2>Cobranzas</h2>
          <p>Seguimiento de pendientes, vencimientos y cobros registrados.</p>
        </div>
        {canWrite && (
          <div className="view-controls">
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => void handleRefreshAlerts()}
            >
              Refrescar vencimientos
            </button>
          </div>
        )}
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Cobranzas visibles</h3>
          <strong>{stats.total}</strong>
          <small className="kpi-neutral">Página actual</small>
        </article>
        <article className="kpi-card">
          <h3>Pendientes</h3>
          <strong>{stats.pending}</strong>
          <small>Estado no cobrado</small>
        </article>
        <article className="kpi-card">
          <h3>Vencidas</h3>
          <strong className="kpi-negative">{stats.overdue}</strong>
          <small>Estado VENCIDO</small>
        </article>
        <article className="kpi-card">
          <h3>Monto pendiente</h3>
          <strong>{formatMoney(stats.pendingAmount)}</strong>
          <small>Total visible</small>
        </article>
      </div>

      {!canWrite && (
        <article className="panel">
          <p className="text-muted">
            Modo solo lectura: no tienes permisos para crear ni registrar
            cobros.
          </p>
        </article>
      )}

      {alerts && (
        <article className="panel panel--warning">
          <h3>Estado actualizado</h3>
          <p>
            Vencidas: {alerts.overdue} | Próximas 72 h: {alerts.dueSoon}
          </p>
        </article>
      )}

      <article className="panel">
        <div className="budget-toolbar">
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
              <option value="due">Con fecha de vencimiento</option>
              <option value="overdue">Solo vencidos</option>
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
                  <th>Cliente</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Total</th>
                  <th>Pagado</th>
                  <th>Pendiente</th>
                  <th>Vence</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Cargando cobranzas...
                    </td>
                  </tr>
                )}
                {!isLoading && error && (
                  <tr>
                    <td colSpan={8} className="text-negative text-center">
                      {error}
                    </td>
                  </tr>
                )}
                {!isLoading && !error && rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center">
                      No hay cobranzas para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr key={row._id}>
                      <td>{row.clientId.slice(-8)}</td>
                      <td>{row.projectId ? row.projectId.slice(-8) : "-"}</td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${row.status.toLowerCase()}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="td-numeric">
                        {formatMoney(row.totalAmount, row.currency)}
                      </td>
                      <td className="text-positive td-numeric">
                        {formatMoney(row.paidAmount, row.currency)}
                      </td>
                      <td className="text-negative td-numeric">
                        {formatMoney(row.pendingAmount, row.currency)}
                      </td>
                      <td>{formatDate(row.dueDate)}</td>
                      <td>
                        {canWrite && row.status !== "COBRADO" ? (
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() => void handlePay(row)}
                          >
                            Registrar cobro
                          </button>
                        ) : (
                          "-"
                        )}
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

        {canWrite && (
          <article className="panel budget-form-panel">
            <div className="clients-form-header">
              <div>
                <h3>Nueva cobranza</h3>
                <p>Alta manual de cuenta por cobrar.</p>
              </div>
            </div>

            <form
              className="budget-form"
              onSubmit={(event) => void handleSubmit(event)}
            >
              <label>
                <span>ID cliente *</span>
                <input
                  type="text"
                  value={clientId}
                  onChange={(event) => setClientId(event.target.value)}
                  required
                />
              </label>
              <label>
                <span>ID proyecto</span>
                <input
                  type="text"
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                />
              </label>
              <div className="budget-form__row">
                <label>
                  <span>Total *</span>
                  <input
                    type="number"
                    min={0.01}
                    step="0.01"
                    value={totalAmount}
                    onChange={(event) =>
                      setTotalAmount(Number(event.target.value))
                    }
                    required
                  />
                </label>
                <label>
                  <span>Mano de obra pendiente</span>
                  <input
                    type="number"
                    min={0}
                    step="0.01"
                    value={laborAmountPending}
                    onChange={(event) =>
                      setLaborAmountPending(Number(event.target.value))
                    }
                  />
                </label>
              </div>
              <div className="budget-form__row">
                <label>
                  <span>Moneda</span>
                  <input
                    type="text"
                    value={currency}
                    onChange={(event) => setCurrency(event.target.value)}
                  />
                </label>
                <label>
                  <span>Fecha de vencimiento</span>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </label>
              </div>
              <label>
                <span>Notas</span>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </label>

              {formError && <p className="form-error">{formError}</p>}

              <div className="clients-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving ? "Guardando..." : "Crear cobranza"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    setClientId("");
                    setProjectId("");
                    setTotalAmount(0);
                    setLaborAmountPending(0);
                    setCurrency("ARS");
                    setDueDate("");
                    setNotes("");
                    setFormError(null);
                  }}
                >
                  Reiniciar
                </button>
              </div>
            </form>
          </article>
        )}
      </div>
    </section>
  );
}
