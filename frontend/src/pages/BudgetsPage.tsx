import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

import { Pagination } from "../components/Pagination";
import { FormPopup } from "../components/FormPopup";

import {
  acceptBudgetApi,
  type AcceptBudgetInput,
  acceptBudgetWithDiscountApi,
  applyBudgetRecalculationApi,
  createBudgetApi,
  deleteBudgetApi,
  getBudgetByIdApi,
  getBudgetPricingAuditTrailApi,
  getBudgetsApi,
  getMaterialsApi,
  recalculateBudgetPricingApi,
  rejectBudgetApi,
  updateBudgetStatusApi,
  reviseBudgetApi,
  type MaterialItem,
  type BudgetPricingAuditEntry,
  type BudgetItemInput,
  type BudgetRecord,
  type BudgetStatus,
  getApiErrorInfo,
} from "../services/erp-api";
import {
  formatDate,
  formatMoneyWithCurrency as formatMoney,
  toDatetimeLocal,
} from "../utils/formatters";

const PAGE_SIZE = 8;

const statusOptions: Array<{ value: BudgetStatus | ""; label: string }> = [
  { value: "", label: "Todos" },
  { value: "DRAFT", label: "Borrador" },
  { value: "SENT", label: "Enviado" },
  { value: "APPROVED", label: "Aprobado" },
  { value: "REJECTED", label: "Rechazado" },
  { value: "CANCELED", label: "Cancelado" },
];

type EditableBudgetStatus = Exclude<BudgetStatus, "APPROVED">;

function normalizeEditableStatus(status: BudgetStatus): EditableBudgetStatus {
  if (status === "APPROVED") {
    return "SENT";
  }

  return status;
}

function toIsoDateTimeOrUndefined(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed) {
    return undefined;
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toISOString();
}

function getDefaultCollectionDueDateLocal(): string {
  return toDatetimeLocal(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString());
}

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

type BudgetAcceptModalState = {
  budget: BudgetRecord;
  withDiscount: boolean;
};

type BudgetAcceptanceLinks = {
  clientId: string;
  projectId: string;
  collectionId: string;
};

type BudgetRejectModalState = {
  budget: BudgetRecord;
};

type BudgetRowActionKind =
  | "status"
  | "accept"
  | "accept-with-discount"
  | "reject"
  | "recalculate"
  | "apply-recalculate"
  | "delete";

type BudgetActionState = {
  budgetId: string;
  kind: BudgetRowActionKind;
};

type BudgetActionFeedback = {
  tone: "success" | "error";
  message: string;
};

type BudgetTableAction = "edit" | "delete";

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

function buildFormFromBudget(budget?: BudgetRecord | null): BudgetFormState {
  if (!budget) {
    return emptyFormState;
  }

  return {
    clientId: budget.clientId ?? "",
    prospectName: budget.prospectName ?? "",
    prospectLocalidad: budget.prospectLocalidad ?? "",
    prospectContacto: budget.prospectContacto ?? "",
    prospectDireccion: budget.prospectDireccion ?? "",
    title: budget.title,
    description: budget.description ?? "",
    currency: budget.currency,
    status: normalizeEditableStatus(budget.status),
    items:
      budget.items.length > 0
        ? budget.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          }))
        : [{ ...emptyItem }],
    materials:
      budget.materials && budget.materials.length > 0
        ? budget.materials.map((material) => ({
            materialId: material.materialId,
            quantity: material.quantity,
            unitPrice: material.unitPrice,
          }))
        : [],
    laborHours: budget.laborHours ?? 0,
    hourlyRate: budget.laborCostPerHour ?? 0,
    sellerCommission: budget.commissionPercent ?? 13,
    employeeBonus: budget.bonusPercent ?? 10,
    shippingCost: budget.shippingCost ?? 0,
    packagingCost: budget.packagingCost ?? 0,
    marginType:
      budget.marginType === "COCINA_55" ? "COCINA_55" : "COMUN_40",
  };
}

function calculateItemTotal(item: BudgetItemInput): number {
  return Number((item.quantity * item.unitPrice).toFixed(2));
}

function calculateBudgetTotal(items: BudgetItemInput[]): number {
  return Number(
    items.reduce((acc, item) => acc + calculateItemTotal(item), 0).toFixed(2),
  );
}

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
  itemsTotal: number;
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
  const profitAmount = Number(
    ((projectCost * marginPercent) / 100).toFixed(2),
  );
  const itemUnitPrice = Number((projectCost + profitAmount).toFixed(2));
  const itemQuantityMultiplier = Math.max(
    1,
    formState.items.reduce((acc, item) => acc + normalizePositiveInteger(item.quantity), 0),
  );
  const multipliedItemsTotal = Number(
    (itemUnitPrice * itemQuantityMultiplier).toFixed(2),
  );
  const finalTotal = hasCostInputs ? multipliedItemsTotal : itemUnitPrice;

  return {
    materialsTotal: mainMaterialsCost,
    subtotalCosts,
    commissionAmount,
    bonusAmount,
    projectCost,
    marginPercent,
    profitAmount,
    itemUnitPrice,
    itemsTotal: finalTotal,
    finalTotal,
  };
}

function labelAuditReason(reason: BudgetPricingAuditEntry["reason"]): string {
  if (reason === "CREATE") {
    return "Creación";
  }

  if (reason === "REVISE") {
    return "Revisión";
  }

  return "Recálculo";
}

function labelBudgetAction(kind: BudgetRowActionKind): string {
  if (kind === "status") {
    return "actualización de estado";
  }
  if (kind === "accept") {
    return "aceptación";
  }
  if (kind === "accept-with-discount") {
    return "aceptación con descuento";
  }
  if (kind === "reject") {
    return "registro de rechazo";
  }
  if (kind === "recalculate") {
    return "recálculo de precios";
  }
  if (kind === "apply-recalculate") {
    return "aplicación de recálculo";
  }

  return "eliminación";
}

export function BudgetsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialBudgetId = searchParams.get("budgetId")?.trim() ?? "";
  const [rows, setRows] = useState<BudgetRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<BudgetActionFeedback | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [budgetAction, setBudgetAction] = useState<BudgetActionState | null>(
    null,
  );
  const [selectedBudgetId, setSelectedBudgetId] = useState<string | null>(
    initialBudgetId || null,
  );
  const [editingBudgetId, setEditingBudgetId] = useState<string | null>(null);
  const [formState, setFormState] = useState<BudgetFormState>(emptyFormState);
  const [selectedBudgetDetail, setSelectedBudgetDetail] =
    useState<BudgetRecord | null>(null);
  const [auditTrail, setAuditTrail] = useState<BudgetPricingAuditEntry[]>([]);
  const [isAuditLoading, setIsAuditLoading] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [openBudgetMenuId, setOpenBudgetMenuId] = useState<string | null>(null);
  const [acceptModal, setAcceptModal] =
    useState<BudgetAcceptModalState | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [acceptInput, setAcceptInput] = useState<AcceptBudgetInput>({});
  const [acceptanceLinksByBudgetId, setAcceptanceLinksByBudgetId] = useState<
    Record<string, BudgetAcceptanceLinks>
  >({});
  const [rejectModal, setRejectModal] = useState<BudgetRejectModalState | null>(
    null,
  );
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState<string | null>(null);
  const acceptTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rejectTriggerRef = useRef<HTMLButtonElement | null>(null);
  const budgetMenuRef = useRef<HTMLDivElement | null>(null);
  const acceptClientNameInputRef = useRef<HTMLInputElement | null>(null);
  const rejectReasonInputRef = useRef<HTMLTextAreaElement | null>(null);
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialCatalog, setMaterialCatalog] = useState<MaterialItem[]>([]);
  const [isMaterialCatalogLoading, setIsMaterialCatalogLoading] = useState(false);
  const [materialCatalogError, setMaterialCatalogError] = useState<string | null>(null);
  const [isHoursPopupOpen, setIsHoursPopupOpen] = useState(false);
  const [isHoursPopupMinimized, setIsHoursPopupMinimized] = useState(false);
  const [isBudgetFormOpen, setIsBudgetFormOpen] = useState(false);
  const [hourTasks, setHourTasks] = useState<HourTask[]>(
    DEFAULT_HOUR_TASKS.map((task) => ({ ...task })),
  );

  const page = Number(searchParams.get("page") ?? "1");
  const search = searchParams.get("search") ?? "";
  const status = (searchParams.get("status") ?? "") as BudgetStatus | "";
  const safePage = Number.isFinite(page) && page > 0 ? page : 1;

  useEffect(() => {
    let active = true;

    const load = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const data = await getBudgetsApi({
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
          setSelectedBudgetId((current) => current ?? data.items[0]._id);
        }
      } catch (error) {
        if (!active) {
          return;
        }

        setError(
          getApiErrorInfo(error, "No se pudieron cargar los presupuestos")
            .message,
        );
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

  const selectedBudget = useMemo(
    () => rows.find((budget) => budget._id === selectedBudgetId) ?? null,
    [rows, selectedBudgetId],
  );

  const selectedBudgetView = selectedBudgetId
    ? (selectedBudgetDetail ?? selectedBudget)
    : null;

  const selectedBudgetAcceptanceLinks = useMemo(() => {
    if (!selectedBudgetId) {
      return null;
    }

    return acceptanceLinksByBudgetId[selectedBudgetId] ?? null;
  }, [acceptanceLinksByBudgetId, selectedBudgetId]);

  const selectedProjectId =
    selectedBudgetView?.projectId ?? selectedBudgetAcceptanceLinks?.projectId ?? null;

  const selectedClientId =
    selectedBudgetView?.clientId ?? selectedBudgetAcceptanceLinks?.clientId ?? null;

  const selectedCollectionId =
    selectedBudgetView?.collectionId ??
    selectedBudgetAcceptanceLinks?.collectionId ??
    null;

  const selectedBudgetActionKind =
    selectedBudgetView && budgetAction?.budgetId === selectedBudgetView._id
      ? budgetAction.kind
      : null;

  const isAcceptModalSubmitting = useMemo(() => {
    if (!acceptModal || !budgetAction) {
      return false;
    }

    return (
      budgetAction.budgetId === acceptModal.budget._id &&
      (budgetAction.kind === "accept" ||
        budgetAction.kind === "accept-with-discount")
    );
  }, [acceptModal, budgetAction]);

  const isRejectModalSubmitting = useMemo(() => {
    if (!rejectModal || !budgetAction) {
      return false;
    }

    return (
      budgetAction.budgetId === rejectModal.budget._id &&
      budgetAction.kind === "reject"
    );
  }, [rejectModal, budgetAction]);

  useEffect(() => {
    if (!acceptModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      acceptClientNameInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [acceptModal]);

  useEffect(() => {
    if (!rejectModal) {
      return;
    }

    const timer = window.setTimeout(() => {
      rejectReasonInputRef.current?.focus();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rejectModal]);

  useEffect(() => {
    if (!selectedBudgetId) {
      return;
    }

    let active = true;

    const loadDetail = async () => {
      try {
        const detail = await getBudgetByIdApi(selectedBudgetId);
        if (!active) {
          return;
        }

        setSelectedBudgetDetail(detail);
      } catch {
        if (!active) {
          return;
        }

        setSelectedBudgetDetail(null);
      }
    };

    void loadDetail();

    return () => {
      active = false;
    };
  }, [selectedBudgetId]);

  useEffect(() => {
    if (!selectedBudgetId || rows.length === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      const activeRow = document.querySelector<HTMLTableRowElement>(
        ".budget-row-selected",
      );
      activeRow?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [rows, selectedBudgetId]);

  useEffect(() => {
    let active = true;

    const loadMaterials = async () => {
      setIsMaterialCatalogLoading(true);
      setMaterialCatalogError(null);
      try {
        const result = await getMaterialsApi({
          page: 1,
          limit: 50,
          search: materialSearch.trim() || undefined,
          activeOnly: true,
        });

        if (!active) {
          return;
        }

        setMaterialCatalog(result.items);
      } catch (error) {
        if (!active) {
          return;
        }

        setMaterialCatalogError(
          getApiErrorInfo(error, "No se pudieron cargar los materiales").message,
        );
        setMaterialCatalog([]);
      } finally {
        if (active) {
          setIsMaterialCatalogLoading(false);
        }
      }
    };

    void loadMaterials();

    return () => {
      active = false;
    };
  }, [materialSearch]);

  useEffect(() => {
    if (!openBudgetMenuId) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!budgetMenuRef.current?.contains(event.target as Node)) {
        setOpenBudgetMenuId(null);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpenBudgetMenuId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [openBudgetMenuId]);

  useEffect(() => {
    if (!selectedBudgetId) {
      return;
    }

    let active = true;

    const loadAudit = async () => {
      setIsAuditLoading(true);
      setAuditError(null);
      try {
        const trail = await getBudgetPricingAuditTrailApi(selectedBudgetId);
        if (!active) {
          return;
        }

        setAuditTrail(trail);
      } catch (error) {
        if (!active) {
          return;
        }

        const detailsError = getApiErrorInfo(
          error,
          "No se pudo cargar la trazabilidad del presupuesto",
        );
        setAuditError(detailsError.message);
        setAuditTrail([]);
      } finally {
        if (active) {
          setIsAuditLoading(false);
        }
      }
    };

    void loadAudit();

    return () => {
      active = false;
    };
  }, [selectedBudgetId]);

  const metrics = useMemo(() => {
    const total = rows.length;
    const approvedTotal = rows
      .filter((budget) => budget.status === "APPROVED")
      .reduce((acc, budget) => acc + budget.total, 0);
    const draftCount = rows.filter(
      (budget) => budget.status === "DRAFT",
    ).length;
    const average =
      total > 0
        ? rows.reduce((acc, budget) => acc + budget.total, 0) / total
        : 0;

    return { total, approvedTotal, draftCount, average };
  }, [rows]);

  const setPage = (next: number) => {
    setOpenBudgetMenuId(null);
    const params = new URLSearchParams(searchParams);
    params.set("page", String(next));
    setSearchParams(params);
  };

  const setFilter = (key: string, value: string) => {
    setOpenBudgetMenuId(null);
    const params = new URLSearchParams(searchParams);

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    params.set("page", "1");
    setSearchParams(params);
  };

  const selectBudget = (budgetId: string) => {
    setSelectedBudgetId(budgetId);
    setOpenBudgetMenuId(null);

    const params = new URLSearchParams(searchParams);
    params.set("budgetId", budgetId);
    setSearchParams(params);
  };

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

  const appendMaterial = async (material: MaterialItem) => {
    const existing = formState.materials.find(
      (entry) => entry.materialId === material.id,
    );

    if (existing) {
      setFormState((current) => ({
        ...current,
        materials: current.materials.map((entry) =>
          entry.materialId === material.id
            ? {
                ...entry,
                quantity: normalizePositiveInteger(entry.quantity + 1),
              }
            : entry,
        ),
      }));
      return;
    }

    setFormState((current) => ({
      ...current,
      materials: [
        ...current.materials,
        {
          materialId: material.id,
          quantity: 1,
          unitPrice: material.unitPrice ?? 0,
        },
      ],
    }));
  };

  const updateMaterial = (
    materialId: string,
    field: "quantity",
    value: number,
  ) => {
    setFormState((current) => ({
      ...current,
      materials: current.materials.map((entry) => {
        if (entry.materialId !== materialId) {
          return entry;
        }

        return { ...entry, [field]: normalizePositiveInteger(value) };
      }),
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

  const totalHoursFromTasks = useMemo(
    () => Number(hourTasks.reduce((acc, task) => acc + task.hours, 0).toFixed(2)),
    [hourTasks],
  );

  const openHoursPopup = () => {
    setHourTasks((current) => {
      if (current.length > 0) {
        return current;
      }
      return DEFAULT_HOUR_TASKS.map((task) => ({ ...task }));
    });
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

  const refreshList = async () => {
    const data = await getBudgetsApi({
      page: safePage,
      limit: PAGE_SIZE,
      ...(search ? { search } : {}),
      ...(status ? { status } : {}),
    });

    setRows(data.items);
    setTotalPages(Math.max(data.pagination.totalPages, 1));
    if (data.items.length > 0) {
      setSelectedBudgetId((current) => current ?? data.items[0]._id);
    }
  };

  const openBudgetForm = () => {
    setIsBudgetFormOpen(true);
  };

  const closeBudgetForm = () => {
    setIsBudgetFormOpen(false);
    setEditingBudgetId(null);
    setFormError(null);
  };

  const startCreate = () => {
    setEditingBudgetId(null);
    setSelectedBudgetId(null);
    setOpenBudgetMenuId(null);
    setFormState(emptyFormState);
    setFormError(null);
    setActionFeedback(null);
    openBudgetForm();
  };

  const startEdit = (budget: BudgetRecord) => {
    setEditingBudgetId(budget._id);
    setSelectedBudgetId(budget._id);
    setOpenBudgetMenuId(null);
    setFormState(buildFormFromBudget(budget));
    setFormError(null);
    setActionFeedback(null);
    openBudgetForm();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setFormError(null);

    const budgetPreview = calculateBudgetPreview(formState);
    const defaultItemDescription = formState.title.trim() || "Presupuesto";

    const normalizedItems = formState.items.map((item) => ({
      description: item.description.trim() || defaultItemDescription,
      quantity: normalizePositiveInteger(item.quantity),
      unitPrice: budgetPreview.itemUnitPrice,
    }));

    const itemsToPersist = normalizedItems
      .filter(
        (item) =>
          item.quantity > 0 &&
          item.unitPrice >= 0,
      )
      .map((item) => ({
        ...item,
      }));

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
            material.materialId.trim().length > 0 &&
            material.quantity > 0,
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
      setFormError(
        "Agrega al menos un item valido o un material con cantidad para el presupuesto",
      );
      setIsSaving(false);
      return;
    }

    const estimatedTotal = budgetPreview.finalTotal;

    if (estimatedTotal <= 0) {
      setFormError(
        "El monto total del presupuesto debe ser mayor a 0 para poder guardarlo",
      );
      setIsSaving(false);
      return;
    }

    try {
      if (editingBudgetId) {
        await reviseBudgetApi(editingBudgetId, {
          prospectName: payload.prospectName,
          prospectLocalidad: payload.prospectLocalidad,
          prospectContacto: payload.prospectContacto,
          prospectDireccion: payload.prospectDireccion,
          title: payload.title,
          description: payload.description,
          currency: payload.currency,
          items: payload.items,
          materials: payload.materials,
          laborHours: payload.laborHours,
          hourlyRate: payload.hourlyRate,
          sellerCommission: payload.sellerCommission,
          employeeBonus: payload.employeeBonus,
          shippingCost: payload.shippingCost,
          packagingCost: payload.packagingCost,
          marginType: payload.marginType,
          enableCommercialPricing: payload.enableCommercialPricing,
          status: payload.status,
        });
      } else {
        await createBudgetApi(payload);
      }

      await refreshList();
      closeBudgetForm();
      setFormState(emptyFormState);
    } catch (error) {
      setFormError(
        getApiErrorInfo(error, "No se pudo guardar el presupuesto").message,
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (
    budget: BudgetRecord,
    nextStatus: BudgetStatus,
  ) => {
    if (budgetAction?.budgetId === budget._id) {
      return;
    }

    setBudgetAction({ budgetId: budget._id, kind: "status" });
    setActionFeedback(null);
    try {
      await updateBudgetStatusApi(budget._id, nextStatus);
      await refreshList();
      setSelectedBudgetId(budget._id);
      setActionFeedback({
        tone: "success",
        message: `Estado actualizado a ${nextStatus}.`,
      });
    } catch (error) {
      setActionFeedback({
        tone: "error",
        message: getApiErrorInfo(
          error,
          "No se pudo actualizar el estado del presupuesto",
        ).message,
      });
    } finally {
      setBudgetAction(null);
    }
  };

  const openAcceptModal = (
    budget: BudgetRecord,
    withDiscount: boolean,
    triggerElement: HTMLButtonElement,
  ) => {
    acceptTriggerRef.current = triggerElement;
    setAcceptError(null);
    setAcceptInput({
      clientName: budget.prospectName ?? undefined,
      contactName:
        budget.prospectContacto ?? budget.prospectContactName ?? undefined,
      email: budget.prospectEmail ?? undefined,
      phone: budget.prospectPhone ?? budget.prospectContacto ?? undefined,
      notes: budget.prospectNotes ?? undefined,
      projectName: budget.title,
      projectDescription: budget.description ?? undefined,
      collectionDueDate: getDefaultCollectionDueDateLocal(),
    });
    setAcceptModal({ budget, withDiscount });
  };

  const closeAcceptModal = () => {
    if (isAcceptModalSubmitting) {
      return;
    }
    setAcceptModal(null);
    setAcceptError(null);

    const trigger = acceptTriggerRef.current;
    if (trigger) {
      window.setTimeout(() => {
        trigger.focus();
      }, 0);
    }
  };

  const handleConfirmAccept = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!acceptModal) {
      return;
    }

    if (isAcceptModalSubmitting) {
      return;
    }

    setBudgetAction({
      budgetId: acceptModal.budget._id,
      kind: acceptModal.withDiscount ? "accept-with-discount" : "accept",
    });
    setActionFeedback(null);
    setAcceptError(null);

    try {
      const projectDeliveryDate = toIsoDateTimeOrUndefined(
        acceptInput.projectDeliveryDate,
      );
      const collectionDueDate = toIsoDateTimeOrUndefined(
        acceptInput.collectionDueDate,
      );

      const payload: AcceptBudgetInput = {
        ...(acceptInput.clientName?.trim()
          ? { clientName: acceptInput.clientName.trim() }
          : {}),
        ...(acceptInput.contactName?.trim()
          ? { contactName: acceptInput.contactName.trim() }
          : {}),
        ...(acceptInput.email?.trim()
          ? { email: acceptInput.email.trim() }
          : {}),
        ...(acceptInput.phone?.trim()
          ? { phone: acceptInput.phone.trim() }
          : {}),
        ...(acceptInput.notes?.trim()
          ? { notes: acceptInput.notes.trim() }
          : {}),
        ...(acceptInput.projectName?.trim()
          ? { projectName: acceptInput.projectName.trim() }
          : {}),
        ...(acceptInput.projectDescription?.trim()
          ? { projectDescription: acceptInput.projectDescription.trim() }
          : {}),
        ...(projectDeliveryDate ? { projectDeliveryDate } : {}),
        ...(collectionDueDate ? { collectionDueDate } : {}),
        ...(acceptInput.collectionNotes?.trim()
          ? { collectionNotes: acceptInput.collectionNotes.trim() }
          : {}),
      };

      const result = acceptModal.withDiscount
        ? await acceptBudgetWithDiscountApi(acceptModal.budget._id, payload)
        : await acceptBudgetApi(acceptModal.budget._id, payload);

      setAcceptanceLinksByBudgetId((current) => ({
        ...current,
        [result.budget._id]: {
          clientId: result.clientId,
          projectId: result.projectId,
          collectionId: result.collectionId,
        },
      }));

      await refreshList();
      setSelectedBudgetId(result.budget._id);
      setAcceptModal(null);
      const trigger = acceptTriggerRef.current;
      if (trigger) {
        window.setTimeout(() => {
          trigger.focus();
        }, 0);
      }

      const stockAlertSuffix =
        result.stockAlerts && result.stockAlerts.length > 0
          ? ` Reserva parcial en ${result.stockAlerts.length} material(es) por faltante de stock.`
          : "";

      setActionFeedback({
        tone: "success",
        message: `${acceptModal.withDiscount ? "Aceptado con descuento" : "Presupuesto aceptado"}. Proyecto ${result.projectId.slice(-8)} creado con conversión completa.${stockAlertSuffix}`,
      });
    } catch (error) {
      setAcceptError(
        getApiErrorInfo(
          error,
          acceptModal.withDiscount
            ? "No se pudo aceptar el presupuesto con descuento"
            : "No se pudo aceptar el presupuesto",
        ).message,
      );
    } finally {
      setBudgetAction(null);
    }
  };

  const openRejectModal = (
    budget: BudgetRecord,
    triggerElement: HTMLButtonElement,
  ) => {
    rejectTriggerRef.current = triggerElement;
    setRejectReason("");
    setRejectError(null);
    setRejectModal({ budget });
  };

  const closeRejectModal = () => {
    if (isRejectModalSubmitting) {
      return;
    }

    setRejectModal(null);
    setRejectReason("");
    setRejectError(null);

    const trigger = rejectTriggerRef.current;
    if (trigger) {
      window.setTimeout(() => {
        trigger.focus();
      }, 0);
    }
  };

  const handleConfirmReject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!rejectModal) {
      return;
    }

    if (isRejectModalSubmitting) {
      return;
    }

    const budget = rejectModal.budget;
    setBudgetAction({ budgetId: budget._id, kind: "reject" });
    setActionFeedback(null);
    setRejectError(null);

    try {
      const rejected = await rejectBudgetApi(budget._id, rejectReason);
      await refreshList();
      setSelectedBudgetId(rejected._id);
      setRejectModal(null);
      const trigger = rejectTriggerRef.current;
      if (trigger) {
        window.setTimeout(() => {
          trigger.focus();
        }, 0);
      }

      if (rejected.status === "CANCELED") {
        setActionFeedback({
          tone: "success",
          message: "Segundo rechazo registrado. Presupuesto cancelado.",
        });
      } else {
        setActionFeedback({
          tone: "success",
          message: `Rechazo registrado. Descuento ${rejected.discountPercentage ?? 10}% ofrecido.`,
        });
      }
    } catch (error) {
      setRejectError(
        getApiErrorInfo(
          error,
          "No se pudo registrar el rechazo del presupuesto",
        ).message,
      );
    } finally {
      setBudgetAction(null);
    }
  };

  const handleDelete = async (budget: BudgetRecord) => {
    if (budgetAction?.budgetId === budget._id) {
      return;
    }

    if (!window.confirm(`Eliminar ${budget.title}?`)) {
      return;
    }

    setBudgetAction({ budgetId: budget._id, kind: "delete" });
    setActionFeedback(null);
    try {
      await deleteBudgetApi(budget._id);
      await refreshList();

      if (selectedBudgetId === budget._id) {
        setSelectedBudgetId(null);
      }
    } catch (error) {
      setActionFeedback({
        tone: "error",
        message: getApiErrorInfo(error, "No se pudo eliminar el presupuesto")
          .message,
      });
    } finally {
      setBudgetAction(null);
    }
  };

  const handleBudgetTableAction = async (
    budget: BudgetRecord,
    action: BudgetTableAction,
  ) => {
    if (action === "edit") {
      startEdit(budget);
      return;
    }

    await handleDelete(budget);
  };

  const toggleBudgetMenu = (budgetId: string) => {
    setOpenBudgetMenuId((current) => (current === budgetId ? null : budgetId));
  };

  const handleRecalculate = async (budget: BudgetRecord) => {
    if (budgetAction?.budgetId === budget._id) {
      return;
    }

    setBudgetAction({ budgetId: budget._id, kind: "recalculate" });
    setActionFeedback(null);
    try {
      const result = await recalculateBudgetPricingApi(budget._id);
      setActionFeedback({
        tone: "success",
        message: `Recálculo listo. Diferencia final: ${formatMoney(
          result.differences.finalPriceDiff,
          budget.currency,
        )}`,
      });
    } catch (error) {
      setActionFeedback({
        tone: "error",
        message: getApiErrorInfo(error, "No se pudo recalcular el presupuesto")
          .message,
      });
    } finally {
      setBudgetAction(null);
    }
  };

  const handleApplyRecalculate = async (budget: BudgetRecord) => {
    if (budgetAction?.budgetId === budget._id) {
      return;
    }

    setBudgetAction({ budgetId: budget._id, kind: "apply-recalculate" });
    setActionFeedback(null);
    try {
      const result = await applyBudgetRecalculationApi(budget._id);
      await refreshList();
      setSelectedBudgetId(result.budget._id);
      setActionFeedback({
        tone: "success",
        message: `Recálculo aplicado. Diferencia final: ${formatMoney(
          result.differences.finalPriceDiff,
          result.budget.currency,
        )}`,
      });
    } catch (error) {
      setActionFeedback({
        tone: "error",
        message: getApiErrorInfo(
          error,
          "No se pudo aplicar el recalculo (puede estar aprobado o vinculado)",
        ).message,
      });
    } finally {
      setBudgetAction(null);
    }
  };

  return (
    <section className="page-content">
      <p className="page-breadcrumb">Comercial · Presupuestos</p>

      <header className="page-header">
        <div>
          <h2>Presupuestos</h2>
          <p>
            Flujo comercial de alta, revisión y aprobación antes del paso a
            proyecto.
          </p>
        </div>
        <div className="view-controls">
          <button
            className="btn btn-secondary"
            type="button"
            onClick={startCreate}
          >
            Nuevo presupuesto
          </button>
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => navigate("/projects")}
          >
            Ir a proyectos
          </button>
        </div>
      </header>

      {actionFeedback && (
        <article
          className={`panel ${
            actionFeedback.tone === "error" ? "panel--error" : "panel--success"
          } budget-feedback-panel`}
          role={actionFeedback.tone === "error" ? "alert" : "status"}
          aria-live="polite"
        >
          <p
            className={
              actionFeedback.tone === "error"
                ? "text-negative"
                : "text-positive"
            }
          >
            {actionFeedback.message}
          </p>
        </article>
      )}

      <div className="kpi-grid">
        <article className="kpi-card">
          <h3>Presupuestos visibles</h3>
          <strong>{metrics.total}</strong>
          <small className="kpi-neutral">Resultado de filtros activos</small>
        </article>
        <article className="kpi-card">
          <h3>Monto aprobado</h3>
          <strong>{formatMoney(metrics.approvedTotal)}</strong>
          <small className="kpi-positive">Potencial de conversión</small>
        </article>
        <article className="kpi-card">
          <h3>Borradores</h3>
          <strong>{metrics.draftCount}</strong>
          <small>Listos para envío</small>
        </article>
        <article className="kpi-card">
          <h3>Ticket promedio</h3>
          <strong>{formatMoney(metrics.average)}</strong>
          <small>Promedio de la página actual</small>
        </article>
      </div>

      <article className="panel">
        <div className="budget-toolbar">
          <label className="clients-search">
            <span>Buscar</span>
            <input
              type="search"
              value={search}
              placeholder="Título, descripción o grupo"
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
        </div>
      </article>

      <div className="panel-grid budgets-layout">
        <article className="panel budgets-table-panel">
          <div className="table-wrapper">
            <table className="table table-compact">
              <thead>
                <tr>
                  <th>Presupuesto</th>
                  <th>Cliente</th>
                  <th>Estado</th>
                  <th>Versión</th>
                  <th>Total</th>
                  <th>Actualizado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Cargando presupuestos...
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
                      No hay presupuestos para mostrar
                    </td>
                  </tr>
                )}
                {!isLoading &&
                  !error &&
                  rows.map((budget) => (
                    (() => {
                      const isActionRunning = budgetAction?.budgetId === budget._id;
                      const isApproved = budget.status === "APPROVED";
                      const isCanceled = budget.status === "CANCELED";
                      const isRejected = budget.status === "REJECTED";
                      const canRecalculate = !isActionRunning && !isApproved && !isCanceled;
                      const canApplyRecalculation = !isActionRunning && !isApproved && !isCanceled;
                      const canAccept = !isActionRunning && !isApproved && !isCanceled && !isRejected;
                      const canAcceptWithDiscount = !isActionRunning && isRejected;
                      const canReject = !isActionRunning && !isApproved && !isCanceled;
                      const canMarkSent = !isActionRunning && budget.status === "DRAFT";

                      return (
                    <tr
                      key={budget._id}
                      className={
                        selectedBudgetId === budget._id
                          ? "budget-row-selected"
                          : undefined
                      }
                      onClick={() => selectBudget(budget._id)}
                    >
                      <td>
                        <div className="project-cell">
                          <strong>{budget.title}</strong>
                          <small>{budget.versionGroupId.slice(-8)}</small>
                        </div>
                      </td>
                      <td>
                        {budget.clientId?.slice(-8) ??
                          budget.prospectName ??
                          "Prospecto"}
                      </td>
                      <td>
                        <span
                          className={`budget-chip budget-chip--${budget.status.toLowerCase()}`}
                        >
                          {budget.status}
                        </span>
                      </td>
                      <td>v{budget.version}</td>
                      <td>{formatMoney(budget.total, budget.currency)}</td>
                      <td>{formatDate(budget.updatedAt)}</td>
                      <td>
                        <div
                          className="budget-actions"
                          onClick={(event) => event.stopPropagation()}
                        >
                          <div
                            className="budget-actions-menu"
                            ref={
                              openBudgetMenuId === budget._id
                                ? budgetMenuRef
                                : undefined
                            }
                          >
                            <button
                              type="button"
                              className="btn btn-tertiary budget-actions-trigger"
                              aria-label="Abrir acciones del presupuesto"
                              aria-expanded={openBudgetMenuId === budget._id}
                              onClick={() => toggleBudgetMenu(budget._id)}
                            >
                              Acciones
                            </button>
                            {openBudgetMenuId === budget._id && (
                              <div className="budget-actions-dropdown" role="menu">
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canRecalculate}
                                  onClick={() => {
                                    setOpenBudgetMenuId(null);
                                    void handleRecalculate(budget);
                                  }}
                                >
                                  {isActionRunning
                                    ? "Procesando..."
                                    : "Recalcular"}
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canApplyRecalculation}
                                  onClick={() => {
                                    setOpenBudgetMenuId(null);
                                    void handleApplyRecalculate(budget);
                                  }}
                                >
                                  Aplicar recálculo
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canAccept}
                                  onClick={(event) => {
                                    setOpenBudgetMenuId(null);
                                    openAcceptModal(
                                      budget,
                                      false,
                                      event.currentTarget,
                                    );
                                  }}
                                >
                                  Aceptar
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canAcceptWithDiscount}
                                  onClick={(event) => {
                                    setOpenBudgetMenuId(null);
                                    openAcceptModal(
                                      budget,
                                      true,
                                      event.currentTarget,
                                    );
                                  }}
                                >
                                  Aceptar c/descuento
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canReject}
                                  onClick={(event) => {
                                    setOpenBudgetMenuId(null);
                                    openRejectModal(budget, event.currentTarget);
                                  }}
                                >
                                  Rechazar
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={!canMarkSent}
                                  onClick={() => {
                                    setOpenBudgetMenuId(null);
                                    void handleStatusChange(budget, "SENT");
                                  }}
                                >
                                  Marcar enviado
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item"
                                  role="menuitem"
                                  disabled={isActionRunning}
                                  onClick={() => {
                                    setOpenBudgetMenuId(null);
                                    void handleBudgetTableAction(budget, "edit");
                                  }}
                                >
                                  Editar
                                </button>
                                <button
                                  type="button"
                                  className="budget-actions-dropdown__item budget-actions-dropdown__item--danger"
                                  role="menuitem"
                                  disabled={isActionRunning}
                                  onClick={() => {
                                    setOpenBudgetMenuId(null);
                                    void handleBudgetTableAction(budget, "delete");
                                  }}
                                >
                                  Eliminar
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                      );
                    })()
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
                <h3>Detalle</h3>
                <p>Resumen operativo del presupuesto seleccionado.</p>
              </div>
              {selectedBudgetView && (
                <span
                  className={`budget-chip budget-chip--${selectedBudgetView.status.toLowerCase()}`}
                >
                  {selectedBudgetView.status}
                </span>
              )}
            </div>

            {selectedBudgetView ? (
              <div className="budget-detail">
                <div className="budget-detail__meta">
                  <div>
                    <span>Cliente / Prospecto</span>
                    <strong>
                      {selectedBudgetView.clientId ??
                        selectedBudgetView.prospectName ??
                        "Prospecto"}
                    </strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>
                      {formatMoney(
                        selectedBudgetView.total,
                        selectedBudgetView.currency,
                      )}
                    </strong>
                  </div>
                  {typeof selectedBudgetView.discountedTotal === "number" && (
                    <div>
                      <span>Total con descuento</span>
                      <strong>
                        {formatMoney(
                          selectedBudgetView.discountedTotal,
                          selectedBudgetView.currency,
                        )}
                      </strong>
                    </div>
                  )}
                  <div>
                    <span>Subtotal</span>
                    <strong>
                      {formatMoney(
                        selectedBudgetView.subtotal,
                        selectedBudgetView.currency,
                      )}
                    </strong>
                  </div>
                  <div>
                    <span>Actualizado</span>
                    <strong>{formatDate(selectedBudgetView.updatedAt)}</strong>
                  </div>
                  <div>
                    <span>Rechazos</span>
                    <strong>{selectedBudgetView.rejectionCount ?? 0}</strong>
                  </div>
                  <div>
                    <span>Proyecto</span>
                    <strong>
                      {selectedProjectId ? selectedProjectId.slice(-8) : "-"}
                    </strong>
                  </div>
                  <div>
                    <span>Cobranza</span>
                    <strong>
                      {selectedCollectionId?.slice(-8) ??
                        (selectedProjectId
                          ? "Sin cobranza asociada"
                          : "-")}
                    </strong>
                  </div>
                  <div>
                    <span>Localidad</span>
                    <strong>{selectedBudgetView.prospectLocalidad ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Contacto</span>
                    <strong>{selectedBudgetView.prospectContacto ?? "-"}</strong>
                  </div>
                  <div>
                    <span>Direccion</span>
                    <strong>{selectedBudgetView.prospectDireccion ?? "-"}</strong>
                  </div>
                </div>

                <div className="budget-detail-context">
                  <span className="budget-chip budget-chip--sent">
                    Cliente: {selectedClientId ? selectedClientId.slice(-8) : "-"}
                  </span>
                  <span className="budget-chip budget-chip--ordered">
                    Proyecto: {selectedProjectId ? selectedProjectId.slice(-8) : "-"}
                  </span>
                  <span className="budget-chip budget-chip--parcial">
                    Cobranza: {selectedCollectionId ? selectedCollectionId.slice(-8) : "-"}
                  </span>
                </div>

                {selectedBudgetActionKind && (
                  <p className="budget-action-inline" role="status" aria-live="polite">
                    Procesando {labelBudgetAction(selectedBudgetActionKind)}...
                  </p>
                )}

                <div className="future-modal__actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!selectedProjectId}
                    onClick={() => {
                      if (!selectedProjectId) {
                        return;
                      }

                      const query = new URLSearchParams({
                        search: selectedProjectId,
                      });
                      navigate(`/projects?${query.toString()}`);
                    }}
                  >
                    Ver proyecto
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={!selectedCollectionId}
                    onClick={() => {
                      const query = new URLSearchParams();
                      if (selectedBudgetView?._id) {
                        query.set("budgetId", selectedBudgetView._id);
                      }
                      if (selectedProjectId) {
                        query.set("projectId", selectedProjectId);
                      }
                      if (selectedClientId) {
                        query.set("clientId", selectedClientId);
                      }
                      if (selectedCollectionId) {
                        query.set("collectionId", selectedCollectionId);
                      }

                      navigate(`/collections?${query.toString()}`);
                    }}
                  >
                    Ir a cobranzas
                  </button>
                </div>

                <div className="budget-detail__items">
                  {selectedBudgetView.items.map((item) => (
                    <div
                      key={`${item.description}-${item.total}`}
                      className="budget-detail__item"
                    >
                      <div>
                        <strong>{item.description}</strong>
                        <small>
                          {item.quantity} x{" "}
                          {formatMoney(item.unitPrice, selectedBudgetView.currency)}
                        </small>
                      </div>
                      <strong>
                        {formatMoney(item.total, selectedBudgetView.currency)}
                      </strong>
                    </div>
                  ))}
                </div>

                {selectedBudgetView.materials && selectedBudgetView.materials.length > 0 && (
                  <div className="budget-detail__items">
                    <h4>Materiales presupuestados</h4>
                    {selectedBudgetView.materials.map((material) => (
                      <div
                        key={`${material.materialId}-${material.total}`}
                        className="budget-detail__item"
                      >
                        <div>
                          <strong>Material {material.materialId.slice(-8)}</strong>
                          <small>
                            {material.quantity} x {formatMoney(material.unitPrice, selectedBudgetView.currency)}
                          </small>
                        </div>
                        <strong>{formatMoney(material.total, selectedBudgetView.currency)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="budget-detail__items">
                  <h4>Composición comercial</h4>
                  <div className="budget-detail__item">
                    <span>Subtotal</span>
                    <strong>{formatMoney(selectedBudgetView.subtotal, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Mano de obra</span>
                    <strong>{formatMoney(selectedBudgetView.laborCost ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Comisión vendedor</span>
                    <strong>{formatMoney(selectedBudgetView.commissionAmount ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Bono empleado</span>
                    <strong>{formatMoney(selectedBudgetView.bonusAmount ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Envío</span>
                    <strong>{formatMoney(selectedBudgetView.shippingCost ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Embalaje</span>
                    <strong>{formatMoney(selectedBudgetView.packagingCost ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Ganancia ({(selectedBudgetView.marginPercent ?? 0).toFixed(2)}%)</span>
                    <strong>{formatMoney(selectedBudgetView.marginAmount ?? 0, selectedBudgetView.currency)}</strong>
                  </div>
                  <div className="budget-detail__item">
                    <span>Precio final</span>
                    <strong>{formatMoney(selectedBudgetView.finalPrice ?? selectedBudgetView.total, selectedBudgetView.currency)}</strong>
                  </div>
                </div>

                <div className="budget-detail__items">
                  <h4>Trazabilidad de precio</h4>
                  {isAuditLoading && <p className="text-muted">Cargando auditoría...</p>}
                  {!isAuditLoading && auditError && (
                    <p className="text-negative">{auditError}</p>
                  )}
                  {!isAuditLoading && !auditError && auditTrail.length === 0 && (
                    <p className="text-muted">Sin registros de auditoría por ahora.</p>
                  )}
                  {!isAuditLoading &&
                    !auditError &&
                    auditTrail.map((entry) => (
                      <div key={entry._id} className="budget-detail__item">
                        <div>
                          <strong>
                            {labelAuditReason(entry.reason)} · v{entry.budgetVersion}
                          </strong>
                          <small>{formatDate(entry.createdAt)}</small>
                        </div>
                        <strong>
                          {formatMoney(entry.finalPrice, selectedBudgetView.currency)}
                        </strong>
                      </div>
                    ))}
                </div>
              </div>
            ) : (
              <p className="text-muted">
                Selecciona un presupuesto para ver su detalle.
              </p>
            )}
          </article>

          <FormPopup
            isOpen={isBudgetFormOpen}
            title={editingBudgetId ? "Revisar presupuesto" : "Nuevo presupuesto"}
            subtitle={
              editingBudgetId
                ? "Genera una revision a partir del presupuesto seleccionado."
                : "Carga un presupuesto nuevo y deja listo el flujo comercial."
            }
            onRequestClose={closeBudgetForm}
            onMinimize={closeBudgetForm}
          >
            <div className="clients-form-header">
              <div>
                <h3>
                  {editingBudgetId
                    ? "Revisar presupuesto"
                    : "Nuevo presupuesto"}
                </h3>
                <p>
                  {editingBudgetId
                    ? "Genera una revision a partir del presupuesto seleccionado."
                    : "Carga un presupuesto nuevo y deja listo el flujo comercial."}
                </p>
              </div>
              {editingBudgetId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={startCreate}
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
                <span>Título *</span>
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
                <span>Descripción</span>
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

              <div className="budget-items">
                <div className="budget-items__header">
                  <h4>Materiales (Stock)</h4>
                </div>

                <label>
                  <span>Buscar material</span>
                  <input
                    type="search"
                    value={materialSearch}
                    onChange={(event) => setMaterialSearch(event.target.value)}
                    placeholder="Nombre, SKU o tipo"
                  />
                </label>

                {isMaterialCatalogLoading && (
                  <p className="text-muted">Cargando materiales...</p>
                )}
                {!isMaterialCatalogLoading && materialCatalogError && (
                  <p className="text-negative">{materialCatalogError}</p>
                )}

                {!isMaterialCatalogLoading && !materialCatalogError && (
                  <div className="budget-detail__items">
                    {materialCatalog.length === 0 ? (
                      <p className="text-muted">
                        No hay materiales activos para el filtro actual.
                      </p>
                    ) : (
                      materialCatalog.slice(0, 12).map((material) => {
                        const materialAlreadySelected = formState.materials.some(
                          (entry) => entry.materialId === material.id,
                        );
                        return (
                          <div
                            key={material.id}
                            className="budget-detail__item"
                          >
                            <div>
                              <strong>{material.name}</strong>
                              <small>
                                SKU {material.sku ?? "-"} · Stock{" "}
                                {material.currentStock} {material.unit} · Precio{" "}
                                {formatMoney(
                                  material.unitPrice ?? 0,
                                  formState.currency,
                                )}
                              </small>
                            </div>
                            <button
                              type="button"
                              className="btn btn-tertiary"
                              onClick={() => void appendMaterial(material)}
                            >
                              {materialAlreadySelected ? "+1" : "Agregar"}
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {formState.materials.length > 0 &&
                  formState.materials.map((material) => {
                    const materialMeta = materialCatalog.find(
                      (catalogItem) => catalogItem.id === material.materialId,
                    );

                    return (
                      <div key={material.materialId} className="budget-item-row">
                        <label>
                          <span>Material</span>
                          <input
                            type="text"
                            value={
                              materialMeta?.name ??
                              `Material ${material.materialId.slice(-8)}`
                            }
                            disabled
                          />
                        </label>
                        <label>
                          <span>Cantidad</span>
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={material.quantity}
                            onChange={(event) =>
                              updateMaterial(
                                material.materialId,
                                "quantity",
                                Number(event.target.value),
                              )
                            }
                          />
                        </label>
                        <div className="budget-item-row__total">
                          <span>Precio unitario</span>
                          <strong>
                            {formatMoney(material.unitPrice, formState.currency)}
                          </strong>
                        </div>
                        <div className="budget-item-row__total">
                          <span>Total</span>
                          <strong>
                            {formatMoney(
                              calculateMaterialLineTotal(
                                material.quantity,
                                material.unitPrice,
                              ),
                              formState.currency,
                            )}
                          </strong>
                        </div>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => removeMaterial(material.materialId)}
                        >
                          Quitar
                        </button>
                      </div>
                    );
                  })}
              </div>

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
                  <span>Costo de envío</span>
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
                <label>
                  <span>Comisión vendedor (%)</span>
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
              </div>

              <div className="budget-form__row">
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
                <label>
                  <span>Margen final</span>
                  <select
                    value={formState.marginType}
                    onChange={(event) =>
                      setFormState((current) => ({
                        ...current,
                        marginType: event.target.value as
                          | "COMUN_40"
                          | "COCINA_55",
                      }))
                    }
                  >
                    <option value="COMUN_40">Común 40%</option>
                    <option value="COCINA_55">Cocina 55%</option>
                  </select>
                </label>
              </div>

              <p className="budget-form__note">
                Comisión y bono se calculan como porcentaje del subtotal de
                costos (materiales + mano de obra + envío + embalaje).
              </p>

              <div className="budget-summary">
                <span>Resumen comercial (estimado)</span>
                <strong>
                  {formatMoney(calculateBudgetPreview(formState).finalTotal, formState.currency)}
                </strong>
              </div>

              <div className="budget-detail__items">
                <div className="budget-detail__item">
                  <span>Base materiales/items</span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).materialsTotal, formState.currency)}
                  </strong>
                </div>
                <div className="budget-detail__item">
                  <span>Subtotal de costos</span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).subtotalCosts, formState.currency)}
                  </strong>
                </div>
                <div className="budget-detail__item">
                  <span>Comisión vendedor</span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).commissionAmount, formState.currency)}
                  </strong>
                </div>
                <div className="budget-detail__item">
                  <span>Bono empleado</span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).bonusAmount, formState.currency)}
                  </strong>
                </div>
                <div className="budget-detail__item">
                  <span>Costo del proyecto</span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).projectCost, formState.currency)}
                  </strong>
                </div>
                <div className="budget-detail__item">
                  <span>
                    Margen ({calculateBudgetPreview(formState).marginPercent}%)
                  </span>
                  <strong>
                    {formatMoney(calculateBudgetPreview(formState).profitAmount, formState.currency)}
                  </strong>
                </div>
              </div>

              <div className="budget-items">
                <div className="budget-items__header">
                  <h4>Items</h4>
                  <button
                    type="button"
                    className="btn btn-tertiary"
                    onClick={appendItem}
                  >
                    + Agregar item
                  </button>
                </div>
                {formState.items.map((item, index) => (
                  <div
                    key={`${index}-${item.description}`}
                    className="budget-item-row"
                  >
                    <label>
                      <span>Descripción</span>
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
                          updateItem(
                            index,
                            "quantity",
                            Number(event.target.value),
                          )
                        }
                      />
                    </label>
                    <div className="budget-item-row__total">
                      <span>Precio unitario</span>
                      <strong>
                        {formatMoney(
                          calculateBudgetPreview(formState).itemUnitPrice,
                          formState.currency,
                        )}
                      </strong>
                    </div>
                    <div className="budget-item-row__total">
                      <span>Total</span>
                      <strong>
                        {formatMoney(
                          calculateMaterialLineTotal(
                            normalizePositiveInteger(item.quantity),
                            calculateBudgetPreview(formState).itemUnitPrice,
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

              <p className="text-muted">
                El precio final se recalcula en backend con horas x cuota horaria,
                comisión/bono comercial y margen seleccionado.
              </p>

              {formError && <p className="form-error">{formError}</p>}

              <div className="clients-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  {isSaving
                    ? "Guardando..."
                    : editingBudgetId
                      ? "Guardar revision"
                      : "Crear presupuesto"}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={startCreate}
                >
                  Reiniciar
                </button>
              </div>
            </form>
          </FormPopup>
        </div>
      </div>

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

      {acceptModal ? (
        <div
          className="future-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-accept-title"
          aria-describedby={
            acceptError ? "budget-accept-error" : "budget-accept-description"
          }
          onClick={closeAcceptModal}
        >
          <div
            className="future-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="budget-accept-title">
              {acceptModal.withDiscount
                ? "Aceptar con descuento"
                : "Aceptar presupuesto"}
            </h2>
            <p id="budget-accept-description">
              Completa solo los datos que quieras ajustar antes de crear cliente,
              proyecto y cobranza.
            </p>

            <form className="budget-form" onSubmit={(event) => void handleConfirmAccept(event)}>
              <div className="budget-form__row">
                <label>
                  <span>Nombre cliente</span>
                  <input
                    ref={acceptClientNameInputRef}
                    type="text"
                    value={acceptInput.clientName ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        clientName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Contacto</span>
                  <input
                    type="text"
                    value={acceptInput.contactName ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        contactName: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="budget-form__row">
                <label>
                  <span>Email</span>
                  <input
                    type="email"
                    value={acceptInput.email ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        email: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Telefono</span>
                  <input
                    type="text"
                    value={acceptInput.phone ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        phone: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <div className="budget-form__row">
                <label>
                  <span>Nombre proyecto</span>
                  <input
                    type="text"
                    value={acceptInput.projectName ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        projectName: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Vencimiento cobranza</span>
                  <input
                    type="datetime-local"
                    value={acceptInput.collectionDueDate ?? ""}
                    onChange={(event) =>
                      setAcceptInput((current) => ({
                        ...current,
                        collectionDueDate: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>

              <label>
                <span>Notas</span>
                <textarea
                  rows={3}
                  value={acceptInput.notes ?? ""}
                  onChange={(event) =>
                    setAcceptInput((current) => ({
                      ...current,
                      notes: event.target.value,
                    }))
                  }
                />
              </label>

              {acceptError && (
                <p
                  id="budget-accept-error"
                  className="form-error"
                  role="alert"
                  aria-live="assertive"
                >
                  {acceptError}
                </p>
              )}

              <div className="future-modal__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeAcceptModal}
                  disabled={isAcceptModalSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isAcceptModalSubmitting}>
                  {isAcceptModalSubmitting
                    ? "Procesando..."
                    : acceptModal.withDiscount
                      ? "Aceptar con descuento"
                      : "Aceptar presupuesto"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {rejectModal ? (
        <div
          className="future-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="budget-reject-title"
          aria-describedby={
            rejectError ? "budget-reject-error" : "budget-reject-description"
          }
          onClick={closeRejectModal}
        >
          <div
            className="future-modal__content"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="budget-reject-title">Registrar rechazo</h2>
            <p id="budget-reject-description">
              {rejectModal.budget.rejectionCount && rejectModal.budget.rejectionCount > 0
                ? "Este es el segundo rechazo: el presupuesto quedará cancelado."
                : "Este es el primer rechazo: se ofrecerá descuento automático del 10%."}
            </p>

            <form className="budget-form" onSubmit={(event) => void handleConfirmReject(event)}>
              <label>
                <span>Motivo (opcional)</span>
                <textarea
                  ref={rejectReasonInputRef}
                  rows={3}
                  value={rejectReason}
                  onChange={(event) => setRejectReason(event.target.value)}
                  placeholder="Observaciones comerciales del rechazo"
                />
              </label>

              {rejectError && (
                <p
                  id="budget-reject-error"
                  className="form-error"
                  role="alert"
                  aria-live="assertive"
                >
                  {rejectError}
                </p>
              )}

              <div className="future-modal__actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={closeRejectModal}
                  disabled={isRejectModalSubmitting}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={isRejectModalSubmitting}>
                  {isRejectModalSubmitting ? "Procesando..." : "Confirmar rechazo"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}
