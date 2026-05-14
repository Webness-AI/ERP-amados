import { Router } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import { authorizeMiddleware } from "../../core/auth/authorize.middleware";
import { AppError } from "../../core/errors/app-error";
import { ROLES } from "../auth/roles";
import {
  createUser,
  getUserById,
  listUsers,
  resetUserPassword,
  softDeleteUser,
  updateUserProfile,
  updateUserRole,
  updateUserStatus,
} from "./user.service";
import {
  createUserSchema,
  listUsersSchema,
  resetUserPasswordSchema,
  updateUserRoleSchema,
  updateUserSchema,
  updateUserStatusSchema,
} from "./user.schemas";

const userRouter = Router();
const MANAGE_USERS_ROLES = [ROLES.ADMIN_GENERAL];

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

userRouter.get(
  "/",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const query = listUsersSchema.parse(req.query);
      const result = await listUsers(query);

      res.status(200).json({
        ok: true,
        data: result,
      });
    })().catch(next);
  },
);

userRouter.get(
  "/:id",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      const user = await getUserById(userId);

      res.status(200).json({
        ok: true,
        data: { user },
      });
    })().catch(next);
  },
);

userRouter.post(
  "/",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const payload = createUserSchema.parse(req.body);
      const user = await createUser(payload, { id: req.user!.id });

      res.status(201).json({
        ok: true,
        data: { user },
      });
    })().catch(next);
  },
);

userRouter.patch(
  "/:id",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      const payload = updateUserSchema.parse(req.body);
      const user = await updateUserProfile(userId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { user },
      });
    })().catch(next);
  },
);

userRouter.patch(
  "/:id/role",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      const payload = updateUserRoleSchema.parse(req.body);
      const user = await updateUserRole(userId, payload, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { user },
      });
    })().catch(next);
  },
);

userRouter.patch(
  "/:id/status",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      const payload = updateUserStatusSchema.parse(req.body);
      const user = await updateUserStatus(userId, payload, {
        id: req.user!.id,
      });

      res.status(200).json({
        ok: true,
        data: { user },
      });
    })().catch(next);
  },
);

userRouter.patch(
  "/:id/password",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      const payload = resetUserPasswordSchema.parse(req.body);
      await resetUserPassword(userId, payload, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "Password updated" },
      });
    })().catch(next);
  },
);

userRouter.delete(
  "/:id",
  authMiddleware,
  authorizeMiddleware(MANAGE_USERS_ROLES),
  (req, res, next) => {
    (async () => {
      const userId = requireRouteParam(req.params.id, "id");
      await softDeleteUser(userId, { id: req.user!.id });

      res.status(200).json({
        ok: true,
        data: { message: "User deleted" },
      });
    })().catch(next);
  },
);

export { userRouter };
