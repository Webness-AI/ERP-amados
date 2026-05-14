import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export type ProjectMaterialRequirement = AuditableFields & {
  projectId: Types.ObjectId;
  materialId: Types.ObjectId;
  requiredQuantity: number;
  reservedQuantity: number;
  consumedQuantity: number;
  createdAt: Date;
  updatedAt: Date;
};

const projectMaterialRequirementSchema = new Schema<ProjectMaterialRequirement>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      required: true,
      index: true,
    },
    materialId: {
      type: Schema.Types.ObjectId,
      ref: "Material",
      required: true,
      index: true,
    },
    requiredQuantity: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    reservedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    consumedQuantity: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

projectMaterialRequirementSchema.index(
  { projectId: 1, materialId: 1, deletedAt: 1 },
  { unique: true },
);
projectMaterialRequirementSchema.index({ projectId: 1, createdAt: -1 });

export type ProjectMaterialRequirementDocument =
  HydratedDocument<ProjectMaterialRequirement>;

export const ProjectMaterialRequirementModel =
  model<ProjectMaterialRequirement>(
    "ProjectMaterialRequirement",
    projectMaterialRequirementSchema,
  );
