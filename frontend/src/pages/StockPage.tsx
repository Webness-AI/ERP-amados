import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { FormPopup } from "../components/FormPopup";
import { Pagination } from "../components/Pagination";

import {
  createMaterialApi,
  getGeneralLedgerReportApi,
  getMaterialsApi,
  getPurchaseSuggestionsApi,
  getSuppliersApi,
  updateMaterialApi,
  type MaterialCategory,
  type MaterialItem,
  type SupplierItem,
} from "../services/erp-api";
import { formatMoney } from "../utils/formatters";

const PAGE_SIZE = 10;

const CATEGORY_OPTIONS: Array<{
  key: MaterialCategory;
  label: string;
}> = [
  { key: "MADERA", label: "Madera" },
  { key: "HERRAJES", label: "Herrajes" },
  { key: "OTROS", label: "Otros Materiales" },
];

type MaterialFormState = {
  sku: string;
  name: string;
  supplierId: string;
  category: MaterialCategory;
  type: string;
  unit: string;
  color: string;
  note: string;
  unitPrice: string;
  minStock: string;
};

const emptyFormState: MaterialFormState = {
  sku: "",
  name: "",
  supplierId: "",
  category: "OTROS",
  type: "",
  unit: "u",
  color: "",
  note: "",
  unitPrice: "0",
  minStock: "0",
};

export function StockPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [rows, setRows] = useState<MaterialItem[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [estimatedCost, setEstimatedCost] = useState(0);
  const [currentCmv, setCurrentCmv] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSuppliersLoading, setIsSuppliersLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suppliersError, setSuppliersError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formState, setFormState] = useState<MaterialFormState>(emptyFormState);
  const [initialFormState, setInitialFormState] =
    useState<MaterialFormState>(emptyFormState);
  const [isFormPopupOpen, setIsFormPopupOpen] = useState(false);
  const [isFormPopupMinimized, setIsFormPopupMinimized] = useState(false);
  const [editingMaterialId, setEditingMaterialId] = useState<string | null>(
    null,
  );

  const page = Number(searchParams.get("page") ?? "1");
  const category = searchParams.get("category") ?? "ALL";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;
  const selectedCategory =
    category === "ALL" ? undefined : (category as MaterialCategory);

  const supplierById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier._id, supplier.name])),
    [suppliers],
  );

  const loadStock = useCallback(async (activeFlag?: { current: boolean }) => {
    setIsLoading(true);
    setError(null);

    try {
      const [materialsData, purchaseListData, cmvLedgerData] = await Promise.all([
        getMaterialsApi({
          page: safePage,
          limit: PAGE_SIZE,
          category: selectedCategory,
        }),
        getPurchaseSuggestionsApi({ category: selectedCategory }),
        getGeneralLedgerReportApi({ accountCode: "CMV" }),
      ]);

      if (activeFlag && !activeFlag.current) {
        return;
      }

      setRows(materialsData.items);
      setTotalPages(Math.max(materialsData.pagination.totalPages, 1));
      setLowStockCount(purchaseListData.pagination.total);
      setEstimatedCost(purchaseListData.totals.estimatedTotalCost);
      setCurrentCmv(Math.abs(cmvLedgerData.totals.endingBalance));
    } catch {
      if (activeFlag && !activeFlag.current) {
        return;
      }

      setError("No se pudo cargar el stock");
    } finally {
      if (!activeFlag || activeFlag.current) {
        setIsLoading(false);
      }
    }
  }, [safePage, selectedCategory]);

  const loadSuppliers = useCallback(async (activeFlag?: { current: boolean }) => {
    setIsSuppliersLoading(true);
    setSuppliersError(null);

    try {
      const data = await getSuppliersApi({
        page: 1,
        limit: 200,
        activeOnly: true,
      });

      if (activeFlag && !activeFlag.current) {
        return;
      }

      setSuppliers(data.items);
    } catch {
      if (activeFlag && !activeFlag.current) {
        return;
      }

      setSuppliersError("No se pudieron cargar los proveedores activos");
    } finally {
      if (!activeFlag || activeFlag.current) {
        setIsSuppliersLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const active = { current: true };
    const timer = window.setTimeout(() => {
      void loadStock(active);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      active.current = false;
    };
  }, [loadStock]);

  useEffect(() => {
    const active = { current: true };
    const timer = window.setTimeout(() => {
      void loadSuppliers(active);
    }, 0);

    return () => {
      window.clearTimeout(timer);
      active.current = false;
    };
  }, [loadSuppliers]);

  const setPage = (next: number) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setCategory = (newCategory: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("category", newCategory);
    params.set("page", "1");
    setSearchParams(params);
  };

  const handleFormChange = (key: keyof MaterialFormState, value: string) => {
    setFormState((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const hasUnsavedChanges =
    JSON.stringify(formState) !== JSON.stringify(initialFormState);

  const resetForm = () => {
    setFormState(emptyFormState);
    setInitialFormState(emptyFormState);
    setEditingMaterialId(null);
    setFormError(null);
  };

  const openCreatePopup = () => {
    resetForm();
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const handleMinimizeFormPopup = () => {
    setIsFormPopupOpen(false);
    setIsFormPopupMinimized(true);
  };

  const handleRestoreFormPopup = () => {
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const closeAndResetFormPopup = () => {
    resetForm();
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

    closeAndResetFormPopup();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const trimmedSku = formState.sku.trim().toUpperCase();
    const trimmedSupplierId = formState.supplierId.trim();
    const trimmedName = formState.name.trim();
    const trimmedType = formState.type.trim();
    const trimmedUnit = formState.unit.trim();
    const trimmedColor = formState.color.trim();
    const trimmedNote = formState.note.trim();
    const unitPrice = Number(formState.unitPrice);
    const minStock = Number(formState.minStock);

    if (!trimmedSku) {
      setFormError("El ID material es obligatorio");
      return;
    }

    if (!trimmedSupplierId) {
      setFormError("El proveedor es obligatorio");
      return;
    }

    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      setFormError("El precio del material debe ser un número válido");
      return;
    }

    if (!Number.isFinite(minStock) || minStock < 0) {
      setFormError("El stock mínimo debe ser un número válido");
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        sku: trimmedSku,
        ...(trimmedName ? { name: trimmedName } : {}),
        supplierId: trimmedSupplierId,
        category: formState.category,
        ...(trimmedType ? { type: trimmedType } : {}),
        ...(trimmedUnit ? { unit: trimmedUnit } : {}),
        ...(trimmedColor ? { color: trimmedColor } : {}),
        ...(trimmedNote ? { note: trimmedNote } : {}),
        unitPrice,
        minStock,
      };

      if (editingMaterialId) {
        await updateMaterialApi(editingMaterialId, payload);
      } else {
        await createMaterialApi(payload);
      }

      closeAndResetFormPopup();
      await loadStock();
    } catch {
      setFormError(
        editingMaterialId
          ? "No se pudo actualizar el material"
          : "No se pudo crear el material",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = (row: MaterialItem) => {
    setFormError(null);
    setEditingMaterialId(row.id);
    const nextFormState = {
      sku: row.sku ?? "",
      name: row.name,
      supplierId: row.supplierId ?? "",
      category: row.category,
      type: row.type ?? "",
      unit: row.unit ?? "u",
      color: row.color ?? "",
      note: row.note ?? "",
      unitPrice: String(row.unitPrice ?? 0),
      minStock: String(row.minStock),
    };
    setFormState(nextFormState);
    setInitialFormState(nextFormState);
    setIsFormPopupOpen(true);
    setIsFormPopupMinimized(false);
  };

  const handleCancelEdit = () => {
    closeAndResetFormPopup();
  };

  const lowStockVisible = rows.filter((row) => row.isLowStock).length;

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Inventario · Control de Stock</p>

      <header className="page-header">
        <div>
          <h2>Control de Inventario</h2>
          <p>Gestión de materiales para producción, faltantes y compras.</p>
        </div>
        <div className="stock-actions">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={openCreatePopup}
          >
            Nuevo material
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
          <button
            className="btn btn-secondary"
            type="button"
            onClick={() => navigate("/purchases")}
          >
            Generar Lista de Compra
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate("/purchases")}
          >
            Ingreso de mercadería
          </button>
        </div>
      </header>

      <div className="stock-kpis">
        <article className="panel stock-alert-card">
          <h3>Alerta de Stock Bajo</h3>
          <p>
            {lowStockCount} materiales críticos detectados. Costo estimado: {" "}
            {formatMoney(estimatedCost)}.
          </p>
        </article>
        <article className="kpi-card">
          <h3>Costo de Reposición Estimado</h3>
          <strong>{formatMoney(estimatedCost)}</strong>
          <small className="kpi-neutral">
            Basado en lista de compra sugerida
          </small>
        </article>
        <article className="kpi-card">
          <h3>CMV contable</h3>
          <strong>{formatMoney(currentCmv)}</strong>
          <small className="kpi-neutral">
            Acumulado desde el mayor de costos
          </small>
        </article>
        <article className="kpi-card">
          <h3>Materiales Disponibles</h3>
          <strong>{rows.length}</strong>
          <small>Filtrados por categoría</small>
        </article>
        <article className="kpi-card">
          <h3>Materiales Críticos en Vista</h3>
          <strong className="kpi-negative">{lowStockVisible}</strong>
          <small>Requieren reposición</small>
        </article>
      </div>

      <div className="filter-tabs">
        {[
          { key: "ALL", label: "Todos los Materiales" },
          ...CATEGORY_OPTIONS,
        ].map((tab) => (
          <button
            key={tab.key}
            className={`filter-tab ${category === tab.key ? "filter-tab--active" : ""}`}
            onClick={() => setCategory(tab.key)}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <FormPopup
        isOpen={isFormPopupOpen}
        title={editingMaterialId ? "Editar material" : "Alta de material"}
        subtitle={
          editingMaterialId
            ? "Actualizá los datos del material seleccionado."
            : "Creá nuevos materiales con proveedor, medida y metadatos."
        }
        onMinimize={handleMinimizeFormPopup}
        onRequestClose={handleRequestCloseFormPopup}
      >
        <form className="budget-form" onSubmit={handleSubmit}>
          <div className="budget-form__row">
            <label>
              <span>ID material</span>
              <input
                type="text"
                value={formState.sku}
                placeholder="SKU o código interno"
                onChange={(event) => handleFormChange("sku", event.target.value)}
              />
            </label>

            <label>
              <span>Nombre opcional</span>
              <input
                type="text"
                value={formState.name}
                placeholder="Se deriva del ID si se deja vacío"
                onChange={(event) => handleFormChange("name", event.target.value)}
              />
            </label>
          </div>

          <div className="budget-form__row">
            <label>
              <span>Proveedor</span>
              <select
                value={formState.supplierId}
                onChange={(event) =>
                  handleFormChange("supplierId", event.target.value)
                }
                disabled={isSuppliersLoading || suppliers.length === 0}
              >
                <option value="">
                  {isSuppliersLoading
                    ? "Cargando proveedores..."
                    : "Seleccionar proveedor"}
                </option>
                {suppliers.map((supplier) => (
                  <option key={supplier._id} value={supplier._id}>
                    {supplier.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Categoría</span>
              <select
                value={formState.category}
                onChange={(event) =>
                  handleFormChange("category", event.target.value as MaterialCategory)
                }
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="budget-form__row">
            <label>
              <span>Tipo</span>
              <input
                type="text"
                value={formState.type}
                placeholder="Opcional"
                onChange={(event) => handleFormChange("type", event.target.value)}
              />
            </label>

            <label>
              <span>Medida</span>
              <input
                type="text"
                value={formState.unit}
                placeholder="u"
                onChange={(event) => handleFormChange("unit", event.target.value)}
              />
            </label>
          </div>

          <div className="budget-form__row">
            <label>
              <span>Color</span>
              <input
                type="text"
                value={formState.color}
                placeholder="Opcional"
                onChange={(event) => handleFormChange("color", event.target.value)}
              />
            </label>

            <label>
              <span>Precio unitario</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={formState.unitPrice}
                onChange={(event) => handleFormChange("unitPrice", event.target.value)}
              />
            </label>

            <label>
              <span>Stock mínimo</span>
              <input
                type="number"
                min="0"
                step="1"
                value={formState.minStock}
                onChange={(event) => handleFormChange("minStock", event.target.value)}
              />
            </label>
          </div>

          <label>
            <span>Nota del material</span>
            <textarea
              rows={3}
              value={formState.note}
              placeholder="Información adicional, uso, observaciones"
              onChange={(event) => handleFormChange("note", event.target.value)}
            />
          </label>

          {formError && <p className="text-negative">{formError}</p>}
          {suppliersError && <p className="text-negative">{suppliersError}</p>}

          <div className="clients-form-actions">
            <button className="btn btn-primary" type="submit" disabled={isSaving}>
              {isSaving
                ? "Guardando..."
                : editingMaterialId
                  ? "Guardar cambios"
                  : "Crear material"}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              onClick={handleCancelEdit}
              disabled={isSaving}
            >
              {editingMaterialId ? "Salir" : "Limpiar"}
            </button>
          </div>
        </form>
      </FormPopup>

      <article className="panel">
        <div className="table-wrapper">
          <table className="table stock-table">
            <thead>
              <tr>
                <th>Material / Insumo</th>
                <th>Categoría</th>
                <th className="td-numeric">Cant. Total</th>
                <th className="td-numeric">Reservado</th>
                <th className="td-numeric">Disponible</th>
                <th>Unidad</th>
                <th className="td-numeric">Precio unitario</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="text-center">
                    Cargando inventario...
                  </td>
                </tr>
              )}
              {!isLoading && error && (
                <tr>
                  <td colSpan={9} className="text-negative text-center">
                    {error}
                  </td>
                </tr>
              )}
              {!isLoading && !error && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-center">
                    No hay materiales para mostrar
                  </td>
                </tr>
              )}
              {!isLoading &&
                !error &&
                rows.map((row) => {
                  const reserved = Math.min(row.currentStock, row.minStock);
                  const available = Math.max(row.currentStock - reserved, 0);
                  const supplierName = row.supplierId
                    ? supplierById.get(row.supplierId) ?? "Proveedor activo"
                    : "Sin proveedor";
                  const displaySku = row.sku ?? row.id.slice(-8).toUpperCase();
                  const metadata = [
                    supplierName,
                    row.type ?? "Sin tipo",
                    row.color ?? "Sin color",
                    row.note ? `Nota: ${row.note}` : null,
                  ]
                    .filter((value): value is string => Boolean(value))
                    .join(" · ");

                  return (
                    <tr
                      key={row.id}
                      className={
                        editingMaterialId === row.id
                          ? "stock-table__row--editing"
                          : undefined
                      }
                    >
                      <td>
                        <div className="project-cell">
                          <strong>{row.name}</strong>
                          <small>ID material {displaySku}</small>
                          <small>{metadata}</small>
                        </div>
                      </td>
                      <td>{row.category}</td>
                      <td className="td-numeric">{row.currentStock}</td>
                      <td className="td-numeric">{reserved}</td>
                      <td className="td-numeric">{available}</td>
                      <td>{row.unit}</td>
                      <td className="td-numeric">{formatMoney(row.unitPrice ?? 0)}</td>
                      <td>
                        {row.isLowStock ? (
                          <span className="chip chip-produccion">CRITICO</span>
                        ) : (
                          <span className="chip chip-aprobado">SUFICIENTE</span>
                        )}
                      </td>
                      <td>
                        <button
                          className={`btn btn-secondary ${
                            editingMaterialId === row.id
                              ? "stock-table__edit-btn--active"
                              : ""
                          }`}
                          type="button"
                          onClick={() => handleStartEdit(row)}
                        >
                          Editar
                        </button>
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
    </section>
  );
}
