import { Router, type RequestHandler } from "express";

import { authMiddleware } from "../../core/auth/auth.middleware";
import {
  changePassword,
  getProfile,
  login,
  logout,
  refreshSession,
} from "./auth.service";
import {
  changePasswordSchema,
  loginSchema,
  refreshSchema,
} from "./auth.schemas";

const authRouter = Router();

const REFRESH_COOKIE_NAME = "refreshToken";
const isProduction = process.env.NODE_ENV === "production";

function getRefreshCookieOptions() {
  return {
    httpOnly: true,
    sameSite: isProduction ? ("none" as const) : ("lax" as const),
    secure: isProduction,
    path: "/api/v1/auth",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

function setRefreshCookie(
  res: Parameters<RequestHandler>[1],
  token: string,
): void {
  res.cookie(REFRESH_COOKIE_NAME, token, getRefreshCookieOptions());
}

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
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());
    res.status(200).json({
      ok: true,
      data: {
        message: "Session closed",
      },
    });
  })().catch(next);
});

authRouter.patch("/change-password", authMiddleware, (req, res, next) => {
  (async () => {
    const payload = changePasswordSchema.parse(req.body);
    await changePassword(req.user!.id, payload);
    res.clearCookie(REFRESH_COOKIE_NAME, getRefreshCookieOptions());

    res.status(200).json({
      ok: true,
      data: {
        message: "Password updated",
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
