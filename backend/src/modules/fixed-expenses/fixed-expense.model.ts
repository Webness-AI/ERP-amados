import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const FIXED_EXPENSE_FREQUENCIES = {
  MENSUAL: "MENSUAL",
  BIMESTRAL: "BIMESTRAL",
  TRIMESTRAL: "TRIMESTRAL",
  ANUAL: "ANUAL",
} as const;

export type FixedExpenseFrequency =
  (typeof FIXED_EXPENSE_FREQUENCIES)[keyof typeof FIXED_EXPENSE_FREQUENCIES];

export const FIXED_EXPENSE_STATUSES = {
  ACTIVO: "ACTIVO",
  PAUSADO: "PAUSADO",
} as const;

export type FixedExpenseStatus =
  (typeof FIXED_EXPENSE_STATUSES)[keyof typeof FIXED_EXPENSE_STATUSES];

export type FixedExpensePayment = {
  amount: number;
  paidAt: Date;
  note?: string | null;
  createdBy: string;
};

export type FixedExpense = AuditableFields & {
  name: string;
  amount: number;
  currency: string;
  frequency: FixedExpenseFrequency;
  status: FixedExpenseStatus;
  nextDueDate: Date;
  lastPaidAt?: Date | null;
  notes?: string | null;
  payments: FixedExpensePayment[];
  createdAt: Date;
  updatedAt: Date;
};

const fixedExpensePaymentSchema = new Schema<FixedExpensePayment>(
  {
    amount: {
      type: Number,
      required: true,
      min: 0.0001,
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

const fixedExpenseSchema = new Schema<FixedExpense>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 220,
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
    frequency: {
      type: String,
      required: true,
      enum: Object.values(FIXED_EXPENSE_FREQUENCIES),
      default: FIXED_EXPENSE_FREQUENCIES.MENSUAL,
    },
    status: {
      type: String,
      required: true,
      enum: Object.values(FIXED_EXPENSE_STATUSES),
      default: FIXED_EXPENSE_STATUSES.ACTIVO,
    },
    nextDueDate: {
      type: Date,
      required: true,
    },
    lastPaidAt: {
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
      type: [fixedExpensePaymentSchema],
      required: true,
      default: [],
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

fixedExpenseSchema.index({ status: 1, nextDueDate: 1, deletedAt: 1 });
fixedExpenseSchema.index({ name: 1 });

export type FixedExpenseDocument = HydratedDocument<FixedExpense>;

export const FixedExpenseModel = model<FixedExpense>(
  "FixedExpense",
  fixedExpenseSchema,
);
