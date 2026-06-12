import mongoose, { type Types } from "mongoose";

import {
  FIXED_EXPENSE_STATUSES,
  FixedExpenseModel,
} from "../fixed-expenses/fixed-expense.model";
import { calculateMonthlyFixedExpenseTotal } from "../fixed-expenses/fixed-expense.service";
import { PURCHASE_STATUSES, PurchaseModel } from "../purchases/purchase.model";
import {
  STOCK_MOVEMENT_TYPES,
  StockMovementModel,
} from "../stock/stock-movement.model";
import type { Budget } from "./budget.model";
import {
  BUDGET_PRICING_AUDIT_REASONS,
  type BudgetPricingAuditDocument,
  BUDGET_PRICING_SOURCE_TYPES,
  type BudgetPricingAudit,
  type BudgetPricingAuditReason,
  type BudgetPricingSource,
  BudgetPricingAuditModel,
} from "./budget-pricing-audit.model";
import { roundMoney } from "../../core/utils/formatting";

type BudgetForAudit = Pick<
  Budget,
  | "items"
  | "materials"
  | "marginType"
  | "laborHours"
  | "shippingCost"
  | "packagingCost"
  | "laborCostPerHour"
  | "laborCost"
  | "subtotal"
  | "commissionPercent"
  | "commissionAmount"
  | "bonusPercent"
  | "bonusAmount"
  | "projectCost"
  | "marginPercent"
  | "marginAmount"
  | "finalPrice"
  | "version"
>;

type CreateBudgetPricingAuditInput = {
  budgetId: string;
  budget: BudgetForAudit;
  reason: BudgetPricingAuditReason;
  actorId: string;
};

async function readMaterialPriceContext(materialId: string): Promise<{
  lastKnownUnitCost: number | null;
  lastKnownCostDate: Date | null;
  lastPurchaseUnitCost: number | null;
  lastPurchaseDate: Date | null;
  averageCostLast30Days: number | null;
}> {
  const sinceDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [movement, purchase] = await Promise.all([
    StockMovementModel.findOne({
      materialId,
      deletedAt: null,
      unitCost: { $ne: null },
      type: {
        $in: [
          STOCK_MOVEMENT_TYPES.INGRESO,
          STOCK_MOVEMENT_TYPES.AJUSTE,
          STOCK_MOVEMENT_TYPES.DEVOLUCION,
        ],
      },
    })
      .sort({ createdAt: -1 })
      .select("unitCost createdAt")
      .lean(),
    PurchaseModel.findOne({
      deletedAt: null,
      status: {
        $in: [
          PURCHASE_STATUSES.ORDERED,
          PURCHASE_STATUSES.PARTIALLY_RECEIVED,
          PURCHASE_STATUSES.RECEIVED,
        ],
      },
      "items.materialId": materialId,
    })
      .sort({ createdAt: -1 })
      .select("items createdAt")
      .lean(),
  ]);

  const avgRows = await StockMovementModel.aggregate<{ avgUnitCost: number }>([
    {
      $match: {
        materialId: new mongoose.Types.ObjectId(materialId),
        deletedAt: null,
        unitCost: { $ne: null },
        createdAt: { $gte: sinceDate },
        type: {
          $in: [
            STOCK_MOVEMENT_TYPES.INGRESO,
            STOCK_MOVEMENT_TYPES.AJUSTE,
            STOCK_MOVEMENT_TYPES.DEVOLUCION,
          ],
        },
      },
    },
    {
      $group: {
        _id: null,
        avgUnitCost: { $avg: "$unitCost" },
      },
    },
  ]);

  let lastPurchaseUnitCost: number | null = null;
  let lastPurchaseDate: Date | null = null;

  if (purchase) {
    const matched = purchase.items.find(
      (item) => String(item.materialId) === String(materialId),
    );

    if (matched) {
      lastPurchaseUnitCost = roundMoney(matched.unitCost);
      lastPurchaseDate = purchase.createdAt ?? null;
    }
  }

  return {
    lastKnownUnitCost:
      typeof movement?.unitCost === "number" ? roundMoney(movement.unitCost) : null,
    lastKnownCostDate: movement?.createdAt ?? null,
    lastPurchaseUnitCost,
    lastPurchaseDate,
    averageCostLast30Days:
      typeof avgRows[0]?.avgUnitCost === "number"
        ? roundMoney(avgRows[0].avgUnitCost)
        : null,
  };
}

export async function getMaterialPriceSuggestion(materialId: string): Promise<{
  materialId: string;
  lastKnownUnitCost: number;
  lastKnownCostDate: Date | null;
  lastPurchaseUnitCost: number;
  lastPurchaseDate: Date | null;
  averageCostLast30Days: number;
  estimatedCost: number;
}> {
  const context = await readMaterialPriceContext(materialId);
  const estimatedCost =
    context.averageCostLast30Days ??
    context.lastPurchaseUnitCost ??
    context.lastKnownUnitCost ??
    0;

  return {
    materialId,
    lastKnownUnitCost: context.lastKnownUnitCost ?? 0,
    lastKnownCostDate: context.lastKnownCostDate,
    lastPurchaseUnitCost: context.lastPurchaseUnitCost ?? 0,
    lastPurchaseDate: context.lastPurchaseDate,
    averageCostLast30Days: context.averageCostLast30Days ?? 0,
    estimatedCost,
  };
}

function buildBaseSources(budget: BudgetForAudit): BudgetPricingSource[] {
  const itemSources: BudgetPricingSource[] = budget.items.map((item) => ({
    type: BUDGET_PRICING_SOURCE_TYPES.ITEM,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.total,
  }));

  const fixedSources: BudgetPricingSource[] = [
    {
      type: BUDGET_PRICING_SOURCE_TYPES.LABOR,
      quantity: budget.laborHours,
      unitPrice: budget.laborCostPerHour,
      subtotal: roundMoney(budget.laborHours * budget.laborCostPerHour),
    },
    {
      type: BUDGET_PRICING_SOURCE_TYPES.COMMISSION,
      unitPrice: budget.commissionPercent,
      subtotal: budget.commissionAmount,
    },
    {
      type: BUDGET_PRICING_SOURCE_TYPES.BONUS,
      unitPrice: budget.bonusPercent,
      subtotal: budget.bonusAmount,
    },
    {
      type: BUDGET_PRICING_SOURCE_TYPES.SHIPPING,
      subtotal: budget.shippingCost,
    },
    {
      type: BUDGET_PRICING_SOURCE_TYPES.PACKAGING,
      subtotal: budget.packagingCost,
    },
    {
      type: BUDGET_PRICING_SOURCE_TYPES.MARGIN,
      unitPrice: budget.marginPercent,
      subtotal: budget.marginAmount,
    },
  ];

  return [...itemSources, ...fixedSources];
}

export async function createBudgetPricingAudit(
  input: CreateBudgetPricingAuditInput,
): Promise<BudgetPricingAuditDocument> {
  const [fixedExpenses, monthlyFixedTotal, materialSources] = await Promise.all([
    FixedExpenseModel.find({
      deletedAt: null,
      status: FIXED_EXPENSE_STATUSES.ACTIVO,
    })
      .select("_id")
      .lean(),
    calculateMonthlyFixedExpenseTotal(),
    Promise.all(
      input.budget.materials.map(async (material) => {
        const context = await readMaterialPriceContext(String(material.materialId));
        return {
          type: BUDGET_PRICING_SOURCE_TYPES.MATERIAL,
          sourceId: material.materialId,
          quantity: material.quantity,
          unitPrice: material.unitPrice,
          subtotal: material.total,
          lastKnownUnitCost: context.lastKnownUnitCost,
          lastPurchaseUnitCost: context.lastPurchaseUnitCost,
          lastPurchaseDate: context.lastPurchaseDate,
        } satisfies BudgetPricingSource;
      }),
    ),
  ]);

  const fixedExpenseIds = fixedExpenses.map((expense) => expense._id as Types.ObjectId);
  const sources = [...materialSources, ...buildBaseSources(input.budget)];

  const audit = await BudgetPricingAuditModel.create({
    budgetId: new mongoose.Types.ObjectId(input.budgetId),
    budgetVersion: input.budget.version,
    reason: input.reason,
    marginType: input.budget.marginType,
    laborHours: input.budget.laborHours,
    shippingCost: input.budget.shippingCost,
    packagingCost: input.budget.packagingCost,
    monthlyFixedTotal,
    laborCostPerHour: input.budget.laborCostPerHour,
    fixedExpenseIds,
    sources,
    subtotal: input.budget.subtotal,
    commissionPercent: input.budget.commissionPercent,
    commissionAmount: input.budget.commissionAmount,
    bonusPercent: input.budget.bonusPercent,
    bonusAmount: input.budget.bonusAmount,
    projectCost: input.budget.projectCost,
    marginPercent: input.budget.marginPercent,
    marginAmount: input.budget.marginAmount,
    finalPrice: input.budget.finalPrice,
    createdBy: input.actorId,
    updatedBy: input.actorId,
  });

  return audit;
}

export async function listBudgetPricingAudit(
  budgetId: string,
): Promise<BudgetPricingAudit[]> {
  return BudgetPricingAuditModel.find({
    budgetId,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
}

export { BUDGET_PRICING_AUDIT_REASONS };
