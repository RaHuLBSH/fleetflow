import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";
import mongoose from "mongoose";

async function start() {
  await connectDatabase();
  const legacyIdentityCount = await mongoose.connection.collection("users").countDocuments({ organizationId: { $exists: true }, role: { $exists: true } });
  if (legacyIdentityCount) throw new Error(`Organization membership migration required (${legacyIdentityCount} legacy users); run npm run migrate:organizations, review its dry-run, then rerun with -- --apply`);
  const app = createApp();
  app.listen(env.port, () => console.log(`FleetFlow API listening on port ${env.port}`));
}

start().catch((error: unknown) => {
  console.error("FleetFlow API could not start", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
