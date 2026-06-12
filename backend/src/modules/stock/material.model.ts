import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const MATERIAL_CATEGORIES = {
  MADERA: "MADERA",
  HERRAJES: "HERRAJES",
  OTROS: "OTROS",
} as const;

export type MaterialCategory =
  (typeof MATERIAL_CATEGORIES)[keyof typeof MATERIAL_CATEGORIES];

export type Material = AuditableFields & {
  name: string;
  category: MaterialCategory;
  sku?: string | null;
  supplierId?: string | null;
  type?: string | null;
  color?: string | null;
  note?: string | null;
  unit: string;
  unitPrice: number;
  minStock: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const materialSchema = new Schema<Material>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    category: {
      type: String,
      required: true,
      enum: Object.values(MATERIAL_CATEGORIES),
    },
    sku: {
      type: String,
      trim: true,
      uppercase: true,
      default: null,
      maxlength: 60,
    },
    supplierId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 60,
    },
    type: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },
    color: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    unit: {
      type: String,
      required: true,
      trim: true,
      default: "u",
      maxlength: 30,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    minStock: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

materialSchema.index({ name: 1 });
materialSchema.index({ category: 1, isActive: 1, deletedAt: 1 });
materialSchema.index({ supplierId: 1, deletedAt: 1 });
materialSchema.index({ sku: 1 }, { unique: true, sparse: true });

export type MaterialDocument = HydratedDocument<Material>;

export const MaterialModel = model<Material>("Material", materialSchema);
