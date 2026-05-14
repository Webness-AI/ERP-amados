import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const CASH_SOURCES = {
  CASH: "CASH",
  BANK: "BANK",
} as const;

export const CASH_DIRECTIONS = {
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export const CASH_PAYMENT_METHODS = {
  EFECTIVO: "EFECTIVO",
  TRANSFERENCIA: "TRANSFERENCIA",
  TARJETA: "TARJETA",
  CHEQUE: "CHEQUE",
  OTRO: "OTRO",
} as const;

export type CashSource = (typeof CASH_SOURCES)[keyof typeof CASH_SOURCES];
export type CashDirection =
  (typeof CASH_DIRECTIONS)[keyof typeof CASH_DIRECTIONS];
export type CashPaymentMethod =
  (typeof CASH_PAYMENT_METHODS)[keyof typeof CASH_PAYMENT_METHODS];

export type CashMovement = AuditableFields & {
  source: CashSource;
  direction: CashDirection;
  paymentMethod: CashPaymentMethod;
  amount: number;
  currency: string;
  concept: string;
  clientId?: Types.ObjectId | null;
  projectId?: Types.ObjectId | null;
  referenceType?: string | null;
  referenceId?: string | null;
  occurredAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

const cashMovementSchema = new Schema<CashMovement>(
  {
    source: {
      type: String,
      required: true,
      enum: Object.values(CASH_SOURCES),
    },
    direction: {
      type: String,
      required: true,
      enum: Object.values(CASH_DIRECTIONS),
    },
    paymentMethod: {
      type: String,
      required: true,
      enum: Object.values(CASH_PAYMENT_METHODS),
      default: CASH_PAYMENT_METHODS.EFECTIVO,
    },
    amount: {
      type: Number,
      required: true,
      min: 0.0001,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ARS",
      maxlength: 12,
    },
    concept: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 280,
    },
    clientId: {
      type: Schema.Types.ObjectId,
      ref: "Client",
      default: null,
    },
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "Project",
      default: null,
    },
    referenceType: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },
    referenceId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
    },
    occurredAt: {
      type: Date,
      required: true,
      default: () => new Date(),
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

cashMovementSchema.index({ occurredAt: -1, deletedAt: 1 });
cashMovementSchema.index({ source: 1, direction: 1, deletedAt: 1 });
cashMovementSchema.index({ referenceType: 1, referenceId: 1, deletedAt: 1 });

export type CashMovementDocument = HydratedDocument<CashMovement>;

export const CashMovementModel = model<CashMovement>(
  "CashMovement",
  cashMovementSchema,
);
