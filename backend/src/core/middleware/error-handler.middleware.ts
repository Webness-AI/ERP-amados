import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error";

type ErrorResponse = {
  ok: false;
  error: {
    code: string;
    message: string;
    requestId: string;
  };
};

export function errorHandlerMiddleware(
  error: unknown,
  req: Request,
  res: Response<ErrorResponse>,
  _next: NextFunction,
): void {
  if (error instanceof ZodError) {
    const message = error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");

    res.status(400).json({
      ok: false,
      error: {
        code: "VALIDATION_ERROR",
        message,
        requestId: req.requestId,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        requestId: req.requestId,
      },
    });
    return;
  }

  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
      requestId: req.requestId,
    },
  });
}
