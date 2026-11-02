# FleetFlow — API and Event Contracts

These contracts define intended behavior for implementation. They are not a claim that endpoints already exist. Keep this file updated whenever a contract changes.

## 1. Conventions

- Base path: `/api`.
- JSON request and response bodies unless otherwise stated.
- Dates are ISO 8601 UTC timestamps.
- Use pagination for list endpoints.
- Validate path parameters, query parameters, and request bodies.
- Do not expose MongoDB documents directly; map to response DTOs.
- Authentication and resource authorization are server-enforced.
- Return a request/correlation ID when available.

### Success envelope (suggested)

```json
{
  "success": true,
  "data": {}
}
```

### Error envelope (suggested)

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request could not be validated",
    "details": []
  },
  "requestId": "..."
}
```

Do not expose stack traces, secrets, or raw provider errors in production responses.

## 2. Initial foundation endpoints

### `GET /api/health`

Purpose: report that the API process is responding.

Example:
```json
{
  "success": true,
  "message": "FleetFlow API is running"
}
```

This endpoint does not necessarily prove MongoDB or Redis is ready. Add a separate readiness endpoint if deployment checks require dependency status.

## 3. Authentication endpoints

FleetFlow uses opaque, random session tokens. The token is stored only in a Secure (production), HttpOnly cookie; the database stores only its SHA-256 hash. Cookies use SameSite=Strict in development and SameSite=None in production so a separately hosted frontend can send credentials to the API. Sessions expire after `SESSION_TTL_DAYS` and can be revoked on logout. Authenticated state-changing requests require a CSRF token in `X-CSRF-Token`; logout instead requires an authenticated session and an approved `Origin`, since it only revokes the caller's own session. Requests with an unapproved `Origin` are rejected. Set `FRONTEND_ORIGIN` to the exact deployed frontend origin; each session has an active organization and its role is resolved from the user's membership in that organization.

Public registration is intentionally not implemented. Organization admins invite dispatchers and drivers with a single-use invitation. New invitees set their own password when accepting; existing accounts must authenticate before accepting. Regular invitations cannot grant the admin role.

- `POST /api/auth/login` — verify credentials and establish a session.
- `POST /api/auth/logout` — revoke the current session/refresh credential.
- `GET /api/auth/me` — return the current authenticated user's safe profile.
- `GET /api/auth/organizations` — list active memberships and the current organization.
- `POST /api/auth/switch-organization` — switch the session to one of the caller's active memberships; requires CSRF.
- `POST /api/auth/invitations` — admin-only invitation for `dispatcher` or `driver`; returns a copyable one-time link.
- `POST /api/auth/invitations/accept` — accept an invitation; new users provide name/password, existing users must authenticate with the invited account.

The login identity is global and unique by normalized email. Roles belong to `OrganizationMembership`, not the global user. Switching changes the session's active organization and effective role. Every API and socket request must derive tenant and role from the verified membership. Never accept client-supplied role or organization ID as proof of permission. Organization creation remains controlled provisioning.

Role permissions within the active organization:
- **Admin:** manage tenant shipments, drivers, vehicles, members, and organization settings; cannot access a tenant without membership or invite another admin through the member UI.
- **Dispatcher:** manage shipments and operational driver/vehicle records, assignments, tracking, alerts, and AI reviews; cannot manage users, memberships, or organization settings.
- **Driver:** view only assigned shipments/history/tracking and submit permitted status/location updates for an active assignment; cannot access organization-wide records or manage resources/users/settings.

## 4. Shipments

- `POST /api/shipments` — create a shipment.
- `GET /api/shipments` — list authorized shipments with pagination and filters.
- `GET /api/shipments/:shipmentId` — retrieve an authorized shipment.
- `PATCH /api/shipments/:shipmentId` — update permitted fields.
- `POST /api/shipments/:shipmentId/assign` — assign eligible driver and vehicle.
- `POST /api/shipments/:shipmentId/status` — perform a validated status transition.
- `GET /api/shipments/:shipmentId/events` — retrieve shipment history.
- `GET /api/shipments/:shipmentId/tracking` — retrieve current tracking/ETA data.

Use an explicit allowed-field list for updates. A generic patch must not permit changing organization ownership, internal flags, or fields reserved for system workflows.

Milestone 3 permissions and behavior:
- All shipment, driver, and vehicle routes require the session cookie. Every write also requires `X-CSRF-Token` and an approved Origin when supplied.
- Admins and dispatchers can create, list, view, update, assign, and change shipment status within their own organization. Admins and dispatchers can list/create/view/update drivers and vehicles in that organization.
- Drivers can list only shipments assigned to their linked driver record, view those shipments and their events/tracking summary, and submit permitted status changes. A driver with no linked driver record sees an empty list.
- Shipment list query supports `page` (default 1), `limit` (default 20, max 100), `status`, and case-insensitive `search` against reference. Response includes `pagination: { page, limit, total, pages }`.
- Assignment requires both `driverId` and `vehicleId`, both in the caller's organization and available with no conflicting active shipment. Only created or assigned shipments may be assigned. Assignment marks the resources in use; delivery or cancellation releases them.
- Permitted transitions: `created -> assigned | cancelled`; `assigned -> dispatched | cancelled`; `dispatched -> in_transit | cancelled`; `in_transit -> delayed | delivered | cancelled`; `delayed -> in_transit | delivered | cancelled`. Delivered and cancelled are terminal. Drivers may only transition to `in_transit`, `delayed`, or `delivered`.
- `/tracking` currently returns the authorized shipment's stored `latestEtaAt` and `location: null`; live tracking is a later milestone.
- `/events` returns the persisted shipment event history. Shipment status/assignment events are recorded after writes; these writes are not transactionally coupled in this MVP.

## 5. Drivers and vehicles

Suggested endpoints:
- `GET /api/drivers`
- `POST /api/drivers`
- `GET /api/drivers/:driverId`
- `PATCH /api/drivers/:driverId`
- `GET /api/vehicles`
- `POST /api/vehicles`
- `GET /api/vehicles/:vehicleId`
- `PATCH /api/vehicles/:vehicleId`

Milestone 3 implements the listed driver and vehicle endpoints. Driver and vehicle creation and edits are restricted to admins/dispatchers; edits cannot mark an active resource available/unavailable while it is assigned. User-linked driver records must reference an active driver account in the same organization.

Define the role permissions and organization scope for each endpoint before implementation.

## 6. Location updates

For the MVP, location updates may arrive through an authenticated Socket.IO event. A REST endpoint can be useful for tests or integrations:

`POST /api/drivers/me/location`

Example request:
```json
{
  "latitude": 18.5204,
  "longitude": 73.8567,
  "recordedAt": "2026-10-28T10:00:00.000Z",
  "sequence": 42
}
```

The server derives the driver identity from authentication. Do not trust a client-provided `driverId` to decide whose location is updated. Validate coordinate ranges, assignment permissions, timestamps, and stale-update behavior.

## 7. AI analysis

`POST /api/shipments/:shipmentId/ai-analysis`

Purpose: enqueue an AI analysis for an authorized shipment.

Suggested response: `202 Accepted` with an analysis ID and queued status.

```json
{
  "success": true,
  "data": {
    "analysisId": "analysis-id",
    "status": "queued"
  }
}
```

- Do not make the client wait for a long LLM call.
- Check shipment access before enqueueing.
- Validate structured model output.
- Treat recommendations as suggestions, not executable commands.
- Add deduplication and provider timeouts.
- Provide an authorized endpoint to retrieve the analysis result.

## 8. Socket.IO contract

Authenticate the socket connection using the chosen session/token strategy. The server assigns rooms after authorization; clients cannot choose arbitrary organization or shipment rooms.

### Client-to-server events

- `tracking:subscribe` — request access to tracking for a shipment; server authorizes before joining a room.
- `tracking:location_update` — send a location update as an authenticated assigned driver.
- `tracking:unsubscribe` — leave a previously authorized subscription.

### Server-to-client events

#### `shipment:updated`
```json
{
  "shipmentId": "shipment-id",
  "status": "in_transit",
  "updatedAt": "2026-10-28T10:00:00.000Z"
}
```

#### `driver:location`
```json
{
  "driverId": "driver-id",
  "shipmentId": "shipment-id",
  "latitude": 18.5204,
  "longitude": 73.8567,
  "recordedAt": "2026-10-28T10:00:00.000Z"
}
```

#### `delivery:delay_alert`
```json
{
  "shipmentId": "shipment-id",
  "expectedDeliveryAt": "2026-10-28T12:00:00.000Z",
  "reasonCode": "ETA_EXCEEDS_DELIVERY_WINDOW"
}
```

#### `ai:analysis_completed`
```json
{
  "analysisId": "analysis-id",
  "shipmentId": "shipment-id",
  "status": "completed"
}
```

These are illustrative minimum payloads. Avoid broadcasting unnecessary customer, driver, or internal AI data.

## 9. Domain events versus socket events

Internal domain events represent business facts, for example `shipment.assigned` or `delivery.delay_detected`. Socket events are client-facing notifications such as `shipment:updated`.

A domain event should be persisted or reliably queued if losing it would cause an important business operation to be missed. Socket delivery alone is not durable; clients should be able to recover state from REST.

## 10. HTTP status guidance

- `200 OK`: successful read/update.
- `201 Created`: resource created.
- `202 Accepted`: asynchronous work queued.
- `400 Bad Request`: malformed or invalid request.
- `401 Unauthorized`: missing/invalid authentication.
- `403 Forbidden`: authenticated but not permitted.
- `404 Not Found`: missing resource, or use this to avoid leaking resource existence where appropriate.
- `409 Conflict`: conflicting state or assignment.
- `429 Too Many Requests`: rate limit exceeded.
- `500 Internal Server Error`: unexpected server failure.

Keep error codes stable so the frontend can display appropriate messages.
