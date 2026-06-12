import { useEffect, useMemo, useState } from "react";

import {
  getApiErrorInfo,
  getMaterialsApi,
  type MaterialCategory,
  type MaterialItem,
} from "../services/erp-api";
import { formatMoneyWithCurrency as formatMoney } from "../utils/formatters";

export type SelectedMaterialLine = {
  materialId: string;
  quantity: number;
  unitPrice: number;
};

type MaterialListPickerProps = {
  value: SelectedMaterialLine[];
  currency: string;
  onAddMaterial: (material: MaterialItem) => void;
  onQuantityChange: (materialId: string, quantity: number) => void;
  onRemoveMaterial: (materialId: string) => void;
};

const categoryOptions: Array<{ value: MaterialCategory | ""; label: string }> = [
  { value: "", label: "Todas" },
  { value: "MADERA", label: "Madera" },
  { value: "HERRAJES", label: "Herrajes" },
  { value: "OTROS", label: "Otros" },
];

function normalizeQuantity(value: string | number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsed));
}

function materialSearchText(material: MaterialItem): string {
  return [
    material.name,
    material.sku,
    material.category,
    material.type,
    material.color,
    material.supplierId,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function materialLineTotal(line: SelectedMaterialLine): number {
  return Number((line.quantity * line.unitPrice).toFixed(2));
}

export function MaterialListPicker({
  value,
  currency,
  onAddMaterial,
  onQuantityChange,
  onRemoveMaterial,
}: MaterialListPickerProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<MaterialCategory | "">("");
  const [typeFilter, setTypeFilter] = useState("");
  const [selectedOnly, setSelectedOnly] = useState(false);
  const [materials, setMaterials] = useState<MaterialItem[]>([]);
  const [knownMaterials, setKnownMaterials] = useState<Record<string, MaterialItem>>(
    {},
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedById = useMemo(() => {
    const map = new Map<string, SelectedMaterialLine>();
    value.forEach((line) => {
      map.set(line.materialId, line);
    });
    return map;
  }, [value]);

  useEffect(() => {
    let active = true;

    const loadMaterials = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const loaded: MaterialItem[] = [];
        let page = 1;
        let totalPages = 1;

        do {
          const result = await getMaterialsApi({
            page,
            limit: 100,
            ...(category ? { category } : {}),
            ...(search.trim() ? { search: search.trim() } : {}),
            activeOnly: true,
          });

          loaded.push(...result.items);
          totalPages = result.pagination.totalPages;
          page += 1;
        } while (page <= totalPages);

        if (!active) {
          return;
        }

        setMaterials(loaded);
        setKnownMaterials((current) => {
          const next = { ...current };
          loaded.forEach((material) => {
            next[material.id] = material;
          });
          return next;
        });
      } catch (error) {
        if (!active) {
          return;
        }

        setError(getApiErrorInfo(error, "No se pudieron cargar los materiales").message);
        setMaterials([]);
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    void loadMaterials();

    return () => {
      active = false;
    };
  }, [category, search]);

  const typeOptions = useMemo(() => {
    const types = new Set<string>();
    materials.forEach((material) => {
      if (material.type) {
        types.add(material.type);
      }
    });
    return Array.from(types).sort((left, right) => left.localeCompare(right));
  }, [materials]);

  const visibleMaterials = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return materials
      .filter((material) => {
        if (selectedOnly && !selectedById.has(material.id)) {
          return false;
        }

        if (typeFilter && material.type !== typeFilter) {
          return false;
        }

        if (!normalizedSearch) {
          return true;
        }

        return materialSearchText(material).includes(normalizedSearch);
      })
      .sort((left, right) => left.name.localeCompare(right.name));
  }, [materials, search, selectedById, selectedOnly, typeFilter]);

  const selectedLines = useMemo(
    () =>
      value.map((line) => ({
        line,
        material: knownMaterials[line.materialId] ?? null,
      })),
    [knownMaterials, value],
  );

  const selectedTotal = useMemo(
    () =>
      Number(
        value
          .reduce((acc, line) => acc + materialLineTotal(line), 0)
          .toFixed(2),
      ),
    [value],
  );

  return (
    <section className="material-list-picker">
      <div className="material-list-picker__toolbar">
        <label className="material-list-picker__search">
          <span>Buscar material</span>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nombre, SKU, tipo o color"
          />
        </label>

        <label>
          <span>Categoria</span>
          <select
            value={category}
            onChange={(event) =>
              setCategory(event.target.value as MaterialCategory | "")
            }
          >
            {categoryOptions.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Rubro</span>
          <select
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value)}
          >
            <option value="">Todos</option>
            {typeOptions.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <label className="material-list-picker__toggle">
          <input
            type="checkbox"
            checked={selectedOnly}
            onChange={(event) => setSelectedOnly(event.target.checked)}
          />
          <span>Seleccionados</span>
        </label>
      </div>

      <div className="material-list-picker__summary" aria-live="polite">
        <span>{value.length} materiales seleccionados</span>
        <strong>{formatMoney(selectedTotal, currency)}</strong>
      </div>

      {selectedLines.length > 0 ? (
        <div className="material-list-picker__selected">
          {selectedLines.map(({ line, material }) => (
            <div key={line.materialId} className="material-selected-row">
              <div>
                <strong>
                  {material?.name ?? `Material ${line.materialId.slice(-8)}`}
                </strong>
                <small>
                  {material?.sku ?? "-"} / {material?.type ?? "Sin rubro"} /{" "}
                  {formatMoney(line.unitPrice, currency)}
                </small>
              </div>
              <label>
                <span>Cantidad</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={line.quantity}
                  onChange={(event) =>
                    onQuantityChange(
                      line.materialId,
                      normalizeQuantity(event.target.value),
                    )
                  }
                />
              </label>
              <strong>{formatMoney(materialLineTotal(line), currency)}</strong>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => onRemoveMaterial(line.materialId)}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {isLoading ? <p className="text-muted">Cargando materiales...</p> : null}
      {!isLoading && error ? <p className="text-negative">{error}</p> : null}

      {!isLoading && !error ? (
        <div className="material-list-picker__results">
          {visibleMaterials.length === 0 ? (
            <p className="text-muted">No hay materiales para el filtro actual.</p>
          ) : (
            visibleMaterials.map((material) => {
              const selectedLine = selectedById.get(material.id);

              return (
                <article key={material.id} className="material-picker-row">
                  <div className="material-picker-row__main">
                    <strong>{material.name}</strong>
                    <small>
                      SKU {material.sku ?? "-"} / {material.type ?? "Sin rubro"}
                    </small>
                  </div>
                  <div className="material-picker-row__meta">
                    <span className={`budget-chip budget-chip--${material.category.toLowerCase()}`}>
                      {material.category}
                    </span>
                    <span>
                      Stock {material.currentStock} {material.unit}
                    </span>
                    <strong>{formatMoney(material.unitPrice ?? 0, currency)}</strong>
                  </div>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={() => onAddMaterial(material)}
                  >
                    {selectedLine ? `+1 (${selectedLine.quantity})` : "Agregar"}
                  </button>
                </article>
              );
            })
          )}
        </div>
      ) : null}
    </section>
  );
}
