import { model, Schema, type HydratedDocument, Types } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";

export const ACCOUNT_TYPES = {
  ASSET: "ASSET",
  LIABILITY: "LIABILITY",
  EQUITY: "EQUITY",
  INCOME: "INCOME",
  EXPENSE: "EXPENSE",
} as const;

export type AccountType = (typeof ACCOUNT_TYPES)[keyof typeof ACCOUNT_TYPES];

export type Account = AuditableFields & {
  code: string;
  name: string;
  type: AccountType;
  parentAccountId?: Types.ObjectId | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

const accountSchema = new Schema<Account>(
  {
    code: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 30,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 180,
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(ACCOUNT_TYPES),
    },
    parentAccountId: {
      type: Schema.Types.ObjectId,
      ref: "Account",
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

accountSchema.index({ code: 1 }, { unique: true });
accountSchema.index({ type: 1, isActive: 1, deletedAt: 1 });
accountSchema.index({ parentAccountId: 1, deletedAt: 1 });

export type AccountDocument = HydratedDocument<Account>;

export const AccountModel = model<Account>("Account", accountSchema);
