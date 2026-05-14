import { randomUUID } from "node:crypto";

import type { NextFunction, Request, Response } from "express";

export function requestContextMiddleware(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  req.requestId = randomUUID();
  next();
}
