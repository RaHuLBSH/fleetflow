import "dotenv/config";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { connectDatabase } from "./config/database.js";

async function start() {
  await connectDatabase();
  const app = createApp();
  app.listen(env.port, () => console.log(`FleetFlow API listening on port ${env.port}`));
}

start().catch((error: unknown) => {
  console.error("FleetFlow API could not start", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
