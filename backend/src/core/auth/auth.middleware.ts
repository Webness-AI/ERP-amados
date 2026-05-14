import type { NextFunction, Request, Response } from "express";

import { AppError } from "../errors/app-error";
import { verifyAccessToken } from "./jwt.service";

export function authMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  const authorization = req.headers.authorization;

  if (!authorization || !authorization.startsWith("Bearer ")) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  const token = authorization.replace("Bearer ", "").trim();

  if (!token) {
    next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
    return;
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    next();
  } catch (error) {
    next(error);
  }
}
