import argon2 from "argon2";
import { createHash, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { env } from "../../config/env.js";
import { AppError } from "../../middleware/errorHandler.js";
import { Session } from "./session.model.js";
import { User, type UserRole } from "./user.model.js";
import { Organization, OrganizationMembership } from "../organizations/models.js";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
const randomToken = () => randomBytes(32).toString("base64url");

export type SafeUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  organizationName: string;
  organizations: Array<{ id: string; name: string; role: UserRole }>;
};

type MembershipView = { organizationId: Types.ObjectId; role: UserRole; isActive: boolean };
type OrganizationView = { _id: Types.ObjectId; name: string };

export function toSafeUser(user: { _id: Types.ObjectId; name: string; email: string }, membership: MembershipView, organization: OrganizationView, memberships: Array<{ membership: MembershipView; organization: OrganizationView }>): SafeUser {
  return {
    id: user._id.toString(), name: user.name, email: user.email, role: membership.role,
    organizationId: membership.organizationId.toString(), organizationName: organization.name,
    organizations: memberships.map(({ membership: member, organization: org }) => ({ id: org._id.toString(), name: org.name, role: member.role })),
  };
}

async function membershipsFor(userId: Types.ObjectId) {
  const memberships = await OrganizationMembership.find({ userId, isActive: true }).sort({ createdAt: 1 }).lean();
  const organizations = await Organization.find({ _id: { $in: memberships.map((item) => item.organizationId) } }).select("_id name").lean();
  const orgById = new Map(organizations.map((organization) => [organization._id.toString(), organization]));
  return memberships.flatMap((membership) => {
    const organization = orgById.get(membership.organizationId.toString());
    return organization ? [{ membership, organization }] : [];
  });
}

export async function safeUserForMembership(user: { _id: Types.ObjectId; name: string; email: string }, organizationId: Types.ObjectId) {
  const memberships = await membershipsFor(user._id);
  const current = memberships.find(({ membership }) => membership.organizationId.equals(organizationId));
  if (!current) throw new AppError(403, "ORGANIZATION_ACCESS_DENIED", "You do not belong to this organization");
  return toSafeUser(user, current.membership, current.organization, memberships);
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

export async function createSession(userId: Types.ObjectId, activeOrganizationId: Types.ObjectId) {
  const token = randomToken();
  const csrfToken = randomToken();
  const expiresAt = new Date(Date.now() + env.sessionTtlDays * 24 * 60 * 60 * 1000);
  await Session.create({ userId, activeOrganizationId, tokenHash: hashToken(token), csrfTokenHash: hashToken(csrfToken), expiresAt });
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
  const memberships = await membershipsFor(user._id);
  if (!memberships.length) throw new AppError(403, "ORGANIZATION_ACCESS_DENIED", "No active organization membership is available");
  const preferredId = user.lastOrganizationId;
  const active = memberships.find(({ membership }) => session.activeOrganizationId && membership.organizationId.equals(session.activeOrganizationId))
    ?? memberships.find(({ membership }) => preferredId && membership.organizationId.equals(preferredId))
    ?? memberships[0];
  if (!active) throw new AppError(403, "ORGANIZATION_ACCESS_DENIED", "No active organization membership is available");
  if (!session.activeOrganizationId?.equals(active.membership.organizationId)) {
    await Session.updateOne({ _id: session._id }, { $set: { activeOrganizationId: active.membership.organizationId } });
    session.activeOrganizationId = active.membership.organizationId;
  }
  return { user, session, membership: active.membership, organization: active.organization, memberships };
}

export async function switchSessionOrganization(sessionId: Types.ObjectId, userId: Types.ObjectId, organizationId: Types.ObjectId) {
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new AppError(401, "UNAUTHENTICATED", "Authentication is required");
  const safeUser = await safeUserForMembership(user, organizationId);
  await Session.updateOne({ _id: sessionId, userId }, { $set: { activeOrganizationId: organizationId } });
  await User.updateOne({ _id: userId }, { $set: { lastOrganizationId: organizationId } });
  return safeUser;
}

export function csrfMatches(rawToken: string | undefined, storedHash: string): boolean {
  return rawToken !== undefined && hashToken(rawToken) === storedHash;
}
