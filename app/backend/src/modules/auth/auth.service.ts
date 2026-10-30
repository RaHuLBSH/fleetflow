import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { Session } from "./session.model.js";
import { User, type UserRole } from "./user.model.js";

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");

export type SafeUser = {
  id: string;
  organizationId: string;
  name: string;
  email: string;
  role: UserRole;
};

export function toSafeUser(user: { _id: Types.ObjectId; organizationId: Types.ObjectId; name: string; email: string; role: UserRole }): SafeUser {
  return { id: user._id.toString(), organizationId: user.organizationId.toString(), name: user.name, email: user.email, role: user.role };
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyCredentials(email: string, password: string) {
  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !user.isActive || !(await argon2.verify(user.passwordHash, password))) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }
  return user;
}

export async function createSession(userId: Types.ObjectId) {
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  await Session.create({ userId, tokenHash: hashToken(token), csrfTokenHash: hashToken(csrfToken), expiresAt });
  return { token, csrfToken, expiresAt };
}

export async function revokeSession(token: string | undefined): Promise<void> {
  if (token) await Session.updateOne({ tokenHash: hashToken(token), revokedAt: null }, { revokedAt: new Date() });
}

export async function authenticateSession(token: string | undefined) {
  if (!token) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  const session = await Session.findOne({ tokenHash: hashToken(token), revokedAt: null, expiresAt: { $gt: new Date() } }).select("+csrfTokenHash");
  if (!session) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  const user = await User.findById(session.userId);
  if (!user || !user.isActive) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  return { user, session };
}

export function csrfMatches(rawToken: string | undefined, storedHash: string): boolean {
  return rawToken !== undefined && hashToken(rawToken) === storedHash;
}
