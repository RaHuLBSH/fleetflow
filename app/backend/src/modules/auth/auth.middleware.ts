import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { authenticateSession, csrfMatches, toSafeUser, type SafeUser } from "./auth.service.js";
import type { UserRole } from "./user.model.js";

declare global { namespace Express { interface Request { auth?: { user: SafeUser; csrfTokenHash: string }; } } }

export async function requireAuthentication(req: Request, _res: Response, next: NextFunction) {
  try {
    const { user, session } = await authenticateSession(req.cookies?.fleetflow_session);
    req.auth = { user: toSafeUser(user), csrfTokenHash: session.csrfTokenHash };
    next();
  } catch (error) { next(error); }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.auth) return next(new AppError(401, "UNAUTHENTICATED", "Authentication is required"));
    if (!roles.includes(req.auth.user.role)) return next(new AppError(403, "FORBIDDEN", "You do not have permission to perform this action"));
    next();
  };
}

export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !env.allowedOrigins.includes(origin)) return next(new AppError(403, "CSRF_REJECTED", "Request origin is not allowed"));
  if (!req.auth || !csrfMatches(req.get("x-csrf-token"), req.auth.csrfTokenHash)) return next(new AppError(403, "CSRF_REJECTED", "CSRF validation failed"));
  next();
}
