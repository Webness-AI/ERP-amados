import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const STOCK_MOVEMENT_TYPES = {
  INGRESO: "INGRESO",
  RESERVA: "RESERVA",
  CONSUMO: "CONSUMO",
  AJUSTE: "AJUSTE",
  DEVOLUCION: "DEVOLUCION",
} as const;

export type StockMovementType =
  (typeof STOCK_MOVEMENT_TYPES)[keyof typeof STOCK_MOVEMENT_TYPES];

export type StockMovement = AuditableFields & {
  materialId: Types.ObjectId;
  type: StockMovementType;
  quantity: number;
  unitCost?: number | null;
  projectId?: Types.ObjectId | null;
  note?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

const stockMovementSchema = new Schema<StockMovement>(
  {
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
      index: true,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(STOCK_MOVEMENT_TYPES),
    },
    quantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    unitCost: {
      type: Number,
      default: null,
      min: 0,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

stockMovementSchema.index({ materialId: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ projectId: 1, createdAt: -1 });

export type StockMovementDocument = HydratedDocument<StockMovement>;

export const StockMovementModel = model<StockMovement>(
  "StockMovement",
  stockMovementSchema,
);
