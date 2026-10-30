import { API_BASE_URL } from "../config";

export type HealthResponse = {
  success: true;
  message: string;
};

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.success === true && typeof record.message === "string";
}

export async function fetchHealth(
  signal?: AbortSignal,
): Promise<HealthResponse> {
  const response = await fetch(`${API_BASE_URL}/api/health`, { signal });

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  const body: unknown = await response.json();

  if (!isHealthResponse(body)) {
    throw new Error("Health check returned an unexpected response");
  }

  return body;
}
