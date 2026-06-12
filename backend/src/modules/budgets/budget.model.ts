import { randomUUID } from "node:crypto";

import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const BUDGET_STATUSES = {
  DRAFT: "DRAFT",
  SENT: "SENT",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  CANCELED: "CANCELED",
} as const;

export type BudgetStatus =
  (typeof BUDGET_STATUSES)[keyof typeof BUDGET_STATUSES];

export const BUDGET_MARGIN_TYPES = {
  COMUN_40: "COMUN_40",
  COCINA_55: "COCINA_55",
} as const;

export type BudgetMarginType =
  (typeof BUDGET_MARGIN_TYPES)[keyof typeof BUDGET_MARGIN_TYPES];

export type BudgetItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type BudgetMaterial = {
  materialId: Types.ObjectId;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Budget = AuditableFields & {
  clientId?: Types.ObjectId | null;
  prospectName?: string | null;
  prospectContactName?: string | null;
  prospectEmail?: string | null;
  prospectPhone?: string | null;
  prospectNotes?: string | null;
  prospectLocalidad?: string | null;
  prospectContacto?: string | null;
  prospectDireccion?: string | null;
  title: string;
  description?: string | null;
  currency: string;
  items: BudgetItem[];
  materials: BudgetMaterial[];
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
  subtotal: number;
  total: number;
  status: BudgetStatus;
  rejectionCount: number;
  discountPercentage: number;
  discountedTotal?: number | null;
  discountOfferedAt?: Date | null;
  rejectedAt?: Date | null;
  lastRejectionReason?: string | null;
  versionGroupId: string;
  version: number;
  pricingAuditId?: Types.ObjectId | null;
  parentBudgetId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  approvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const budgetItemSchema = new Schema<BudgetItem>(
  {
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 240,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const budgetMaterialSchema = new Schema<BudgetMaterial>(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const budgetSchema = new Schema<Budget>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: false,
      default: null,
    },
    prospectName: {
      type: String,
      trim: true,
      default: null,
      maxlength: 180,
    },
    prospectContactName: {
      type: String,
      trim: true,
      default: null,
      maxlength: 180,
    },
    prospectEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      maxlength: 120,
    },
    prospectPhone: {
      type: String,
      trim: true,
      default: null,
      maxlength: 40,
    },
    prospectNotes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    prospectLocalidad: {
      type: String,
      trim: true,
      default: null,
      maxlength: 180,
    },
    prospectContacto: {
      type: String,
      trim: true,
      default: null,
      maxlength: 140,
    },
    prospectDireccion: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ARS",
      maxlength: 10,
    },
    items: {
      type: [budgetItemSchema],
      required: true,
      default: [],
    },
    materials: {
      type: [budgetMaterialSchema],
      required: true,
      default: [],
    },
    laborHours: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    laborCostPerHour: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    laborCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    commissionPercent: {
      type: Number,
      required: true,
      min: 0,
      default: 13,
    },
    commissionAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    bonusPercent: {
      type: Number,
      required: true,
      min: 0,
      default: 10,
    },
    bonusAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    shippingCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    packagingCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    projectCost: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    marginType: {
      type: String,
      required: true,
      enum: Object.values(BUDGET_MARGIN_TYPES),
      default: BUDGET_MARGIN_TYPES.COMUN_40,
    },
    marginPercent: {
      type: Number,
      required: true,
      min: 0,
      default: 40,
    },
    marginAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(BUDGET_STATUSES),
      default: BUDGET_STATUSES.DRAFT,
    },
    rejectionCount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountPercentage: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    discountedTotal: {
      type: Number,
      min: 0,
      default: null,
    },
    discountOfferedAt: {
      type: Date,
      default: null,
    },
    rejectedAt: {
      type: Date,
      default: null,
    },
    lastRejectionReason: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
    versionGroupId: {
      type: String,
      required: true,
      default: () => randomUUID(),
    },
    version: {
      type: Number,
      required: true,
      min: 1,
      default: 1,
    },
    pricingAuditId: {
      type: Schema.Types.ObjectId,
      ref: "BudgetPricingAudit",
      default: null,
    },
    parentBudgetId: {
      type: Schema.Types.ObjectId,
      ref: "Budget",
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

budgetSchema.index({ clientId: 1, createdAt: -1 });
budgetSchema.index({ versionGroupId: 1, version: -1 });
budgetSchema.index({ status: 1, deletedAt: 1 });

export type BudgetDocument = HydratedDocument<Budget>;

export const BudgetModel = model<Budget>("Budget", budgetSchema);
