import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export type Supplier = AuditableFields & {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const supplierSchema = new Schema<Supplier>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    contactName: {
      type: String,
      trim: true,
      default: null,
      maxlength: 140,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      maxlength: 140,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
      maxlength: 60,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1200,
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

supplierSchema.index({ name: 1 });
supplierSchema.index({ email: 1 });
supplierSchema.index({ isActive: 1, deletedAt: 1 });

export type SupplierDocument = HydratedDocument<Supplier>;

export const SupplierModel = model<Supplier>("Supplier", supplierSchema);
