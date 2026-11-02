import "dotenv/config";
import mongoose from "mongoose";
import { connectDatabase, disconnectDatabase } from "../config/database.js";
import { hashPassword } from "../modules/auth/auth.service.js";
import { User } from "../modules/auth/user.model.js";
import { Organization, OrganizationMembership } from "../modules/organizations/models.js";

async function provisionAdmin() {
  const { PROVISION_ORGANIZATION_ID: organizationId, PROVISION_ADMIN_NAME: name, PROVISION_ADMIN_EMAIL: email, PROVISION_ADMIN_PASSWORD: password } = process.env;
  if (!organizationId || !mongoose.isValidObjectId(organizationId) || !name || !email || !password || password.length < 12) {
    throw new Error("Set a valid PROVISION_ORGANIZATION_ID, PROVISION_ADMIN_NAME, PROVISION_ADMIN_EMAIL, and a 12+ character PROVISION_ADMIN_PASSWORD");
  }
  await connectDatabase();
  const tenantId = new mongoose.Types.ObjectId(organizationId);
  await Organization.updateOne({ _id: tenantId }, { $setOnInsert: { name: process.env.PROVISION_ORGANIZATION_NAME?.trim() || "FleetFlow workspace" } }, { upsert: true });
  let user = await User.findOne({ email: email.toLowerCase() });
  if (!user) user = await User.create({ name, email: email.toLowerCase(), passwordHash: await hashPassword(password), isActive: true, lastOrganizationId: tenantId });
  const existingMembership = await OrganizationMembership.findOne({ organizationId: tenantId, userId: user._id });
  if (existingMembership && existingMembership.role !== "admin") throw new Error("The configured provisioned user already has a non-admin role in this organization");
  await OrganizationMembership.updateOne({ organizationId: tenantId, userId: user._id }, { $setOnInsert: { organizationId: tenantId, userId: user._id, role: "admin", isActive: true } }, { upsert: true });
  console.log("Administrator membership provisioned");
}

provisionAdmin().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; }).finally(disconnectDatabase);
