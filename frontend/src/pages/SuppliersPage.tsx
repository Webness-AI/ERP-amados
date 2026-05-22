import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { Pagination } from "../components/Pagination";
import {
  createSupplierApi,
  deleteSupplierApi,
  getSuppliersApi,
  updateSupplierApi,
  type SupplierInput,
  type SupplierItem,
} from "../services/erp-api";

const PAGE_SIZE = 10;

type SupplierFormState = SupplierInput;

const emptyForm: SupplierFormState = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  notes: "",
};

function formatDate(value?: string): string {
  if (!value) {
    return "Sin fecha";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }
  return date.toLocaleDateString("es-AR");
}

export function SuppliersPage() {
  const { user } = useAuth();
  const canWrite = user?.role === "ADMIN_GENERAL" || user?.role === "ADMIN";

  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<SupplierItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState<SupplierFormState>(emptyForm);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const activeOnly = searchParams.get("activeOnly") !== "false";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const data = await getSuppliersApi({
        page: safePage,
        limit: PAGE_SIZE,
        ...(search ? { search } : {}),
        activeOnly,
      });
      setRows(data.items);
      setTotalPages(Math.max(data.pagination.totalPages, 1));
    } catch {
      setError("No se pudieron cargar los proveedores");
    } finally {
      setIsLoading(false);
    }
  }, [activeOnly, safePage, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [load]);

  const stats = useMemo(() => {
    const total = rows.length;
    const withEmail = rows.filter((row) => Boolean(row.email)).length;
    const withPhone = rows.filter((row) => Boolean(row.phone)).length;
    return { total, withEmail, withPhone };
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

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const payload: SupplierInput = {
      name: formState.name.trim(),
      ...(formState.contactName?.trim()
        ? { contactName: formState.contactName.trim() }
        : {}),
      ...(formState.email?.trim() ? { email: formState.email.trim() } : {}),
      ...(formState.phone?.trim() ? { phone: formState.phone.trim() } : {}),
      ...(formState.notes?.trim() ? { notes: formState.notes.trim() } : {}),
    };

    if (!payload.name || payload.name.length < 2) {
      setFormError("El nombre del proveedor debe tener al menos 2 caracteres");
      return;
    }

    setIsSaving(true);
    try {
      await createSupplierApi(payload);
      setFormState(emptyForm);
      await load();
    } catch {
      setFormError("No se pudo crear el proveedor");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (supplier: SupplierItem) => {
    const name = window.prompt("Nombre", supplier.name)?.trim();
    if (!name) {
      return;
    }

    const contactName = window.prompt("Contacto", supplier.contactName ?? "");
    const email = window.prompt("Email", supplier.email ?? "");
    const phone = window.prompt("Teléfono", supplier.phone ?? "");
    const notes = window.prompt("Notas", supplier.notes ?? "");

    try {
      await updateSupplierApi(supplier._id, {
        name,
        contactName: contactName?.trim() || undefined,
        email: email?.trim() || undefined,
        phone: phone?.trim() || undefined,
        notes: notes?.trim() || undefined,
      });
      await load();
    } catch {
      setFormError("No se pudo actualizar el proveedor");
    }
  };

  const handleDelete = async (supplier: SupplierItem) => {
    if (!window.confirm(`Eliminar proveedor ${supplier.name}?`)) {
      return;
    }

    try {
      await deleteSupplierApi(supplier._id);
      await load();
    } catch {
      setFormError("No se pudo eliminar el proveedor");
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Abastecimiento · Proveedores</p>

      <header className="page-header">
        <div>
          <h2>Proveedores</h2>
          <p>Gestión mínima operativa de proveedores activos.</p>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Proveedores visibles</h3>
          <strong>{stats.total}</strong>
          <small className="kpi-neutral">Página actual</small>
        </article>
        <article className="kpi-card">
          <h3>Con email</h3>
          <strong>{stats.withEmail}</strong>
          <small>Canal digital</small>
        </article>
        <article className="kpi-card">
          <h3>Con teléfono</h3>
          <strong>{stats.withPhone}</strong>
          <small>Contacto directo</small>
        </article>
        <article className="kpi-card">
          <h3>Filtro activo</h3>
          <strong>{activeOnly ? "Activos" : "Todos"}</strong>
          <small>Vista actual</small>
        </article>
      </div>

      {!canWrite && (
        <article className="panel">
          <p className="text-muted">
            Modo solo lectura: no tienes permisos para crear, editar o eliminar.
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
              placeholder="Nombre, contacto o email"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <label className="clients-toggle">
            <span>Estado</span>
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
                  <th>Proveedor</th>
                  <th>Contacto</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Alta</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={6} className="text-center">
                      Cargando proveedores...
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
                      No hay proveedores para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr key={row._id}>
                      <td>
                        <div className="project-cell">
                          <strong>{row.name}</strong>
                          <small>{row.notes ?? "Sin notas"}</small>
                        </div>
                      </td>
                      <td>{row.contactName ?? "-"}</td>
                      <td>{row.email ?? "-"}</td>
                      <td>{row.phone ?? "-"}</td>
                      <td>{formatDate(row.createdAt)}</td>
                      <td>
                        {canWrite ? (
                          <div className="budget-actions">
                            <button
                              type="button"
                              className="btn btn-tertiary"
                              onClick={() => void handleEdit(row)}
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
                        ) : (
                          "Solo lectura"
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
          <article className="panel clients-form-panel">
            <div className="clients-form-header">
              <div>
                <h3>Nuevo proveedor</h3>
                <p>Alta rápida de proveedor para flujo de compras.</p>
              </div>
            </div>

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
                  rows={4}
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
                  {isSaving ? "Guardando..." : "Crear proveedor"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setFormState(emptyForm)}
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
