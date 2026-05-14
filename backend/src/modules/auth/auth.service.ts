import bcrypt from "bcryptjs";

import { env } from "../../config/env";
import { AppError } from "../../core/errors/app-error";
import {
  issueTokenPair,
  verifyRefreshToken,
} from "../../core/auth/jwt.service";
import { UserModel, type UserDocument } from "../users/user.model";
import type {
  BootstrapAdminInput,
  LoginInput,
  RefreshInput,
} from "./auth.schemas";

type PublicUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: "ADMIN_GENERAL" | "ADMIN" | "USER";
};

type AuthResult = {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
};

function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
  };
}

async function persistRefreshToken(
  user: UserDocument,
  refreshToken: string,
): Promise<void> {
  const refreshTokenHash = await bcrypt.hash(
    refreshToken,
    env.BCRYPT_SALT_ROUNDS,
  );
  user.refreshTokenHash = refreshTokenHash;
}

export async function bootstrapAdmin(
  input: BootstrapAdminInput,
): Promise<AuthResult> {
  const activeUsers = await UserModel.countDocuments({
    isActive: true,
    deletedAt: null,
  });

  if (activeUsers > 0) {
    throw new AppError(
      "Bootstrap admin is disabled because users already exist",
      409,
      "BOOTSTRAP_ALREADY_DONE",
    );
  }

  const passwordHash = await bcrypt.hash(
    input.password,
    env.BCRYPT_SALT_ROUNDS,
  );

  const user = new UserModel({
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email.toLowerCase(),
    passwordHash,
    role: input.role,
    isActive: true,
    createdBy: "system",
    updatedBy: "system",
  });

  const tokens = issueTokenPair({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  await persistRefreshToken(user, tokens.refreshToken);
  user.lastLoginAt = new Date();
  await user.save();

  return {
    user: toPublicUser(user),
    ...tokens,
  };
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await UserModel.findOne({
    email: input.email.toLowerCase(),
    isActive: true,
    deletedAt: null,
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const isPasswordValid = await bcrypt.compare(
    input.password,
    user.passwordHash,
  );

  if (!isPasswordValid) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const tokens = issueTokenPair({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  await persistRefreshToken(user, tokens.refreshToken);
  user.lastLoginAt = new Date();
  user.updatedBy = user.id;
  await user.save();

  return {
    user: toPublicUser(user),
    ...tokens,
  };
}

export async function refreshSession(input: RefreshInput): Promise<AuthResult> {
  const payload = verifyRefreshToken(input.refreshToken);

  const user = await UserModel.findOne({
    _id: payload.sub,
    isActive: true,
    deletedAt: null,
  });

  if (!user || !user.refreshTokenHash) {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  const isRefreshTokenValid = await bcrypt.compare(
    input.refreshToken,
    user.refreshTokenHash,
  );

  if (!isRefreshTokenValid) {
    throw new AppError("Invalid refresh token", 401, "INVALID_REFRESH_TOKEN");
  }

  const tokens = issueTokenPair({
    userId: user.id,
    role: user.role,
    email: user.email,
  });

  await persistRefreshToken(user, tokens.refreshToken);
  user.updatedBy = user.id;
  await user.save();

  return {
    user: toPublicUser(user),
    ...tokens,
  };
}

export async function logout(userId: string): Promise<void> {
  const user = await UserModel.findById(userId);

  if (!user || !user.isActive || user.deletedAt) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  user.refreshTokenHash = null;
  user.updatedBy = user.id;
  await user.save();
}

export async function getProfile(userId: string): Promise<PublicUser> {
  const user = await UserModel.findOne({
    _id: userId,
    isActive: true,
    deletedAt: null,
  });

  if (!user) {
    throw new AppError("User not found", 404, "USER_NOT_FOUND");
  }

  return toPublicUser(user);
}
