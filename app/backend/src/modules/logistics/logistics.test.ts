import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";
import argon2 from "argon2";
import mongoose from "mongoose";
import { createApp } from "../../app.js";
import { Session } from "../auth/session.model.js";
import { User } from "../auth/user.model.js";
import { Organization, OrganizationMembership } from "../organizations/models.js";
import { Driver, Shipment, ShipmentEvent, Vehicle } from "./models.js";

const org = new mongoose.Types.ObjectId(); const otherOrg = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId();
const driverId = new mongoose.Types.ObjectId(); const vehicleId = new mongoose.Types.ObjectId(); const shipmentId = new mongoose.Types.ObjectId();
const password = "correct horse battery staple"; const sessionMap = new Map<string, any>();
let shipments = new Map<string, any>(); let drivers = new Map<string, any>(); let vehicles = new Map<string, any>();
const baseShipment = (organizationId = org, status = "created") => ({ _id: shipmentId, organizationId, reference: "FF-101", origin: { address: "A" }, destination: { address: "B" }, status, createdBy: userId, toObject() { return { ...this }; }, async save() { shipments.set(this._id.toString(), this); return this; } });
function responseDoc(value: any) { return { ...value, toObject() { const { toObject: _toObject, save: _save, ...rest } = this; return rest; } }; }
async function request(path: string, options: RequestInit = {}) { const server = createServer(createApp()); await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve)); const addr = server.address(); if (!addr || typeof addr === "string") throw new Error("Test server did not start"); try { return await fetch(`http://127.0.0.1:${addr.port}${path}`, options); } finally { await new Promise<void>((resolve, reject) => server.close((e) => e ? reject(e) : resolve())); } }

test.before(async () => {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  (User as any).findOne = () => ({ select: async () => ({ _id: userId, name: "Dispatcher", email: "dispatcher@test.local", passwordHash, isActive: true }) });
  (User as any).findById = async () => ({ _id: userId, name: "Dispatcher", email: "dispatcher@test.local", isActive: true });
  (User as any).updateOne = async () => ({ modifiedCount: 1 });
  (OrganizationMembership as any).find = () => ({ sort: () => ({ lean: async () => [{ userId, organizationId: org, role: "dispatcher", isActive: true }] }) });
  (Organization as any).find = () => ({ select: () => ({ lean: async () => [{ _id: org, name: "Test organization" }] }) });
  (Session as any).create = async (data: any) => { sessionMap.set(data.tokenHash, { _id: new mongoose.Types.ObjectId(), ...data, revokedAt: null }); };
  (Session as any).findOne = (query: any) => ({ select: async () => sessionMap.get(query.tokenHash) ?? null });
  (Shipment as any).create = async (data: any) => { const doc = responseDoc({ _id: shipmentId, ...data, status: "created" }); shipments.set(shipmentId.toString(), doc); return doc; };
  (Shipment as any).findOne = async (query: any) => { const value = shipments.get(String(query._id)); return value && String(value.organizationId) === String(query.organizationId) ? value : null; };
  (Shipment as any).exists = async () => null;
  (Shipment as any).findById = async () => null;
  (ShipmentEvent as any).create = async () => ({});
  (Driver as any).findOne = async (query: any) => { const value = drivers.get(String(query._id)); return value && String(value.organizationId) === String(query.organizationId) ? value : null; };
  (Vehicle as any).findOne = async (query: any) => { const value = vehicles.get(String(query._id)); return value && String(value.organizationId) === String(query.organizationId) ? value : null; };
  (Driver as any).updateOne = async () => ({}); (Vehicle as any).updateOne = async () => ({});
});

async function dispatcherRequest(path: string, method: string, body: unknown) {
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dispatcher@test.local", password }) });
  const cookies = login.headers.getSetCookie().map((v) => v.split(";", 1)[0]).join("; "); const loginBody = await login.json() as any; assert.equal(login.status, 200, JSON.stringify(loginBody)); const csrf = loginBody.data.csrfToken;
  return request(path, { method, headers: { "content-type": "application/json", cookie: cookies, "x-csrf-token": csrf }, body: JSON.stringify(body) });
}

test.beforeEach(() => { shipments = new Map(); drivers = new Map(); vehicles = new Map(); });

test("dispatcher can create a tenant-scoped shipment", async () => {
  const response = await dispatcherRequest("/api/shipments", "POST", { reference: "FF-101", origin: { address: "Dock A" }, destination: { address: "Dock B" } });
  assert.equal(response.status, 201); const body = await response.json() as any;
  assert.equal(body.data.shipment.reference, "FF-101"); assert.equal(body.data.shipment.organizationId, org.toString());
});

test("assignment rejects a driver or vehicle that is unavailable", async () => {
  shipments.set(shipmentId.toString(), baseShipment());
  drivers.set(driverId.toString(), { _id: driverId, organizationId: org, availability: "on_delivery", async save() {} });
  vehicles.set(vehicleId.toString(), { _id: vehicleId, organizationId: org, status: "available", async save() {} });
  const response = await dispatcherRequest(`/api/shipments/${shipmentId}/assign`, "POST", { driverId: driverId.toString(), vehicleId: vehicleId.toString() });
  assert.equal(response.status, 409); assert.equal((await response.json() as any).error.code, "RESOURCE_UNAVAILABLE");
});

test("dispatcher can assign available organization resources", async () => {
  shipments.set(shipmentId.toString(), baseShipment());
  drivers.set(driverId.toString(), { _id: driverId, organizationId: org, name: "Taylor Driver", availability: "available", async save() {} });
  vehicles.set(vehicleId.toString(), { _id: vehicleId, organizationId: org, registrationNumber: "FF-TRK-01", status: "available", async save() {} });
  const response = await dispatcherRequest(`/api/shipments/${shipmentId}/assign`, "POST", { driverId: driverId.toString(), vehicleId: vehicleId.toString() });
  assert.equal(response.status, 200); const body = await response.json() as any;
  assert.equal(body.data.shipment.status, "assigned"); assert.equal(body.data.shipment.assignedDriverId, driverId.toString());
  assert.equal(drivers.get(driverId.toString()).availability, "on_delivery"); assert.equal(vehicles.get(vehicleId.toString()).status, "in_use");
});

test("shipment status endpoint rejects a transition outside the explicit state graph", async () => {
  shipments.set(shipmentId.toString(), baseShipment(org, "created"));
  const response = await dispatcherRequest(`/api/shipments/${shipmentId}/status`, "POST", { status: "in_transit" });
  assert.equal(response.status, 409); assert.equal((await response.json() as any).error.code, "INVALID_STATUS_TRANSITION");
});

test("shipment lookup does not reveal records owned by another organization", async () => {
  shipments.set(shipmentId.toString(), baseShipment(otherOrg));
  const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: "dispatcher@test.local", password }) });
  const cookies = login.headers.getSetCookie().map((v) => v.split(";", 1)[0]).join("; ");
  const response = await request(`/api/shipments/${shipmentId}`, { headers: { cookie: cookies } });
  assert.equal(response.status, 404); assert.equal((await response.json() as any).error.code, "NOT_FOUND");
});
