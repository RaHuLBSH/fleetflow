import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import argon2 from "argon2";
import mongoose from "mongoose";
import { createApp } from "../../app.js";
import { Session } from "./session.model.js";
import { User } from "./user.model.js";

const password = "a secure test password";
const adminId = new mongoose.Types.ObjectId();
const dispatcherId = new mongoose.Types.ObjectId();
const organizationId = new mongoose.Types.ObjectId();
const users = new Map<string, any>();
const sessions = new Map<string, any>();

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
  for (const [id, name, email, role] of [[adminId, "Admin", "admin@example.test", "admin"], [dispatcherId, "Dispatcher", "dispatcher@example.test", "dispatcher"]] as const) users.set(id.toString(), { _id: id, organizationId, name, email, role, passwordHash, isActive: true });
  (User as any).findOne = ({ email }: { email: string }) => ({ select: async () => [...users.values()].find((user) => user.email === email) ?? null });
  (User as any).findById = async (id: mongoose.Types.ObjectId) => users.get(id.toString()) ?? null;
  (User as any).create = async (data: any) => ({ _id: new mongoose.Types.ObjectId(), ...data });
  (Session as any).create = async (data: any) => { sessions.set(data.tokenHash, { _id: new mongoose.Types.ObjectId(), ...data, revokedAt: null }); };
  (Session as any).findOne = (query: any) => ({ select: async () => { const session = sessions.get(query.tokenHash); return session && !session.revokedAt && session.expiresAt > new Date() ? session : null; } });
  (Session as any).updateOne = async (query: any, update: any) => { const session = sessions.get(query.tokenHash); if (session) session.revokedAt = update.revokedAt; };
});

test("logs in with valid credentials and returns a safe profile", async () => {
  const response = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "admin@example.test", password }) });
  assert.equal(response.status, 200);
  const body = await response.json() as any;
  assert.equal(body.data.user.email, "admin@example.test");
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

test("forbids a dispatcher from provisioning users", async () => {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dispatcher@example.test", password }) });
  const cookies = login.headers.getSetCookie().map((value) => value.split(";", 1)[0]).join("; ");
  const csrf = (await login.json() as any).data.csrfToken;
  const response = await request("/api/auth/users", { method: "POST", headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify({ name: "New User", email: "new@example.test", password: "a secure password", role: "driver" }) });
  assert.equal(response.status, 403);
  assert.equal((await response.json() as any).error.code, "FORBIDDEN");
});
