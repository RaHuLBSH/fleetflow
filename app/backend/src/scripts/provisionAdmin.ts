import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { hashPassword } from "../modules/auth/auth.service.js";
import { User } from "../modules/auth/user.model.js";

async function provisionAdmin() {
  const { PROVISION_ORGANIZATION_ID: organizationId, PROVISION_ADMIN_NAME: name, PROVISION_ADMIN_EMAIL: email, PROVISION_ADMIN_PASSWORD: password } = process.env;
  if (!organizationId || !mongoose.isValidObjectId(organizationId) || !name || !email || !password || password.length < 12) {
    throw new Error("Set a valid PROVISION_ORGANIZATION_ID, PROVISION_ADMIN_NAME, PROVISION_ADMIN_EMAIL, and a 12+ character PROVISION_ADMIN_PASSWORD");
  }
  await connectDatabase();
  await User.create({ organizationId, name, email: email.toLowerCase(), passwordHash: await hashPassword(password), role: "admin", isActive: true });
  console.log("Administrator provisioned");
}

provisionAdmin().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(disconnectDatabase);
