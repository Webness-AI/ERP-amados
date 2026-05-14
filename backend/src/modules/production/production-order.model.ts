import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const PRODUCTION_STATUSES = {
  PENDIENTE: "PENDIENTE",
  CORTE: "CORTE",
  ARMADO: "ARMADO",
  INSTALACION: "INSTALACION",
  FINALIZADO: "FINALIZADO",
} as const;

export const PRODUCTION_PRIORITIES = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
} as const;

export type ProductionStatus =
  (typeof PRODUCTION_STATUSES)[keyof typeof PRODUCTION_STATUSES];
export type ProductionPriority =
  (typeof PRODUCTION_PRIORITIES)[keyof typeof PRODUCTION_PRIORITIES];

export type ProductionOrder = AuditableFields & {
  projectId: Types.ObjectId;
  title: string;
  status: ProductionStatus;
  priority: ProductionPriority;
  assigneeName?: string | null;
  notes?: string | null;
  startedAt?: Date | null;
  finishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const productionOrderSchema = new Schema<ProductionOrder>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(PRODUCTION_STATUSES),
      default: PRODUCTION_STATUSES.PENDIENTE,
    },
    priority: {
      type: String,
      required: true,
      enum: Object.values(PRODUCTION_PRIORITIES),
      default: PRODUCTION_PRIORITIES.MEDIUM,
    },
    assigneeName: {
      type: String,
      trim: true,
      default: null,
      maxlength: 140,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
    },
    startedAt: {
      type: Date,
      default: null,
    },
    finishedAt: {
      type: Date,
      default: null,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

productionOrderSchema.index({ projectId: 1, createdAt: -1 });
productionOrderSchema.index({ status: 1, priority: 1, deletedAt: 1 });

export type ProductionOrderDocument = HydratedDocument<ProductionOrder>;

export const ProductionOrderModel = model<ProductionOrder>(
  "ProductionOrder",
  productionOrderSchema,
);
