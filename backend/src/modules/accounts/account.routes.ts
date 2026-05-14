import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createAccount,
  getAccountById,
  listAccounts,
  softDeleteAccount,
  updateAccount,
} from "./account.service";
import {
  createAccountSchema,
  listAccountsSchema,
  updateAccountSchema,
} from "./account.schemas";

const accountRouter = Router();
const READ_ROLES = [ROLES.ADMIN_GENERAL, ROLES.ADMIN, ROLES.USER];
const WRITE_ROLES = [ROLES.ADMIN_GENERAL];

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

accountRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listAccountsSchema.parse(req.query);
      const result = await listAccounts(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

accountRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(READ_ROLES),
  (req, res, next) => {
    (async () => {
      const accountId = requireRouteParam(req.params.id, "id");
      const account = await getAccountById(accountId);

      res.status(200).json({
        ok: true,
        data: { account },
      });
    })().catch(next);
  },
);

accountRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createAccountSchema.parse(req.body);
      const account = await createAccount(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { account },
      });
    })().catch(next);
  },
);

accountRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const accountId = requireRouteParam(req.params.id, "id");
      const payload = updateAccountSchema.parse(req.body);
      const account = await updateAccount(accountId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { account },
      });
    })().catch(next);
  },
);

accountRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(WRITE_ROLES),
  (req, res, next) => {
    (async () => {
      const accountId = requireRouteParam(req.params.id, "id");
      await softDeleteAccount(accountId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Account deleted" },
      });
    })().catch(next);
  },
);

export { accountRouter };
