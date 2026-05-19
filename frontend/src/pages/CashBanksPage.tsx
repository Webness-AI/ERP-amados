import { type FormEvent, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";
import {
  createCashMovementApi,
  getCashMovementsApi,
  type CashDirection,
  type CashMovementRecord,
  type CashPaymentMethod,
  type CashSource,
} from "../services/erp-api";

const PAGE_SIZE = 10;

const sourceOptions: Array<{ value: CashSource | ""; label: string }> = [
  { value: "", label: "Todas" },
  { value: "CASH", label: "Caja" },
  { value: "BANK", label: "Banco" },
];

const directionOptions: Array<{ value: CashDirection | ""; label: string }> = [
  { value: "", label: "Todas" },
  { value: "INCOME", label: "Ingreso" },
  { value: "EXPENSE", label: "Egreso" },
];

const paymentMethodOptions: Array<{
  value: CashPaymentMethod | "";
  label: string;
}> = [
  { value: "", label: "Todos" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "OTRO", label: "Otro" },
];

type CashMovementFormState = {
  source: CashSource;
  direction: CashDirection;
  paymentMethod: CashPaymentMethod;
  amount: number;
  currency: string;
  concept: string;
  clientId: string;
  projectId: string;
  referenceType: string;
  referenceId: string;
  occurredAt: string;
};

const emptyFormState: CashMovementFormState = {
  source: "CASH",
  direction: "INCOME",
  paymentMethod: "EFECTIVO",
  amount: 0,
  currency: "ARS",
  concept: "",
  clientId: "",
  projectId: "",
  referenceType: "",
  referenceId: "",
  occurredAt: "",
};

function formatMoney(value: number, currency = "ARS"): string {
  return `${currency} ${value.toLocaleString("es-AR")}`;
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Sin fecha";
  }

  return `${date.toLocaleDateString("es-AR")} ${date.toLocaleTimeString(
    "es-AR",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  )}`;
}

export function CashBanksPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<CashMovementRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] =
    useState<CashMovementFormState>(emptyFormState);

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const source = (searchParams.get("source") ?? "") as CashSource | "";
  const direction = (searchParams.get("direction") ?? "") as CashDirection | "";
  const paymentMethod = (searchParams.get("paymentMethod") ?? "") as
    | CashPaymentMethod
    | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getCashMovementsApi({
          page: safePage,
          limit: PAGE_SIZE,
          ...(search ? { search } : {}),
          ...(source ? { source } : {}),
          ...(direction ? { direction } : {}),
          ...(paymentMethod ? { paymentMethod } : {}),
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

        setError("No se pudieron cargar los movimientos");
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
  }, [safePage, search, source, direction, paymentMethod]);

  const metrics = useMemo(() => {
    const income = rows
      .filter((row) => row.direction === "INCOME")
      .reduce((acc, row) => acc + row.amount, 0);
    const expense = rows
      .filter((row) => row.direction === "EXPENSE")
      .reduce((acc, row) => acc + row.amount, 0);
    const net = income - expense;
    const bank = rows
      .filter((row) => row.source === "BANK")
      .reduce(
        (acc, row) =>
          acc + (row.direction === "INCOME" ? row.amount : -row.amount),
        0,
      );

    return { income, expense, net, bank };
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
    const data = await getCashMovementsApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(source ? { source } : {}),
      ...(direction ? { direction } : {}),
      ...(paymentMethod ? { paymentMethod } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));
  };

  const resetForm = () => {
    setFormState(emptyFormState);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const payload = {
      source: formState.source,
      direction: formState.direction,
      paymentMethod: formState.paymentMethod,
      amount: Number(formState.amount),
      currency: formState.currency.trim() || "ARS",
      concept: formState.concept.trim(),
      clientId: formState.clientId.trim() || undefined,
      projectId: formState.projectId.trim() || undefined,
      referenceType: formState.referenceType.trim() || undefined,
      referenceId: formState.referenceId.trim() || undefined,
      occurredAt: formState.occurredAt
        ? new Date(formState.occurredAt).toISOString()
        : undefined,
    };

    if (!payload.concept || payload.concept.length < 2) {
      setFormError("El concepto debe tener al menos 2 caracteres");
      setIsSaving(false);
      return;
    }

    if (!Number.isFinite(payload.amount) || payload.amount <= 0) {
      setFormError("El monto debe ser mayor a 0");
      setIsSaving(false);
      return;
    }

    try {
      await createCashMovementApi(payload);
      await refreshList();
      resetForm();
    } catch {
      setFormError("No se pudo registrar el movimiento");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Finanzas · Caja y Bancos</p>

      <header className="page-header">
        <div>
          <h2>Caja y Bancos</h2>
          <p>
            Control de ingresos, egresos y trazabilidad de movimientos
            financieros.
          </p>
        </div>
        <div className="view-controls">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={resetForm}
          >
            Nuevo movimiento
          </button>
          <button type="button" className="btn btn-primary">
            Exportar movimientos
          </button>
        </div>
      </header>

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Ingresos visibles</h3>
          <strong className="kpi-positive">
            {formatMoney(metrics.income)}
          </strong>
          <small className="kpi-neutral">Con filtros activos</small>
        </article>
        <article className="kpi-card">
          <h3>Egresos visibles</h3>
          <strong className="kpi-negative">
            {formatMoney(metrics.expense)}
          </strong>
          <small>Gasto operativo de la pagina</small>
        </article>
        <article className="kpi-card">
          <h3>Neto visible</h3>
          <strong>{formatMoney(metrics.net)}</strong>
          <small>Ingreso menos egreso</small>
        </article>
        <article className="kpi-card">
          <h3>Saldo en banco</h3>
          <strong>{formatMoney(metrics.bank)}</strong>
          <small>Movimientos con origen Banco</small>
        </article>
      </div>

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Concepto, referencia o moneda"
              onChange={(event) => setFilter("search", event.target.value)}
            />
          </label>
          <label className="clients-toggle">
            <span>Origen</span>
            <select
              value={source}
              onChange={(event) => setFilter("source", event.target.value)}
            >
              {sourceOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="clients-toggle">
            <span>Dirección</span>
            <select
              value={direction}
              onChange={(event) => setFilter("direction", event.target.value)}
            >
              {directionOptions.map((option) => (
                <option key={option.value || "all"} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className="clients-toggle">
            <span>Método</span>
            <select
              value={paymentMethod}
              onChange={(event) =>
                setFilter("paymentMethod", event.target.value)
              }
            >
              {paymentMethodOptions.map((option) => (
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
                  <th>Fecha</th>
                  <th>Concepto</th>
                  <th>Origen</th>
                  <th>Dirección</th>
                  <th>Método</th>
                  <th>Monto</th>
                  <th>Referencia</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando movimientos...
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
                      No hay movimientos para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((row) => (
                    <tr key={row._id}>
                      <td>{formatDate(row.occurredAt)}</td>
                      <td>
                        <div className="project-cell">
                          <strong>{row.concept}</strong>
                          <small>{row.currency}</small>
                        </div>
                      </td>
                      <td>
                        <span
                          className={`cash-chip cash-chip--${row.source.toLowerCase()}`}
                        >
                          {row.source}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${row.direction.toLowerCase()}`}
                        >
                          {row.direction}
                        </span>
                      </td>
                      <td>{row.paymentMethod}</td>
                      <td className="td-numeric">
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td>
                        {row.referenceType && row.referenceId
                          ? `${row.referenceType}:${row.referenceId}`
                          : "-"}
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

        <article className="panel budget-form-panel">
          <div className="clients-form-header">
            <div>
              <h3>Registrar movimiento</h3>
              <p>Alta manual para caja chica o transacciones bancarias.</p>
            </div>
          </div>

          <form
            className="budget-form"
            onSubmit={(event) => void handleSubmit(event)}
          >
            <div className="budget-form__row">
              <label>
                <span>Origen</span>
                <select
                  value={formState.source}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      source: event.target.value as CashSource,
                    }))
                  }
                >
                  <option value="CASH">Caja</option>
                  <option value="BANK">Banco</option>
                </select>
              </label>
              <label>
                <span>Dirección</span>
                <select
                  value={formState.direction}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      direction: event.target.value as CashDirection,
                    }))
                  }
                >
                  <option value="INCOME">Ingreso</option>
                  <option value="EXPENSE">Egreso</option>
                </select>
              </label>
            </div>

            <div className="budget-form__row">
              <label>
                <span>Método</span>
                <select
                  value={formState.paymentMethod}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      paymentMethod: event.target.value as CashPaymentMethod,
                    }))
                  }
                >
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                  <option value="TARJETA">Tarjeta</option>
                  <option value="CHEQUE">Cheque</option>
                  <option value="OTRO">Otro</option>
                </select>
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
                <span>Fecha y hora</span>
                <input
                  type="datetime-local"
                  value={formState.occurredAt}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      occurredAt: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            <label>
              <span>Concepto *</span>
              <input
                type="text"
                value={formState.concept}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    concept: event.target.value,
                  }))
                }
                required
              />
            </label>

            <div className="budget-form__row">
              <label>
                <span>ID cliente</span>
                <input
                  type="text"
                  value={formState.clientId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      clientId: event.target.value,
                    }))
                  }
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
            </div>

            <div className="budget-form__row">
              <label>
                <span>Tipo de referencia</span>
                <input
                  type="text"
                  value={formState.referenceType}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      referenceType: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                <span>ID de referencia</span>
                <input
                  type="text"
                  value={formState.referenceId}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      referenceId: event.target.value,
                    }))
                  }
                />
              </label>
            </div>

            {formError && <p className="form-error">{formError}</p>}

            <div className="clients-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? "Guardando..." : "Registrar movimiento"}
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
    </section>
  );
}
