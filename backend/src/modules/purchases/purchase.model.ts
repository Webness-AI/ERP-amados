import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const PURCHASE_STATUSES = {
  DRAFT: "DRAFT",
  ORDERED: "ORDERED",
  PARTIALLY_RECEIVED: "PARTIALLY_RECEIVED",
  RECEIVED: "RECEIVED",
  CANCELED: "CANCELED",
} as const;

export type PurchaseStatus =
  (typeof PURCHASE_STATUSES)[keyof typeof PURCHASE_STATUSES];

export type PurchaseItem = {
  materialId: Types.ObjectId;
  quantityOrdered: number;
  quantityReceived: number;
  unitCost: number;
  totalCost: number;
};

export type Purchase = AuditableFields & {
  supplierId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  status: PurchaseStatus;
  currency: string;
  items: PurchaseItem[];
  estimatedTotal: number;
  receivedTotal: number;
  notes?: string | null;
  orderedAt?: Date | null;
  receivedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const purchaseItemSchema = new Schema<PurchaseItem>(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
    },
    quantityOrdered: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    quantityReceived: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    unitCost: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCost: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  { _id: false },
);

const purchaseSchema = new Schema<Purchase>(
  {
    supplierId: {
      type: Schema.Types.ObjectId,
      ref: "Supplier",
      required: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PURCHASE_STATUSES),
      default: PURCHASE_STATUSES.DRAFT,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ARS",
      maxlength: 12,
    },
    items: {
      type: [purchaseItemSchema],
      required: true,
      default: [],
    },
    estimatedTotal: {
      type: Number,
      required: true,
      min: 0,
    },
    receivedTotal: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    orderedAt: {
      type: Date,
      default: null,
    },
    receivedAt: {
      type: Date,
      default: null,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

purchaseSchema.index({ supplierId: 1, createdAt: -1 });
purchaseSchema.index({ projectId: 1, createdAt: -1 });
purchaseSchema.index({ status: 1, deletedAt: 1 });

export type PurchaseDocument = HydratedDocument<Purchase>;

export const PurchaseModel = model<Purchase>("Purchase", purchaseSchema);
