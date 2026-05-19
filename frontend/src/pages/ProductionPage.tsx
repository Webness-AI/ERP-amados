import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";
import {
  createProductionOrderApi,
  deleteProductionOrderApi,
  getProductionOrdersApi,
  updateProductionOrderApi,
  updateProductionOrderStatusApi,
  type ProductionOrderRecord,
  type ProductionPriority,
  type ProductionStatus,
} from "../services/erp-api";

const PAGE_SIZE = 8;

const statusOptions: Array<{ value: ProductionStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CORTE", label: "Corte" },
  { value: "ARMADO", label: "Armado" },
  { value: "INSTALACION", label: "Instalacion" },
  { value: "FINALIZADO", label: "Finalizado" },
];

const priorityOptions: Array<{
  value: ProductionPriority | "";
  label: string;
}> = [
  { value: "", label: "Todas" },
  { value: "LOW", label: "Baja" },
  { value: "MEDIUM", label: "Media" },
  { value: "HIGH", label: "Alta" },
];

type ProductionFormState = {
  projectId: string;
  title: string;
  priority: ProductionPriority;
  assigneeName: string;
  notes: string;
};

const emptyFormState: ProductionFormState = {
  projectId: "",
  title: "",
  priority: "MEDIUM",
  assigneeName: "",
  notes: "",
};

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

function progressByStatus(status: ProductionStatus): number {
  if (status === "PENDIENTE") {
    return 5;
  }
  if (status === "CORTE") {
    return 35;
  }
  if (status === "ARMADO") {
    return 65;
  }
  if (status === "INSTALACION") {
    return 85;
  }
  return 100;
}

export function ProductionPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ProductionOrderRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<ProductionFormState>(emptyFormState);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as ProductionStatus | "";
  const priority = (searchParams.get("priority") ?? "") as
    | ProductionPriority
    | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getProductionOrdersApi({
          page: safePage,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(status ? { status } : {}),
          ...(priority ? { priority } : {}),
        });

        if (!active) {
          return;
        }

        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
        if (!selectedOrderId && data.items.length > 0) {
          setSelectedOrderId(data.items[0]._id);
        }
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar las ordenes de produccion");
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
  }, [safePage, search, status, priority]);

  useEffect(() => {
    if (!selectedOrderId && rows.length > 0) {
      setSelectedOrderId(rows[0]._id);
    }
  }, [rows, selectedOrderId]);

  const selectedOrder = useMemo(
    () => rows.find((order) => order._id === selectedOrderId) ?? null,
    [rows, selectedOrderId],
  );

  const metrics = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.status !== "FINALIZADO").length;
    const high = rows.filter((row) => row.priority === "HIGH").length;
    const done = rows.filter((row) => row.status === "FINALIZADO").length;
    return { total, active, high, done };
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
    const data = await getProductionOrdersApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));

    if (data.items.length > 0) {
      setSelectedOrderId((current) => current ?? data.items[0]._id);
    } else {
      setSelectedOrderId(null);
    }
  };

  const clearForm = () => {
    setEditingOrderId(null);
    setFormState(emptyFormState);
    setFormError(null);
  };

  const startEdit = (order: ProductionOrderRecord) => {
    setEditingOrderId(order._id);
    setSelectedOrderId(order._id);
    setFormState({
      projectId: order.projectId,
      title: order.title,
      priority: order.priority,
      assigneeName: order.assigneeName ?? "",
      notes: order.notes ?? "",
    });
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const projectId = formState.projectId.trim();
    const title = formState.title.trim();

    if (!projectId) {
      setFormError("El ID del proyecto es obligatorio");
      setIsSaving(false);
      return;
    }

    if (!title || title.length < 2) {
      setFormError("El titulo debe tener al menos 2 caracteres");
      setIsSaving(false);
      return;
    }

    try {
      if (editingOrderId) {
        await updateProductionOrderApi(editingOrderId, {
          title,
          priority: formState.priority,
          assigneeName: formState.assigneeName.trim() || null,
          notes: formState.notes.trim() || null,
        });
      } else {
        await createProductionOrderApi({
          projectId,
          title,
          priority: formState.priority,
          assigneeName: formState.assigneeName.trim() || undefined,
          notes: formState.notes.trim() || undefined,
        });
      }

      await refreshList();
      clearForm();
    } catch {
      setFormError("No se pudo guardar la orden");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    order: ProductionOrderRecord,
    nextStatus: ProductionStatus,
  ) => {
    try {
      await updateProductionOrderStatusApi(order._id, nextStatus);
      await refreshList();
      setSelectedOrderId(order._id);
    } catch {
      setFormError("No se pudo actualizar el estado");
    }
  };

  const handleDelete = async (order: ProductionOrderRecord) => {
    if (!window.confirm(`Eliminar orden ${order.title}?`)) {
      return;
    }

    try {
      await deleteProductionOrderApi(order._id);
      await refreshList();
      if (selectedOrderId === order._id) {
        setSelectedOrderId(null);
      }
      if (editingOrderId === order._id) {
        clearForm();
      }
    } catch {
      setFormError("No se pudo eliminar la orden");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Operaciones · Producción</p>

      <header className="page-header">
        <div>
          <h2>Producción</h2>
          <p>
            Gestión de órdenes de taller, avance operativo y cierre de obra.
          </p>
        </div>
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={clearForm}
          >
            Nueva orden
          </button>
          <button className="btn btn-primary" type="button">
            Ver tablero de planta
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Órdenes visibles</h3>
          <strong>{metrics.total}</strong>
          <small className="kpi-neutral">Con filtros aplicados</small>
        </article>
        <article className="kpi-card">
          <h3>Activas</h3>
          <strong>{metrics.active}</strong>
          <small>En flujo productivo</small>
        </article>
        <article className="kpi-card">
          <h3>Prioridad alta</h3>
          <strong className="kpi-negative">{metrics.high}</strong>
          <small>Seguimiento intensivo</small>
        </article>
        <article className="kpi-card">
          <h3>Finalizadas</h3>
          <strong className="kpi-positive">{metrics.done}</strong>
          <small>Listas para entrega</small>
        </article>
      </div>

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Título o responsable"
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
            <span>Prioridad</span>
            <select
              value={priority}
              onChange={(event) => setFilter("priority", event.target.value)}
            >
              {priorityOptions.map((option) => (
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
                  <th>Orden</th>
                  <th>Proyecto</th>
                  <th>Estado</th>
                  <th>Prioridad</th>
                  <th>Inicio</th>
                  <th>Fin</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando órdenes...
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
                      No hay órdenes para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr
                      key={row._id}
                      className={
                        selectedOrderId === row._id ? "table-row-active" : ""
                      }
                      onClick={() => setSelectedOrderId(row._id)}
                    >
                      <td>
                        <div className="project-cell">
                          <strong>{row.title}</strong>
                          <small>{row.assigneeName ?? "Sin responsable"}</small>
                        </div>
                      </td>
                      <td>{row.projectId.slice(-8)}</td>
                      <td>
                        <span className={`budget-chip budget-chip--${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <span className={`budget-chip budget-chip--${row.priority.toLowerCase()}`}>
                          {row.priority}
                        </span>
                      </td>
                      <td>{formatDate(row.startedAt)}</td>
                      <td>{formatDate(row.finishedAt)}</td>
                      <td>
                        <div className="budget-actions">
                          <button
                            type="button"
                            className="btn btn-tertiary"
                            onClick={() => startEdit(row)}
                          >
                            Editar
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
                <h3>Transicion de estado</h3>
                <p>Actualiza el avance de la orden seleccionada.</p>
              </div>
              {selectedOrder && (
                <span
                  className={`budget-chip budget-chip--${selectedOrder.status.toLowerCase()}`}
                >
                  {selectedOrder.status}
                </span>
              )}
            </div>

            {!selectedOrder && (
              <p className="text-muted">
                Selecciona una orden para operar su estado.
              </p>
            )}

            {selectedOrder && (
              <div className="production-status-grid">
                {statusOptions
                  .filter((option) => option.value)
                  .map((option) => {
                    const value = option.value as ProductionStatus;
                    const isCurrent = selectedOrder.status === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`btn ${isCurrent ? "btn-primary" : "btn-secondary"}`}
                        onClick={() =>
                          void handleStatusChange(selectedOrder, value)
                        }
                      >
                        {option.label}
                      </button>
                    );
                  })}

                <div className="production-progress-card">
                  <span>Avance estimado</span>
                  <strong>{progressByStatus(selectedOrder.status)}%</strong>
                  <small>
                    Inicio: {formatDate(selectedOrder.startedAt)} | Fin:{" "}
                    {formatDate(selectedOrder.finishedAt)}
                  </small>
                </div>
              </div>
            )}
          </article>

          <article className="panel budget-form-panel">
            <div className="clients-form-header">
              <div>
                <h3>{editingOrderId ? "Editar orden" : "Nueva orden"}</h3>
                <p>
                  {editingOrderId
                    ? "Ajusta datos de trabajo y prioridad."
                    : "Carga una orden productiva vinculada a un proyecto."}
                </p>
              </div>
              {editingOrderId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={clearForm}
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
                <span>ID proyecto *</span>
                <input
                  type="text"
                  value={formState.projectId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      projectId: event.target.value,
                    }))
                  }
                  required
                  disabled={Boolean(editingOrderId)}
                />
              </label>
              <label>
                <span>Titulo *</span>
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
              <div className="budget-form__row">
                <label>
                  <span>Prioridad</span>
                  <select
                    value={formState.priority}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        priority: event.target.value as ProductionPriority,
                      }))
                    }
                  >
                    <option value="LOW">Baja</option>
                    <option value="MEDIUM">Media</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </label>
                <label>
                  <span>Responsable</span>
                  <input
                    type="text"
                    value={formState.assigneeName}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        assigneeName: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              <label>
                <span>Notas</span>
                <textarea
                  rows={4}
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
                    : editingOrderId
                      ? "Guardar cambios"
                      : "Crear orden"}
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
