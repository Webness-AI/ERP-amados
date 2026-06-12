import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { FormPopup } from "../components/FormPopup";
import { MaterialListPicker } from "../components/MaterialListPicker";
import {
  createBudgetApi,
  getApiErrorInfo,
  type BudgetItemInput,
  type BudgetStatus,
  type MaterialItem,
} from "../services/erp-api";
import { formatMoneyWithCurrency as formatMoney } from "../utils/formatters";

type EditableBudgetStatus = Exclude<BudgetStatus, "APPROVED">;

type BudgetFormState = {
  clientId: string;
  prospectName: string;
  prospectLocalidad: string;
  prospectContacto: string;
  prospectDireccion: string;
  title: string;
  description: string;
  currency: string;
  status: EditableBudgetStatus;
  items: BudgetItemInput[];
  materials: Array<{
    materialId: string;
    quantity: number;
    unitPrice: number;
  }>;
  laborHours: number;
  hourlyRate: number;
  sellerCommission: number;
  employeeBonus: number;
  shippingCost: number;
  packagingCost: number;
  marginType: "COMUN_40" | "COCINA_55";
};

type HourTask = {
  task: string;
  hours: number;
};

const emptyItem: BudgetItemInput = {
  description: "",
  quantity: 1,
  unitPrice: 0,
};

const DEFAULT_HOUR_TASKS: HourTask[] = [
  { task: "Canteo total", hours: 4 },
  { task: "Armado de modulos", hours: 2 },
  { task: "Armado de cajones", hours: 2 },
  { task: "Preparado de puertas", hours: 1 },
  { task: "Otros Herrajes", hours: 0 },
  { task: "Extra", hours: 0 },
  { task: "Instalacion", hours: 8 },
];

const emptyFormState: BudgetFormState = {
  clientId: "",
  prospectName: "",
  prospectLocalidad: "",
  prospectContacto: "",
  prospectDireccion: "",
  title: "",
  description: "",
  currency: "ARS",
  status: "DRAFT",
  items: [{ ...emptyItem }],
  materials: [],
  laborHours: 0,
  hourlyRate: 0,
  sellerCommission: 0,
  employeeBonus: 0,
  shippingCost: 0,
  packagingCost: 0,
  marginType: "COMUN_40",
};

function calculateMaterialLineTotal(quantity: number, unitPrice: number): number {
  return Number((quantity * unitPrice).toFixed(2));
}

function normalizePositiveInteger(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function calculateBudgetTotal(items: BudgetItemInput[]): number {
  return Number(
    items
      .reduce((acc, item) => acc + calculateMaterialLineTotal(item.quantity, item.unitPrice), 0)
      .toFixed(2),
  );
}

function calculateMaterialsTotal(
  materials: Array<{ quantity: number; unitPrice: number }>,
): number {
  return Number(
    materials
      .reduce(
        (acc, material) =>
          acc + calculateMaterialLineTotal(material.quantity, material.unitPrice),
        0,
      )
      .toFixed(2),
  );
}

function calculateBudgetPreview(formState: BudgetFormState): {
  materialsTotal: number;
  subtotalCosts: number;
  commissionAmount: number;
  bonusAmount: number;
  projectCost: number;
  marginPercent: number;
  profitAmount: number;
  itemUnitPrice: number;
  finalTotal: number;
} {
  const itemsTotal = calculateBudgetTotal(formState.items);
  const materialsTotal = calculateMaterialsTotal(formState.materials);
  const hasCostInputs =
    materialsTotal > 0 ||
    formState.laborHours > 0 ||
    formState.hourlyRate > 0 ||
    formState.shippingCost > 0 ||
    formState.packagingCost > 0;
  const mainMaterialsCost = materialsTotal > 0 ? materialsTotal : hasCostInputs ? 0 : itemsTotal;
  const derivedLaborCost = Number(
    (formState.laborHours * formState.hourlyRate).toFixed(2),
  );
  const subtotalCosts = Number(
    (
      mainMaterialsCost +
      derivedLaborCost +
      formState.shippingCost +
      formState.packagingCost
    ).toFixed(2),
  );
  const commissionAmount = Number(
    ((subtotalCosts * formState.sellerCommission) / 100).toFixed(2),
  );
  const bonusAmount = Number(
    ((subtotalCosts * formState.employeeBonus) / 100).toFixed(2),
  );
  const projectCost = Number(
    (subtotalCosts + commissionAmount + bonusAmount).toFixed(2),
  );
  const marginPercent = formState.marginType === "COCINA_55" ? 55 : 40;
  const profitAmount = Number(((projectCost * marginPercent) / 100).toFixed(2));
  const itemUnitPrice = Number((projectCost + profitAmount).toFixed(2));
  const itemQuantityMultiplier = Math.max(
    1,
    formState.items.reduce(
      (acc, item) => acc + normalizePositiveInteger(item.quantity),
      0,
    ),
  );
  const finalTotal = Number((itemUnitPrice * itemQuantityMultiplier).toFixed(2));

  return {
    materialsTotal: mainMaterialsCost,
    subtotalCosts,
    commissionAmount,
    bonusAmount,
    projectCost,
    marginPercent,
    profitAmount,
    itemUnitPrice,
    finalTotal: hasCostInputs ? finalTotal : itemUnitPrice,
  };
}

export function BudgetCreatePage() {
  const navigate = useNavigate();
  const [formState, setFormState] = useState<BudgetFormState>(emptyFormState);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isHoursPopupOpen, setIsHoursPopupOpen] = useState(false);
  const [isHoursPopupMinimized, setIsHoursPopupMinimized] = useState(false);
  const [hourTasks, setHourTasks] = useState<HourTask[]>(
    DEFAULT_HOUR_TASKS.map((task) => ({ ...task })),
  );

  const preview = useMemo(() => calculateBudgetPreview(formState), [formState]);
  const totalHoursFromTasks = useMemo(
    () => Number(hourTasks.reduce((acc, task) => acc + task.hours, 0).toFixed(2)),
    [hourTasks],
  );

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
    const nextValue =
      field === "quantity" ? normalizePositiveInteger(value) : value;

    setFormState((current) => ({
      ...current,
      items: current.items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: nextValue } : item,
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

  const appendMaterial = (material: MaterialItem) => {
    setFormState((current) => {
      const existing = current.materials.find(
        (entry) => entry.materialId === material.id,
      );

      if (existing) {
        return {
          ...current,
          materials: current.materials.map((entry) =>
            entry.materialId === material.id
              ? {
                  ...entry,
                  quantity: normalizePositiveInteger(entry.quantity + 1),
                }
              : entry,
          ),
        };
      }

      return {
        ...current,
        materials: [
          ...current.materials,
          {
            materialId: material.id,
            quantity: 1,
            unitPrice: material.unitPrice ?? 0,
          },
        ],
      };
    });
  };

  const updateMaterialQuantity = (materialId: string, quantity: number) => {
    setFormState((current) => ({
      ...current,
      materials: current.materials.map((entry) =>
        entry.materialId === materialId
          ? { ...entry, quantity: normalizePositiveInteger(quantity) }
          : entry,
      ),
    }));
  };

  const removeMaterial = (materialId: string) => {
    setFormState((current) => ({
      ...current,
      materials: current.materials.filter(
        (entry) => entry.materialId !== materialId,
      ),
    }));
  };

  const openHoursPopup = () => {
    setIsHoursPopupMinimized(false);
    setIsHoursPopupOpen(true);
  };

  const applyHourTasksToForm = () => {
    setFormState((current) => ({
      ...current,
      laborHours: totalHoursFromTasks,
    }));
    setIsHoursPopupOpen(false);
    setIsHoursPopupMinimized(false);
  };

  const updateHourTask = (index: number, value: number) => {
    setHourTasks((current) =>
      current.map((task, taskIndex) =>
        taskIndex === index
          ? { ...task, hours: Number.isFinite(value) ? Math.max(0, value) : 0 }
          : task,
      ),
    );
  };

  const resetForm = () => {
    setFormState(emptyFormState);
    setFormError(null);
    setHourTasks(DEFAULT_HOUR_TASKS.map((task) => ({ ...task })));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const defaultItemDescription = formState.title.trim() || "Presupuesto";
    const normalizedItems = formState.items.map((item) => ({
      description: item.description.trim() || defaultItemDescription,
      quantity: normalizePositiveInteger(item.quantity),
      unitPrice: preview.itemUnitPrice,
    }));

    const itemsToPersist = normalizedItems.filter(
      (item) => item.quantity > 0 && item.unitPrice >= 0,
    );

    const payload = {
      clientId: formState.clientId.trim() || undefined,
      prospectName: formState.prospectName.trim() || undefined,
      prospectLocalidad: formState.prospectLocalidad.trim() || undefined,
      prospectContacto: formState.prospectContacto.trim() || undefined,
      prospectDireccion: formState.prospectDireccion.trim() || undefined,
      title: formState.title.trim(),
      description: formState.description.trim() || undefined,
      currency: formState.currency.trim() || "ARS",
      items: itemsToPersist,
      materials: formState.materials
        .map((material) => ({
          materialId: material.materialId,
          quantity: normalizePositiveInteger(material.quantity),
        }))
        .filter(
          (material) =>
            material.materialId.trim().length > 0 && material.quantity > 0,
        ),
      laborHours: Number(formState.laborHours),
      hourlyRate: Number(formState.hourlyRate),
      sellerCommission: Number(formState.sellerCommission),
      employeeBonus: Number(formState.employeeBonus),
      shippingCost: Number(formState.shippingCost),
      packagingCost: Number(formState.packagingCost),
      marginType: formState.marginType,
      enableCommercialPricing:
        formState.materials.length > 0 ||
        Number(formState.hourlyRate) > 0 ||
        Number(formState.sellerCommission) > 0 ||
        Number(formState.employeeBonus) > 0 ||
        Number(formState.laborHours) > 0 ||
        Number(formState.shippingCost) > 0 ||
        Number(formState.packagingCost) > 0,
      status: formState.status,
    };

    if (!payload.clientId && !payload.prospectName) {
      setFormError("Debes cargar un cliente o al menos un nombre de prospecto");
      setIsSaving(false);
      return;
    }

    if (payload.items.length === 0 && payload.materials.length === 0) {
      setFormError("Agrega al menos un item valido o un material con cantidad");
      setIsSaving(false);
      return;
    }

    if (preview.finalTotal <= 0) {
      setFormError("El monto total debe ser mayor a 0 para guardar");
      setIsSaving(false);
      return;
    }

    try {
      const budget = await createBudgetApi(payload);
      navigate(`/budgets?budgetId=${budget._id}`);
    } catch (error) {
      setFormError(
        getApiErrorInfo(error, "No se pudo guardar el presupuesto").message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="page-content budget-form-page">
      <p className="page-breadcrumb">Comercial / Presupuestos / Nuevo</p>

      <header className="page-header">
        <div>
          <h2>Nuevo presupuesto</h2>
          <p>Alta comercial con materiales, horas y composicion de costos.</p>
        </div>
        <div className="view-controls">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate("/budgets")}
          >
            Volver
          </button>
        </div>
      </header>

      <article className="panel budget-form-page__panel">
        <form className="budget-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="budget-form-page__section">
            <h3>Datos comerciales</h3>
            <label>
              <span>Prospecto</span>
              <input
                type="text"
                value={formState.prospectName}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    prospectName: event.target.value,
                  }))
                }
                placeholder="Nombre de consulta o titular"
              />
            </label>

            <div className="budget-form__row">
              <label>
                <span>Localidad</span>
                <input
                  type="text"
                  value={formState.prospectLocalidad}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      prospectLocalidad: event.target.value,
                    }))
                  }
                  placeholder="Localidad del cliente"
                />
              </label>
              <label>
                <span>Contacto</span>
                <input
                  type="text"
                  value={formState.prospectContacto}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      prospectContacto: event.target.value,
                    }))
                  }
                  placeholder="Persona o referencia de contacto"
                />
              </label>
            </div>

            <label>
              <span>Direccion</span>
              <input
                type="text"
                value={formState.prospectDireccion}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    prospectDireccion: event.target.value,
                  }))
                }
                placeholder="Direccion de obra o cliente"
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

            <label>
              <span>Descripcion</span>
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
                <select
                  value={formState.currency}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      currency: event.target.value,
                    }))
                  }
                >
                  <option value="ARS">ARS</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <label>
                <span>Estado</span>
                <select
                  value={formState.status}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      status: event.target.value as EditableBudgetStatus,
                    }))
                  }
                >
                  <option value="DRAFT">Borrador</option>
                  <option value="SENT">Enviado</option>
                  <option value="REJECTED">Rechazado</option>
                  <option value="CANCELED">Cancelado</option>
                </select>
              </label>
            </div>
          </div>

          <div className="budget-form-page__section">
            <div className="budget-items__header">
              <h3>Materiales</h3>
            </div>
            <MaterialListPicker
              value={formState.materials}
              currency={formState.currency}
              onAddMaterial={appendMaterial}
              onQuantityChange={updateMaterialQuantity}
              onRemoveMaterial={removeMaterial}
            />
          </div>

          <div className="budget-form-page__section">
            <h3>Costos y margen</h3>
            <div className="budget-form__row">
              <label>
                <span>Horas de mano de obra</span>
                <input type="number" value={formState.laborHours} disabled />
                <button
                  type="button"
                  className="btn btn-tertiary"
                  onClick={openHoursPopup}
                >
                  Editar horas por tarea
                </button>
              </label>
              <label>
                <span>Cuota horaria</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.hourlyRate}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      hourlyRate: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className="budget-form__row">
              <label>
                <span>Costo de envio</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.shippingCost}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      shippingCost: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>Costo de embalaje</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.packagingCost}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      packagingCost: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <div className="budget-form__row">
              <label>
                <span>Comision vendedor (%)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.sellerCommission}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      sellerCommission: Number(event.target.value),
                    }))
                  }
                />
              </label>
              <label>
                <span>Bono empleado (%)</span>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={formState.employeeBonus}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      employeeBonus: Number(event.target.value),
                    }))
                  }
                />
              </label>
            </div>

            <label>
              <span>Margen final</span>
              <select
                value={formState.marginType}
                onChange={(event) =>
                  setFormState((current) => ({
                    ...current,
                    marginType: event.target.value as "COMUN_40" | "COCINA_55",
                  }))
                }
              >
                <option value="COMUN_40">Comun 40%</option>
                <option value="COCINA_55">Cocina 55%</option>
              </select>
            </label>

            <div className="budget-summary">
              <span>Resumen comercial</span>
              <strong>{formatMoney(preview.finalTotal, formState.currency)}</strong>
            </div>

            <div className="budget-detail__items">
              <div className="budget-detail__item">
                <span>Base materiales/items</span>
                <strong>
                  {formatMoney(preview.materialsTotal, formState.currency)}
                </strong>
              </div>
              <div className="budget-detail__item">
                <span>Subtotal de costos</span>
                <strong>{formatMoney(preview.subtotalCosts, formState.currency)}</strong>
              </div>
              <div className="budget-detail__item">
                <span>Comision vendedor</span>
                <strong>
                  {formatMoney(preview.commissionAmount, formState.currency)}
                </strong>
              </div>
              <div className="budget-detail__item">
                <span>Bono empleado</span>
                <strong>{formatMoney(preview.bonusAmount, formState.currency)}</strong>
              </div>
              <div className="budget-detail__item">
                <span>Costo del proyecto</span>
                <strong>{formatMoney(preview.projectCost, formState.currency)}</strong>
              </div>
              <div className="budget-detail__item">
                <span>Margen ({preview.marginPercent}%)</span>
                <strong>{formatMoney(preview.profitAmount, formState.currency)}</strong>
              </div>
            </div>
          </div>

          <div className="budget-form-page__section">
            <div className="budget-items__header">
              <h3>Items</h3>
              <button
                type="button"
                className="btn btn-tertiary"
                onClick={appendItem}
              >
                + Agregar item
              </button>
            </div>
            {formState.items.map((item, index) => (
              <div key={`${index}-${item.description}`} className="budget-item-row">
                <label>
                  <span>Descripcion</span>
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
                    min="1"
                    step="1"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", Number(event.target.value))
                    }
                  />
                </label>
                <div className="budget-item-row__total">
                  <span>Precio unitario</span>
                  <strong>{formatMoney(preview.itemUnitPrice, formState.currency)}</strong>
                </div>
                <div className="budget-item-row__total">
                  <span>Total</span>
                  <strong>
                    {formatMoney(
                      calculateMaterialLineTotal(
                        normalizePositiveInteger(item.quantity),
                        preview.itemUnitPrice,
                      ),
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

          {formError ? <p className="form-error">{formError}</p> : null}

          <div className="clients-form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? "Guardando..." : "Crear presupuesto"}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={resetForm}
              disabled={isSaving}
            >
              Reiniciar
            </button>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigate("/budgets")}
              disabled={isSaving}
            >
              Cancelar
            </button>
          </div>
        </form>
      </article>

      {isHoursPopupMinimized ? (
        <button
          type="button"
          className="btn btn-secondary form-popup-restore"
          onClick={() => {
            setIsHoursPopupMinimized(false);
            setIsHoursPopupOpen(true);
          }}
        >
          Restaurar horas ({totalHoursFromTasks})
        </button>
      ) : null}

      <FormPopup
        isOpen={isHoursPopupOpen}
        title="Detalle de horas"
        subtitle="Distribuye horas por tarea. Se aplican al campo Horas del presupuesto."
        onRequestClose={() => setIsHoursPopupOpen(false)}
        onMinimize={() => {
          setIsHoursPopupMinimized(true);
          setIsHoursPopupOpen(false);
        }}
      >
        <form
          className="budget-form"
          onSubmit={(event) => {
            event.preventDefault();
            applyHourTasksToForm();
          }}
        >
          <div className="table-wrapper">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Tarea</th>
                  <th>Horas</th>
                </tr>
              </thead>
              <tbody>
                {hourTasks.map((task, index) => (
                  <tr key={task.task}>
                    <td>{task.task}</td>
                    <td>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={task.hours}
                        onChange={(event) =>
                          updateHourTask(index, Number(event.target.value))
                        }
                      />
                    </td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <strong>TOTAL</strong>
                  </td>
                  <td>
                    <strong>{totalHoursFromTasks}</strong>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="clients-form-actions">
            <button type="submit" className="btn btn-primary">
              Aplicar horas
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsHoursPopupOpen(false)}
            >
              Cerrar
            </button>
          </div>
        </form>
      </FormPopup>
    </section>
  );
}
