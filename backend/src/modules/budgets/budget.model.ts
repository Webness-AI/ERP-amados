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

export type BudgetItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export type Budget = AuditableFields & {
  clientId: Types.ObjectId;
  title: string;
  description?: string | null;
  currency: string;
  items: BudgetItem[];
  subtotal: number;
  total: number;
  status: BudgetStatus;
  versionGroupId: string;
  version: number;
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

const budgetSchema = new Schema<Budget>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
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
