import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import argon2 from "argon2";
import mongoose from "mongoose";
import { createApp } from "../../app.js";
import { Session } from "./session.model.js";
import { User } from "./user.model.js";
import { OrganizationInvitation, OrganizationMembership } from "../organizations/models.js";
import { Organization } from "../organizations/models.js";

const password = "a secure test password";
const adminId = new mongoose.Types.ObjectId();
const dispatcherId = new mongoose.Types.ObjectId();
const organizationId = new mongoose.Types.ObjectId();
const users = new Map<string, any>();
const sessions = new Map<string, any>();
const invitations = new Map<string, any>();
const org2 = new mongoose.Types.ObjectId();
const memberships = new Map<string, any[]>([[adminId.toString(), [{ userId: adminId, organizationId, role: "admin", isActive: true }, { userId: adminId, organizationId: org2, role: "driver", isActive: true }]], [dispatcherId.toString(), [{ userId: dispatcherId, organizationId, role: "dispatcher", isActive: true }]]]);
const organizations = new Map([[organizationId.toString(), { _id: organizationId, name: "Primary workspace" }], [org2.toString(), { _id: org2, name: "Second workspace" }]]);

async function request(path: string, options: RequestInit = {}) {
  const server = createServer(createApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not start");
  try { return await fetch(`http://127.0.0.1:${address.port}${path}`, options); }
  finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
}

test.before(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  for (const [id, name, email] of [[adminId, "Admin", "admin@example.test"], [dispatcherId, "Dispatcher", "dispatcher@example.test"]] as const) users.set(id.toString(), { _id: id, name, email, passwordHash, isActive: true, lastOrganizationId: organizationId });
  (User as any).findOne = ({ email }: { email: string }) => {
    const found = [...users.values()].find((user) => user.email === email) ?? null;
    return { select: async () => found, then: (resolve: (value: any) => unknown, reject: (error: unknown) => unknown) => Promise.resolve(found).then(resolve, reject) };
  };
  (User as any).findById = async (id: mongoose.Types.ObjectId) => users.get(id.toString()) ?? null;
  (User as any).create = async (data: any) => { const user = { _id: new mongoose.Types.ObjectId(), ...data }; users.set(user._id.toString(), user); return user; };
  (User as any).updateOne = async () => ({ modifiedCount: 1 });
  (OrganizationMembership as any).find = ({ userId }: any) => ({ sort: () => ({ lean: async () => memberships.get(userId.toString()) ?? [] }) });
  (OrganizationMembership as any).findOne = async ({ organizationId: orgId, userId }: any) => memberships.get(userId.toString())?.find((item) => item.organizationId.toString() === orgId.toString()) ?? null;
  (OrganizationMembership as any).updateOne = async ({ organizationId: orgId, userId }: any, update: any) => { const list = memberships.get(userId.toString()) ?? []; if (!list.some((item) => item.organizationId.toString() === orgId.toString())) list.push(update.$setOnInsert); memberships.set(userId.toString(), list); return { upsertedCount: 1 }; };
  (OrganizationMembership as any).create = async (data: any) => { const list = memberships.get(data.userId.toString()) ?? []; list.push(data); memberships.set(data.userId.toString(), list); return data; };
  (Organization as any).find = ({ _id }: any) => ({ select: () => ({ lean: async () => (_id.$in as mongoose.Types.ObjectId[]).map((id) => organizations.get(id.toString())).filter(Boolean) }) });
  (OrganizationInvitation as any).updateMany = async () => ({ modifiedCount: 0 });
  (OrganizationInvitation as any).create = async (data: any) => { const invite = { _id: new mongoose.Types.ObjectId(), ...data }; invitations.set(data.tokenHash, invite); return invite; };
  (OrganizationInvitation as any).findOne = (query: any) => ({ select: async () => { const invite = invitations.get(query.tokenHash); return invite && !invite.acceptedAt && !invite.revokedAt && invite.expiresAt > new Date() ? invite : null; } });
  (OrganizationInvitation as any).updateOne = async (query: any, update: any) => { const invite = [...invitations.values()].find((item) => item._id.toString() === query._id.toString()); if (invite) Object.assign(invite, update.$set); return { modifiedCount: invite ? 1 : 0 }; };
  (Session as any).create = async (data: any) => { sessions.set(data.tokenHash, { _id: new mongoose.Types.ObjectId(), ...data, revokedAt: null }); };
  (Session as any).findOne = (query: any) => ({ select: async () => { const session = sessions.get(query.tokenHash); return session && !session.revokedAt && session.expiresAt > new Date() ? session : null; } });
  (Session as any).updateOne = async (query: any, update: any) => { const session = query.tokenHash ? sessions.get(query.tokenHash) : [...sessions.values()].find((value) => value._id.toString() === query._id?.toString()); if (session) Object.assign(session, update.$set ?? update, update.revokedAt ? { revokedAt: update.revokedAt } : {}); };
});

test("logs in with valid credentials and returns a safe profile", async () => {
  const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.data.user.email, "admin@example.test");
  assert.equal(body.data.user.role, "admin");
  assert.equal(body.data.user.organizations.length, 2);
  assert.equal("passwordHash" in body.data.user, false);
});

test("rejects invalid credentials without revealing which field failed", async () => {
  const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password: "wrong password" }) });
  assert.equal(response.status, 401);
  assert.equal((await response.json() as any).error.code, "INVALID_CREDENTIALS");
});

test("rejects unauthenticated current-user requests", async () => {
  const response = await request("/api/auth/me");
  assert.equal(response.status, 401);
  assert.equal((await response.json() as any).error.code, "UNAUTHENTICATED");
});

test("forbids a dispatcher from inviting organization members", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dispatcher@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = (await login.json() as any).data.csrfToken;
  const response = await request("/api/auth/invitations", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ email: "new@example.test", role: "dispatcher" }) });
  assert.equal(response.status, 403);
  assert.equal((await response.json() as any).error.code, "FORBIDDEN");
});

test("organization switching changes the session role only to an active membership", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const body = await login.json() as any; const csrf = body.data.csrfToken;
  const switched = await request("/api/auth/switch-organization", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ organizationId: org2.toString() }) });
  assert.equal(switched.status, 200); assert.equal((await switched.json() as any).data.user.role, "driver");
  const denied = await request("/api/auth/switch-organization", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ organizationId: new mongoose.Types.ObjectId().toString() }) });
  assert.equal(denied.status, 403);
});

test("an admin creates a dispatcher invitation and the invitee sets their own password", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; "); const csrf = (await login.json() as any).data.csrfToken;
  const inviteResponse = await request("/api/auth/invitations", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ email: "invited@example.test", role: "dispatcher" }) });
  assert.equal(inviteResponse.status, 201); const invite = (await inviteResponse.json() as any).data;
  assert.equal(invite.invitation.role, "dispatcher"); assert.ok(invite.invitationUrl.includes("token="));
  const token = new URL(invite.invitationUrl).searchParams.get("token");
  const accepted = await request("/api/auth/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: "New Dispatcher", password: "invitee password with 12 chars" }) });
  const acceptedJson = await accepted.json() as any; assert.equal(accepted.status, 200, JSON.stringify(acceptedJson)); const acceptedBody = acceptedJson.data;
  assert.equal(acceptedBody.user.role, "dispatcher"); assert.equal(acceptedBody.user.organizationId, organizationId.toString()); assert.ok(accepted.headers.getSetCookie().some((value) => value.startsWith("fleetflow_session=")));
  const reused = await request("/api/auth/invitations/accept", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, name: "Replay", password: "invitee password with 12 chars" }) });
  assert.equal(reused.status, 404);
});

test("an organization admin cannot invite an admin role", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; "); const csrf = (await login.json() as any).data.csrfToken;
  const response = await request("/api/auth/invitations", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ email: "newadmin@example.test", role: "admin" }) });
  assert.equal(response.status, 400);
});

test("an existing invited account must accept with its authenticated CSRF token", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = (await login.json() as any).data.csrfToken;
  const inviteResponse = await request("/api/auth/invitations", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ email: "admin@example.test", role: "dispatcher" }) });
  assert.equal(inviteResponse.status, 201);
  const inviteUrl = new URL((await inviteResponse.json() as any).data.invitationUrl);
  const token = inviteUrl.searchParams.get("token");
  const rejected = await request("/api/auth/invitations/accept", { method: "POST", headers: { "content-type": "application/json", cookie: cookies }, body: JSON.stringify({ token }) });
  assert.equal(rejected.status, 403);
  const accepted = await request("/api/auth/invitations/accept", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ token }) });
  assert.equal(accepted.status, 200);
});
