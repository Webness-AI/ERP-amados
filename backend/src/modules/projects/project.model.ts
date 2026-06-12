import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const PROJECT_STATUSES = {
  CONSULTA: "CONSULTA",
  PRESUPUESTADO: "PRESUPUESTADO",
  APROBADO: "APROBADO",
  COMPRADO: "COMPRADO",
  PRODUCCION: "PRODUCCION",
  INSTALACION: "INSTALACION",
  PAUSADO: "PAUSADO",
  FINALIZADO: "FINALIZADO",
  CANCELADO: "CANCELADO",
} as const;

export type ProjectStatus =
  (typeof PROJECT_STATUSES)[keyof typeof PROJECT_STATUSES];

export type Project = AuditableFields & {
  clientId: Types.ObjectId;
  budgetId?: Types.ObjectId | null;
  name: string;
  description?: string | null;
  localidad?: string | null;
  contacto?: string | null;
  direccion?: string | null;
  status: ProjectStatus;
  deliveryDate?: Date | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const projectSchema = new Schema<Project>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
    },
    budgetId: {
      type: Schema.Types.ObjectId,
      ref: "Budget",
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: 2000,
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
    status: {
      type: String,
      required: true,
      enum: Object.values(PROJECT_STATUSES),
      default: PROJECT_STATUSES.CONSULTA,
    },
    deliveryDate: {
      type: Date,
      default: null,
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

projectSchema.index({ clientId: 1, createdAt: -1 });
projectSchema.index({ budgetId: 1 });
projectSchema.index({ status: 1, deletedAt: 1 });

export type ProjectDocument = HydratedDocument<Project>;

export const ProjectModel = model<Project>("Project", projectSchema);
