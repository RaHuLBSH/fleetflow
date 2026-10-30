import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import { createSession, hashPassword, revokeSession, toSafeUser, verifyCredentials } from "./auth.service.js";
import { requireAuthentication, requireCsrf, requireRole } from "./auth.middleware.js";
import { User, userRoles } from "./user.model.js";

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(256) });
const provisionSchema = z.object({ name: z.string().trim().min(1).max(120), email: z.string().trim().email().max(254), password: z.string().min(12).max(256), role: z.enum(userRoles) });

function parse<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError(400, "VALIDATION_ERROR", "The request could not be validated", result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })));
  return result.data;
}

const cookieOptions = (expires: Date) => ({ httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, expires, path: "/api" });
const csrfCookieOptions = (expires: Date) => ({ httpOnly: false, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, expires, path: "/api" });

export const authRouter = Router();
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: "RATE_LIMITED", message: "Too many login attempts; try again later" } } });

authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = parse(loginSchema, req.body);
    const user = await verifyCredentials(email, password);
    const session = await createSession(user._id);
    res.cookie("fleetflow_session", session.token, cookieOptions(session.expiresAt));
    res.cookie("fleetflow_csrf", session.csrfToken, csrfCookieOptions(session.expiresAt));
    res.status(200).json({ success: true, data: { user: toSafeUser(user), csrfToken: session.csrfToken } });
  } catch (error) { next(error); }
});

authRouter.post("/logout", requireAuthentication, requireCsrf, async (req, res, next) => {
  try {
    await revokeSession(req.cookies?.fleetflow_session);
    res.clearCookie("fleetflow_session", { path: "/api" });
    res.clearCookie("fleetflow_csrf", { path: "/api" });
    res.status(200).json({ success: true, data: { loggedOut: true } });
  } catch (error) { next(error); }
});

authRouter.get("/me", requireAuthentication, (req, res) => res.status(200).json({ success: true, data: { user: req.auth!.user } }));

// There is deliberately no public registration route. Only organization admins can provision accounts.
authRouter.post("/users", requireAuthentication, requireCsrf, requireRole("admin"), async (req, res, next) => {
  try {
    const input = parse(provisionSchema, req.body);
    const user = await User.create({ organizationId: req.auth!.user.organizationId, name: input.name, email: input.email.toLowerCase(), passwordHash: await hashPassword(input.password), role: input.role, isActive: true });
    res.status(201).json({ success: true, data: { user: toSafeUser(user) } });
  } catch (error) {
    if ((error as { code?: number }).code === 11000) return next(new AppError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists in this organization"));
    next(error);
  }
});
