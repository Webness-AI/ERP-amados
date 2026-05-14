import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const COLLECTION_STATUSES = {
  PENDIENTE: "PENDIENTE",
  SENADO: "SENADO",
  PARCIAL: "PARCIAL",
  COBRADO: "COBRADO",
  VENCIDO: "VENCIDO",
} as const;

export type CollectionStatus =
  (typeof COLLECTION_STATUSES)[keyof typeof COLLECTION_STATUSES];

export const COLLECTION_PAYMENT_METHODS = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  TARJETA: "TARJETA",
  CHEQUE: "CHEQUE",
  OTRO: "OTRO",
} as const;

export type CollectionPaymentMethod =
  (typeof COLLECTION_PAYMENT_METHODS)[keyof typeof COLLECTION_PAYMENT_METHODS];

export type CollectionPayment = {
  amount: number;
  paymentMethod: CollectionPaymentMethod;
  paidAt: Date;
  note?: string | null;
  createdBy: string;
};

export type Collection = AuditableFields & {
  clientId: Types.ObjectId;
  projectId?: Types.ObjectId | null;
  status: CollectionStatus;
  totalAmount: number;
  paidAmount: number;
  pendingAmount: number;
  laborAmountPending: number;
  currency: string;
  dueDate?: Date | null;
  notes?: string | null;
  payments: CollectionPayment[];
  createdAt: Date;
  updatedAt: Date;
};

const collectionPaymentSchema = new Schema<CollectionPayment>(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: Object.values(COLLECTION_PAYMENT_METHODS),
    },
    paidAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    note: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1000,
    },
    createdBy: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
  },
  { _id: false },
);

const collectionSchema = new Schema<Collection>(
  {
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      required: true,
      index: true,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
      index: true,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(COLLECTION_STATUSES),
      default: COLLECTION_STATUSES.PENDIENTE,
    },
    totalAmount: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    paidAmount: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    pendingAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    laborAmountPending: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ARS",
      maxlength: 12,
    },
    dueDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      default: null,
      maxlength: 1500,
    },
    payments: {
      type: [collectionPaymentSchema],
      required: true,
      default: [],
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

collectionSchema.index({ clientId: 1, status: 1, deletedAt: 1 });
collectionSchema.index({ projectId: 1, status: 1, deletedAt: 1 });
collectionSchema.index({ dueDate: 1, status: 1, deletedAt: 1 });

export type CollectionDocument = HydratedDocument<Collection>;

export const CollectionModel = model<Collection>(
  "Collection",
  collectionSchema,
);
