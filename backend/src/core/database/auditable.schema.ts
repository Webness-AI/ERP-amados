import type { SchemaDefinitionProperty } from "mongoose";

export type AuditableFields = {
  createdBy: string;
  updatedBy: string;
  deletedAt?: Date | null;
  deletedBy?: string | null;
};

export const auditableFields: Record<
  keyof AuditableFields,
  SchemaDefinitionProperty
> = {
  createdBy: {
    type: String,
    required: true,
    trim: true,
  },
  updatedBy: {
    type: String,
    required: true,
    trim: true,
  },
  deletedAt: {
    type: Date,
    default: null,
  },
  deletedBy: {
    type: String,
    default: null,
    trim: true,
  },
};

export const auditableSchemaOptions = {
  timestamps: true,
};
