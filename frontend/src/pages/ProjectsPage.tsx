import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { Pagination } from "../components/Pagination";

import {
  deleteProjectApi,
  downloadNonFinalizedProjectsPdfApi,
  downloadProjectPdfApi,
  getBudgetByIdApi,
  getProjectByIdApi,
  getProjectsApi,
  updateProjectApi,
  updateProjectStatusApi,
  type BudgetRecord,
  type ProjectItem,
  type ProjectStatus,
} from "../services/erp-api";
import { formatDate, formatDateTime, formatMoneyWithCurrency } from "../utils/formatters";

function getProgressByStatus(status: ProjectStatus): number {
  switch (status) {
    case "PRODUCCION":
      return 68;
    case "INSTALACION":
      return 90;
    case "APROBADO":
      return 45;
    case "PAUSADO":
      return 20;
    case "FINALIZADO":
      return 100;
    default:
      return 12;
  }
}

function getPaymentLabel(status: ProjectStatus): string {
  switch (status) {
    case "FINALIZADO":
      return "SALDADO";
    case "INSTALACION":
      return "CUOTA 2/5";
    case "PRODUCCION":
      return "PENDIENTE";
    case "PAUSADO":
      return "SEÑA";
    default:
      return "EN REVISION";
  }
}

const PAGE_SIZE = 8;
const PROJECT_STATUS_OPTIONS: ProjectStatus[] = [
  "CONSULTA",
  "PRESUPUESTADO",
  "APROBADO",
  "COMPRADO",
  "PRODUCCION",
  "INSTALACION",
  "PAUSADO",
  "FINALIZADO",
  "CANCELADO",
];

export function ProjectsPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ProjectItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [selectedProject, setSelectedProject] = useState<ProjectItem | null>(
    null,
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isLoadingBudgetDetail, setIsLoadingBudgetDetail] = useState(false);
  const [budgetDetailError, setBudgetDetailError] = useState<string | null>(
    null,
  );
  const [selectedBudget, setSelectedBudget] = useState<BudgetRecord | null>(
    null,
  );
  const [nextStatus, setNextStatus] = useState<ProjectStatus | "">("");
  const [isDownloadingBulkPdf, setIsDownloadingBulkPdf] = useState(false);
  const [downloadingProjectPdfId, setDownloadingProjectPdfId] = useState<
    string | null
  >(null);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as ProjectStatus | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const canWrite = user?.role === "ADMIN_GENERAL" || user?.role === "ADMIN";

  const statusCounts = useMemo(() => {
    return PROJECT_STATUS_OPTIONS.reduce(
      (acc, currentStatus) => ({
        ...acc,
        [currentStatus]: rows.filter((row) => row.status === currentStatus)
          .length,
      }),
      {} as Record<ProjectStatus, number>,
    );
  }, [rows]);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getProjectsApi({
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
        if (data.items.length > 0) {
          setSelectedProjectId((currentSelectedProjectId) => {
            if (
              !currentSelectedProjectId ||
              !data.items.some(
                (project) => project._id === currentSelectedProjectId,
              )
            ) {
              return data.items[0]._id;
            }

            return currentSelectedProjectId;
          });
        }
        if (data.items.length === 0) {
          setSelectedProjectId(null);
          setSelectedProject(null);
        }
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
  }, [safePage, search, status]);

  useEffect(() => {
    if (!selectedProjectId) {
      return;
    }

    const loadDetail = async () => {
      setIsLoadingDetail(true);
      setActionError(null);

      try {
        const project = await getProjectByIdApi(selectedProjectId);
        setSelectedProject(project);
        setNextStatus(project.status);
      } catch {
        setActionError("No se pudo cargar el detalle del proyecto");
      } finally {
        setIsLoadingDetail(false);
      }
    };

    void loadDetail();
  }, [selectedProjectId]);

  useEffect(() => {
    if (!selectedProject?.budgetId) {
      setSelectedBudget(null);
      setBudgetDetailError(null);
      setIsLoadingBudgetDetail(false);
      return;
    }

    let active = true;

    const loadBudgetDetail = async () => {
      setIsLoadingBudgetDetail(true);
      setBudgetDetailError(null);

      try {
        const budget = await getBudgetByIdApi(selectedProject.budgetId as string);
        if (!active) {
          return;
        }
        setSelectedBudget(budget);
      } catch {
        if (!active) {
          return;
        }
        setSelectedBudget(null);
        setBudgetDetailError("No se pudo cargar el detalle del presupuesto vinculado");
      } finally {
        if (active) {
          setIsLoadingBudgetDetail(false);
        }
      }
    };

    void loadBudgetDetail();

    return () => {
      active = false;
    };
  }, [selectedProject]);

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

  const refreshRows = async () => {
    const data = await getProjectsApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });
    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));
  };

  const applyStatus = async () => {
    if (
      !selectedProject ||
      !nextStatus ||
      selectedProject.status === nextStatus
    ) {
      return;
    }

    setActionError(null);
    try {
      const updated = await updateProjectStatusApi(
        selectedProject._id,
        nextStatus,
      );
      setSelectedProject(updated);
      await refreshRows();
    } catch {
      setActionError("No se pudo actualizar el estado del proyecto");
    }
  };

  const handleEditProject = async (row: ProjectItem) => {
    const nextName = window.prompt("Nombre del proyecto", row.name);
    if (nextName === null) {
      return;
    }

    const trimmedName = nextName.trim();
    if (trimmedName.length < 2) {
      setActionError("El nombre del proyecto debe tener al menos 2 caracteres");
      return;
    }

    const nextDescription = window.prompt(
      "Descripcion del proyecto",
      row.description ?? "",
    );
    if (nextDescription === null) {
      return;
    }

    const defaultDeliveryDate = row.deliveryDate
      ? row.deliveryDate.slice(0, 10)
      : "";
    const nextDeliveryDate = window.prompt(
      "Fecha de entrega (YYYY-MM-DD, vacio para quitar)",
      defaultDeliveryDate,
    );
    if (nextDeliveryDate === null) {
      return;
    }

    setActionError(null);

    try {
      const payload = {
        name: trimmedName,
        ...(nextDescription.trim()
          ? { description: nextDescription.trim() }
          : { description: "" }),
        ...(nextDeliveryDate.trim()
          ? {
              deliveryDate: new Date(
                `${nextDeliveryDate.trim()}T00:00:00.000Z`,
              ).toISOString(),
            }
          : {}),
      };

      const updated = await updateProjectApi(row._id, payload);
      await refreshRows();

      if (selectedProjectId === row._id) {
        setSelectedProject(updated);
        setNextStatus(updated.status);
      }
    } catch {
      setActionError("No se pudo editar el proyecto");
    }
  };

  const handleDeleteProject = async (row: ProjectItem) => {
    if (!window.confirm(`Eliminar ${row.name}?`)) {
      return;
    }

    setActionError(null);

    try {
      await deleteProjectApi(row._id);
      await refreshRows();

      if (selectedProjectId === row._id) {
        setSelectedProjectId(null);
        setSelectedProject(null);
        setNextStatus("");
      }
    } catch {
      setActionError("No se pudo eliminar el proyecto");
    }
  };

  const handleProjectAction = async (
    row: ProjectItem,
    action: "view" | "edit" | "delete" | "print",
  ) => {
    if (action === "view") {
      setSelectedProjectId(row._id);
      return;
    }

    if (action === "print") {
      setActionError(null);
      setDownloadingProjectPdfId(row._id);
      try {
        const blob = await downloadProjectPdfApi(row._id);
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `proyecto-${row._id}.pdf`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      } catch {
        setActionError("No se pudo descargar el PDF del proyecto");
      } finally {
        setDownloadingProjectPdfId(null);
      }
      return;
    }

    if (action === "edit") {
      await handleEditProject(row);
      return;
    }

    await handleDeleteProject(row);
  };

  const handleDownloadNonFinalizedProjectsPdf = async () => {
    setActionError(null);
    setIsDownloadingBulkPdf(true);

    try {
      const blob = await downloadNonFinalizedProjectsPdfApi();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `proyectos-no-finalizados-${Date.now()}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setActionError("No se pudo descargar el PDF de proyectos no finalizados");
    } finally {
      setIsDownloadingBulkPdf(false);
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Administración · Gestión de Proyectos</p>

      <header className="page-header">
        <div>
          <h2>Gestión de Proyectos</h2>
          <p>Control de producción y estados de montaje en tiempo real.</p>
        </div>
        <div className="project-toolbar-row">
          <div className="view-switch">
            <button type="button" className="view-switch__item view-switch__item--active">
              Tabla
            </button>
            <button type="button" className="view-switch__item">
              Kanban
            </button>
            <button type="button" className="view-switch__item">
              Gantt
            </button>
          </div>
          <div className="view-controls">
            <button type="button" className="btn btn-ghost">
              Filtros
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              disabled={isDownloadingBulkPdf}
              onClick={() => void handleDownloadNonFinalizedProjectsPdf()}
            >
              {isDownloadingBulkPdf ? "Generando PDF..." : "PDF no finalizados"}
            </button>
          </div>
        </div>
      </header>

      <div className="pill-filters">
        <button
          type="button"
          className={`pill-filter ${status === "" ? "pill-filter--active" : ""}`}
          onClick={() => setFilter("status", "")}
        >
          Todos los proyectos <span>{rows.length}</span>
        </button>
        <button
          type="button"
          className={`pill-filter ${status === "PRODUCCION" ? "pill-filter--active" : ""}`}
          onClick={() => setFilter("status", "PRODUCCION")}
        >
          En producción <span>{statusCounts.PRODUCCION ?? 0}</span>
        </button>
        <button
          type="button"
          className={`pill-filter ${status === "INSTALACION" ? "pill-filter--active" : ""}`}
          onClick={() => setFilter("status", "INSTALACION")}
        >
          En instalación <span>{statusCounts.INSTALACION ?? 0}</span>
        </button>
        <button
          type="button"
          className={`pill-filter ${status === "FINALIZADO" ? "pill-filter--active" : ""}`}
          onClick={() => setFilter("status", "FINALIZADO")}
        >
          Finalizados <span>{statusCounts.FINALIZADO ?? 0}</span>
        </button>
      </div>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Proyectos visibles</h3>
          <strong>{rows.length}</strong>
          <small className="kpi-neutral">Página actual</small>
        </article>
        <article className="kpi-card">
          <h3>En producción</h3>
          <strong>{statusCounts.PRODUCCION ?? 0}</strong>
          <small>Estado PRODUCCION</small>
        </article>
        <article className="kpi-card">
          <h3>Instalación</h3>
          <strong>{statusCounts.INSTALACION ?? 0}</strong>
          <small>Estado INSTALACION</small>
        </article>
        <article className="kpi-card">
          <h3>Finalizados</h3>
          <strong className="kpi-positive">
            {statusCounts.FINALIZADO ?? 0}
          </strong>
          <small>Estado FINALIZADO</small>
        </article>
      </div>

      {!canWrite && (
        <article className="panel">
          <p className="text-muted">
            Modo solo lectura: tu rol no tiene permisos para actualizar estados.
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
              placeholder="Nombre o descripción"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <label className="clients-toggle">
            <span>Estado</span>
            <select
              value={status}
              onChange={(event) =>
                setFilter("status", event.target.value as ProjectStatus | "")
              }
            >
              <option value="">Todos</option>
              {PROJECT_STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
        </div>

        {actionError && (
          <article className="panel panel--warning">
            <h3>Operación no completada</h3>
            <p>{actionError}</p>
          </article>
        )}

        <div className="table-wrapper projects-table-wrapper">
          <table className="table table-compact project-table">
            <thead>
              <tr>
                <th>Proyecto & cliente</th>
                <th>Estado</th>
                <th>Progreso de obra</th>
                <th>Entrega</th>
                <th>Pagos</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="text-center">
                    Cargando proyectos...
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={6} className="text-negative text-center">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center">
                    No hay proyectos para mostrar
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                rows.map((row) => {
                  const progress = getProgressByStatus(row.status);
                  const paymentLabel = getPaymentLabel(row.status);
                  return (
                    <tr key={row._id}>
                      <td>
                        <div className="project-cell">
                          <strong>{row.name}</strong>
                          <small>{row.description ?? row.clientId.slice(-8)}</small>
                        </div>
                      </td>
                      <td>
                        <span className={`chip chip-${row.status.toLowerCase()}`}>
                          {row.status}
                        </span>
                      </td>
                      <td>
                        <div className="progress-inline">
                          <span>{progress}%</span>
                          <div className="progress-bar">
                            <div
                              className="progress-fill"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="project-cell">
                          <strong>{formatDate(row.deliveryDate)}</strong>
                          <small>{row.status === "PRODUCCION" ? "En curso" : "Planificado"}</small>
                        </div>
                      </td>
                      <td>
                        <div className="project-cell">
                          <strong>${(row.name.length * 12000).toLocaleString("es-AR")}</strong>
                          <small>{paymentLabel}</small>
                        </div>
                      </td>
                      <td>
                        <div className="row-action-buttons">
                          <button
                            type="button"
                            className="btn btn-tertiary btn-emoji-action"
                            title="Ver detalle"
                            aria-label="Ver detalle del proyecto"
                            onClick={() => void handleProjectAction(row, "view")}
                          >
                            👁️
                          </button>
                          <button
                            type="button"
                            className="btn btn-tertiary btn-emoji-action"
                            title="Imprimir PDF"
                            aria-label="Imprimir PDF del proyecto"
                            disabled={downloadingProjectPdfId === row._id}
                            onClick={() => void handleProjectAction(row, "print")}
                          >
                            {downloadingProjectPdfId === row._id ? "⏳" : "🖨️"}
                          </button>
                          {canWrite && (
                            <button
                              type="button"
                              className="btn btn-tertiary btn-emoji-action"
                              title="Editar"
                              aria-label="Editar proyecto"
                              onClick={() =>
                                void handleProjectAction(row, "edit")
                              }
                            >
                              ✏️
                            </button>
                          )}
                          {canWrite && (
                            <button
                              type="button"
                              className="btn btn-ghost btn-emoji-action"
                              title="Eliminar"
                              aria-label="Eliminar proyecto"
                              onClick={() =>
                                void handleProjectAction(row, "delete")
                              }
                            >
                              🗑️
                            </button>
                          )}
                        </div>
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

      <article className="panel budget-detail-panel">
        <div className="budget-detail-header">
          <div>
            <h3>Detalle de proyecto</h3>
            <p>Información real del proyecto seleccionado.</p>
          </div>
        </div>

        {isLoadingDetail && <p className="text-muted">Cargando detalle...</p>}
        {!isLoadingDetail && !selectedProject && (
          <p className="text-muted">
            Selecciona un proyecto para ver su detalle.
          </p>
        )}

        {!isLoadingDetail && selectedProject && (
          <div className="budget-detail">
            <div className="budget-detail__meta">
              <div>
                <span>ID proyecto</span>
                <strong>{selectedProject._id}</strong>
              </div>
              <div>
                <span>Proyecto</span>
                <strong>{selectedProject.name}</strong>
              </div>
              <div>
                <span>ID cliente</span>
                <strong>{selectedProject.clientId}</strong>
              </div>
              <div>
                <span>ID presupuesto</span>
                <strong>{selectedProject.budgetId ?? "-"}</strong>
              </div>
              <div>
                <span>Estado</span>
                <strong>{selectedProject.status}</strong>
              </div>
              <div>
                <span>Activo</span>
                <strong>{selectedProject.isActive ? "Si" : "No"}</strong>
              </div>
              <div>
                <span>Entrega</span>
                <strong>{formatDate(selectedProject.deliveryDate)}</strong>
              </div>
              <div>
                <span>Localidad</span>
                <strong>{selectedProject.localidad ?? "-"}</strong>
              </div>
              <div>
                <span>Contacto</span>
                <strong>{selectedProject.contacto ?? "-"}</strong>
              </div>
              <div>
                <span>Dirección</span>
                <strong>{selectedProject.direccion ?? "-"}</strong>
              </div>
              <div>
                <span>Creado</span>
                <strong>{formatDate(selectedProject.createdAt)}</strong>
              </div>
              <div>
                <span>Actualizado</span>
                <strong>{formatDate(selectedProject.updatedAt)}</strong>
              </div>
              <div>
                <span>Creado por</span>
                <strong>{selectedProject.createdBy ?? "-"}</strong>
              </div>
              <div>
                <span>Actualizado por</span>
                <strong>{selectedProject.updatedBy ?? "-"}</strong>
              </div>
            </div>

            <p className="panel-subtitle">
              {selectedProject.description ?? "Sin descripción registrada."}
            </p>

            <hr />

            <div className="budget-detail-header">
              <div>
                <h3>Detalle principal del proyecto (presupuesto)</h3>
                <p>Desglose comercial y técnico del presupuesto vinculado.</p>
              </div>
            </div>

            {!selectedProject.budgetId && (
              <p className="text-muted">
                Este proyecto no tiene presupuesto vinculado.
              </p>
            )}

            {selectedProject.budgetId && isLoadingBudgetDetail && (
              <p className="text-muted">Cargando detalle del presupuesto...</p>
            )}

            {selectedProject.budgetId && !isLoadingBudgetDetail && budgetDetailError && (
              <p className="text-negative">{budgetDetailError}</p>
            )}

            {selectedProject.budgetId && !isLoadingBudgetDetail && selectedBudget && (
              <>
                <div className="budget-detail__meta">
                  <div>
                    <span>ID presupuesto</span>
                    <strong>{selectedBudget._id}</strong>
                  </div>
                  <div>
                    <span>Título</span>
                    <strong>{selectedBudget.title}</strong>
                  </div>
                  <div>
                    <span>Estado presupuesto</span>
                    <strong>{selectedBudget.status}</strong>
                  </div>
                  <div>
                    <span>Versión</span>
                    <strong>{selectedBudget.version}</strong>
                  </div>
                  <div>
                    <span>Moneda</span>
                    <strong>{selectedBudget.currency}</strong>
                  </div>
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.subtotal,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.total,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Precio final</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.finalPrice ?? selectedBudget.total,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Costo materiales</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.materialsCost ?? 0,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Mano de obra</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.laborCost ?? 0,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Horas MO</span>
                    <strong>{selectedBudget.laborHours ?? 0}</strong>
                  </div>
                  <div>
                    <span>Costo proyecto</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.projectCost ?? 0,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Margen</span>
                    <strong>{selectedBudget.marginPercent ?? 0}%</strong>
                  </div>
                  <div>
                    <span>Monto margen</span>
                    <strong>
                      {formatMoneyWithCurrency(
                        selectedBudget.marginAmount ?? 0,
                        selectedBudget.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Aprobado</span>
                    <strong>{formatDateTime(selectedBudget.approvedAt)}</strong>
                  </div>
                  <div>
                    <span>Última actualización</span>
                    <strong>{formatDateTime(selectedBudget.updatedAt)}</strong>
                  </div>
                </div>

                <p className="panel-subtitle">
                  {selectedBudget.description ?? "Sin descripción en presupuesto."}
                </p>

                <h4>Rubros del presupuesto</h4>
                <div className="table-wrapper">
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Descripción</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBudget.items.length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center">
                            Sin rubros cargados.
                          </td>
                        </tr>
                      )}
                      {selectedBudget.items.map((item, index) => (
                        <tr key={`${item.description}-${index}`}>
                          <td>{item.description}</td>
                          <td>{item.quantity}</td>
                          <td>
                            {formatMoneyWithCurrency(
                              item.unitPrice,
                              selectedBudget.currency,
                            )}
                          </td>
                          <td>
                            {formatMoneyWithCurrency(item.total, selectedBudget.currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <h4>Materiales del presupuesto</h4>
                <div className="table-wrapper">
                  <table className="table table-compact">
                    <thead>
                      <tr>
                        <th>Material ID</th>
                        <th>Cantidad</th>
                        <th>Precio unitario</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedBudget.materials ?? []).length === 0 && (
                        <tr>
                          <td colSpan={4} className="text-center">
                            Sin materiales cargados.
                          </td>
                        </tr>
                      )}
                      {(selectedBudget.materials ?? []).map((material, index) => (
                        <tr key={`${material.materialId}-${index}`}>
                          <td>{material.materialId}</td>
                          <td>{material.quantity}</td>
                          <td>
                            {formatMoneyWithCurrency(
                              material.unitPrice,
                              selectedBudget.currency,
                            )}
                          </td>
                          <td>
                            {formatMoneyWithCurrency(
                              material.total,
                              selectedBudget.currency,
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {canWrite && (
              <div className="clients-form-actions">
                <select
                  value={nextStatus}
                  onChange={(event) =>
                    setNextStatus(event.target.value as ProjectStatus)
                  }
                >
                  {PROJECT_STATUS_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => void applyStatus()}
                >
                  Actualizar estado
                </button>
              </div>
            )}
          </div>
        )}
      </article>
    </section>
  );
}
