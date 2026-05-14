import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createCollection,
  getCollectionById,
  listCollections,
  refreshCollectionDueStatus,
  registerCollectionPayment,
} from "./collection.service";
import {
  createCollectionSchema,
  listCollectionsSchema,
  registerCollectionPaymentSchema,
} from "./collection.schemas";

const collectionRouter = Router();
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

collectionRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listCollectionsSchema.parse(req.query);
      const result = await listCollections(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

collectionRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const collectionId = requireRouteParam(req.params.id, "id");
      const collection = await getCollectionById(collectionId);

      res.status(200).json({
        ok: true,
        data: { collection },
      });
    })().catch(next);
  },
);

collectionRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createCollectionSchema.parse(req.body);
      const collection = await createCollection(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { collection },
      });
    })().catch(next);
  },
);

collectionRouter.post(
  "/:id/payments",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const collectionId = requireRouteParam(req.params.id, "id");
      const payload = registerCollectionPaymentSchema.parse(req.body);
      const collection = await registerCollectionPayment(
        collectionId,
        payload,
        {
          id: req.user!.id,
        },
      );

      res.status(200).json({
        ok: true,
        data: { collection },
      });
    })().catch(next);
  },
);

collectionRouter.post(
  "/refresh-due-status",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const result = await refreshCollectionDueStatus({ id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

export { collectionRouter };
