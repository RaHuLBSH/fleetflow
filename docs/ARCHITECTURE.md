# FleetFlow — Architecture

## 1. Architecture style

Start with a **modular monolith** and a separately runnable background worker. Keep domain logic separated by feature, but deploy the API as one application until there is a measured reason to split it.

```text
React + TypeScript
   | REST (initial loads and commands)
   | Socket.IO (live updates)
   v
Express + TypeScript API
   |-- Authentication and authorization
   |-- Shipments module
   |-- Drivers and vehicles modules
   |-- Assignments module
   |-- Tracking module
   |-- Notifications module
   |-- AI service wrapper
   |
   +--> MongoDB
   |
   +--> Redis / BullMQ --> Worker process
   |                         |-- ETA and delay jobs
   |                         |-- AI analysis
   |                         |-- Notifications
   |
   +--> External routing/ETA provider
   +--> External LLM provider
```

## 2. Suggested backend structure

Adapt this to the codebase that exists; do not create empty abstractions without a current use.

```text
apps/backend/src/
  config/
  middleware/
  modules/
    auth/
    users/
    shipments/
    drivers/
    vehicles/
    assignments/
    tracking/
    notifications/
    ai/
  realtime/
  jobs/
  services/
  app.ts
  server.ts
  worker.ts
```

A module can contain routes/controller, service, model/schema, validation, and tests as needed. Keep controllers thin: parse/validate input, invoke services, and format responses. Put business rules in services/domain functions.

## 3. REST and real-time responsibilities

Use REST for:
- Initial page data and list/detail queries.
- Creating and editing shipments.
- Assigning drivers and vehicles.
- Status-change commands.
- Requesting an AI analysis.

Use Socket.IO for:
- Authorized live location updates.
- Shipment status changes.
- Delay alerts and completed AI analyses.
- Other UI updates where push delivery is useful.

The socket event is a notification that state changed, not a replacement for persisted state. Clients should be able to reconnect and reload current state through REST.

## 4. Event flow

Recommended flow:

1. Client submits a command.
2. API authenticates the user, validates the input, and checks resource/organization access.
3. Service applies business rules and persists the change.
4. Service records a domain event or schedules follow-up work.
5. Event handlers/jobs update derived state, call external providers, or create notifications.
6. API/worker emits authorized client-facing Socket.IO updates.
7. Clients refresh or update the relevant view.

Example domain events:
- `shipment.created`
- `shipment.assigned`
- `shipment.dispatched`
- `driver.location_updated`
- `delivery.delay_detected`
- `ai.analysis_completed`
- `shipment.status_changed`
- `delivery.completed`
- `vehicle.unavailable`

Example client-facing Socket.IO events:
- `shipment:updated`
- `driver:location`
- `delivery:delay_alert`
- `ai:analysis_completed`

Keep internal domain-event names separate from public socket event names. Document event payloads in `API_CONTRACTS.md`.

## 5. Reliability and event publication

A MongoDB write and a Redis publish are not one atomic operation. If a process crashes between them, a change can be saved without its event being published.

For an initial local MVP, keep the implementation simple and document the limitation. For robust event delivery, use a transactional outbox:
- Persist the business change and outbox event in the same MongoDB transaction.
- A worker reads unpublished outbox records.
- Publish/handle each event and mark it processed.
- Use a MongoDB deployment that supports transactions (normally a replica set).
- Make consumers idempotent because events/jobs can be delivered more than once.

Do not introduce the outbox before the basic workflow works, but design services so it can be added without rewriting every route.

## 6. Real-time tracking

- Authenticate the Socket.IO connection.
- Determine the user's role and organization from the verified server-side session/token.
- Authorize each requested subscription on the server.
- Never let a client join an arbitrary room by sending a room name.
- Validate driver identity, assignment, coordinate ranges, and timestamps for location updates.
- Reject stale updates using timestamps or sequence numbers.
- Throttle or batch high-frequency updates.
- Persist the latest known location separately from historical location points.
- Use GeoJSON coordinates in `[longitude, latitude]` order and a `2dsphere` index when geo queries are needed.
- In multi-instance deployments, use a Socket.IO Redis adapter; understand session-affinity requirements if HTTP long-polling is enabled.
- Browser background location tracking is constrained; use a simulator for the first demo.

## 7. ETA and delay detection

- Put routing/ETA access behind an interface so the provider can be swapped or mocked.
- Do not call the routing provider for every GPS update.
- Recalculate on a schedule or meaningful changes (route deviation, significant movement, changed delivery window).
- Cache results and throttle requests.
- Apply deterministic delay rules first.
- Enqueue AI analysis only for shipments that are actually at risk or when a dispatcher requests it.

AI output should explain evidence and suggest options. It must not silently make consequential dispatch decisions.

## 8. AI integration

Use an `AiAnalysisService` (or similarly named service) that:
- Accepts a narrowly defined, validated input object.
- Receives only the shipment/driver data the caller is authorized to access.
- Calls the configured provider.
- Requests structured output.
- Validates the response using a schema.
- Stores the analysis and model/provider metadata needed for debugging.
- Handles timeouts, rate limits, retries where safe, and provider errors.
- Clearly labels model-generated recommendations as suggestions.

For a natural-language assistant, expose only explicit backend tools. Every tool must enforce authorization independently; the LLM is never the security boundary.

## 9. Authentication and security

- Hash passwords with Argon2id or bcrypt using appropriate parameters.
- Prefer short-lived access credentials and carefully managed refresh/session credentials.
- If refresh tokens are used, rotate them and support revocation.
- Use Secure, HttpOnly cookies with appropriate SameSite settings where cookie-based credentials are selected; assess CSRF protection for the deployment topology.
- Configure CORS for known frontend origins, not `*` with credentials.
- Rate-limit login and other sensitive endpoints.
- Enforce role and organization/resource access on the server.
- Validate Socket.IO connections and individual events.
- Never store secrets in the frontend bundle.
- Avoid returning password hashes, token secrets, or internal error details.

Choose one coherent session/token design and document it; do not combine incompatible patterns by default.

## 10. Background jobs

Use BullMQ for work that should not block the API response:
- ETA refresh.
- Delay evaluation.
- AI analysis.
- Notification delivery.

Jobs should include stable IDs where useful, retry/backoff policies, bounded concurrency, timeouts, and idempotent handlers. Deduplicate repeated alerts and AI analyses. Keep GPS ingestion responsive.

## 11. Observability and testing

- Structured request logs and correlation/request IDs.
- Health endpoint and, if needed, separate readiness check for dependencies.
- Unit tests for business rules.
- Integration tests for routes, authorization, and persistence.
- Socket event authorization tests.
- Job retry/idempotency tests.
- Tests for AI output schema validation and provider failure handling.
- Never use real production credentials in tests.

## 12. Scaling path

1. One API process, one worker process, MongoDB, Redis.
2. Add indexes, pagination, profiling, and queue metrics.
3. Scale API instances and configure the Socket.IO adapter.
4. Scale worker concurrency independently.
5. Introduce a dedicated service only when load, reliability, or team boundaries justify it.
