import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";
import {
  DOMAIN_EVENTS,
  type DomainEventName,
} from "../../core/events/domain-events";

export type JournalEntryLine = {
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  description?: string | null;
};

export type JournalEntry = AuditableFields & {
  entryDate: Date;
  description: string;
  currency: string;
  originEvent?: DomainEventName | null;
  originEntityType?: string | null;
  originEntityId?: string | null;
  correlationId?: string | null;
  isReversal: boolean;
  reversalOfEntryId?: string | null;
  lines: JournalEntryLine[];
  totalDebit: number;
  totalCredit: number;
  createdAt: Date;
  updatedAt: Date;
};

const journalEntryLineSchema = new Schema<JournalEntryLine>(
  {
    accountCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 60,
    },
    accountName: {
      type: String,
      required: true,
      trim: true,
      maxlength: 220,
    },
    debit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    credit: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    description: {
      type: String,
      trim: true,
      default: null,
      maxlength: 500,
    },
  },
  { _id: false },
);

const journalEntrySchema = new Schema<JournalEntry>(
  {
    entryDate: {
      type: Date,
      required: true,
      default: () => new Date(),
      index: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 600,
    },
    currency: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      default: "ARS",
      maxlength: 12,
    },
    originEvent: {
      type: String,
      enum: Object.values(DOMAIN_EVENTS),
      default: null,
      index: true,
    },
    originEntityType: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
      index: true,
    },
    originEntityId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
      index: true,
    },
    correlationId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 180,
      index: true,
    },
    isReversal: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    reversalOfEntryId: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
      index: true,
    },
    lines: {
      type: [journalEntryLineSchema],
      required: true,
      validate: {
        validator: (lines: JournalEntryLine[]): boolean => lines.length >= 2,
        message: "Journal entry must include at least two lines",
      },
    },
    totalDebit: {
      type: Number,
      required: true,
      min: 0,
    },
    totalCredit: {
      type: Number,
      required: true,
      min: 0,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

journalEntrySchema.index({ entryDate: -1, createdAt: -1 });
journalEntrySchema.index({ "lines.accountCode": 1, entryDate: -1 });

export type JournalEntryDocument = HydratedDocument<JournalEntry>;

export const JournalEntryModel = model<JournalEntry>(
  "JournalEntry",
  journalEntrySchema,
);
