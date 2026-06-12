import mongoose from "mongoose";

import { eventBus } from "../../core/events/event-bus";
import type { DomainEventName } from "../../core/events/domain-events";
import { DOMAIN_EVENTS } from "../../core/events/domain-events";
import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import {
  normalizeOptionalString,
  roundMoney,
  toDateOrNull,
} from "../../core/utils/formatting";
import { ClientModel } from "../clients/client.model";
import { COLLECTION_STATUSES, CollectionModel } from "../collections/collection.model";
import { PROJECT_STATUSES, ProjectModel } from "../projects/project.model";
import { ProjectMaterialRequirementModel } from "../stock/project-material-requirement.model";
import {
  STOCK_MOVEMENT_TYPES,
  StockMovementModel,
} from "../stock/stock-movement.model";
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
  laborCost: number;
  hourlyRate: number;
  sellerCommission: number;
  employeeBonus: number;
  shippingCost: number;
  packagingCost: number;
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
  packagingCost: number;
  projectCost: number;
  marginType: BudgetMarginType;
  marginPercent: number;
  marginAmount: number;
  finalPrice: number;
};

type StockReservationWarning = {
  materialId: string;
  requiredQuantity: number;
  reservedQuantity: number;
  missingQuantity: number;
};

export type AcceptBudgetResult = {
  budget: Budget;
  clientId: string;
  projectId: string;
  collectionId: string;
  createdClient: boolean;
  stockAlerts: StockReservationWarning[];
};

export type BudgetDetail = Budget & {
  collectionId?: string | null;
};

type AcceptBudgetOptions = {
  requireDiscount?: boolean;
  acceptanceEventName?: DomainEventName;
};

function calculateCollectionDueDateFromNow(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

function resolveNormalizedBudgetAmount(budget: Budget): number {
  if (budget.total > 0) {
    return roundMoney(budget.total);
  }

  if (budget.finalPrice > 0) {
    return roundMoney(budget.finalPrice);
  }

  if (budget.subtotal > 0) {
    return roundMoney(budget.subtotal);
  }

  const itemsTotal = roundMoney(
    budget.items.reduce((acc, item) => acc + (item.total ?? 0), 0),
  );
  return itemsTotal;
}

function isTransactionUnsupportedError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  return error.message.includes(
    "Transaction numbers are only allowed on a replica set member or mongos",
  );
}

function calculateItemTotals(items: BudgetItemInput[]): BudgetItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice ?? 0,
    total: roundMoney(item.quantity * (item.unitPrice ?? 0)),
  }));
}

function calculateItemsFromBudgetUnitPrice(
  items: BudgetItemInput[],
  unitPrice: number,
): BudgetItem[] {
  return items.map((item) => ({
    description: item.description,
    quantity: item.quantity,
    unitPrice,
    total: roundMoney(item.quantity * unitPrice),
  }));
}

function calculateItemsMultiplier(items: BudgetItemInput[]): number {
  const multiplier = items.reduce((acc, item) => acc + item.quantity, 0);
  return multiplier > 0 ? multiplier : 1;
}

async function calculateMaterialTotals(
  materials: BudgetMaterialInput[],
): Promise<BudgetMaterial[]> {
  if (materials.length === 0) {
    return [];
  }

  const materialIds = Array.from(
    new Set(materials.map((material) => material.materialId)),
  );
  const invalidMaterialId = materialIds.find(
    (materialId) => !mongoose.Types.ObjectId.isValid(materialId),
  );

  if (invalidMaterialId) {
    throw new AppError("Invalid material id", 400, "INVALID_MATERIAL_ID");
  }

  const materialPrices = await MaterialModel.find({
    _id: { $in: materialIds },
    deletedAt: null,
  })
    .select("_id unitPrice")
    .lean();

  const unitPriceByMaterialId = new Map(
    materialPrices.map((material) => [
      String(material._id),
      material.unitPrice ?? 0,
    ]),
  );

  return materials.map((material) => {
    const unitPrice = unitPriceByMaterialId.get(material.materialId);

    if (unitPrice === undefined) {
      throw new AppError("Material not found", 404, "MATERIAL_NOT_FOUND");
    }

    return {
      materialId: new mongoose.Types.ObjectId(material.materialId),
      quantity: material.quantity,
      unitPrice,
      total: roundMoney(material.quantity * unitPrice),
    };
  });
}

function calculateMarginPercent(marginType: BudgetMarginType): number {
  if (marginType === BUDGET_MARGIN_TYPES.COCINA_55) {
    return 55;
  }
  return 40;
}

async function getCurrentStockForMaterial(
  materialId: string,
  session?: mongoose.ClientSession,
): Promise<number> {
  const aggregate = StockMovementModel.aggregate<{ total: number }>([
    {
      $match: {
        materialId: new mongoose.Types.ObjectId(materialId),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: null,
        ingreso: {
          $sum: {
            $cond: [{ $eq: ["$type", STOCK_MOVEMENT_TYPES.INGRESO] }, "$quantity", 0],
          },
        },
        devolucion: {
          $sum: {
            $cond: [
              { $eq: ["$type", STOCK_MOVEMENT_TYPES.DEVOLUCION] },
              "$quantity",
              0,
            ],
          },
        },
        ajuste: {
          $sum: {
            $cond: [{ $eq: ["$type", STOCK_MOVEMENT_TYPES.AJUSTE] }, "$quantity", 0],
          },
        },
        reserva: {
          $sum: {
            $cond: [{ $eq: ["$type", STOCK_MOVEMENT_TYPES.RESERVA] }, "$quantity", 0],
          },
        },
        consumo: {
          $sum: {
            $cond: [{ $eq: ["$type", STOCK_MOVEMENT_TYPES.CONSUMO] }, "$quantity", 0],
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        total: {
          $subtract: [
            { $add: ["$ingreso", "$devolucion", "$ajuste"] },
            { $add: ["$reserva", "$consumo"] },
          ],
        },
      },
    },
  ]);

  if (session) {
    aggregate.session(session);
  }

  const totals = await aggregate;
  return Number((totals[0]?.total ?? 0).toFixed(4));
}

async function calculateBudgetPricing(
  input: BudgetPricingInput,
): Promise<BudgetPricingResult> {
  const items = calculateItemTotals(input.items);
  const materials = await calculateMaterialTotals(input.materials);

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
      packagingCost: 0,
      projectCost: materialsCost,
      marginType: input.marginType,
      marginPercent: 0,
      marginAmount: 0,
      finalPrice: materialsCost,
    };
  }

  const laborHours = roundMoney(input.laborHours);
  const laborCostPerHour = roundMoney(input.hourlyRate);

  if (laborHours > 0 && laborCostPerHour <= 0) {
    throw new AppError(
      "Labor hours require a valid hourly rate",
      400,
      "HOURLY_RATE_REQUIRED",
    );
  }
  const laborCost = roundMoney(laborHours * laborCostPerHour);

  const shippingCost = roundMoney(input.shippingCost);
  const packagingCost = roundMoney(input.packagingCost);
  const subtotalCosts = roundMoney(
    materialsCost + laborCost + shippingCost + packagingCost,
  );
  const commissionPercent =
    input.sellerCommission > 0 ? roundMoney(input.sellerCommission) : 13;
  const bonusPercent =
    input.employeeBonus > 0 ? roundMoney(input.employeeBonus) : 10;
  const commissionAmount = roundMoney((subtotalCosts * commissionPercent) / 100);
  const bonusAmount = roundMoney((subtotalCosts * bonusPercent) / 100);

  const projectCost = roundMoney(
    subtotalCosts + commissionAmount + bonusAmount,
  );

  const marginPercent = calculateMarginPercent(input.marginType);
  const marginAmount = roundMoney((projectCost * marginPercent) / 100);
  const unitFinalPrice = roundMoney(projectCost + marginAmount);
  const itemsMultiplier = calculateItemsMultiplier(input.items);
  const pricedItems = calculateItemsFromBudgetUnitPrice(
    input.items,
    unitFinalPrice,
  );
  const finalPrice = roundMoney(unitFinalPrice * itemsMultiplier);

  return {
    items: pricedItems,
    materials,
    subtotal: subtotalCosts,
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
    packagingCost,
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
  laborCost?: number | undefined;
  hourlyRate?: number | undefined;
  sellerCommission?: number | undefined;
  employeeBonus?: number | undefined;
  shippingCost?: number | undefined;
  packagingCost?: number | undefined;
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

  if ((input.laborCost ?? 0) > 0) {
    return true;
  }

  if ((input.hourlyRate ?? 0) > 0) {
    return true;
  }

  if ((input.sellerCommission ?? 0) > 0) {
    return true;
  }

  if ((input.employeeBonus ?? 0) > 0) {
    return true;
  }

  if ((input.shippingCost ?? 0) > 0) {
    return true;
  }

  return (input.packagingCost ?? 0) > 0;
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
    laborCost: input.laborCost ?? 0,
    hourlyRate: input.hourlyRate ?? 0,
    sellerCommission: input.sellerCommission ?? 0,
    employeeBonus: input.employeeBonus ?? 0,
    shippingCost: input.shippingCost ?? 0,
    packagingCost: input.packagingCost ?? 0,
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
    packagingCost: pricing.packagingCost,
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
    laborCost: input.laborCost ?? baseBudget.laborCost,
    hourlyRate: input.hourlyRate ?? baseBudget.laborCostPerHour,
    sellerCommission: input.sellerCommission ?? baseBudget.commissionPercent,
    employeeBonus: input.employeeBonus ?? baseBudget.bonusPercent,
    shippingCost: input.shippingCost ?? baseBudget.shippingCost,
    packagingCost: input.packagingCost ?? baseBudget.packagingCost,
  });

  const pricing = await calculateBudgetPricing({
    items: sourceItems,
    materials: sourceMaterials,
    laborHours: input.laborHours ?? baseBudget.laborHours,
    laborCost: input.laborCost ?? baseBudget.laborCost,
    hourlyRate: input.hourlyRate ?? baseBudget.laborCostPerHour,
    sellerCommission: input.sellerCommission ?? baseBudget.commissionPercent,
    employeeBonus: input.employeeBonus ?? baseBudget.bonusPercent,
    shippingCost: input.shippingCost ?? baseBudget.shippingCost,
    packagingCost: input.packagingCost ?? baseBudget.packagingCost,
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
    packagingCost: pricing.packagingCost,
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
    laborCost: budget.laborCost,
    hourlyRate: budget.laborCostPerHour,
    sellerCommission: budget.commissionPercent,
    employeeBonus: budget.bonusPercent,
    shippingCost: budget.shippingCost,
    packagingCost: budget.packagingCost,
    marginType: budget.marginType,
    enableCommercialPricing: shouldEnableCommercialPricing({
      materials: budget.materials.map((material) => ({
        materialId: String(material.materialId),
        quantity: material.quantity,
        unitPrice: material.unitPrice,
      })),
      laborHours: budget.laborHours,
      laborCost: budget.laborCost,
      hourlyRate: budget.laborCostPerHour,
      sellerCommission: budget.commissionPercent,
      employeeBonus: budget.bonusPercent,
      shippingCost: budget.shippingCost,
      packagingCost: budget.packagingCost,
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
      packagingCost: pricing.packagingCost,
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
    laborCost: budget.laborCost,
    hourlyRate: budget.laborCostPerHour,
    sellerCommission: budget.commissionPercent,
    employeeBonus: budget.bonusPercent,
    shippingCost: budget.shippingCost,
    packagingCost: budget.packagingCost,
    marginType: budget.marginType,
    enableCommercialPricing: shouldEnableCommercialPricing({
      materials: budget.materials.map((material) => ({
        materialId: String(material.materialId),
        quantity: material.quantity,
        unitPrice: material.unitPrice,
      })),
      laborHours: budget.laborHours,
      laborCost: budget.laborCost,
      hourlyRate: budget.laborCostPerHour,
      sellerCommission: budget.commissionPercent,
      employeeBonus: budget.bonusPercent,
      shippingCost: budget.shippingCost,
      packagingCost: budget.packagingCost,
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
      packagingCost: pricing.packagingCost,
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
  budget.packagingCost = pricing.packagingCost;
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
      { prospectLocalidad: regex },
      { prospectContacto: regex },
      { prospectDireccion: regex },
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
    const stockAlerts: StockReservationWarning[] = [];

    try {
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

      const linkedBudgetInVersionGroup = await BudgetModel.findOne({
        _id: { $ne: budget._id },
        versionGroupId: budget.versionGroupId,
        projectId: { $ne: null },
        deletedAt: null,
      })
        .select("_id projectId")
        .session(session)
        .lean();

      if (linkedBudgetInVersionGroup?.projectId) {
        throw new AppError(
          "Budget version group already linked to a project",
          409,
          "BUDGET_VERSION_GROUP_ALREADY_LINKED",
        );
      }

      let clientObjectId = budget.clientId ?? null;
      let clientId = clientObjectId ? String(clientObjectId) : null;
      const fallbackContact =
        normalizeOptionalString(input.contactName) ??
        normalizeOptionalString(budget.prospectContacto) ??
        normalizeOptionalString(budget.prospectContactName);
      const fallbackPhone =
        normalizeOptionalString(input.phone) ??
        normalizeOptionalString(budget.prospectPhone) ??
        fallbackContact;

      if (clientId) {
        const existingClient = await ClientModel.findOne({
          _id: clientId,
          deletedAt: null,
          isActive: true,
        }).session(session);

        if (!existingClient) {
          throw new AppError("Client not found", 404, "CLIENT_NOT_FOUND");
        }

        existingClient.contactName =
          existingClient.contactName ?? fallbackContact ?? null;
        existingClient.localidad =
          existingClient.localidad ??
          normalizeOptionalString(budget.prospectLocalidad) ??
          null;
        existingClient.contacto =
          existingClient.contacto ?? fallbackContact ??
          null;
        existingClient.phone = existingClient.phone ?? fallbackPhone ?? null;
        existingClient.direccion =
          existingClient.direccion ??
          normalizeOptionalString(budget.prospectDireccion) ??
          null;
        existingClient.updatedBy = actor.id;
        await existingClient.save({ session });
      } else {
        const name =
          normalizeOptionalString(input.clientName) ??
          normalizeOptionalString(budget.prospectName) ??
          normalizeOptionalString(budget.title);

        if (!name) {
          throw new AppError(
            "Budget does not provide a valid client name",
            422,
            "CLIENT_NAME_REQUIRED",
          );
        }

        const clientDocs = await ClientModel.create(
          [
            {
              name,
              contactName:
                fallbackContact ??
                null,
              email:
                normalizeOptionalString(input.email) ??
                normalizeOptionalString(budget.prospectEmail) ??
                null,
              phone:
                fallbackPhone ??
                null,
              notes:
                normalizeOptionalString(input.notes) ??
                normalizeOptionalString(budget.prospectNotes) ??
                null,
              localidad: normalizeOptionalString(budget.prospectLocalidad),
              contacto: fallbackContact,
              direccion: normalizeOptionalString(budget.prospectDireccion),
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
              normalizeOptionalString(budget.description) ??
              null,
            status: PROJECT_STATUSES.APROBADO,
            deliveryDate: toDateOrNull(input.projectDeliveryDate),
            localidad: normalizeOptionalString(budget.prospectLocalidad),
            contacto: normalizeOptionalString(budget.prospectContacto),
            direccion: normalizeOptionalString(budget.prospectDireccion),
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

      const aggregatedMaterials = new Map<string, number>();
      for (const material of budget.materials ?? []) {
        const materialId = String(material.materialId);
        const current = aggregatedMaterials.get(materialId) ?? 0;
        aggregatedMaterials.set(
          materialId,
          Number((current + material.quantity).toFixed(4)),
        );
      }

      for (const [materialId, requiredQuantity] of aggregatedMaterials.entries()) {
        if (requiredQuantity <= 0) {
          continue;
        }

        const requirementDocs = await ProjectMaterialRequirementModel.create(
          [
            {
              projectId: projectDoc._id,
              materialId: new mongoose.Types.ObjectId(materialId),
              requiredQuantity,
              reservedQuantity: 0,
              consumedQuantity: 0,
              createdBy: actor.id,
              updatedBy: actor.id,
            },
          ],
          { session },
        );

        const requirement = requirementDocs[0];
        if (!requirement) {
          throw new AppError(
            "Unable to create project material requirement",
            500,
            "PROJECT_MATERIAL_REQUIREMENT_CREATE_FAILED",
          );
        }

        const currentStock = await getCurrentStockForMaterial(materialId, session);
        const reservedQuantity = Number(
          Math.min(currentStock, requiredQuantity).toFixed(4),
        );
        const missingQuantity = Number(
          (requiredQuantity - reservedQuantity).toFixed(4),
        );

        if (reservedQuantity > 0) {
          const movementDocs = await StockMovementModel.create(
            [
              {
                materialId: new mongoose.Types.ObjectId(materialId),
                projectId: projectDoc._id,
                type: STOCK_MOVEMENT_TYPES.RESERVA,
                quantity: reservedQuantity,
                unitCost: null,
                note: `Reserva automática desde presupuesto ${budget.id}`,
                createdBy: actor.id,
                updatedBy: actor.id,
              },
            ],
            { session },
          );

          const movement = movementDocs[0];

          requirement.reservedQuantity = reservedQuantity;
          requirement.updatedBy = actor.id;
          await requirement.save({ session });

          eventBus.publish({
            name: DOMAIN_EVENTS.MATERIAL_RESERVADO,
            payload: {
              materialId,
              projectId: projectDoc.id,
              quantity: reservedQuantity,
            },
            occurredAt: new Date().toISOString(),
            actorId: actor.id,
            correlationId: movement?.id ?? budget.id,
          });

          eventBus.publish({
            name: DOMAIN_EVENTS.MATERIAL_ASIGNADO_A_PROYECTO,
            payload: {
              materialId,
              projectId: projectDoc.id,
              requirementId: requirement.id,
              quantity: reservedQuantity,
            },
            occurredAt: new Date().toISOString(),
            actorId: actor.id,
            correlationId: requirement.id,
          });
        }

        if (missingQuantity > 0) {
          stockAlerts.push({
            materialId,
            requiredQuantity,
            reservedQuantity,
            missingQuantity,
          });

          eventBus.publish({
            name: DOMAIN_EVENTS.STOCK_BAJO_DETECTADO,
            payload: {
              materialId,
              projectId: projectDoc.id,
              requiredQuantity,
              reservedQuantity,
              missingQuantity,
            },
            occurredAt: new Date().toISOString(),
            actorId: actor.id,
            correlationId: requirement.id,
          });
        }
      }

      const normalizedBudgetAmount = resolveNormalizedBudgetAmount(budget);
      const effectiveTotal = roundMoney(
        requireDiscount
          ? (budget.discountedTotal ?? normalizedBudgetAmount)
          : normalizedBudgetAmount,
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
            dueDate: calculateCollectionDueDateFromNow(),
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
      budget.subtotal = normalizedBudgetAmount;
      budget.total = normalizedBudgetAmount;
      budget.finalPrice = normalizedBudgetAmount;
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
    } catch (error: unknown) {
      if (isTransactionUnsupportedError(error)) {
        throw new AppError(
          "MongoDB no soporta transacciones en esta instancia. Configura replica set (incluido single-node) o usa una instancia compatible.",
          500,
          "MONGO_TRANSACTIONS_UNAVAILABLE",
        );
      }

      throw error;
    }

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
        stockAlerts,
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
      stockAlerts,
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
