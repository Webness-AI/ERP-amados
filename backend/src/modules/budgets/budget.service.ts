import mongoose from "mongoose";

import { eventBus } from "../../core/events/event-bus";
import type { DomainEventName } from "../../core/events/domain-events";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { ClientModel } from "../clients/client.model";
import { COLLECTION_STATUSES, CollectionModel } from "../collections/collection.model";
import { calculateFixedCostPerHour } from "../fixed-expenses/fixed-expense.service";
import { PROJECT_STATUSES, ProjectModel } from "../projects/project.model";
import {
  BUDGET_PRICING_AUDIT_REASONS,
  createBudgetPricingAudit,
  getMaterialPriceSuggestion,
  listBudgetPricingAudit,
} from "./budget-pricing-audit.service";
import { MaterialModel } from "../stock/material.model";
import {
  BUDGET_MARGIN_TYPES,
  BUDGET_STATUSES,
  type Budget,
  type BudgetItem,
  type BudgetMarginType,
  type BudgetMaterial,
  BudgetModel,
} from "./budget.model";
import type {
  AcceptBudgetInput,
  BudgetItemInput,
  BudgetMaterialInput,
  CreateBudgetInput,
  ListBudgetsInput,
  RejectBudgetInput,
  ReviseBudgetInput,
  UpdateBudgetStatusInput,
} from "./budget.schemas";

type Actor = {
  id: string;
};

type BudgetPricingInput = {
  items: BudgetItemInput[];
  materials: BudgetMaterialInput[];
  laborHours: number;
  shippingCost: number;
  marginType: BudgetMarginType;
  enableCommercialPricing: boolean;
};

type BudgetPricingResult = {
  items: BudgetItem[];
  materials: BudgetMaterial[];
  subtotal: number;
  total: number;
  materialsCost: number;
  laborHours: number;
  laborCostPerHour: number;
  laborCost: number;
  commissionPercent: number;
  commissionAmount: number;
  bonusPercent: number;
  bonusAmount: number;
  shippingCost: number;
  projectCost: number;
  marginType: BudgetMarginType;
  marginPercent: number;
  marginAmount: number;
  finalPrice: number;
};

export type AcceptBudgetResult = {
  budget: Budget;
  clientId: string;
  projectId: string;
  collectionId: string;
  createdClient: boolean;
};

export type BudgetDetail = Budget & {
  collectionId?: string | null;
};

type AcceptBudgetOptions = {
  requireDiscount?: boolean;
  acceptanceEventName?: DomainEventName;
};

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeOptionalString(value?: string): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toDateOrNull(value?: string): Date | null {
  if (!value) {
    return null;
  }
  return new Date(value);
}

function calculateItemTotals(items: BudgetItemInput[]): BudgetItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    total: roundMoney(item.quantity * item.unitPrice),
  }));
}

function calculateMaterialTotals(materials: BudgetMaterialInput[]): BudgetMaterial[] {
  return materials.map((material) => ({
    materialId: new mongoose.Types.ObjectId(material.materialId),
    quantity: material.quantity,
    unitPrice: material.unitPrice,
    total: roundMoney(material.quantity * material.unitPrice),
  }));
}

function calculateMarginPercent(marginType: BudgetMarginType): number {
  if (marginType === BUDGET_MARGIN_TYPES.COCINA_55) {
    return 55;
  }
  return 40;
}

async function calculateBudgetPricing(
  input: BudgetPricingInput,
): Promise<BudgetPricingResult> {
  const items = calculateItemTotals(input.items);
  const materials = calculateMaterialTotals(input.materials);

  const itemsCost = roundMoney(items.reduce((acc, item) => acc + item.total, 0));
  const materialsCost =
    materials.length > 0
      ? roundMoney(materials.reduce((acc, material) => acc + material.total, 0))
      : itemsCost;

  if (!input.enableCommercialPricing) {
    return {
      items,
      materials,
      subtotal: materialsCost,
      total: materialsCost,
      materialsCost,
      laborHours: 0,
      laborCostPerHour: 0,
      laborCost: 0,
      commissionPercent: 0,
      commissionAmount: 0,
      bonusPercent: 0,
      bonusAmount: 0,
      shippingCost: 0,
      projectCost: materialsCost,
      marginType: input.marginType,
      marginPercent: 0,
      marginAmount: 0,
      finalPrice: materialsCost,
    };
  }

  const laborCostPerHour = await calculateFixedCostPerHour();
  const laborHours = roundMoney(input.laborHours);
  if (laborHours > 0 && laborCostPerHour <= 0) {
    throw new AppError(
      "Labor hours require active fixed expenses",
      400,
      "LABOR_COST_BASE_REQUIRED",
    );
  }
  const laborCost = roundMoney(laborHours * laborCostPerHour);

  const baseCost = roundMoney(materialsCost + laborCost);
  const commissionPercent = 13;
  const bonusPercent = 10;
  const commissionAmount = roundMoney((baseCost * commissionPercent) / 100);
  const bonusAmount = roundMoney((baseCost * bonusPercent) / 100);
  const shippingCost = roundMoney(input.shippingCost);

  const projectCost = roundMoney(
    baseCost + commissionAmount + bonusAmount + shippingCost,
  );

  const marginPercent = calculateMarginPercent(input.marginType);
  const marginAmount = roundMoney((projectCost * marginPercent) / 100);
  const finalPrice = roundMoney(projectCost + marginAmount);

  return {
    items,
    materials,
    subtotal: roundMoney(materialsCost + laborCost),
    total: finalPrice,
    materialsCost,
    laborHours,
    laborCostPerHour,
    laborCost,
    commissionPercent,
    commissionAmount,
    bonusPercent,
    bonusAmount,
    shippingCost,
    projectCost,
    marginType: input.marginType,
    marginPercent,
    marginAmount,
    finalPrice,
  };
}

async function assertClientExists(clientId: string): Promise<void> {
  const exists = await ClientModel.exists({
    _id: clientId,
    deletedAt: null,
    isActive: true,
  });

  if (!exists) {
    throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
  }
}

function shouldEnableCommercialPricing(input: {
  enableCommercialPricing?: boolean | undefined;
  materials?: BudgetMaterialInput[] | undefined;
  laborHours?: number | undefined;
  shippingCost?: number | undefined;
}): boolean {
  if (input.enableCommercialPricing === true) {
    return true;
  }

  if ((input.materials?.length ?? 0) > 0) {
    return true;
  }

  if ((input.laborHours ?? 0) > 0) {
    return true;
  }

  return (input.shippingCost ?? 0) > 0;
}

function normalizeMarginType(value?: BudgetMarginType): BudgetMarginType {
  return value ?? BUDGET_MARGIN_TYPES.COMUN_40;
}

export async function createBudget(
  input: CreateBudgetInput,
  actor: Actor,
): Promise<Budget> {
  if (input.clientId) {
    await assertClientExists(input.clientId);
  }

  if (!input.clientId && !normalizeOptionalString(input.prospectName)) {
    throw new AppError(
      "Budget without client requires prospectName",
      400,
      "BUDGET_PROSPECT_REQUIRED",
    );
  }

  const enableCommercialPricing = shouldEnableCommercialPricing(input);
  const pricing = await calculateBudgetPricing({
    items: input.items,
    materials: input.materials ?? [],
    laborHours: input.laborHours ?? 0,
    shippingCost: input.shippingCost ?? 0,
    marginType: normalizeMarginType(input.marginType),
    enableCommercialPricing,
  });

  const budget = new BudgetModel({
    clientId: input.clientId ?? null,
    prospectName: normalizeOptionalString(input.prospectName),
    prospectContactName: normalizeOptionalString(input.prospectContactName),
    prospectEmail: normalizeOptionalString(input.prospectEmail),
    prospectPhone: normalizeOptionalString(input.prospectPhone),
    prospectNotes: normalizeOptionalString(input.prospectNotes),
    title: input.title,
    description: normalizeOptionalString(input.description),
    currency: input.currency.toUpperCase(),
    items: pricing.items,
    materials: pricing.materials,
    laborHours: pricing.laborHours,
    laborCostPerHour: pricing.laborCostPerHour,
    laborCost: pricing.laborCost,
    commissionPercent: pricing.commissionPercent,
    commissionAmount: pricing.commissionAmount,
    bonusPercent: pricing.bonusPercent,
    bonusAmount: pricing.bonusAmount,
    shippingCost: pricing.shippingCost,
    projectCost: pricing.projectCost,
    marginType: pricing.marginType,
    marginPercent: pricing.marginPercent,
    marginAmount: pricing.marginAmount,
    finalPrice: pricing.finalPrice,
    subtotal: pricing.subtotal,
    total: pricing.total,
    status: input.status ?? BUDGET_STATUSES.DRAFT,
    version: 1,
    rejectionCount: 0,
    discountPercentage: 0,
    discountedTotal: null,
    discountOfferedAt: null,
    rejectedAt: null,
    lastRejectionReason: null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await budget.save();

  const pricingAudit = await createBudgetPricingAudit({
    budgetId: budget.id,
    budget: budget.toObject(),
    reason: BUDGET_PRICING_AUDIT_REASONS.CREATE,
    actorId: actor.id,
  });

  budget.pricingAuditId = pricingAudit._id;
  budget.updatedBy = actor.id;
  await budget.save();

  return budget.toObject();
}

export async function reviseBudget(
  budgetId: string,
  input: ReviseBudgetInput,
  actor: Actor,
): Promise<Budget> {
  const baseBudget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  }).lean();

  if (!baseBudget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  const latestVersion = await BudgetModel.findOne({
    versionGroupId: baseBudget.versionGroupId,
    deletedAt: null,
  })
    .sort({ version: -1 })
    .lean();

  const version = (latestVersion?.version ?? 0) + 1;

  const sourceItems =
    input.items ??
    baseBudget.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

  const sourceMaterials =
    input.materials ??
    (baseBudget.materials ?? []).map((material) => ({
      materialId: String(material.materialId),
      quantity: material.quantity,
      unitPrice: material.unitPrice,
    }));

  const enableCommercialPricing = shouldEnableCommercialPricing({
    ...(input.enableCommercialPricing !== undefined
      ? { enableCommercialPricing: input.enableCommercialPricing }
      : {}),
    materials: sourceMaterials,
    laborHours: input.laborHours ?? baseBudget.laborHours,
    shippingCost: input.shippingCost ?? baseBudget.shippingCost,
  });

  const pricing = await calculateBudgetPricing({
    items: sourceItems,
    materials: sourceMaterials,
    laborHours: input.laborHours ?? baseBudget.laborHours,
    shippingCost: input.shippingCost ?? baseBudget.shippingCost,
    marginType: normalizeMarginType(input.marginType ?? baseBudget.marginType),
    enableCommercialPricing,
  });

  const revisedBudget = new BudgetModel({
    clientId: baseBudget.clientId ?? null,
    prospectName:
      input.prospectName !== undefined
        ? normalizeOptionalString(input.prospectName)
        : (baseBudget.prospectName ?? null),
    prospectContactName:
      input.prospectContactName !== undefined
        ? normalizeOptionalString(input.prospectContactName)
        : (baseBudget.prospectContactName ?? null),
    prospectEmail:
      input.prospectEmail !== undefined
        ? normalizeOptionalString(input.prospectEmail)
        : (baseBudget.prospectEmail ?? null),
    prospectPhone:
      input.prospectPhone !== undefined
        ? normalizeOptionalString(input.prospectPhone)
        : (baseBudget.prospectPhone ?? null),
    prospectNotes:
      input.prospectNotes !== undefined
        ? normalizeOptionalString(input.prospectNotes)
        : (baseBudget.prospectNotes ?? null),
    title: input.title ?? baseBudget.title,
    description:
      input.description !== undefined
        ? normalizeOptionalString(input.description)
        : (baseBudget.description ?? null),
    currency: (input.currency ?? baseBudget.currency).toUpperCase(),
    items: pricing.items,
    materials: pricing.materials,
    laborHours: pricing.laborHours,
    laborCostPerHour: pricing.laborCostPerHour,
    laborCost: pricing.laborCost,
    commissionPercent: pricing.commissionPercent,
    commissionAmount: pricing.commissionAmount,
    bonusPercent: pricing.bonusPercent,
    bonusAmount: pricing.bonusAmount,
    shippingCost: pricing.shippingCost,
    projectCost: pricing.projectCost,
    marginType: pricing.marginType,
    marginPercent: pricing.marginPercent,
    marginAmount: pricing.marginAmount,
    finalPrice: pricing.finalPrice,
    subtotal: pricing.subtotal,
    total: pricing.total,
    status: input.status ?? BUDGET_STATUSES.DRAFT,
    versionGroupId: baseBudget.versionGroupId,
    version,
    parentBudgetId: baseBudget._id,
    rejectionCount: 0,
    discountPercentage: 0,
    discountedTotal: null,
    discountOfferedAt: null,
    rejectedAt: null,
    lastRejectionReason: null,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await revisedBudget.save();

  const pricingAudit = await createBudgetPricingAudit({
    budgetId: revisedBudget.id,
    budget: revisedBudget.toObject(),
    reason: BUDGET_PRICING_AUDIT_REASONS.REVISE,
    actorId: actor.id,
  });

  revisedBudget.pricingAuditId = pricingAudit._id;
  revisedBudget.updatedBy = actor.id;
  await revisedBudget.save();

  return revisedBudget.toObject();
}

export async function getBudgetPricingAuditTrail(
  budgetId: string,
): Promise<Awaited<ReturnType<typeof listBudgetPricingAudit>>> {
  await getBudgetById(budgetId);
  return listBudgetPricingAudit(budgetId);
}

export async function getBudgetMaterialPriceSuggestion(
  materialId: string,
): Promise<Awaited<ReturnType<typeof getMaterialPriceSuggestion>>> {
  const material = await MaterialModel.findOne({
    _id: materialId,
    deletedAt: null,
    isActive: true,
  })
    .select("_id")
    .lean();

  if (!material) {
    throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
  }

  return getMaterialPriceSuggestion(materialId);
}

export async function recalculateBudgetPricing(
  budgetId: string,
  actor: Actor,
): Promise<{
  original: {
    laborCostPerHour: number;
    laborCost: number;
    subtotal: number;
    projectCost: number;
    marginAmount: number;
    finalPrice: number;
  };
  recalculated: {
    laborCostPerHour: number;
    laborCost: number;
    subtotal: number;
    projectCost: number;
    marginAmount: number;
    finalPrice: number;
  };
  differences: {
    laborCostPerHourDiff: number;
    laborCostDiff: number;
    subtotalDiff: number;
    projectCostDiff: number;
    marginAmountDiff: number;
    finalPriceDiff: number;
  };
  auditId: string;
}> {
  const budget = await getBudgetById(budgetId);

  const pricing = await calculateBudgetPricing({
    items: budget.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    materials: budget.materials.map((material) => ({
      materialId: String(material.materialId),
      quantity: material.quantity,
      unitPrice: material.unitPrice,
    })),
    laborHours: budget.laborHours,
    shippingCost: budget.shippingCost,
    marginType: budget.marginType,
    enableCommercialPricing: shouldEnableCommercialPricing({
      materials: budget.materials.map((material) => ({
        materialId: String(material.materialId),
        quantity: material.quantity,
        unitPrice: material.unitPrice,
      })),
      laborHours: budget.laborHours,
      shippingCost: budget.shippingCost,
      enableCommercialPricing:
        budget.commissionPercent > 0 ||
        budget.bonusPercent > 0 ||
        budget.marginPercent > 0,
    }),
  });

  const audit = await createBudgetPricingAudit({
    budgetId,
    budget: {
      ...budget,
      items: pricing.items,
      materials: pricing.materials,
      laborHours: pricing.laborHours,
      laborCostPerHour: pricing.laborCostPerHour,
      laborCost: pricing.laborCost,
      commissionPercent: pricing.commissionPercent,
      commissionAmount: pricing.commissionAmount,
      bonusPercent: pricing.bonusPercent,
      bonusAmount: pricing.bonusAmount,
      shippingCost: pricing.shippingCost,
      projectCost: pricing.projectCost,
      marginType: pricing.marginType,
      marginPercent: pricing.marginPercent,
      marginAmount: pricing.marginAmount,
      finalPrice: pricing.finalPrice,
      subtotal: pricing.subtotal,
      version: budget.version,
    },
    reason: BUDGET_PRICING_AUDIT_REASONS.RECALCULATE,
    actorId: actor.id,
  });

  const original = {
    laborCostPerHour: budget.laborCostPerHour,
    laborCost: budget.laborCost,
    subtotal: budget.subtotal,
    projectCost: budget.projectCost,
    marginAmount: budget.marginAmount,
    finalPrice: budget.finalPrice,
  };

  const recalculated = {
    laborCostPerHour: pricing.laborCostPerHour,
    laborCost: pricing.laborCost,
    subtotal: pricing.subtotal,
    projectCost: pricing.projectCost,
    marginAmount: pricing.marginAmount,
    finalPrice: pricing.finalPrice,
  };

  const differences = {
    laborCostPerHourDiff: roundMoney(
      recalculated.laborCostPerHour - original.laborCostPerHour,
    ),
    laborCostDiff: roundMoney(recalculated.laborCost - original.laborCost),
    subtotalDiff: roundMoney(recalculated.subtotal - original.subtotal),
    projectCostDiff: roundMoney(recalculated.projectCost - original.projectCost),
    marginAmountDiff: roundMoney(
      recalculated.marginAmount - original.marginAmount,
    ),
    finalPriceDiff: roundMoney(recalculated.finalPrice - original.finalPrice),
  };

  return {
    original,
    recalculated,
    differences,
    auditId: audit.id,
  };
}

export async function applyBudgetRecalculation(
  budgetId: string,
  actor: Actor,
): Promise<{
  budget: Budget;
  differences: {
    laborCostPerHourDiff: number;
    laborCostDiff: number;
    subtotalDiff: number;
    projectCostDiff: number;
    marginAmountDiff: number;
    finalPriceDiff: number;
  };
  auditId: string;
}> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  });

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  if (budget.status === BUDGET_STATUSES.APPROVED || budget.projectId) {
    throw new AppError(
      "Approved or linked budget cannot apply recalculation",
      409,
      "BUDGET_RECALC_LOCKED",
    );
  }

  const pricing = await calculateBudgetPricing({
    items: budget.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
    materials: budget.materials.map((material) => ({
      materialId: String(material.materialId),
      quantity: material.quantity,
      unitPrice: material.unitPrice,
    })),
    laborHours: budget.laborHours,
    shippingCost: budget.shippingCost,
    marginType: budget.marginType,
    enableCommercialPricing: shouldEnableCommercialPricing({
      materials: budget.materials.map((material) => ({
        materialId: String(material.materialId),
        quantity: material.quantity,
        unitPrice: material.unitPrice,
      })),
      laborHours: budget.laborHours,
      shippingCost: budget.shippingCost,
      enableCommercialPricing:
        budget.commissionPercent > 0 ||
        budget.bonusPercent > 0 ||
        budget.marginPercent > 0,
    }),
  });

  const original = {
    laborCostPerHour: budget.laborCostPerHour,
    laborCost: budget.laborCost,
    subtotal: budget.subtotal,
    projectCost: budget.projectCost,
    marginAmount: budget.marginAmount,
    finalPrice: budget.finalPrice,
  };

  const audit = await createBudgetPricingAudit({
    budgetId,
    budget: {
      ...budget.toObject(),
      items: pricing.items,
      materials: pricing.materials,
      laborHours: pricing.laborHours,
      laborCostPerHour: pricing.laborCostPerHour,
      laborCost: pricing.laborCost,
      commissionPercent: pricing.commissionPercent,
      commissionAmount: pricing.commissionAmount,
      bonusPercent: pricing.bonusPercent,
      bonusAmount: pricing.bonusAmount,
      shippingCost: pricing.shippingCost,
      projectCost: pricing.projectCost,
      marginType: pricing.marginType,
      marginPercent: pricing.marginPercent,
      marginAmount: pricing.marginAmount,
      finalPrice: pricing.finalPrice,
      subtotal: pricing.subtotal,
      version: budget.version,
    },
    reason: BUDGET_PRICING_AUDIT_REASONS.RECALCULATE,
    actorId: actor.id,
  });

  budget.items = pricing.items;
  budget.materials = pricing.materials;
  budget.laborHours = pricing.laborHours;
  budget.laborCostPerHour = pricing.laborCostPerHour;
  budget.laborCost = pricing.laborCost;
  budget.commissionPercent = pricing.commissionPercent;
  budget.commissionAmount = pricing.commissionAmount;
  budget.bonusPercent = pricing.bonusPercent;
  budget.bonusAmount = pricing.bonusAmount;
  budget.shippingCost = pricing.shippingCost;
  budget.projectCost = pricing.projectCost;
  budget.marginType = pricing.marginType;
  budget.marginPercent = pricing.marginPercent;
  budget.marginAmount = pricing.marginAmount;
  budget.finalPrice = pricing.finalPrice;
  budget.subtotal = pricing.subtotal;
  budget.total = pricing.total;
  budget.pricingAuditId = audit._id;
  budget.updatedBy = actor.id;
  await budget.save();

  const differences = {
    laborCostPerHourDiff: roundMoney(pricing.laborCostPerHour - original.laborCostPerHour),
    laborCostDiff: roundMoney(pricing.laborCost - original.laborCost),
    subtotalDiff: roundMoney(pricing.subtotal - original.subtotal),
    projectCostDiff: roundMoney(pricing.projectCost - original.projectCost),
    marginAmountDiff: roundMoney(pricing.marginAmount - original.marginAmount),
    finalPriceDiff: roundMoney(pricing.finalPrice - original.finalPrice),
  };

  return {
    budget: budget.toObject(),
    differences,
    auditId: audit.id,
  };
}

export async function listBudgets(query: ListBudgetsInput): Promise<{
  items: Budget[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const { page, limit, skip } = parsePaginationInput(query);
  const filter: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.clientId) {
    filter.clientId = query.clientId;
  }

  if (query.status) {
    filter.status = query.status;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [
      { title: regex },
      { description: regex },
      { versionGroupId: regex },
      { prospectName: regex },
      { prospectEmail: regex },
      { prospectPhone: regex },
    ];
  }

  const [items, total] = await Promise.all([
    BudgetModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    BudgetModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items,
    total,
    page,
    limit,
  });
}

export async function getBudgetById(id: string): Promise<BudgetDetail> {
  const budget = await BudgetModel.findOne({
    _id: id,
    deletedAt: null,
  }).lean();

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  if (!budget.projectId) {
    return {
      ...budget,
      collectionId: null,
    };
  }

  const collection = await CollectionModel.findOne({
    projectId: budget.projectId,
    deletedAt: null,
  })
    .select("_id")
    .sort({ createdAt: -1 })
    .lean();

  return {
    ...budget,
    collectionId: collection ? String(collection._id) : null,
  };
}

export async function updateBudgetStatus(
  budgetId: string,
  input: UpdateBudgetStatusInput,
  actor: Actor,
): Promise<Budget> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  });

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  if (input.status === BUDGET_STATUSES.APPROVED && !budget.clientId) {
    throw new AppError(
      "Budget without client must be accepted with conversion endpoint",
      409,
      "BUDGET_CLIENT_REQUIRED_FOR_APPROVAL",
    );
  }

  budget.status = input.status;
  budget.updatedBy = actor.id;

  if (input.status === BUDGET_STATUSES.APPROVED) {
    budget.approvedAt = new Date();
  }

  await budget.save();

  if (input.status === BUDGET_STATUSES.APPROVED) {
    eventBus.publish({
      name: DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
      payload: {
        budgetId: budget.id,
        clientId: budget.clientId ? String(budget.clientId) : undefined,
        total: budget.discountedTotal ?? budget.total,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: budget.id,
    });
  }

  return budget.toObject();
}

export async function acceptBudgetAndCreateProject(
  budgetId: string,
  input: AcceptBudgetInput,
  actor: Actor,
  options?: AcceptBudgetOptions,
): Promise<AcceptBudgetResult> {
  const session = await mongoose.startSession();
  const requireDiscount = options?.requireDiscount === true;
  const acceptanceEventName =
    options?.acceptanceEventName ?? DOMAIN_EVENTS.PRESUPUESTO_ACEPTADO;

  try {
    let acceptedBudgetId: string | null = null;
    let acceptedTotal: number | null = null;
    let acceptedClientId: string | null = null;
    let acceptedProjectId: string | null = null;
    let acceptedCollectionId: string | null = null;
    let createdClient = false;

    await session.withTransaction(async () => {
      const budget = await BudgetModel.findOne({
        _id: budgetId,
        deletedAt: null,
      }).session(session);

      if (!budget) {
        throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
      }

      if (requireDiscount) {
        if (budget.status !== BUDGET_STATUSES.REJECTED) {
          throw new AppError(
            "Budget must be rejected before accepting with discount",
            409,
            "BUDGET_NOT_REJECTED",
          );
        }

        if ((budget.discountedTotal ?? 0) <= 0) {
          throw new AppError(
            "Budget does not have a valid discounted total",
            409,
            "BUDGET_DISCOUNT_NOT_AVAILABLE",
          );
        }
      }

      if (budget.status === BUDGET_STATUSES.CANCELED) {
        throw new AppError(
          "Canceled budget cannot be accepted",
          409,
          "BUDGET_CANCELED",
        );
      }

      if (budget.projectId) {
        throw new AppError(
          "Budget already linked to a project",
          409,
          "BUDGET_ALREADY_LINKED",
        );
      }

      let clientObjectId = budget.clientId ?? null;
      let clientId = clientObjectId ? String(clientObjectId) : null;

      if (clientId) {
        const existingClient = await ClientModel.findOne({
          _id: clientId,
          deletedAt: null,
          isActive: true,
        }).session(session);

        if (!existingClient) {
          throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
        }
      } else {
        const name =
          normalizeOptionalString(input.clientName) ??
          budget.prospectName ??
          budget.title;

        const clientDocs = await ClientModel.create(
          [
            {
              name,
              contactName:
                normalizeOptionalString(input.contactName) ??
                budget.prospectContactName ??
                null,
              email:
                normalizeOptionalString(input.email) ??
                budget.prospectEmail ??
                null,
              phone:
                normalizeOptionalString(input.phone) ??
                budget.prospectPhone ??
                null,
              notes:
                normalizeOptionalString(input.notes) ??
                budget.prospectNotes ??
                null,
              isActive: true,
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          ],
          { session },
        );

        const clientDoc = clientDocs[0];
        if (!clientDoc) {
          throw new AppError("Unable to create client", 500, "CLIENT_CREATE_FAILED");
        }

        clientId = clientDoc.id;
        clientObjectId = clientDoc._id;
        budget.clientId = clientDoc._id;
        createdClient = true;
      }

      if (!clientObjectId || !clientId) {
        throw new AppError("Unable to resolve client", 500, "CLIENT_RESOLVE_FAILED");
      }

      const [projectDoc] = await ProjectModel.create(
        [
          {
            clientId: clientObjectId,
            budgetId: budget._id,
            name: normalizeOptionalString(input.projectName) ?? budget.title,
            description:
              normalizeOptionalString(input.projectDescription) ??
              budget.description ??
              null,
            status: PROJECT_STATUSES.APROBADO,
            deliveryDate: toDateOrNull(input.projectDeliveryDate),
            isActive: true,
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        ],
        { session },
      );

      if (!projectDoc) {
        throw new AppError("Unable to create project", 500, "PROJECT_CREATE_FAILED");
      }

      const effectiveTotal = roundMoney(
        requireDiscount
          ? (budget.discountedTotal ?? 0)
          : (budget.discountedTotal ?? budget.total),
      );
      const [collectionDoc] = await CollectionModel.create(
        [
          {
            clientId: clientObjectId,
            projectId: projectDoc._id,
            status: COLLECTION_STATUSES.PENDIENTE,
            totalAmount: effectiveTotal,
            paidAmount: 0,
            pendingAmount: effectiveTotal,
            laborAmountPending: roundMoney(budget.laborCost ?? 0),
            currency: budget.currency,
            dueDate: toDateOrNull(input.collectionDueDate),
            notes: normalizeOptionalString(input.collectionNotes),
            payments: [],
            createdBy: actor.id,
            updatedBy: actor.id,
          },
        ],
        { session },
      );

      if (!collectionDoc) {
        throw new AppError(
          "Unable to create collection",
          500,
          "COLLECTION_CREATE_FAILED",
        );
      }

      budget.projectId = projectDoc._id;
      budget.status = BUDGET_STATUSES.APPROVED;
      budget.approvedAt = new Date();
      budget.updatedBy = actor.id;
      await budget.save({ session });

      acceptedBudgetId = budget.id;
      acceptedTotal = effectiveTotal;
      acceptedClientId = clientId;
      acceptedProjectId = projectDoc.id;
      acceptedCollectionId = collectionDoc.id;
    });

    if (
      !acceptedBudgetId ||
      acceptedTotal === null ||
      !acceptedClientId ||
      !acceptedProjectId ||
      !acceptedCollectionId
    ) {
      throw new AppError(
        "Unable to accept budget",
        500,
        "BUDGET_ACCEPT_FAILED",
      );
    }

    const acceptedBudget = await getBudgetById(acceptedBudgetId);

    eventBus.publish({
      name: DOMAIN_EVENTS.PRESUPUESTO_APROBADO,
      payload: {
        budgetId: acceptedBudgetId,
        clientId: acceptedClientId,
        total: acceptedTotal,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: acceptedBudgetId,
    });

    eventBus.publish({
      name: acceptanceEventName,
      payload: {
        budgetId: acceptedBudgetId,
        clientId: acceptedClientId,
        projectId: acceptedProjectId,
        collectionId: acceptedCollectionId,
        total: acceptedTotal,
        createdClient,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: acceptedBudgetId,
    });

    if (createdClient) {
      eventBus.publish({
        name: DOMAIN_EVENTS.CLIENTE_CREADO_DESDE_PRESUPUESTO,
        payload: {
          budgetId: acceptedBudgetId,
          clientId: acceptedClientId,
        },
        occurredAt: new Date().toISOString(),
        actorId: actor.id,
        correlationId: acceptedBudgetId,
      });
    }

    return {
      budget: acceptedBudget,
      clientId: acceptedClientId,
      projectId: acceptedProjectId,
      collectionId: acceptedCollectionId,
      createdClient,
    };
  } finally {
    await session.endSession();
  }
}

export async function acceptBudgetWithDiscount(
  budgetId: string,
  input: AcceptBudgetInput,
  actor: Actor,
): Promise<AcceptBudgetResult> {
  return acceptBudgetAndCreateProject(budgetId, input, actor, {
    requireDiscount: true,
    acceptanceEventName: DOMAIN_EVENTS.PRESUPUESTO_ACEPTADO_CON_DESCUENTO,
  });
}

export async function rejectBudgetWithDiscount(
  budgetId: string,
  input: RejectBudgetInput,
  actor: Actor,
): Promise<Budget> {
  const budget = await BudgetModel.findOne({
    _id: budgetId,
    deletedAt: null,
  });

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }

  if (budget.status === BUDGET_STATUSES.APPROVED) {
    throw new AppError(
      "Approved budget cannot be rejected",
      409,
      "BUDGET_ALREADY_APPROVED",
    );
  }

  const reason = normalizeOptionalString(input.reason);
  const now = new Date();

  if (budget.rejectionCount >= 1) {
    budget.status = BUDGET_STATUSES.CANCELED;
    budget.rejectionCount = budget.rejectionCount + 1;
    budget.rejectedAt = now;
    budget.lastRejectionReason = reason;
    budget.updatedBy = actor.id;
    await budget.save();

    eventBus.publish({
      name: DOMAIN_EVENTS.PRESUPUESTO_RECHAZADO_FINAL,
      payload: {
        budgetId: budget.id,
        reason,
      },
      occurredAt: new Date().toISOString(),
      actorId: actor.id,
      correlationId: budget.id,
    });

    return budget.toObject();
  }

  const discountPercentage = 10;
  const discountedTotal = roundMoney(budget.total * (1 - discountPercentage / 100));

  budget.status = BUDGET_STATUSES.REJECTED;
  budget.rejectionCount = 1;
  budget.discountPercentage = discountPercentage;
  budget.discountedTotal = discountedTotal;
  budget.discountOfferedAt = now;
  budget.rejectedAt = now;
  budget.lastRejectionReason = reason;
  budget.updatedBy = actor.id;
  await budget.save();

  eventBus.publish({
    name: DOMAIN_EVENTS.PRESUPUESTO_DESCUENTO_OFRECIDO,
    payload: {
      budgetId: budget.id,
      clientId: budget.clientId ? String(budget.clientId) : null,
      originalTotal: budget.total,
      discountPercentage,
      discountedTotal,
      reason,
    },
    occurredAt: new Date().toISOString(),
    actorId: actor.id,
    correlationId: budget.id,
  });

  return budget.toObject();
}

export async function softDeleteBudget(
  id: string,
  actor: Actor,
): Promise<void> {
  const budget = await BudgetModel.findOneAndUpdate(
    {
      _id: id,
      deletedAt: null,
    },
    {
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
      status: BUDGET_STATUSES.CANCELED,
    },
    { new: true },
  ).lean();

  if (!budget) {
    throw new AppError("Budget not found", 404, "BUDGET_NOT_FOUND");
  }
}
