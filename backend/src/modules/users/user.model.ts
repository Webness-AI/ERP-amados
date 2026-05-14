import { model, Schema, type HydratedDocument } from "mongoose";

import {
  auditableFields,
  auditableSchemaOptions,
  type AuditableFields,
} from "../../core/database/auditable.schema";
import { ROLES, type Role } from "../auth/roles";

export type User = AuditableFields & {
  firstName: string;
  lastName: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  refreshTokenHash?: string | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

const userSchema = new Schema<User>(
  {
    firstName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    lastName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      required: true,
      enum: Object.values(ROLES),
      default: ROLES.USER,
    },
    isActive: {
      type: Boolean,
      required: true,
      default: true,
    },
    refreshTokenHash: {
      type: String,
      default: null,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
    ...auditableFields,
  },
  auditableSchemaOptions,
);

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ isActive: 1, deletedAt: 1 });

userSchema.set("toJSON", {
  transform: (_doc, ret: Record<string, unknown>) => {
    delete ret.passwordHash;
    delete ret.refreshTokenHash;
    return ret;
  },
});

export type UserDocument = HydratedDocument<User>;

export const UserModel = model<User>("User", userSchema);
