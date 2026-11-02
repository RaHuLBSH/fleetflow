import { API_BASE_URL } from "../config";

export type User = { id: string; name: string; email: string; role: "admin" | "dispatcher" | "driver"; organizationId: string; organizationName: string; organizations: Array<{ id: string; name: string; role: "admin" | "dispatcher" | "driver" }> };
export type Shipment = { id: string; reference: string; customerName?: string; origin: { address: string }; destination: { address: string }; status: string; assignedDriverId?: string; assignedVehicleId?: string; scheduledPickupAt?: string; expectedDeliveryAt?: string; createdAt?: string };
export type Resource = { id: string; name?: string; phone?: string; userId?: string; registrationNumber?: string; capacityKg?: number; availability?: string; status?: string };
let csrfToken = "";
const csrfStorageKey = "fleetflow_csrf_token";
export function setCsrfToken(token: string) {
  csrfToken = token;
  if (typeof window !== "undefined") {
    try { if (token) window.sessionStorage.setItem(csrfStorageKey, token); else window.sessionStorage.removeItem(csrfStorageKey); } catch { /* The session cookie still protects authentication; writes will show the server's CSRF error. */ }
  }
}
export function restoreCsrfToken() {
  if (typeof window === "undefined") return;
  try { csrfToken = window.sessionStorage.getItem(csrfStorageKey) ?? ""; } catch { csrfToken = ""; }
  if (!csrfToken) csrfToken = document.cookie.split("; ").find((part) => part.startsWith("fleetflow_csrf="))?.slice("fleetflow_csrf=".length) ?? "";
}
async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body) headers.set("content-type", "application/json");
  if (options.method && options.method !== "GET") headers.set("x-csrf-token", csrfToken);
  const response = await fetch(`${API_BASE_URL}/api${path}`, { ...options, headers, credentials: "include" });
  if (response.status === 401 && path !== "/auth/me" && typeof window !== "undefined") window.dispatchEvent(new Event("fleetflow:unauthorized"));
  const raw = await response.text();
  let body: { success?: boolean; data?: T; error?: { message?: string } };
  try { body = JSON.parse(raw) as typeof body; } catch { body = {}; }
  if (!response.ok || !body.success || !body.data) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  return body.data;
}
export const login = async (email: string, password: string) => {
  const response = await fetch(`${API_BASE_URL}/api/auth/login`, { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, password }) });
  const body = await response.json() as { success: boolean; data?: { user: User; csrfToken: string }; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? "Login failed");
  setCsrfToken(body.data.csrfToken); return body.data.user;
};
export const me = () => api<{ user: User }>("/auth/me");
export const switchOrganization = (organizationId: string) => api<{ user: User }>("/auth/switch-organization", { method: "POST", body: JSON.stringify({ organizationId }) });
export const inviteMember = (input: { email: string; role: "dispatcher" | "driver" }) => api<{ invitation: { id: string; email: string; role: "dispatcher" | "driver"; expiresAt: string }; invitationUrl: string }>("/auth/invitations", { method: "POST", body: JSON.stringify(input) });
export async function acceptInvitation(input: { token: string; name?: string; password?: string }) {
  const headers = new Headers({ "content-type": "application/json" });
  if (csrfToken) headers.set("x-csrf-token", csrfToken);
  const response = await fetch(`${API_BASE_URL}/api/auth/invitations/accept`, { method: "POST", credentials: "include", headers, body: JSON.stringify(input) });
  const body = await response.json() as { success: boolean; data?: { user: User; csrfToken?: string }; error?: { message?: string } };
  if (!response.ok || !body.data) throw new Error(body.error?.message ?? `Request failed (${response.status})`);
  if (body.data.csrfToken) setCsrfToken(body.data.csrfToken);
  return body.data.user;
}
export const logout = () => api<{ loggedOut: boolean }>("/auth/logout", { method: "POST" });
export type ShipmentEvent = { id: string; type: string; occurredAt: string; payload?: Record<string, unknown> };
export async function listShipments(options: { page?: number; limit?: number; status?: string; search?: string } = {}) {
  const query = new URLSearchParams({ page: String(options.page ?? 1), limit: String(options.limit ?? 100) });
  if (options.status) query.set("status", options.status);
  if (options.search) query.set("search", options.search);
  return api<{ shipments: Shipment[]; pagination: { page: number; limit: number; total: number; pages: number } }>(`/shipments?${query}`);
}
export const listDrivers = () => api<{ drivers: Resource[] }>("/drivers");
export const listVehicles = () => api<{ vehicles: Resource[] }>("/vehicles");
export const getDriver = (id: string) => api<{ driver: Resource }>(`/drivers/${id}`);
export const getVehicle = (id: string) => api<{ vehicle: Resource }>(`/vehicles/${id}`);
export const getShipment = (id: string) => api<{ shipment: Shipment }>(`/shipments/${id}`);
export const createShipment = (input: unknown) => api<{ shipment: Shipment }>("/shipments", { method: "POST", body: JSON.stringify(input) });
export const updateShipment = (id: string, input: { customerName?: string | null; origin?: { address: string }; destination?: { address: string }; scheduledPickupAt?: string | null; expectedDeliveryAt?: string | null }) => api<{ shipment: Shipment }>(`/shipments/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const assignShipment = (id: string, driverId: string, vehicleId: string) => api<{ shipment: Shipment }>(`/shipments/${id}/assign`, { method: "POST", body: JSON.stringify({ driverId, vehicleId }) });
export const updateStatus = (id: string, status: string) => api<{ shipment: Shipment }>(`/shipments/${id}/status`, { method: "POST", body: JSON.stringify({ status }) });
export const createDriver = (input: { name: string; phone?: string }) => api<{ driver: Resource }>("/drivers", { method: "POST", body: JSON.stringify(input) });
export const createVehicle = (input: { registrationNumber: string; capacityKg?: number }) => api<{ vehicle: Resource }>("/vehicles", { method: "POST", body: JSON.stringify(input) });
export const updateDriver = (id: string, input: { name?: string; phone?: string | null; availability?: "available" | "unavailable" }) => api<{ driver: Resource }>(`/drivers/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const updateVehicle = (id: string, input: { registrationNumber?: string; capacityKg?: number | null; status?: "available" | "maintenance" | "unavailable" }) => api<{ vehicle: Resource }>(`/vehicles/${id}`, { method: "PATCH", body: JSON.stringify(input) });
export const shipmentEvents = (id: string) => api<{ events: ShipmentEvent[] }>(`/shipments/${id}/events`);
