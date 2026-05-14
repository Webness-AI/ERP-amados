import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createSupplier,
  getSupplierById,
  listSuppliers,
  softDeleteSupplier,
  updateSupplier,
} from "./supplier.service";
import {
  createSupplierSchema,
  listSuppliersSchema,
  updateSupplierSchema,
} from "./supplier.schemas";

const supplierRouter = Router();
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

supplierRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listSuppliersSchema.parse(req.query);
      const result = await listSuppliers(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

supplierRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const supplierId = requireRouteParam(req.params.id, "id");
      const supplier = await getSupplierById(supplierId);

      res.status(200).json({
        ok: true,
        data: { supplier },
      });
    })().catch(next);
  },
);

supplierRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createSupplierSchema.parse(req.body);
      const supplier = await createSupplier(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { supplier },
      });
    })().catch(next);
  },
);

supplierRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const supplierId = requireRouteParam(req.params.id, "id");
      const payload = updateSupplierSchema.parse(req.body);
      const supplier = await updateSupplier(supplierId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { supplier },
      });
    })().catch(next);
  },
);

supplierRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const supplierId = requireRouteParam(req.params.id, "id");
      await softDeleteSupplier(supplierId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Supplier deleted" },
      });
    })().catch(next);
  },
);

export { supplierRouter };
