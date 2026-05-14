import { Router, type RequestHandler } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import {
  bootstrapAdmin,
  getProfile,
  login,
  logout,
  refreshSession,
} from "./auth.service";
import {
  bootstrapAdminSchema,
  loginSchema,
  refreshSchema,
} from "./auth.schemas";

const authRouter = Router();

const REFRESH_COOKIE_NAME = "refreshToken";

function setRefreshCookie(
  res: Parameters<RequestHandler>[1],
  token: string,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

authRouter.post("/bootstrap-admin", (req, res, next) => {
  (async () => {
    const payload = bootstrapAdminSchema.parse(req.body);
    const result = await bootstrapAdmin(payload);
    setRefreshCookie(res, result.refreshToken);

    res.status(201).json({
      ok: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  })().catch(next);
});

authRouter.post("/login", (req, res, next) => {
  (async () => {
    const payload = loginSchema.parse(req.body);
    const result = await login(payload);
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      ok: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  })().catch(next);
});

authRouter.post("/refresh", (req, res, next) => {
  (async () => {
    const refreshTokenFromCookie = req.cookies?.[REFRESH_COOKIE_NAME];
    const refreshTokenFromBody = req.body?.refreshToken;

    const payload = refreshSchema.parse({
      refreshToken: refreshTokenFromBody ?? refreshTokenFromCookie,
    });

    const result = await refreshSession(payload);
    setRefreshCookie(res, result.refreshToken);

    res.status(200).json({
      ok: true,
      data: {
        user: result.user,
        accessToken: result.accessToken,
      },
    });
  })().catch(next);
});

authRouter.post("/logout", authMiddleware, (req, res, next) => {
  (async () => {
    await logout(req.user!.id);
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/api/v1/auth" });
    res.status(200).json({
      ok: true,
      data: {
        message: "Session closed",
      },
    });
  })().catch(next);
});

authRouter.get("/me", authMiddleware, (req, res, next) => {
  (async () => {
    const user = await getProfile(req.user!.id);
    res.status(200).json({
      ok: true,
      data: {
        user,
      },
    });
  })().catch(next);
});

export { authRouter };
