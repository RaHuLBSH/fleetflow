import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { Organization, OrganizationMembership } from "../modules/organizations/models.js";
import { inspectLegacyUsers } from "../modules/organizations/migration.js";
import { Driver, Shipment, ShipmentEvent, Vehicle } from "../modules/logistics/models.js";

const apply = process.argv.includes("--apply");

async function migrate() {
  await connectDatabase();
  try {
    const users = mongoose.connection.collection("users");
    const allUsers: any[] = await users.find({}).project({ _id: 1, organizationId: 1, role: 1, email: 1 }).toArray();
    const { legacyUsers, invalidLegacyUsers, duplicateEmailGroups } = inspectLegacyUsers(allUsers);
    if (invalidLegacyUsers.length || duplicateEmailGroups) {
      throw new Error(`Migration blocked: ${invalidLegacyUsers.length} invalid legacy users and ${duplicateEmailGroups} duplicate global email groups; resolve these before applying`);
    }

    const organizationIds = new Map<string, mongoose.Types.ObjectId>();
    const addIds = (values: unknown[]) => values.forEach((value) => {
      if (mongoose.isValidObjectId(value)) { const id = new mongoose.Types.ObjectId(String(value)); organizationIds.set(id.toHexString(), id); }
    });
    addIds(await Driver.distinct("organizationId")); addIds(await Vehicle.distinct("organizationId"));
    addIds(await Shipment.distinct("organizationId")); addIds(await ShipmentEvent.distinct("organizationId"));
    addIds(legacyUsers.map((user) => user.organizationId));
    if (process.env.PROVISION_ORGANIZATION_ID && mongoose.isValidObjectId(process.env.PROVISION_ORGANIZATION_ID)) addIds([process.env.PROVISION_ORGANIZATION_ID]);

    if (!apply) {
      process.stdout.write(JSON.stringify({ database: mongoose.connection.name, mode: "dry-run", organizations: organizationIds.size, legacyUsers: legacyUsers.length, membershipsToCreate: legacyUsers.length, duplicateEmailGroups, invalidLegacyUsers: invalidLegacyUsers.length, next: "Review this summary, then rerun with --apply" }) + "\n");
      return;
    }

    for (const organizationId of organizationIds.values()) {
      const name = organizationId.toHexString() === (process.env.PROVISION_ORGANIZATION_ID ? new mongoose.Types.ObjectId(process.env.PROVISION_ORGANIZATION_ID).toHexString() : "")
        ? (process.env.PROVISION_ORGANIZATION_NAME?.trim() || "FleetFlow workspace")
        : "FleetFlow workspace";
      await Organization.updateOne({ _id: organizationId }, { $setOnInsert: { name } }, { upsert: true, runValidators: true });
    }
    for (const user of legacyUsers as any[]) {
      await OrganizationMembership.updateOne(
        { organizationId: user.organizationId, userId: user._id },
        { $setOnInsert: { organizationId: user.organizationId, userId: user._id, role: user.role, isActive: true } },
        { upsert: true, runValidators: true },
      );
    }

    await users.createIndex({ email: 1 }, { unique: true, name: "email_1" });
    const indexes = await users.indexes();
    if (indexes.some((index) => index.name === "organizationId_1_email_1")) await users.dropIndex("organizationId_1_email_1");
    if (legacyUsers.length) await users.updateMany({ organizationId: { $exists: true }, role: { $exists: true } }, { $unset: { organizationId: "", role: "" } });
    process.stdout.write(JSON.stringify({ database: mongoose.connection.name, mode: "applied", organizations: organizationIds.size, membershipsMigrated: legacyUsers.length, usersMigrated: legacyUsers.length, duplicateEmailGroups: 0 }) + "\n");
  } finally {
    await disconnectDatabase();
  }
}

migrate().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Unknown migration failure";
  process.stderr.write(`Organization migration failed: ${message.replace(/mongodb(?:\+srv)?:\/\/[^\s"']+/gi, "[redacted MongoDB URI")}\n`);
  process.exitCode = 1;
});
