import { Router } from "express";
import rateLimit from "express-rate-limit";
import { randomBytes } from "node:crypto";
import mongoose from "mongoose";
import { z } from "zod";
import { AppError } from "../../middleware/errorHandler.js";
import { authenticateSession, createSession, csrfMatches, hashPassword, hashToken, revokeSession, safeUserForMembership, switchSessionOrganization, verifyCredentials } from "./auth.service.js";
import { requireAuthentication, requireCsrf, requireRole } from "./auth.middleware.js";
import { env } from "../../config/env.js";
import { User } from "./user.model.js";
import { OrganizationInvitation, OrganizationMembership, invitedRoles } from "../organizations/models.js";

const loginSchema = z.object({ email: z.string().trim().email().max(254), password: z.string().min(8).max(256) });
const invitationSchema = z.object({ email: z.string().trim().email().max(254), role: z.enum(invitedRoles) });
const acceptInvitationSchema = z.object({ token: z.string().min(32).max(200), name: z.string().trim().min(1).max(120).optional(), password: z.string().min(12).max(256).optional() });
const switchSchema = z.object({ organizationId: z.string().regex(/^[a-f\d]{24}$/i) });

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
    const memberships = await OrganizationMembership.find({ userId: user._id, isActive: true }).sort({ createdAt: 1 }).lean();
    if (!memberships.length) throw new AppError(403, "ORGANIZATION_ACCESS_DENIED", "No active organization membership is available");
    const selected = memberships.find((membership) => user.lastOrganizationId?.equals(membership.organizationId)) ?? memberships[0]!;
    const session = await createSession(user._id, selected.organizationId);
    await User.updateOne({ _id: user._id }, { $set: { lastOrganizationId: selected.organizationId } });
    const safeUser = await safeUserForMembership(user, selected.organizationId);
    res.cookie("fleetflow_session", session.token, cookieOptions(session.expiresAt));
    res.cookie("fleetflow_csrf", session.csrfToken, csrfCookieOptions(session.expiresAt));
    res.status(200).json({ success: true, data: { user: safeUser, csrfToken: session.csrfToken } });
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
authRouter.get("/organizations", requireAuthentication, (req, res) => res.status(200).json({ success: true, data: { organizations: req.auth!.user.organizations, activeOrganizationId: req.auth!.user.organizationId } }));
authRouter.post("/switch-organization", requireAuthentication, requireCsrf, async (req, res, next) => {
  try {
    const { organizationId } = parse(switchSchema, req.body);
    const user = await switchSessionOrganization(req.auth!.sessionId, new mongoose.Types.ObjectId(req.auth!.user.id), new mongoose.Types.ObjectId(organizationId));
    res.status(200).json({ success: true, data: { user } });
  } catch (error) { next(error); }
});

// An organization admin can invite dispatchers and drivers, but cannot grant admin membership.
authRouter.post("/invitations", requireAuthentication, requireCsrf, requireRole("admin"), async (req, res, next) => {
  try {
    const input = parse(invitationSchema, req.body);
    const email = input.email.toLowerCase();
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await OrganizationInvitation.updateMany({ organizationId: req.auth!.user.organizationId, email, acceptedAt: { $exists: false }, revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } });
    const invitation = await OrganizationInvitation.create({ organizationId: req.auth!.user.organizationId, email, role: input.role, tokenHash: hashToken(token), invitedBy: req.auth!.user.id, expiresAt });
    const inviteUrl = new URL("/accept-invitation", process.env.FRONTEND_ORIGIN ?? "http://localhost:5173");
    inviteUrl.searchParams.set("token", token);
    res.status(201).json({ success: true, data: { invitation: { id: invitation._id.toString(), email, role: input.role, expiresAt }, invitationUrl: inviteUrl.toString() } });
  } catch (error) {
    next(error);
  }
});

authRouter.post("/invitations/accept", async (req, res, next) => {
  try {
    const input = parse(acceptInvitationSchema, req.body);
    const invitation = await OrganizationInvitation.findOne({ tokenHash: hashToken(input.token), acceptedAt: { $exists: false }, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } }).select("+tokenHash");
    if (!invitation) throw new AppError(404, "INVITATION_NOT_FOUND", "Invitation is invalid or expired");
    const existingUser = await User.findOne({ email: invitation.email });
    const rawSession = req.cookies?.fleetflow_session as string | undefined;
    let user = existingUser;
    let createdSession: Awaited<ReturnType<typeof createSession>> | undefined;
    if (existingUser) {
      if (!rawSession) throw new AppError(401, "SIGN_IN_REQUIRED", "Sign in with the invited email to accept this invitation");
      const { user: authenticated, session } = await authenticateSession(rawSession);
      if (!authenticated._id.equals(existingUser._id)) throw new AppError(403, "INVITATION_EMAIL_MISMATCH", "Sign in with the invited email to accept this invitation");
      const origin = req.get("origin");
      if ((origin && !env.allowedOrigins.includes(origin)) || !csrfMatches(req.get("x-csrf-token"), session.csrfTokenHash)) {
        throw new AppError(403, "CSRF_REJECTED", "CSRF validation failed");
      }
      user = authenticated;
      await OrganizationMembership.updateOne({ organizationId: invitation.organizationId, userId: user._id }, { $setOnInsert: { organizationId: invitation.organizationId, userId: user._id, role: invitation.role, isActive: true } }, { upsert: true, runValidators: true });
      await OrganizationInvitation.updateOne({ _id: invitation._id, acceptedAt: { $exists: false } }, { $set: { acceptedAt: new Date() } });
      await switchSessionOrganization(session._id, user._id, invitation.organizationId);
    } else {
      if (!input.name || !input.password) throw new AppError(400, "VALIDATION_ERROR", "Name and a 12-character password are required to accept this invitation");
      user = await User.create({ name: input.name, email: invitation.email, passwordHash: await hashPassword(input.password), isActive: true, lastOrganizationId: invitation.organizationId });
      await OrganizationMembership.create({ organizationId: invitation.organizationId, userId: user._id, role: invitation.role, isActive: true });
      await OrganizationInvitation.updateOne({ _id: invitation._id, acceptedAt: { $exists: false } }, { $set: { acceptedAt: new Date() } });
      createdSession = await createSession(user._id, invitation.organizationId);
      res.cookie("fleetflow_session", createdSession.token, cookieOptions(createdSession.expiresAt));
      res.cookie("fleetflow_csrf", createdSession.csrfToken, csrfCookieOptions(createdSession.expiresAt));
    }
    const safeUser = await safeUserForMembership(user, invitation.organizationId);
    res.status(200).json({ success: true, data: { user: safeUser, csrfToken: createdSession?.csrfToken } });
  } catch (error) { next(error); }
});
