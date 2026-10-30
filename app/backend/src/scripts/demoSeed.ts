import "dotenv/config";
import { createHash } from "node:crypto";
import mongoose, { type Model } from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { User } from "../modules/auth/user.model.js";
import { Driver, Shipment, ShipmentEvent, Vehicle } from "../modules/logistics/models.js";

type SeedRecord = { _id: mongoose.Types.ObjectId; organizationId: mongoose.Types.ObjectId; [key: string]: unknown };
export type SeedCounts = { inserted: number; updated: number; skipped: number };
export type SeedReport = Record<string, SeedCounts>;

export function sanitizeErrorMessage(message: string): string {
  return message
    .replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted MongoDB URI]")
    .replace(/([a-z][a-z\d+.-]*:\/\/)[^/@\s]+:[^/@\s]+@/gi, "$1[redacted]@");
}

export async function withDatabaseConnection<T>(task: () => Promise<T>, connect = connectDatabase, disconnect = disconnectDatabase): Promise<T> {
  try {
    await connect();
    return await task();
  } finally {
    await disconnect();
  }
}

function stableId(orgId: mongoose.Types.ObjectId, collection: string, key: string): mongoose.Types.ObjectId {
  const hex = createHash("sha256").update(`${orgId.toHexString()}:fleetflow-demo:${collection}:${key}`).digest("hex").slice(0, 24);
  return new mongoose.Types.ObjectId(hex);
}

export function buildDemoData(orgId: mongoose.Types.ObjectId, adminId: mongoose.Types.ObjectId, now = new Date()) {
  const drivers = Array.from({ length: 6 }, (_, index) => ({
    _id: stableId(orgId, "Driver", String(index + 1)), organizationId: orgId,
    name: `Demo Driver ${String(index + 1).padStart(2, "0")}`,
    availability: index < 4 ? "on_delivery" : "available",
  }));
  const vehicles = Array.from({ length: 6 }, (_, index) => ({
    _id: stableId(orgId, "Vehicle", String(index + 1)), organizationId: orgId,
    registrationNumber: `DEMO-FL-${String(index + 1).padStart(3, "0")}`,
    capacityKg: [1200, 2500, 5000, 8000, 12000, 18000][index],
    status: index < 4 ? "in_use" : "available",
  }));
  const states = ["created", "assigned", "dispatched", "in_transit", "delayed", "delivered", "cancelled"] as const;
  const references = ["DEMO-SHIP-001", "DEMO-SHIP-002", "DEMO-SHIP-003", "DEMO-SHIP-004", "DEMO-SHIP-005", "DEMO-SHIP-006", "DEMO-SHIP-007"];
  const shipments = references.map((reference, index) => {
    const status = states[index]!;
    const assigned = index > 0 && index < 6;
    const createdAt = new Date(now.getTime() - (8 - index) * 60 * 60 * 1000);
    return {
      _id: stableId(orgId, "Shipment", reference), organizationId: orgId, reference,
      customerName: `Demo Customer ${String(index + 1).padStart(2, "0")}`,
      origin: { address: ["North Harbor, Seattle", "Portland Distribution Center", "Spokane Freight Yard", "Tacoma Warehouse", "Everett Depot", "Olympia Logistics Hub", "Bellevue Fulfillment Center"][index]! },
      destination: { address: ["Bellevue Fulfillment Center", "Salem Retail Hub", "Coeur d'Alene Depot", "Vancouver Crossdock", "Yakima Regional Store", "Bellingham Depot", "Redmond Delivery Center"][index]! },
      status, createdBy: adminId, createdAt,
      scheduledPickupAt: new Date(createdAt.getTime() + 60 * 60 * 1000),
      expectedDeliveryAt: new Date(createdAt.getTime() + 24 * 60 * 60 * 1000),
      ...(assigned ? { assignedDriverId: drivers[index - 1]!._id, assignedVehicleId: vehicles[index - 1]!._id } : {}),
      ...(status === "delivered" ? { actualDeliveryAt: new Date(createdAt.getTime() + 5 * 60 * 60 * 1000) } : {}),
    };
  });
  const eventRows: SeedRecord[] = [];
  for (const shipment of shipments) {
    const history: Array<{ type: string; payload?: unknown }> = [{ type: "shipment.created" }];
    if (shipment.assignedDriverId) {
      history.push({ type: "shipment.assigned", payload: { driverId: shipment.assignedDriverId, vehicleId: shipment.assignedVehicleId } });
      const validPath: Record<string, string[]> = {
        assigned: [], dispatched: ["dispatched"], in_transit: ["dispatched", "in_transit"],
        delayed: ["dispatched", "in_transit", "delayed"], delivered: ["dispatched", "in_transit", "delivered"],
      };
      for (const status of validPath[shipment.status] ?? []) history.push({ type: "shipment.status_changed", payload: { status } });
    } else if (shipment.status === "cancelled") {
      history.push({ type: "shipment.status_changed", payload: { status: "cancelled" } });
    }
    history.forEach((event, index) => eventRows.push({
      _id: stableId(orgId, "ShipmentEvent", `${shipment.reference}:${index}`),
      organizationId: orgId, shipmentId: shipment._id, type: event.type, actorUserId: adminId,
      occurredAt: new Date(shipment.createdAt.getTime() + index * 5 * 60 * 1000),
      payload: { ...(event.payload && typeof event.payload === "object" ? event.payload : {}), demoSeed: "fleetflow-demo-v1" },
    }));
  }
  return { drivers, vehicles, shipments, events: eventRows };
}

type SeedConfig = {
  model: Model<any>;
  records: SeedRecord[];
  signature: (record: SeedRecord) => Record<string, unknown>;
  naturalKey?: (record: SeedRecord) => Record<string, unknown>;
  updateFields: string[];
};

export async function upsertSeedRecords({ model, records, signature, naturalKey, updateFields }: SeedConfig): Promise<SeedCounts> {
  const counts: SeedCounts = { inserted: 0, updated: 0, skipped: 0 };
  for (const record of records) {
    const owned = { _id: record._id, organizationId: record.organizationId, ...signature(record) };
    let existing = await model.findOne(owned).select("_id").lean();
    if (!existing) {
      const idCollision = await model.exists({ _id: record._id, organizationId: record.organizationId });
      const naturalCollision = naturalKey ? await model.exists({ organizationId: record.organizationId, ...naturalKey(record) }) : null;
      if (idCollision || naturalCollision) { counts.skipped++; continue; }
      try {
        await model.create(record);
        counts.inserted++;
      } catch (error) {
        if ((error as { code?: number }).code === 11000) { counts.skipped++; continue; }
        throw error;
      }
      continue;
    }
    const $set: Record<string, unknown> = {};
    for (const field of updateFields) if (record[field] !== undefined) $set[field] = record[field];
    if (Object.keys($set).length) await model.updateOne(owned, { $set }, { runValidators: true });
    counts.updated++;
  }
  return counts;
}

export function assertSafeTarget(host: string, database: string, expectedHost: string | undefined, expectedDatabase: string | undefined): void {
  if (!host.toLowerCase().endsWith(".mongodb.net")) throw new Error("Demo seeding requires a MongoDB Atlas host (.mongodb.net)");
  if (!database || /(^|[^a-z])(prod|production)([^a-z]|$)/i.test(database) || /^(admin|local|config)$/i.test(database)) {
    throw new Error("Refusing demo seed: database name is empty, reserved, or appears to be production");
  }
  if (!expectedHost || host.toLowerCase() !== expectedHost.trim().toLowerCase()) throw new Error("Refusing demo seed: set DEMO_SEED_EXPECTED_HOST to the confirmed Atlas cluster host");
  if (!expectedDatabase || database !== expectedDatabase) throw new Error("Refusing demo seed: set DEMO_SEED_EXPECTED_DATABASE to the confirmed target database name");
}

export async function seedDemo() {
  const organizationId = process.env.PROVISION_ORGANIZATION_ID;
  const adminEmail = process.env.PROVISION_ADMIN_EMAIL?.trim().toLowerCase();
  if (!organizationId || !mongoose.isValidObjectId(organizationId) || !adminEmail) {
    throw new Error("Set a valid PROVISION_ORGANIZATION_ID and PROVISION_ADMIN_EMAIL before seeding");
  }
  return withDatabaseConnection(async () => {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error("MONGODB_URI is required to start the API");
    const host = new URL(uri).hostname;
    const database = mongoose.connection.name;
    assertSafeTarget(host, database, process.env.DEMO_SEED_EXPECTED_HOST, process.env.DEMO_SEED_EXPECTED_DATABASE);
    const tenantId = new mongoose.Types.ObjectId(organizationId);
    const admin = await User.findOne({ organizationId: tenantId, email: adminEmail, role: "admin", isActive: true }).select("_id").lean();
    if (!admin) throw new Error("No active provisioned administrator found for the configured organization; no demo records were written");
    const data = buildDemoData(tenantId, admin._id);
    const report: SeedReport = {
      drivers: await upsertSeedRecords({ model: Driver, records: data.drivers, signature: (r) => ({ name: r.name }), naturalKey: (r) => ({ name: r.name }), updateFields: ["name", "availability"] }),
      vehicles: await upsertSeedRecords({ model: Vehicle, records: data.vehicles, signature: (r) => ({ registrationNumber: r.registrationNumber }), naturalKey: (r) => ({ registrationNumber: r.registrationNumber }), updateFields: ["registrationNumber", "capacityKg", "status"] }),
      shipments: await upsertSeedRecords({ model: Shipment, records: data.shipments, signature: (r) => ({ reference: r.reference }), naturalKey: (r) => ({ reference: r.reference }), updateFields: ["customerName", "origin", "destination", "status", "createdBy", "createdAt", "scheduledPickupAt", "expectedDeliveryAt", "actualDeliveryAt", "assignedDriverId", "assignedVehicleId"] }),
      shipmentEvents: await upsertSeedRecords({ model: ShipmentEvent, records: data.events, signature: (r) => ({ "payload.demoSeed": "fleetflow-demo-v1" }), updateFields: ["shipmentId", "type", "actorUserId", "occurredAt", "payload"] }),
    };
    console.log(JSON.stringify({ target: { host, database }, records: report, users: { inserted: 0, updated: 0, skipped: 0 }, administrator: "verified; not modified" }, null, 2));
    return report;
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDemo().catch((error: unknown) => {
    const message = sanitizeErrorMessage(error instanceof Error ? error.message : "Unknown seed failure");
    console.error(`Demo seed failed: ${message}`);
    process.exitCode = 1;
  });
}
