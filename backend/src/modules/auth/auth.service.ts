import bcrypt from "bcryptjs";

import { env } from "../../config/env";
import { AppError } from "../../core/errors/app-error";
import {
  issueTokenPair,
  verifyRefreshToken,
} from "../../core/auth/jwt.service";
import { UserModel, type UserDocument } from "../users/user.model";
import type {
  ChangePasswordInput,
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

export async function login(input: LoginInput): Promise<AuthResult> {
  const user = await UserModel.findOne({
    email: input.email.toLowerCase(),
    isActive: true,
    deletedAt: null,
  });

  if (!user) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  if (!user.passwordHash) {
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

export async function changePassword(
  userId: string,
  input: ChangePasswordInput,
): Promise<void> {
  const user = await UserModel.findOne({
    _id: userId,
    isActive: true,
    deletedAt: null,
  });

  if (!user || !user.passwordHash) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  const isCurrentPasswordValid = await bcrypt.compare(
    input.oldPassword,
    user.passwordHash,
  );

  if (!isCurrentPasswordValid) {
    throw new AppError("Invalid credentials", 401, "INVALID_CREDENTIALS");
  }

  user.passwordHash = await bcrypt.hash(input.newPassword, env.BCRYPT_SALT_ROUNDS);
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
