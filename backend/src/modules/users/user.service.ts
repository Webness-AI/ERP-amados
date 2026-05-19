import bcrypt from "bcryptjs";

import { env } from "../../config/env";
import { AppError } from "../../core/errors/app-error";
import {
  buildPaginatedResponse,
  parsePaginationInput,
} from "../../core/utils/pagination";
import { ROLES, type Role } from "../auth/roles";
import type {
  CreateUserInput,
  ListUsersInput,
  ResetUserPasswordInput,
  UpdateUserInput,
  UpdateUserRoleInput,
  UpdateUserStatusInput,
} from "./user.schemas";
import { UserModel } from "./user.model";

type Actor = {
  id: string;
};

type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function toPublicUser(value: {
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): PublicUser {
  return {
    id: String(value._id),
    firstName: value.firstName,
    lastName: value.lastName,
    email: value.email,
    role: value.role,
    isActive: value.isActive,
    lastLoginAt: value.lastLoginAt ?? null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

async function ensureEmailAvailable(
  email: string,
  currentUserId?: string,
): Promise<void> {
  const existingUser = await UserModel.findOne({
    email: email.toLowerCase(),
  })
    .select("_id")
    .lean();

  if (!existingUser) {
    return;
  }

  if (currentUserId && String(existingUser._id) === currentUserId) {
    return;
  }

  throw new AppError("Email already in use", 409, "EMAIL_ALREADY_IN_USE");
}

async function getExistingUserOrThrow(id: string): Promise<{
  _id: unknown;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  isActive: boolean;
  deletedAt?: Date | null;
  lastLoginAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}> {
  const user = await UserModel.findById(id).lean();

  if (!user || user.deletedAt) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return user;
}

export async function createUser(
  input: CreateUserInput,
  actor: Actor,
): Promise<PublicUser> {
  await ensureEmailAvailable(input.email);

  const passwordHash = await bcrypt.hash(
    input.password,
    env.BCRYPT_SALT_ROUNDS,
  );

  const user = new UserModel({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    passwordHash,
    role: ROLES.USER,
    isActive: true,
    createdBy: actor.id,
    updatedBy: actor.id,
  });

  await user.save();

  return toPublicUser(user.toObject());
}

export async function listUsers(query: ListUsersInput): Promise<{
  items: PublicUser[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}> {
  const { page, limit, skip } = parsePaginationInput(query);
  const filter: Record<string, unknown> = {
    deletedAt: null,
  };

  if (query.role) {
    filter.role = query.role;
  }

  if (query.activeOnly !== "false") {
    filter.isActive = true;
  }

  if (query.search && query.search.trim().length > 0) {
    const regex = new RegExp(query.search.trim(), "i");
    filter.$or = [{ firstName: regex }, { lastName: regex }, { email: regex }];
  }

  const [itemsRaw, total] = await Promise.all([
    UserModel.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select(
        "firstName lastName email role isActive lastLoginAt createdAt updatedAt",
      )
      .lean(),
    UserModel.countDocuments(filter),
  ]);

  return buildPaginatedResponse({
    items: itemsRaw.map((item) => toPublicUser(item)),
    total,
    page,
    limit,
  });
}

export async function getUserById(id: string): Promise<PublicUser> {
  const user = await getExistingUserOrThrow(id);
  return toPublicUser(user);
}

export async function updateUserProfile(
  id: string,
  input: UpdateUserInput,
  actor: Actor,
): Promise<PublicUser> {
  const existing = await getExistingUserOrThrow(id);

  if (input.email !== undefined) {
    await ensureEmailAvailable(input.email, String(existing._id));
  }

  const updatePayload: Record<string, unknown> = {
    updatedBy: actor.id,
  };

  if (input.firstName !== undefined) {
    updatePayload.firstName = input.firstName;
  }

  if (input.lastName !== undefined) {
    updatePayload.lastName = input.lastName;
  }

  if (input.email !== undefined) {
    updatePayload.email = input.email.toLowerCase();
  }

  const user = await UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    updatePayload,
    {
      new: true,
      projection: {
        firstName: 1,
        lastName: 1,
        email: 1,
        role: 1,
        isActive: 1,
        lastLoginAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ).lean();

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function updateUserRole(
  id: string,
  input: UpdateUserRoleInput,
  actor: Actor,
): Promise<PublicUser> {
  const user = await UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      role: input.role,
      updatedBy: actor.id,
    },
    {
      new: true,
      projection: {
        firstName: 1,
        lastName: 1,
        email: 1,
        role: 1,
        isActive: 1,
        lastLoginAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ).lean();

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function updateUserStatus(
  id: string,
  input: UpdateUserStatusInput,
  actor: Actor,
): Promise<PublicUser> {
  if (id === actor.id && !input.isActive) {
    throw new AppError(
      "You cannot deactivate your own user",
      409,
      "SELF_DEACTIVATION_NOT_ALLOWED",
    );
  }

  const user = await UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      isActive: input.isActive,
      refreshTokenHash: input.isActive ? undefined : null,
      updatedBy: actor.id,
    },
    {
      new: true,
      projection: {
        firstName: 1,
        lastName: 1,
        email: 1,
        role: 1,
        isActive: 1,
        lastLoginAt: 1,
        createdAt: 1,
        updatedAt: 1,
      },
    },
  ).lean();

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}

export async function resetUserPassword(
  id: string,
  input: ResetUserPasswordInput,
  actor: Actor,
): Promise<void> {
  const user = await UserModel.findOne({ _id: id, deletedAt: null });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  const passwordHash = await bcrypt.hash(
    input.newPassword,
    env.BCRYPT_SALT_ROUNDS,
  );

  user.passwordHash = passwordHash;
  user.refreshTokenHash = null;
  user.updatedBy = actor.id;
  await user.save();
}

export async function softDeleteUser(id: string, actor: Actor): Promise<void> {
  if (id === actor.id) {
    throw new AppError(
      "You cannot delete your own user",
      409,
      "SELF_DELETE_NOT_ALLOWED",
    );
  }

  const user = await UserModel.findOneAndUpdate(
    { _id: id, deletedAt: null },
    {
      isActive: false,
      refreshTokenHash: null,
      deletedAt: new Date(),
      deletedBy: actor.id,
      updatedBy: actor.id,
    },
    { new: true },
  ).lean();

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }
}
