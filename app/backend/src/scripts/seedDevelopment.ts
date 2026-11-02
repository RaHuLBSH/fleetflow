
import "dotenv/config";
import mongoose from "mongoose";

import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { User } from "../modules/auth/user.model.js";
import {
  Organization,
  OrganizationMembership,
} from "../modules/organizations/models.js";
import {
  Driver,
  Vehicle,
  Shipment,
  ShipmentEvent,
} from "../modules/logistics/models.js";

import { buildFleetFlowSeed } from "./seedData/fleetflow.seed.js";

const EXPECTED_DATABASE = "dev";

function validateEnvironment() {
  const uri = process.env.MONGODB_URI;
  const expectedHost = process.env.DEMO_SEED_EXPECTED_HOST;
  const expectedDatabase =
    process.env.DEMO_SEED_EXPECTED_DATABASE;

  if (!uri || !expectedHost || !expectedDatabase) {
    throw new Error(
      "Missing MONGODB_URI, DEMO_SEED_EXPECTED_HOST, or DEMO_SEED_EXPECTED_DATABASE.",
    );
  }

  const parsed = new URL(uri);
  const host = parsed.hostname.toLowerCase();
  const database = decodeURIComponent(
    parsed.pathname.replace(/^\/+/, "").split("/")[0] ?? "",
  );

  if (!host.endsWith(".mongodb.net")) {
    throw new Error("Seed script only permits MongoDB Atlas hosts.");
  }

  if (host !== expectedHost.toLowerCase()) {
    throw new Error(
      `Atlas host mismatch. Expected ${expectedHost}, received ${host}.`,
    );
  }

  if (database !== EXPECTED_DATABASE) {
    throw new Error(
      `Unsafe database "${database}". Expected "${EXPECTED_DATABASE}".`,
    );
  }

  if (expectedDatabase !== EXPECTED_DATABASE) {
    throw new Error(
      `DEMO_SEED_EXPECTED_DATABASE must equal ${EXPECTED_DATABASE}.`,
    );
  }

  const organizationId = process.env.PROVISION_ORGANIZATION_ID;
  const adminEmail = process.env.PROVISION_ADMIN_EMAIL?.trim().toLowerCase();

  if (
    !organizationId ||
    !mongoose.isValidObjectId(organizationId) ||
    !adminEmail
  ) {
    throw new Error(
      "Valid PROVISION_ORGANIZATION_ID and PROVISION_ADMIN_EMAIL are required.",
    );
  }

  return {
    organizationId: new mongoose.Types.ObjectId(organizationId),
    adminEmail,
  };
}

async function upsertRecords(
  model: any,
  records: any[],
  label: string,
  apply: boolean,
) {
  console.log(`${label}: ${records.length} records`);

  if (!apply) {
    return;
  }

  for (const record of records) {
    await model.updateOne(
      {
        _id: record._id,
        organizationId: record.organizationId,
      },
      {
        $set: record,
      },
      {
        upsert: true,
        runValidators: true,
      },
    );
  }

  console.log(`${label}: upsert completed`);
}

async function seedDevelopment() {
  const apply = process.argv.includes("--apply");
  const { organizationId, adminEmail } = validateEnvironment();

  console.log("\nFleetFlow development seed");
  console.log("--------------------------");
  console.log(`Mode: ${apply ? "APPLY" : "DRY RUN"}`);
  console.log(`Target database: ${EXPECTED_DATABASE}`);
  console.log(`Organization: ${organizationId.toString()}`);

  await connectDatabase();

  try {
    if (mongoose.connection.name !== EXPECTED_DATABASE) {
      throw new Error(
        `Connected to "${mongoose.connection.name}", not "${EXPECTED_DATABASE}".`,
      );
    }

    const organization = await Organization.findById(organizationId);

    if (!organization) {
      throw new Error(
        "Organization not found. Run npm run provision:admin first.",
      );
    }

    const admin = await User.findOne({
      email: adminEmail,
      isActive: true,
    });

    if (!admin) {
      throw new Error(
        "Active admin user not found. Check PROVISION_ADMIN_EMAIL.",
      );
    }

    const membership = await OrganizationMembership.findOne({
      organizationId,
      userId: admin._id,
      role: "admin",
      isActive: true,
    });

    if (!membership) {
      throw new Error(
        "The configured user does not have an active admin membership in this organization.",
      );
    }

    const seed = buildFleetFlowSeed({
      organizationId,
      adminId: admin._id,
      now: new Date(),
    });

    console.log("\nSeed data preview");
    console.log("-----------------");

    await upsertRecords(Driver, seed.drivers, "Drivers", apply);
    await upsertRecords(Vehicle, seed.vehicles, "Vehicles", apply);
    await upsertRecords(Shipment, seed.shipments, "Shipments", apply);
    await upsertRecords(
      ShipmentEvent,
      seed.events,
      "Shipment events",
      apply,
    );

    if (!apply) {
      console.log("\nDry run complete. No records were written.");
      console.log("Run with --apply to insert/update the seed data.");
    } else {
      console.log("\nDevelopment seed completed successfully.");
    }
  } finally {
    await disconnectDatabase();
  }
}

seedDevelopment().catch((error: unknown) => {
  console.error("\nDevelopment seed failed:");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }

  process.exitCode = 1;
});
