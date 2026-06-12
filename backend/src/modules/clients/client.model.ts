import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export type Client = AuditableFields & {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  notes?: string | null;
  localidad?: string | null;
  contacto?: string | null;
  direccion?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const clientSchema = new Schema<Client>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 140,
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
      maxlength: 120,
    },
    phone: {
      type: String,
      trim: true,
      default: null,
      maxlength: 40,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    localidad: {
      type: String,
      trim: true,
      default: null,
      maxlength: 180,
    },
    contacto: {
      type: String,
      trim: true,
      default: null,
      maxlength: 140,
    },
    direccion: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
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

clientSchema.index({ name: 1 });
clientSchema.index({ email: 1 });
clientSchema.index({ isActive: 1, deletedAt: 1 });

export type ClientDocument = HydratedDocument<Client>;

export const ClientModel = model<Client>("Client", clientSchema);
