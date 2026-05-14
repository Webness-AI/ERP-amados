import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createCashMovement,
  getCashMovementById,
  listCashMovements,
} from "./cash.service";
import {
  createCashMovementSchema,
  listCashMovementsSchema,
} from "./cash.schemas";

const cashRouter = Router();
const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

function requireRouteParam(value: unknown, paramName: string): string {
  if (typeof value === "string" && value.length > 0) {
    return value;
  }

  throw new AppError(
    `Missing route param: ${paramName}`,
    400,
    "INVALID_ROUTE_PARAM",
  );
}

cashRouter.get(
  "/movements",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listCashMovementsSchema.parse(req.query);
      const result = await listCashMovements(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

cashRouter.get(
  "/movements/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const movementId = requireRouteParam(req.params.id, "id");
      const movement = await getCashMovementById(movementId);

      res.status(200).json({
        ok: true,
        data: { movement },
      });
    })().catch(next);
  },
);

cashRouter.post(
  "/movements",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createCashMovementSchema.parse(req.body);
      const movement = await createCashMovement(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { movement },
      });
    })().catch(next);
  },
);

export { cashRouter };
