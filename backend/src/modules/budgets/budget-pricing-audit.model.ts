import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";
import { BUDGET_MARGIN_TYPES, type BudgetMarginType } from "./budget.model";

export const BUDGET_PRICING_AUDIT_REASONS = {
  CREATE: "CREATE",
  REVISE: "REVISE",
  RECALCULATE: "RECALCULATE",
} as const;

export type BudgetPricingAuditReason =
  (typeof BUDGET_PRICING_AUDIT_REASONS)[keyof typeof BUDGET_PRICING_AUDIT_REASONS];

export const BUDGET_PRICING_SOURCE_TYPES = {
  MATERIAL: "MATERIAL",
  ITEM: "ITEM",
  LABOR: "LABOR",
  COMMISSION: "COMMISSION",
  BONUS: "BONUS",
  SHIPPING: "SHIPPING",
  MARGIN: "MARGIN",
} as const;

export type BudgetPricingSourceType =
  (typeof BUDGET_PRICING_SOURCE_TYPES)[keyof typeof BUDGET_PRICING_SOURCE_TYPES];

export type BudgetPricingSource = {
  type: BudgetPricingSourceType;
  sourceId?: Types.ObjectId | null;
  description?: string | null;
  quantity?: number | null;
  unitPrice?: number | null;
  subtotal: number;
  lastKnownUnitCost?: number | null;
  lastPurchaseUnitCost?: number | null;
  lastPurchaseDate?: Date | null;
};

export type BudgetPricingAudit = AuditableFields & {
  budgetId: Types.ObjectId;
  budgetVersion: number;
  reason: BudgetPricingAuditReason;
  marginType: BudgetMarginType;
  laborHours: number;
  shippingCost: number;
  monthlyFixedTotal: number;
  laborCostPerHour: number;
  fixedExpenseIds: Types.ObjectId[];
  sources: BudgetPricingSource[];
  subtotal: number;
  commissionPercent: number;
  commissionAmount: number;
  bonusPercent: number;
  bonusAmount: number;
  projectCost: number;
  marginPercent: number;
  marginAmount: number;
  finalPrice: number;
  createdAt: Date;
  updatedAt: Date;
};

const budgetPricingSourceSchema = new Schema<BudgetPricingSource>(
  {
    type: {
      type: String,
      required: true,
      enum: Object.values(BUDGET_PRICING_SOURCE_TYPES),
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      default: null,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: 240,
    },
    quantity: {
      type: Number,
      default: null,
      min: 0,
    },
    unitPrice: {
      type: Number,
      default: null,
      min: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    lastKnownUnitCost: {
      type: Number,
      default: null,
      min: 0,
    },
    lastPurchaseUnitCost: {
      type: Number,
      default: null,
      min: 0,
    },
    lastPurchaseDate: {
      type: Date,
      default: null,
    },
  },
  { _id: false },
);

const budgetPricingAuditSchema = new Schema<BudgetPricingAudit>(
  {
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: "Budget",
      required: true,
      index: true,
    },
    budgetVersion: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      enum: Object.values(BUDGET_PRICING_AUDIT_REASONS),
    },
    marginType: {
      type: String,
      required: true,
      enum: Object.values(BUDGET_MARGIN_TYPES),
    },
    laborHours: {
      type: Number,
      required: true,
      min: 0,
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
    },
    monthlyFixedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    laborCostPerHour: {
      type: Number,
      required: true,
      min: 0,
    },
    fixedExpenseIds: {
      type: [Schema.Types.ObjectId],
      ref: "FixedExpense",
      required: true,
      default: [],
    },
    sources: {
      type: [budgetPricingSourceSchema],
      required: true,
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusPercent: {
      type: Number,
      required: true,
      min: 0,
    },
    bonusAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    projectCost: {
      type: Number,
      required: true,
      min: 0,
    },
    marginPercent: {
      type: Number,
      required: true,
      min: 0,
    },
    marginAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

budgetPricingAuditSchema.index({ budgetId: 1, createdAt: -1 });
budgetPricingAuditSchema.index({ budgetId: 1, budgetVersion: -1, createdAt: -1 });

export type BudgetPricingAuditDocument = HydratedDocument<BudgetPricingAudit>;

export const BudgetPricingAuditModel = model<BudgetPricingAudit>(
  "BudgetPricingAudit",
  budgetPricingAuditSchema,
);
