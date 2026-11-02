# FleetFlow — Initial Data Model

This is a starting model, not a mandate to implement every collection in the first milestone. Use Mongoose schemas with timestamps, validation, and indexes appropriate to actual query patterns.

## Shared conventions

- Use MongoDB ObjectIds unless there is a clear reason to use another ID format.
- Add `createdAt` and `updatedAt` where appropriate.
- Scope tenant-owned records with `organizationId`.
- Keep secrets and password hashes out of API response DTOs.
- Store dates as BSON dates/UTC instants.
- Validate enums and state transitions in the service layer as well as schema validation where appropriate.

## 1. User

```ts
type UserRole = "admin" | "dispatcher" | "driver";

interface User {
  _id: ObjectId;
  name: string;
  email: string;          // normalized; globally unique login identity
  passwordHash: string;
  isActive: boolean;
  lastOrganizationId?: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}
```

User is a global login identity. Organization-specific roles and access are stored in OrganizationMembership. Email has a global unique index.

## 1a. Organization and membership

```ts
interface Organization { _id: ObjectId; name: string; region?: string; timeZone?: string; }
interface OrganizationMembership {
  _id: ObjectId;
  organizationId: ObjectId;
  userId: ObjectId;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

Enforce unique `organizationId + userId`. A session's active organization must resolve to an active membership before tenant data is accessible.

## 1b. Organization invitation

```ts
interface OrganizationInvitation {
  _id: ObjectId;
  organizationId: ObjectId;
  email: string;
  role: "dispatcher" | "driver";
  tokenHash: string;
  invitedBy: ObjectId;
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
}
```

Store only a hash of the single-use invitation token. Invitations expire after seven days; the admin member UI cannot grant admin membership.

## 2. Driver

```ts
interface Driver {
  _id: ObjectId;
  organizationId: ObjectId;
  userId?: ObjectId;
  name: string;
  phone?: string;
  availability: "available" | "on_delivery" | "unavailable";
  createdAt: Date;
  updatedAt: Date;
}
```

Do not assume a driver record and login account are the same entity. A driver can be represented operationally before an account is provisioned.

## 3. Vehicle

```ts
interface Vehicle {
  _id: ObjectId;
  organizationId: ObjectId;
  registrationNumber: string;
  capacityKg?: number;
  status: "available" | "in_use" | "maintenance" | "unavailable";
  createdAt: Date;
  updatedAt: Date;
}
```

Enforce organization-scoped uniqueness for registration number where appropriate.

## 4. Shipment

```ts
type ShipmentStatus =
  | "created"
  | "assigned"
  | "dispatched"
  | "in_transit"
  | "delayed"
  | "delivered"
  | "cancelled";

interface Shipment {
  _id: ObjectId;
  organizationId: ObjectId;
  reference: string;
  customerName?: string;
  origin: { address: string; location?: GeoJSONPoint };
  destination: { address: string; location?: GeoJSONPoint };
  status: ShipmentStatus;
  scheduledPickupAt?: Date;
  expectedDeliveryAt?: Date;
  actualDeliveryAt?: Date;
  assignedDriverId?: ObjectId;
  assignedVehicleId?: ObjectId;
  latestEtaAt?: Date;
  createdBy: ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

interface GeoJSONPoint {
  type: "Point";
  coordinates: [longitude: number, latitude: number];
}
```

Use an explicit state-transition function to prevent invalid transitions, such as moving a cancelled shipment to dispatched without a defined recovery flow.

## 5. Assignment

An assignment collection is optional for a simple MVP. Add it when reassignment history or assignment-specific fields are needed.

```ts
interface Assignment {
  _id: ObjectId;
  organizationId: ObjectId;
  shipmentId: ObjectId;
  driverId: ObjectId;
  vehicleId: ObjectId;
  assignedBy: ObjectId;
  assignedAt: Date;
  endedAt?: Date;
  status: "active" | "completed" | "cancelled";
}
```

Validate that the driver and vehicle belong to the same organization, are eligible, and do not have conflicting active assignments.

## 6. Latest driver location

```ts
interface DriverCurrentLocation {
  _id: ObjectId;          // or driverId as the unique key
  organizationId: ObjectId;
  driverId: ObjectId;
  shipmentId?: ObjectId;
  location: GeoJSONPoint;
  recordedAt: Date;
  receivedAt: Date;
  sequence?: number;
}
```

Maintain one current record per driver and update it only when the incoming update is newer. Index by `driverId` and, if geo queries are needed, `location` with `2dsphere`.

## 7. Location history

```ts
interface LocationUpdate {
  _id: ObjectId;
  organizationId: ObjectId;
  driverId: ObjectId;
  shipmentId?: ObjectId;
  location: GeoJSONPoint;
  recordedAt: Date;
  receivedAt: Date;
  sequence?: number;
}
```

Location history can grow quickly. Add retention/TTL policy only after deciding the product's retention needs. Do not keep every update indefinitely by accident.

## 8. Shipment event history

```ts
interface ShipmentEvent {
  _id: ObjectId;
  organizationId: ObjectId;
  shipmentId: ObjectId;
  type: string;
  actorUserId?: ObjectId;
  occurredAt: Date;
  payload?: Record<string, unknown>;
  correlationId?: string;
}
```

Use a controlled event catalog and validate payloads per event type. Do not place secrets or unnecessary personal data in event payloads.

## 9. Notification

```ts
interface Notification {
  _id: ObjectId;
  organizationId: ObjectId;
  recipientUserId: ObjectId;
  type: string;
  title: string;
  message: string;
  resourceType?: "shipment" | "vehicle" | "driver";
  resourceId?: ObjectId;
  readAt?: Date;
  createdAt: Date;
}
```

Deduplicate repeated delay alerts where possible.

## 10. AI analysis

```ts
interface AiAnalysis {
  _id: ObjectId;
  organizationId: ObjectId;
  shipmentId: ObjectId;
  trigger: "delay_detected" | "dispatcher_requested";
  status: "queued" | "running" | "completed" | "failed";
  summary?: string;
  recommendations?: Array<{
    title: string;
    rationale: string;
    requiresHumanApproval: boolean;
  }>;
  provider?: string;
  model?: string;
  errorCode?: string;
  createdAt: Date;
  completedAt?: Date;
}
```

Store only the information needed for product functionality and debugging. Avoid retaining raw prompts or sensitive context by default. Validate model output before persistence and rendering.

## 11. Optional later collections

- `DeliveryProof`: proof-of-delivery metadata and secure file references.
- `RefreshSession`: hashed refresh/session token, expiry, revocation, rotation metadata.
- `OutboxEvent`: event type, payload, status, attempts, created/processed timestamps.
- `AuditLog`: actor, action, resource, timestamp, and safe metadata.

## Indexing guidance

Start with indexes that match known queries:
- Users: normalized email and organization scope.
- Shipments: organization + status + updated/created time; organization + reference.
- Drivers/vehicles: organization + availability/status.
- Location: driver ID; optional `2dsphere` for GeoJSON.
- Shipment events: organization + shipment ID + occurred time.
- Notifications: recipient + read status + created time.
- Outbox/jobs: processing status + created time.

Check actual query plans before adding many indexes; indexes increase write and storage costs.
