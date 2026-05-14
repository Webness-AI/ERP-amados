import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createPurchase,
  getPurchaseById,
  listPurchases,
  receivePurchase,
  softDeletePurchase,
  updatePurchaseStatus,
} from "./purchase.service";
import {
  createPurchaseSchema,
  listPurchasesSchema,
  receivePurchaseSchema,
  updatePurchaseStatusSchema,
} from "./purchase.schemas";

const purchaseRouter = Router();
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

purchaseRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listPurchasesSchema.parse(req.query);
      const result = await listPurchases(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

purchaseRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const purchaseId = requireRouteParam(req.params.id, "id");
      const purchase = await getPurchaseById(purchaseId);

      res.status(200).json({
        ok: true,
        data: { purchase },
      });
    })().catch(next);
  },
);

purchaseRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createPurchaseSchema.parse(req.body);
      const purchase = await createPurchase(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { purchase },
      });
    })().catch(next);
  },
);

purchaseRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const purchaseId = requireRouteParam(req.params.id, "id");
      const payload = updatePurchaseStatusSchema.parse(req.body);
      const purchase = await updatePurchaseStatus(purchaseId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { purchase },
      });
    })().catch(next);
  },
);

purchaseRouter.post(
  "/:id/receive",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const purchaseId = requireRouteParam(req.params.id, "id");
      const payload = receivePurchaseSchema.parse(req.body);
      const purchase = await receivePurchase(purchaseId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { purchase },
      });
    })().catch(next);
  },
);

purchaseRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const purchaseId = requireRouteParam(req.params.id, "id");
      await softDeletePurchase(purchaseId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Purchase deleted" },
      });
    })().catch(next);
  },
);

export { purchaseRouter };
