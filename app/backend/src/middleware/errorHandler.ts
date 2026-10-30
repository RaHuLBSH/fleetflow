import type { ErrorRequestHandler, RequestHandler } from "express";

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: "NOT_FOUND",
      message: "The requested resource was not found",
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const isProduction = process.env.NODE_ENV === "production";
  if (err instanceof AppError) {
    res.status(err.status).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details === undefined ? {} : { details: err.details }),
      },
    });
    return;
  }
  if (err?.name === "ValidationError" || err?.name === "CastError") {
    res.status(400).json({ success: false, error: { code: "VALIDATION_ERROR", message: "The request could not be validated" } });
    return;
  }
  if (err?.code === 11000) {
    res.status(409).json({ success: false, error: { code: "RESOURCE_ALREADY_EXISTS", message: "A resource with these details already exists" } });
    return;
  }
  const message =
    err instanceof Error ? err.message : "An unexpected error occurred";

  res.status(500).json({
    success: false,
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: isProduction ? "An unexpected error occurred" : message,
    },
  });
};
