function parsePort(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "3000", 10);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error(`Invalid PORT value: ${value ?? "(empty)"}`);
  }

  return parsed;
}

function parsePositiveInteger(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? String(fallback), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 365) {
    throw new Error(`Invalid positive integer value: ${value ?? "(empty)"}`);
  }
  return parsed;
}

function originAliases(origin: string): string[] {
  const origins = new Set([origin]);

  try {
    const url = new URL(origin);

    if (url.hostname === "localhost") {
      url.hostname = "127.0.0.1";
      origins.add(url.origin);
    } else if (url.hostname === "127.0.0.1") {
      url.hostname = "localhost";
      origins.add(url.origin);
    }
  } catch {
    return [origin];
  }

  return [...origins];
}

const frontendOrigin = process.env.FRONTEND_ORIGIN ?? "http://localhost:5173";

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: parsePort(process.env.PORT),
  frontendOrigin,
  allowedOrigins: originAliases(frontendOrigin),
  mongoUri: process.env.MONGODB_URI,
  sessionTtlDays: parsePositiveInteger(process.env.SESSION_TTL_DAYS, 7),
};
