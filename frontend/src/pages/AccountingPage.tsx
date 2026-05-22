import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { useAuth } from "../auth/useAuth";
import { Pagination } from "../components/Pagination";

import {
  createJournalEntryApi,
  deleteJournalEntryApi,
  getAccountsApi,
  getBalanceSheetReportApi,
  getJournalEntryByIdApi,
  getIncomeStatementReportApi,
  getJournalEntriesApi,
  getTrialBalanceReportApi,
  reverseJournalEntryApi,
  type AccountRecord,
  type DomainEventName,
  type JournalEntryRecord,
} from "../services/erp-api";
import { formatDate, formatMoney } from "../utils/formatters";

const PAGE_SIZE = 12;
const DELETE_CONFIRMATION_PHRASE = "eliminar asiento/s contable/s";

const originEventOptions: Array<{
  value: "" | DomainEventName;
  label: string;
}> = [
  { value: "", label: "Todos los módulos" },
  { value: "presupuesto_aprobado", label: "Presupuesto aprobado" },
  { value: "material_reservado", label: "Material reservado" },
  { value: "compra_recibida", label: "Compra recibida" },
  { value: "venta_confirmada", label: "Venta confirmada" },
  { value: "gasto_pagado", label: "Gasto pagado" },
  { value: "proyecto_finalizado", label: "Proyecto finalizado" },
];

type JournalLineForm = {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
};

const emptyLine: JournalLineForm = {
  accountCode: "",
  debit: 0,
  credit: 0,
  description: "",
};

function normalizeMoney(value: number): number {
  return Number(value.toFixed(2));
}

function formatOrigin(value?: string | null): string {
  if (!value) {
    return "manual";
  }

  return value.replaceAll("_", " ");
}

export function AccountingPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<JournalEntryRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [trialBalanceTotal, setTrialBalanceTotal] = useState({
    debit: 0,
    credit: 0,
  });
  const [incomeResult, setIncomeResult] = useState({
    income: 0,
    expenses: 0,
    netResult: 0,
  });
  const [balanceSheetTotal, setBalanceSheetTotal] = useState({
    assets: 0,
    liabilities: 0,
    equity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<JournalEntryRecord | null>(
    null,
  );
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showEntryForm, setShowEntryForm] = useState(false);
  const [entryDescription, setEntryDescription] = useState("");
  const [entryCurrency, setEntryCurrency] = useState("ARS");
  const [entryDate, setEntryDate] = useState("");
  const [entryLines, setEntryLines] = useState<JournalLineForm[]>([
    { ...emptyLine },
    { ...emptyLine },
  ]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [accountsLoading, setAccountsLoading] = useState(false);
  const [selectedEntryIds, setSelectedEntryIds] = useState<string[]>([]);
  const [showDeletePopup, setShowDeletePopup] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canWrite = user?.role === "ADMIN_GENERAL" || user?.role === "ADMIN";

  const page = Number(searchParams.get("page") ?? "1");
  const from = searchParams.get("from") ?? "";
  const to = searchParams.get("to") ?? "";
  const originEvent = (searchParams.get("originEvent") ?? "") as
    | ""
    | DomainEventName;
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  const loadAccounts = async () => {
    setAccountsLoading(true);
    try {
      const result = await getAccountsApi({
        page: 1,
        limit: 9999,
        activeOnly: true,
      });
      setAccounts(result.items);
    } catch {
      console.error("No se pudo cargar las cuentas");
      setAccounts([]);
    } finally {
      setAccountsLoading(false);
    }
  };

  const entryTotals = useMemo(() => {
    const debit = normalizeMoney(
      entryLines.reduce((acc, line) => acc + (Number(line.debit) || 0), 0),
    );
    const credit = normalizeMoney(
      entryLines.reduce((acc, line) => acc + (Number(line.credit) || 0), 0),
    );
    return { debit, credit, isBalanced: debit === credit && debit > 0 };
  }, [entryLines]);

  const loadEntries = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const [
        entriesData,
        trialBalanceData,
        incomeStatementData,
        balanceSheetData,
      ] = await Promise.all([
        getJournalEntriesApi({
          page: safePage,
          limit: PAGE_SIZE,
          ...(from ? { from } : {}),
          ...(to ? { to } : {}),
          ...(originEvent ? { originEvent } : {}),
        }),
        getTrialBalanceReportApi({
          from: from || undefined,
          to: to || undefined,
        }),
        getIncomeStatementReportApi({
          from: from || undefined,
          to: to || undefined,
        }),
        getBalanceSheetReportApi({
          from: from || undefined,
          to: to || undefined,
        }),
      ]);

      setRows(entriesData.items);
      setTotalPages(Math.max(entriesData.pagination.totalPages, 1));
      setTrialBalanceTotal(trialBalanceData.totals);
      setIncomeResult(incomeStatementData.totals);
      setBalanceSheetTotal(balanceSheetData.totals);

      if (entriesData.items.length === 0) {
        setSelectedEntryId(null);
        setSelectedEntry(null);
      }

      if (entriesData.items.length > 0) {
        setSelectedEntryId((currentSelectedEntryId) => {
          if (
            !currentSelectedEntryId ||
            !entriesData.items.some(
              (entry) => entry._id === currentSelectedEntryId,
            )
          ) {
            return entriesData.items[0]._id;
          }

          return currentSelectedEntryId;
        });
      }
    } catch {
      setError("No se pudo cargar el libro diario");
    } finally {
      setIsLoading(false);
    }
  }, [from, originEvent, safePage, to]);

  const loadEntryDetail = async (id: string) => {
    setSelectedEntryId(id);
    setIsLoadingDetail(true);
    setActionError(null);

    try {
      const entry = await getJournalEntryByIdApi(id);
      setSelectedEntry(entry);
    } catch {
      setActionError("No se pudo cargar el detalle del asiento");
    } finally {
      setIsLoadingDetail(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadAccounts();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadEntries();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadEntries]);

  useEffect(() => {
    if (!selectedEntryId) {
      return;
    }
    const timer = window.setTimeout(() => {
      void loadEntryDetail(selectedEntryId);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [selectedEntryId]);

  const visibleSelectedEntryIds = useMemo(
    () => selectedEntryIds.filter((id) => rows.some((row) => row._id === id)),
    [selectedEntryIds, rows],
  );

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

  const toggleEntrySelection = (entryId: string) => {
    setSelectedEntryIds((current) =>
      current.includes(entryId)
        ? current.filter((id) => id !== entryId)
        : [...current, entryId],
    );
  };

  const areAllCurrentRowsSelected =
    rows.length > 0 &&
    rows.every((row) => visibleSelectedEntryIds.includes(row._id));

  const toggleSelectAllCurrentRows = () => {
    if (areAllCurrentRowsSelected) {
      setSelectedEntryIds([]);
      return;
    }

    setSelectedEntryIds(rows.map((row) => row._id));
  };

  const addLine = () => {
    setEntryLines((current) => [...current, { ...emptyLine }]);
  };

  const removeLine = (index: number) => {
    setEntryLines((current) =>
      current.length <= 2
        ? current
        : current.filter((_, lineIndex) => lineIndex !== index),
    );
  };

  const updateLine = (
    index: number,
    field: keyof JournalLineForm,
    value: string | number,
  ) => {
    setEntryLines((current) =>
      current.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    );
  };

  const resetForm = () => {
    setEntryDescription("");
    setEntryCurrency("ARS");
    setEntryDate("");
    setEntryLines([{ ...emptyLine }, { ...emptyLine }]);
  };

  const handleCreateEntry = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setActionError(null);

    const description = entryDescription.trim();
    if (description.length < 3) {
      setActionError("La descripción debe tener al menos 3 caracteres");
      return;
    }

    const lines = entryLines
      .map((line) => ({
        accountCode: line.accountCode.trim().toUpperCase(),
        debit: Number(line.debit) || 0,
        credit: Number(line.credit) || 0,
        description: line.description.trim() || undefined,
      }))
      .filter(
        (line) =>
          line.accountCode.length > 0 || line.debit > 0 || line.credit > 0,
      );

    if (lines.length < 2) {
      setActionError("Debes cargar al menos dos líneas contables");
      return;
    }

    for (const line of lines) {
      const hasDebit = line.debit > 0;
      const hasCredit = line.credit > 0;

      if (!line.accountCode) {
        setActionError("Cada línea debe tener código de cuenta");
        return;
      }

      if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
        setActionError(
          "Cada línea debe tener solo Debe o solo Haber, y mayor a 0",
        );
        return;
      }
    }

    const totalDebit = normalizeMoney(
      lines.reduce((acc, line) => acc + line.debit, 0),
    );
    const totalCredit = normalizeMoney(
      lines.reduce((acc, line) => acc + line.credit, 0),
    );

    if (totalDebit !== totalCredit) {
      setActionError("El asiento no esta balanceado (Debe debe igualar Haber)");
      return;
    }

    setIsSaving(true);
    try {
      const created = await createJournalEntryApi({
        description,
        currency: entryCurrency.trim().toUpperCase() || "ARS",
        lines,
        ...(entryDate ? { entryDate: new Date(entryDate).toISOString() } : {}),
      });
      resetForm();
      setShowEntryForm(false);
      await loadEntries();
      await loadEntryDetail(created._id);
      setSelectedEntryId(created._id);
    } catch {
      setActionError("No se pudo crear el asiento manual");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReverse = async (entry: JournalEntryRecord) => {
    const reason = window.prompt("Motivo del reverso:", "Correccion contable");
    if (!reason || reason.trim().length < 3) {
      return;
    }

    setActionError(null);
    try {
      const reversed = await reverseJournalEntryApi(entry._id, reason.trim());
      await loadEntries();
      await loadEntryDetail(reversed._id);
      setSelectedEntryId(reversed._id);
    } catch {
      setActionError("No se pudo revertir el asiento");
    }
  };

  const openDeletePopup = () => {
    setDeletePhrase("");
    setShowDeletePopup(true);
  };

  const closeDeletePopup = () => {
    if (isDeleting) {
      return;
    }

    setShowDeletePopup(false);
    setDeletePhrase("");
  };

  const handleDeleteSelected = async () => {
    if (visibleSelectedEntryIds.length === 0) {
      return;
    }

    if (deletePhrase.trim() !== DELETE_CONFIRMATION_PHRASE) {
      setActionError(
        `Debes escribir exactamente: "${DELETE_CONFIRMATION_PHRASE}"`,
      );
      return;
    }

    setIsDeleting(true);
    setActionError(null);

    try {
      const idsToDelete = [...visibleSelectedEntryIds];
      const results = await Promise.allSettled(
        idsToDelete.map((entryId) => deleteJournalEntryApi(entryId)),
      );

      const failedCount = results.filter(
        (result) => result.status === "rejected",
      ).length;

      await loadEntries();

      if (selectedEntryId && idsToDelete.includes(selectedEntryId)) {
        setSelectedEntryId(null);
        setSelectedEntry(null);
      }

      setSelectedEntryIds((current) =>
        current.filter((id) => !idsToDelete.includes(id)),
      );
      setShowDeletePopup(false);
      setDeletePhrase("");

      if (failedCount > 0) {
        setActionError(
          `Se eliminaron ${idsToDelete.length - failedCount} asiento(s), pero ${failedCount} fallaron.`,
        );
      }
    } catch {
      setActionError("No se pudieron eliminar los asientos seleccionados");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Administración · Libro Diario</p>

      <header className="page-header">
        <div>
          <h2>Libro Diario</h2>
          <p>
            Registro cronológico de las operaciones que alimentan la
            contabilidad.
          </p>
        </div>
        <div className="view-controls">
          {canWrite && (
            <>
              <button
                className="btn btn-secondary"
                type="button"
                onClick={() => setShowEntryForm((current) => !current)}
              >
                {showEntryForm ? "Ocultar formulario" : "Nuevo asiento manual"}
              </button>
              <button
                className="btn btn-tertiary"
                type="button"
                onClick={toggleSelectAllCurrentRows}
                disabled={rows.length === 0}
              >
                {areAllCurrentRowsSelected ? "Quitar selección" : "Seleccionar todos"}
              </button>
              <button
                className="btn btn-ghost"
                type="button"
                onClick={openDeletePopup}
                disabled={visibleSelectedEntryIds.length === 0}
              >
                Eliminar seleccionados ({visibleSelectedEntryIds.length})
              </button>
            </>
          )}
          <button className="btn btn-primary" type="button">
            Exportar reporte
          </button>
        </div>
      </header>

      {canWrite && showEntryForm && (
        <article className="panel budget-form-panel">
          <div className="clients-form-header">
            <div>
              <h3>Nuevo asiento manual</h3>
              <p>
                Validación de doble partida: Debe y Haber deben coincidir.
              </p>
            </div>
          </div>

          <form
            className="budget-form"
            onSubmit={(event) => void handleCreateEntry(event)}
          >
            <label>
              <span>Descripción *</span>
              <input
                type="text"
                value={entryDescription}
                onChange={(event) => setEntryDescription(event.target.value)}
                required
              />
            </label>

            <div className="budget-form__row">
              <label>
                <span>Moneda</span>
                <input
                  type="text"
                  value={entryCurrency}
                  onChange={(event) => setEntryCurrency(event.target.value)}
                />
              </label>
              <label>
                <span>Fecha (opcional)</span>
                <input
                  type="datetime-local"
                  value={entryDate}
                  onChange={(event) => setEntryDate(event.target.value)}
                />
              </label>
            </div>

            <div className="budget-items">
              <div className="budget-items__header">
                <h4>Lineas contables</h4>
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={addLine}
                >
                  + Agregar línea
                </button>
              </div>

              {entryLines.map((line, index) => (
                <div key={`line-${index}`} className="budget-item-row">
                  <label>
                    <span>Cuenta</span>
                    <select
                      value={line.accountCode}
                      onChange={(event) =>
                        updateLine(index, "accountCode", event.target.value)
                      }
                      disabled={accountsLoading}
                    >
                      <option value="">-- Seleccionar cuenta --</option>
                      {accounts.map((account) => (
                        <option key={account.code} value={account.code}>
                          {account.code} - {account.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Debe</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.debit}
                      onChange={(event) =>
                        updateLine(index, "debit", Number(event.target.value))
                      }
                    />
                  </label>
                  <label>
                    <span>Haber</span>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={line.credit}
                      onChange={(event) =>
                        updateLine(
                          index,
                          "credit",
                          Number(event.target.value),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Descripción</span>
                    <input
                      type="text"
                      value={line.description}
                      onChange={(event) =>
                        updateLine(index, "description", event.target.value)
                      }
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => removeLine(index)}
                    disabled={entryLines.length <= 2}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>

            <div className="budget-summary">
              <span>
                Debe: {formatMoney(entryTotals.debit)} | Haber:{" "}
                {formatMoney(entryTotals.credit)}
              </span>
              <strong>
                {entryTotals.isBalanced ? "Balanceado" : "No balanceado"}
              </strong>
            </div>

            <div className="clients-form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSaving}
              >
                {isSaving ? "Guardando..." : "Registrar asiento"}
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
      )}

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Saldo Debe</h3>
          <strong>{formatMoney(trialBalanceTotal.debit)}</strong>
          <small className="kpi-positive">Balance de comprobacion</small>
        </article>
        <article className="kpi-card">
          <h3>Saldo Haber</h3>
          <strong>{formatMoney(trialBalanceTotal.credit)}</strong>
          <small className="kpi-neutral">Asientos del periodo</small>
        </article>
        <article className="kpi-card">
          <h3>Resultado neto</h3>
          <strong>{formatMoney(incomeResult.netResult)}</strong>
          <small className="kpi-positive">Estado de resultados</small>
        </article>
        <article className="kpi-card">
          <h3>Balance general</h3>
          <strong>{formatMoney(balanceSheetTotal.assets)}</strong>
          <small className="kpi-neutral">
            Activos {formatMoney(balanceSheetTotal.liabilities)} / Pasivos{" "}
            {formatMoney(balanceSheetTotal.equity)}
          </small>
        </article>
      </div>

      <article className="panel">
        <div className="accounting-filters">
          <label className="accounting-filter">
            <span>Desde</span>
            <input
              type="date"
              value={from ? from.slice(0, 10) : ""}
              onChange={(event) =>
                setFilter(
                  "from",
                  event.target.value
                    ? new Date(event.target.value).toISOString()
                    : "",
                )
              }
            />
          </label>
          <label className="accounting-filter">
            <span>Hasta</span>
            <input
              type="date"
              value={to ? to.slice(0, 10) : ""}
              onChange={(event) =>
                setFilter(
                  "to",
                  event.target.value
                    ? new Date(event.target.value).toISOString()
                    : "",
                )
              }
            />
          </label>
          <select
            className="accounting-filter__select"
            value={originEvent}
            onChange={(event) => setFilter("originEvent", event.target.value)}
          >
            {originEventOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </article>

      <article className="panel">
        <div className="accounting-selection-bar">
          <label className="accounting-selection-check">
            <input
              type="checkbox"
              checked={areAllCurrentRowsSelected}
              onChange={toggleSelectAllCurrentRows}
              disabled={rows.length === 0 || !canWrite}
            />
            <span>Seleccionar todos los asientos de la página</span>
          </label>
          <strong>{selectedEntryIds.length} seleccionado(s)</strong>
        </div>
        <div className="table-wrapper">
          <table className="table table-compact accounting-table">
            <thead>
              <tr>
                <th className="accounting-select-col">
                  <input
                    type="checkbox"
                    checked={areAllCurrentRowsSelected}
                    onChange={toggleSelectAllCurrentRows}
                    aria-label="Seleccionar todos"
                    disabled={rows.length === 0 || !canWrite}
                  />
                </th>
                <th>Asiento</th>
                <th>Fecha</th>
                <th>Origen</th>
                <th>Descripción</th>
                <th>Debe</th>
                <th>Haber</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={8} className="text-center">
                    Cargando asientos...
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
                    No hay asientos para mostrar
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                rows.map((row) => (
                  <tr key={row._id}>
                    <td className="accounting-select-col">
                      <input
                        type="checkbox"
                        checked={selectedEntryIds.includes(row._id)}
                        onChange={() => toggleEntrySelection(row._id)}
                        aria-label={`Seleccionar asiento ${row._id.slice(-8)}`}
                        disabled={!canWrite}
                      />
                    </td>
                    <td>
                      <div className="project-cell">
                        <strong>{row._id.slice(-8)}</strong>
                        <small>
                          {row.isReversal ? "ASIENTO REVERSO" : "ASIENTO"}
                        </small>
                      </div>
                    </td>
                    <td>{formatDate(row.entryDate)}</td>
                    <td>{formatOrigin(row.originEvent)}</td>
                    <td>{row.description}</td>
                    <td className="text-positive td-numeric">
                      {formatMoney(row.totalDebit)}
                    </td>
                    <td className="text-negative td-numeric">
                      {formatMoney(row.totalCredit)}
                    </td>
                    <td>
                      <div className="budget-actions">
                        <button
                          type="button"
                          className="btn btn-tertiary"
                          onClick={() => void loadEntryDetail(row._id)}
                        >
                          Ver detalle
                        </button>
                        {canWrite && !row.isReversal && (
                          <button
                            type="button"
                            className="btn btn-ghost"
                            onClick={() => void handleReverse(row)}
                          >
                            Revertir
                          </button>
                        )}
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

      {actionError && (
        <article className="panel panel--warning">
          <h3>Operación no completada</h3>
          <p>{actionError}</p>
        </article>
      )}

      {showDeletePopup ? (
        <div
          className="future-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-entries-title"
          onClick={closeDeletePopup}
        >
          <div
            className="future-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="delete-entries-title">Confirmar eliminación de asientos</h2>
            <p>
              Para eliminar {selectedEntryIds.length} asiento(s), escribe la frase
              exacta: <strong>{DELETE_CONFIRMATION_PHRASE}</strong>
            </p>
            <label className="accounting-delete-label">
              <span>Frase de confirmación</span>
              <input
                type="text"
                value={deletePhrase}
                onChange={(event) => setDeletePhrase(event.target.value)}
                placeholder={DELETE_CONFIRMATION_PHRASE}
              />
            </label>
            <div className="future-modal__actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={closeDeletePopup}
                disabled={isDeleting}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => void handleDeleteSelected()}
                disabled={
                  isDeleting || deletePhrase.trim() !== DELETE_CONFIRMATION_PHRASE
                }
              >
                {isDeleting ? "Eliminando..." : "Eliminar asientos"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="panel-grid">
        <article className="panel panel-large budget-detail-panel">
          <div className="budget-detail-header">
            <div>
              <h3>Detalle de asiento</h3>
              <p>Trazabilidad y líneas contables del asiento seleccionado.</p>
            </div>
          </div>

          {isLoadingDetail && <p className="text-muted">Cargando detalle...</p>}
          {!isLoadingDetail && !selectedEntry && (
            <p className="text-muted">
              Selecciona un asiento para ver su detalle.
            </p>
          )}

          {!isLoadingDetail && selectedEntry && (
            <div className="budget-detail">
              <div className="budget-detail__meta">
                <div>
                  <span>Asiento</span>
                  <strong>{selectedEntry._id}</strong>
                </div>
                <div>
                  <span>Fecha</span>
                  <strong>{formatDate(selectedEntry.entryDate)}</strong>
                </div>
                <div>
                  <span>Origen</span>
                  <strong>{formatOrigin(selectedEntry.originEvent)}</strong>
                </div>
                <div>
                  <span>Estado</span>
                  <strong>
                    {selectedEntry.isReversal ? "Reverso" : "Original"}
                  </strong>
                </div>
              </div>

              <p className="panel-subtitle">{selectedEntry.description}</p>

              <div className="table-wrapper">
                <table className="table table-compact accounting-table">
                  <thead>
                    <tr>
                      <th>Cuenta</th>
                      <th>Nombre</th>
                      <th>Debe</th>
                      <th>Haber</th>
                      <th>Descripción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedEntry.lines.map((line, index) => (
                      <tr key={`${line.accountCode}-${index}`}>
                        <td>{line.accountCode}</td>
                        <td>{line.accountName}</td>
                        <td className="td-numeric">
                          {line.debit > 0 ? formatMoney(line.debit) : "-"}
                        </td>
                        <td className="td-numeric">
                          {line.credit > 0 ? formatMoney(line.credit) : "-"}
                        </td>
                        <td>{line.description ?? "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </article>

      </div>

      <div className="panel-grid">
        <article className="panel">
          <h3>Balance de comprobacion</h3>
          <p className="panel-subtitle">
            Debe: {formatMoney(trialBalanceTotal.debit)} | Haber:{" "}
            {formatMoney(trialBalanceTotal.credit)}
          </p>
        </article>
        <article className="panel">
          <h3>Resultado operativo</h3>
          <p className="panel-subtitle">
            Ingresos: {formatMoney(incomeResult.income)} | Gastos:{" "}
            {formatMoney(incomeResult.expenses)}
          </p>
        </article>
      </div>
    </section>
  );
}
