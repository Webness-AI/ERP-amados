import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createProductionOrder,
  getProductionOrderById,
  listProductionOrders,
  softDeleteProductionOrder,
  updateProductionOrder,
  updateProductionOrderStatus,
} from "./production-order.service";
import {
  createProductionOrderSchema,
  listProductionOrdersSchema,
  updateProductionOrderSchema,
  updateProductionOrderStatusSchema,
} from "./production-order.schemas";

const productionOrderRouter = Router();
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

productionOrderRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listProductionOrdersSchema.parse(req.query);
      const result = await listProductionOrders(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

productionOrderRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const orderId = requireRouteParam(req.params.id, "id");
      const order = await getProductionOrderById(orderId);

      res.status(200).json({
        ok: true,
        data: { order },
      });
    })().catch(next);
  },
);

productionOrderRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createProductionOrderSchema.parse(req.body);
      const order = await createProductionOrder(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { order },
      });
    })().catch(next);
  },
);

productionOrderRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const orderId = requireRouteParam(req.params.id, "id");
      const payload = updateProductionOrderSchema.parse(req.body);
      const order = await updateProductionOrder(orderId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { order },
      });
    })().catch(next);
  },
);

productionOrderRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const orderId = requireRouteParam(req.params.id, "id");
      const payload = updateProductionOrderStatusSchema.parse(req.body);
      const order = await updateProductionOrderStatus(orderId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { order },
      });
    })().catch(next);
  },
);

productionOrderRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const orderId = requireRouteParam(req.params.id, "id");
      await softDeleteProductionOrder(orderId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Production order deleted" },
      });
    })().catch(next);
  },
);

export { productionOrderRouter };
