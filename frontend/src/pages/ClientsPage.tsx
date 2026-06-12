import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { FormPopup } from "../components/FormPopup";
import { Pagination } from "../components/Pagination";

import {
  createClientApi,
  deleteClientApi,
  getClientsApi,
  updateClientApi,
  type ClientInput,
  type ClientItem,
} from "../services/erp-api";
import { formatDate } from "../utils/formatters";

const PAGE_SIZE = 10;

type ClientFormState = ClientInput;

const emptyFormState: ClientFormState = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

function buildFormFromClient(client?: ClientItem | null): ClientFormState {
  return {
    name: client?.name ?? "",
    contactName: client?.contactName ?? "",
    email: client?.email ?? "",
    phone: client?.phone ?? "",
    notes: client?.notes ?? "",
  };
}

export function ClientsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<ClientItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClientId, setEditingClientId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ClientFormState>(emptyFormState);
  const [initialFormState, setInitialFormState] =
    useState<ClientFormState>(emptyFormState);
  const [isFormPopupOpen, setIsFormPopupOpen] = useState(false);
  const [isFormPopupMinimized, setIsFormPopupMinimized] = useState(false);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getClientsApi({
          page: safePage,
          limit: PAGE_SIZE,
          search: search || undefined,
          activeOnly,
        });

        if (!active) {
          return;
        }

        setRows(data.items);
        setTotalPages(Math.max(data.pagination.totalPages, 1));
      } catch {
        if (!active) {
          return;
        }

        setError("No se pudieron cargar los clientes");
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
  }, [safePage, search, activeOnly]);

  const stats = useMemo(() => {
    const total = rows.length;
    const active = rows.filter((row) => row.isActive).length;
    const withEmail = rows.filter((row) => Boolean(row.email)).length;
    const withPhone = rows.filter((row) => Boolean(row.phone)).length;

    return { total, active, withEmail, withPhone };
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
    setEditingClientId(null);
    setFormState(emptyFormState);
    setInitialFormState(emptyFormState);
    setFormError(null);
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const startEdit = (client: ClientItem) => {
    const baseFormState = buildFormFromClient(client);
    setEditingClientId(client._id);
    setFormState(baseFormState);
    setInitialFormState(baseFormState);
    setFormError(null);
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const hasUnsavedChanges =
    JSON.stringify(formState) !== JSON.stringify(initialFormState);

  const handleMinimizeFormPopup = () => {
    setIsFormPopupOpen(false);
    setIsFormPopupMinimized(true);
  };

  const handleRestoreFormPopup = () => {
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const closeAndResetForm = () => {
    setEditingClientId(null);
    setFormState(emptyFormState);
    setInitialFormState(emptyFormState);
    setFormError(null);
    setIsFormPopupOpen(false);
    setIsFormPopupMinimized(false);
  };

  const handleRequestCloseFormPopup = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm("Hay cambios sin guardar. ¿Deseas cerrar y descartarlos?")
    ) {
      return;
    }

    closeAndResetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload: ClientInput = {
      name: formState.name.trim(),
      ...(formState.contactName?.trim()
        ? { contactName: formState.contactName.trim() }
        : {}),
      ...(formState.email?.trim() ? { email: formState.email.trim() } : {}),
      ...(formState.phone?.trim() ? { phone: formState.phone.trim() } : {}),
      ...(formState.notes?.trim() ? { notes: formState.notes.trim() } : {}),
    };

    try {
      if (editingClientId) {
        await updateClientApi(editingClientId, payload);
      } else {
        await createClientApi(payload);
      }

      closeAndResetForm();

      const data = await getClientsApi({
        page: safePage,
        limit: PAGE_SIZE,
        search: search || undefined,
        activeOnly,
      });
      setRows(data.items);
      setTotalPages(Math.max(data.pagination.totalPages, 1));
    } catch {
      setFormError("No se pudo guardar el cliente");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: ClientItem) => {
    const confirmed = window.confirm(`Eliminar ${client.name}?`);
    if (!confirmed) {
      return;
    }

    try {
      await deleteClientApi(client._id);

      const data = await getClientsApi({
        page: safePage,
        limit: PAGE_SIZE,
        search: search || undefined,
        activeOnly,
      });
      setRows(data.items);
      setTotalPages(Math.max(data.pagination.totalPages, 1));

      if (editingClientId === client._id) {
        closeAndResetForm();
      }
    } catch {
      setFormError("No se pudo eliminar el cliente");
    }
  };

  const handleClientAction = async (
    client: ClientItem,
    action: "edit" | "delete",
  ) => {
    if (action === "edit") {
      startEdit(client);
      return;
    }

    await handleDelete(client);
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Comercial · Clientes</p>

      <header className="page-header">
        <div>
          <h2>Clientes</h2>
          <p>Listado operativo de clientes con alta, edicion y baja logica.</p>
        </div>
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={startCreate}
          >
            Nuevo cliente
          </button>
          {isFormPopupMinimized && (
            <button
              className="btn btn-tertiary"
              type="button"
              onClick={handleRestoreFormPopup}
            >
              Restaurar formulario
            </button>
          )}
          <button className="btn btn-primary" type="button">
            Importar clientes
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Clientes visibles</h3>
          <strong>{stats.total}</strong>
          <small className="kpi-neutral">Filtrados por búsqueda</small>
        </article>
        <article className="kpi-card">
          <h3>Activos</h3>
          <strong className="kpi-positive">{stats.active}</strong>
          <small>Habilitados para operar</small>
        </article>
        <article className="kpi-card">
          <h3>Con email</h3>
          <strong>{stats.withEmail}</strong>
          <small>Contacto digital disponible</small>
        </article>
        <article className="kpi-card">
          <h3>Con teléfono</h3>
          <strong>{stats.withPhone}</strong>
          <small>Contacto telefónico disponible</small>
        </article>
      </div>

      <article className="panel">
        <div className="clients-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Nombre, email o contacto"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <label className="clients-toggle">
            <span>Visibilidad</span>
            <select
              value={activeOnly ? "active" : "all"}
              onChange={(event) =>
                setFilter(
                  "activeOnly",
                  event.target.value === "active" ? "" : "false",
                )
              }
            >
              <option value="active">Activos</option>
              <option value="all">Todos</option>
            </select>
          </label>
        </div>
      </article>

      <div className="panel-grid clients-layout">
        <article className="panel clients-panel">
          <div className="table-wrapper">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Contacto</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Alta</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando clientes...
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
                      No hay clientes para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((client) => (
                    <tr key={client._id}>
                      <td>
                        <div className="project-cell">
                          <strong>{client.name}</strong>
                          <small>{client.notes ?? "Sin notas"}</small>
                        </div>
                      </td>
                      <td>{client.contactName ?? "Sin contacto"}</td>
                      <td>{client.email ?? "-"}</td>
                      <td>{client.phone ?? "-"}</td>
                      <td>{formatDate(client.createdAt)}</td>
                      <td>
                        <span
                          className={`chip ${client.isActive ? "chip-aprobado" : "chip-consulta"}`}
                        >
                          {client.isActive ? "Activo" : "Inactivo"}
                        </span>
                      </td>
                      <td>
                        <div className="row-action-buttons">
                          <button
                            type="button"
                            className="btn btn-tertiary btn-emoji-action"
                            title="Editar"
                            aria-label="Editar cliente"
                            onClick={() => void handleClientAction(client, "edit")}
                          >
                            ✏️
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-emoji-action"
                            title="Eliminar"
                            aria-label="Eliminar cliente"
                            onClick={() =>
                              void handleClientAction(client, "delete")
                            }
                          >
                            🗑️
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

      </div>

      <FormPopup
        isOpen={isFormPopupOpen}
        title={editingClientId ? "Editar cliente" : "Nuevo cliente"}
        subtitle={
          editingClientId
            ? "Ajusta datos y guarda cambios."
            : "Carga un cliente nuevo para operar el flujo comercial."
        }
        onMinimize={handleMinimizeFormPopup}
        onRequestClose={handleRequestCloseFormPopup}
      >
        <form
          className="clients-form"
          onSubmit={(event) => void handleSubmit(event)}
        >
          <label>
            <span>Nombre *</span>
            <input
              type="text"
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
          <label>
            <span>Contacto</span>
            <input
              type="text"
              value={formState.contactName ?? ""}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  contactName: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={formState.email ?? ""}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Teléfono</span>
            <input
              type="text"
              value={formState.phone ?? ""}
              onChange={(event) =>
                setFormState((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
            />
          </label>
          <label>
            <span>Notas</span>
            <textarea
              rows={5}
              value={formState.notes ?? ""}
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
                : editingClientId
                  ? "Guardar cambios"
                  : "Crear cliente"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                const base = editingClientId ? initialFormState : emptyFormState;
                setFormState(base);
                setFormError(null);
              }}
            >
              Reiniciar
            </button>
          </div>
        </form>
      </FormPopup>
    </section>
  );
}
