import jwt, {
  type JwtPayload,
  type Secret,
  type SignOptions,
} from "jsonwebtoken";

import { env } from "../../config/env";
import { AppError } from "../errors/app-error";

export type AccessTokenPayload = {
  sub: string;
  role: "ADMIN_GENERAL" | "ADMIN" | "USER";
  email: string;
  type: "access";
};

export type RefreshTokenPayload = {
  sub: string;
  type: "refresh";
};

function assertObjectPayload(payload: string | JwtPayload): JwtPayload {
  if (typeof payload === "string") {
    throw new AppError("Invalid token payload", 401, "INVALID_TOKEN");
  }
  return payload;
}

export function signAccessToken(
  payload: Omit<AccessTokenPayload, "type">,
): string {
  const secret: Secret = env.JWT_ACCESS_SECRET;
  const expiresIn = env.JWT_ACCESS_EXPIRES_IN as Exclude<
    SignOptions["expiresIn"],
    undefined
  >;

  return jwt.sign(
    {
      ...payload,
      type: "access",
    },
    secret,
    { expiresIn },
  );
}

export function signRefreshToken(
  payload: Omit<RefreshTokenPayload, "type">,
): string {
  const secret: Secret = env.JWT_REFRESH_SECRET;
  const expiresIn = env.JWT_REFRESH_EXPIRES_IN as Exclude<
    SignOptions["expiresIn"],
    undefined
  >;

  return jwt.sign(
    {
      ...payload,
      type: "refresh",
    },
    secret,
    { expiresIn },
  );
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    const decoded = assertObjectPayload(
      jwt.verify(token, env.JWT_ACCESS_SECRET),
    );

    if (
      decoded.type !== "access" ||
      typeof decoded.sub !== "string" ||
      typeof decoded.role !== "string" ||
      typeof decoded.email !== "string"
    ) {
      throw new AppError("Invalid access token", 401, "INVALID_TOKEN");
    }

    return decoded as AccessTokenPayload;
  } catch {
    throw new AppError(
      "Access token is invalid or expired",
      401,
      "INVALID_TOKEN",
    );
  }
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    const decoded = assertObjectPayload(
      jwt.verify(token, env.JWT_REFRESH_SECRET),
    );

    if (decoded.type !== "refresh" || typeof decoded.sub !== "string") {
      throw new AppError("Invalid refresh token", 401, "INVALID_TOKEN");
    }

    return decoded as RefreshTokenPayload;
  } catch {
    throw new AppError(
      "Refresh token is invalid or expired",
      401,
      "INVALID_TOKEN",
    );
  }
}

export function issueTokenPair(data: {
  userId: string;
  role: "ADMIN_GENERAL" | "ADMIN" | "USER";
  email: string;
}): { accessToken: string; refreshToken: string } {
  return {
    accessToken: signAccessToken({
      sub: data.userId,
      role: data.role,
      email: data.email,
    }),
    refreshToken: signRefreshToken({
      sub: data.userId,
    }),
  };
}
