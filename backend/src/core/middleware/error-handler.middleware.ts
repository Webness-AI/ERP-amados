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

function isMongoDuplicateError(error: unknown): error is { code: number; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}

function isMongooseValidationError(error: unknown): error is { name: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "ValidationError"
  );
}

function isMongooseCastError(error: unknown): error is { name: string; message: string } {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error as { name: unknown }).name === "CastError"
  );
}

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

  if (isMongoDuplicateError(error)) {
    res.status(409).json({
      ok: false,
      error: {
        code: "DUPLICATE_KEY",
        message: "Ya existe un registro con esos datos.",
        requestId: req.requestId,
      },
    });
    return;
  }

  if (isMongooseValidationError(error) || isMongooseCastError(error)) {
    res.status(400).json({
      ok: false,
      error: {
        code: "MONGOOSE_VALIDATION_ERROR",
        message: error.message,
        requestId: req.requestId,
      },
    });
    return;
  }

  console.error("Unhandled API error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    error,
  });

  res.status(500).json({
    ok: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Unexpected error",
      requestId: req.requestId,
    },
  });
}
