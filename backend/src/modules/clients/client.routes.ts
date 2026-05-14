import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createClient,
  getClientById,
  listClients,
  softDeleteClient,
  updateClient,
} from "./client.service";
import {
  createClientSchema,
  listClientsSchema,
  updateClientSchema,
} from "./client.schemas";

const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN];

const clientRouter = Router();

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

clientRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listClientsSchema.parse(req.query);
      const result = await listClients(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

clientRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const clientId = requireRouteParam(req.params.id, "id");
      const client = await getClientById(clientId);

      res.status(200).json({
        ok: true,
        data: { client },
      });
    })().catch(next);
  },
);

clientRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createClientSchema.parse(req.body);
      const client = await createClient(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { client },
      });
    })().catch(next);
  },
);

clientRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const clientId = requireRouteParam(req.params.id, "id");
      const payload = updateClientSchema.parse(req.body);
      const client = await updateClient(clientId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { client },
      });
    })().catch(next);
  },
);

clientRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const clientId = requireRouteParam(req.params.id, "id");
      await softDeleteClient(clientId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Client deleted" },
      });
    })().catch(next);
  },
);

export { clientRouter };
