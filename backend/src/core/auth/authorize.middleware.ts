import type { NextFunction, Request, Response } from "express";

import type { Role } from "../../modules/auth/roles";
import { AppError } from "../errors/app-error";

export function authorizeMiddleware(allowedRoles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError("Authentication required", 401, "UNAUTHORIZED"));
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      next(new AppError("Forbidden", 403, "FORBIDDEN"));
      return;
    }

    next();
  };
}
