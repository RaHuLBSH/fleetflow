import assert from "node:assert/strict";
import test from "node:test";
import mongoose, { type Model } from "mongoose";
import { assertSafeTarget, buildDemoData, sanitizeErrorMessage, upsertSeedRecords, withDatabaseConnection } from "./demoSeed.js";

function memoryModel() {
  const rows = new Map<string, Record<string, any>>();
  const model = {
    findOne(filter: Record<string, any>) {
      const row = rows.get(String(filter._id));
      return { select: () => ({ lean: async () => row && Object.entries(filter).every(([key, value]) => {
        const actual = key === "payload.demoSeed" ? row.payload?.demoSeed : row[key];
        const actualId = actual instanceof mongoose.Types.ObjectId ? actual.toHexString() : actual;
        const expectedId = value instanceof mongoose.Types.ObjectId ? value.toHexString() : value;
        return actualId === expectedId;
      }) ? row : null }) };
    },
    async exists(filter: Record<string, any>) {
      return [...rows.values()].some((row) => Object.entries(filter).every(([key, value]) => row[key]?.toString?.() === value?.toString?.()));
    },
    async create(record: Record<string, any>) { rows.set(String(record._id), record); },
    async updateOne(filter: Record<string, any>, update: { $set: Record<string, any> }) {
      const row = rows.get(String(filter._id));
      if (row) Object.assign(row, update.$set);
      return { modifiedCount: row ? 1 : 0 };
    },
  };
  return { model: model as unknown as Model<any>, rows };
}

test("demo fixture has stable tenant relationships and legal status histories", () => {
  const org = new mongoose.Types.ObjectId("64b000000000000000000001");
  const admin = new mongoose.Types.ObjectId("64b000000000000000000002");
  const a = buildDemoData(org, admin, new Date("2026-10-01T00:00:00Z"));
  const b = buildDemoData(org, admin, new Date("2026-10-01T00:00:00Z"));
  assert.deepEqual(a, b);
  assert.ok([...a.drivers, ...a.vehicles, ...a.shipments, ...a.events].every((row) => row.organizationId.equals(org)));
  assert.deepEqual(a.shipments.map((shipment) => shipment.status), ["created", "assigned", "dispatched", "in_transit", "delayed", "delivered", "cancelled"]);
  assert.ok(a.shipments.slice(1, 6).every((shipment) => shipment.assignedDriverId && shipment.assignedVehicleId));
  assert.ok(a.events.every((event) => event.payload && (event.payload as { demoSeed: string }).demoSeed === "fleetflow-demo-v1"));
  const otherTenant = buildDemoData(new mongoose.Types.ObjectId("64b000000000000000000003"), admin);
  assert.notEqual(a.shipments[0]!._id.toString(), otherTenant.shipments[0]!._id.toString());
});

test("repeat execution updates only seed-owned records without duplication", async () => {
  const org = new mongoose.Types.ObjectId("64b000000000000000000011");
  const records = buildDemoData(org, new mongoose.Types.ObjectId("64b000000000000000000012")).drivers;
  const { model, rows } = memoryModel();
  const config = { model, records, signature: (r: any) => ({ name: r.name }), naturalKey: (r: any) => ({ name: r.name }), updateFields: ["name", "availability"] };
  assert.deepEqual(await upsertSeedRecords(config), { inserted: 6, updated: 0, skipped: 0 });
  assert.deepEqual(await upsertSeedRecords(config), { inserted: 0, updated: 6, skipped: 0 });
  assert.equal(rows.size, 6);
});

test("unrelated tenant record matching a natural key is skipped", async () => {
  const org = new mongoose.Types.ObjectId("64b000000000000000000021");
  const record = buildDemoData(org, new mongoose.Types.ObjectId("64b000000000000000000022")).vehicles[0]!;
  const { model, rows } = memoryModel();
  rows.set("different-id", { ...record, _id: new mongoose.Types.ObjectId(), status: "maintenance" });
  const result = await upsertSeedRecords({ model, records: [record], signature: (r) => ({ registrationNumber: r.registrationNumber }), naturalKey: (r) => ({ registrationNumber: r.registrationNumber }), updateFields: ["status"] });
  assert.deepEqual(result, { inserted: 0, updated: 0, skipped: 1 });
  assert.equal(rows.size, 1);
  assert.equal([...rows.values()][0]!.status, "maintenance");
});

test("identical demo natural keys remain isolated across organizations", async () => {
  const firstOrg = new mongoose.Types.ObjectId("64b000000000000000000025");
  const secondOrg = new mongoose.Types.ObjectId("64b000000000000000000026");
  const first = buildDemoData(firstOrg, new mongoose.Types.ObjectId()).vehicles[0]!;
  const second = buildDemoData(secondOrg, new mongoose.Types.ObjectId()).vehicles[0]!;
  const { model, rows } = memoryModel();
  const seed = (record: typeof first) => upsertSeedRecords({ model, records: [record], signature: (r: any) => ({ registrationNumber: r.registrationNumber }), naturalKey: (r: any) => ({ registrationNumber: r.registrationNumber }), updateFields: ["status"] });
  assert.deepEqual(await seed(first), { inserted: 1, updated: 0, skipped: 0 });
  assert.deepEqual(await seed(second), { inserted: 1, updated: 0, skipped: 0 });
  assert.equal(rows.size, 2);
});

test("model validation or persistence errors propagate to the command", async () => {
  const org = new mongoose.Types.ObjectId("64b000000000000000000031");
  const record = buildDemoData(org, new mongoose.Types.ObjectId("64b000000000000000000032")).drivers[0]!;
  const { model } = memoryModel();
  model.create = async () => { throw new Error("validation failed"); };
  await assert.rejects(upsertSeedRecords({ model, records: [record], signature: (r) => ({ name: r.name }), updateFields: ["name"] }), /validation failed/);
});

test("seed target requires Atlas, a non-production database, and explicit database confirmation", () => {
  assert.doesNotThrow(() => assertSafeTarget("cluster.mongodb.net", "fleetflow_demo", "cluster.mongodb.net", "fleetflow_demo"));
  assert.throws(() => assertSafeTarget("localhost", "fleetflow_demo", "localhost", "fleetflow_demo"), /Atlas host/);
  assert.throws(() => assertSafeTarget("cluster.mongodb.net", "fleetflow_prod", "cluster.mongodb.net", "fleetflow_prod"), /production/);
  assert.throws(() => assertSafeTarget("cluster.mongodb.net", "test", "cluster.mongodb.net", undefined), /EXPECTED_DATABASE/);
  assert.throws(() => assertSafeTarget("cluster.mongodb.net", "fleetflow_demo", "cluster.mongodb.net", "another_database"), /EXPECTED_DATABASE/);
  assert.throws(() => assertSafeTarget("cluster.mongodb.net", "fleetflow_demo", "other.mongodb.net", "fleetflow_demo"), /EXPECTED_HOST/);
});

test("database connection is closed after connect or task failures", async () => {
  let disconnected = 0;
  await assert.rejects(withDatabaseConnection(async () => "unused", async () => { throw new Error("connect failed"); }, async () => { disconnected++; }), /connect failed/);
  assert.equal(disconnected, 1);
  await assert.rejects(withDatabaseConnection(async () => { throw new Error("seed failed"); }, async () => {}, async () => { disconnected++; }), /seed failed/);
  assert.equal(disconnected, 2);
});

test("connection error messages redact MongoDB credentials", () => {
  const message = sanitizeErrorMessage("failed mongodb+srv://user:password@cluster.mongodb.net/test?retryWrites=true");
  assert.equal(message.includes("password"), false);
  assert.equal(message.includes("user"), false);
  assert.match(message, /redacted MongoDB URI/);
});
