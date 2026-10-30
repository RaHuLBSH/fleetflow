# FleetFlow — Project Specification

## 1. Overview

FleetFlow is a full-stack logistics and fleet coordination platform for dispatch teams and drivers. It manages shipments, driver/vehicle assignments, delivery progress, live location updates, delay alerts, and AI-assisted operational recommendations.

The project should demonstrate why **Node.js is a good fit for an event-driven, I/O-heavy application**. Its main differentiators are real-time updates, many concurrent client connections, asynchronous background jobs, and a shared TypeScript ecosystem across the frontend and backend.

This is a portfolio project. Prioritize a reliable, demonstrable vertical slice over a large feature set.

## 2. Product goals

1. Let authenticated users perform actions permitted by their role.
2. Let dispatchers create shipments and assign available drivers and vehicles.
3. Let drivers update delivery progress and submit location updates.
4. Push relevant shipment and location changes to authorized clients in real time.
5. Detect potential delays with deterministic rules and notify dispatchers.
6. Use an LLM to explain detected delays and suggest next steps, with a human making consequential decisions.
7. Demonstrate production-minded engineering: validation, authorization, tests, idempotent jobs, logging, and deployment documentation.

## 3. Roles and access

### Dispatcher
- View and manage shipments within their organization.
- View drivers and vehicles within their organization.
- Assign eligible drivers and vehicles to shipments.
- View live tracking and shipment history.
- Request AI explanations and recommendations.
- Receive delay and operational notifications.

### Driver
- View shipments assigned to them.
- Update permitted shipment statuses.
- Send location updates while on an assigned delivery.
- Record delivery completion and proof where implemented.
- Cannot access another driver's shipments or private data.

### Administrator
- Manage users and organization-level settings.
- View organization-wide operational information.
- Cannot access another organization unless explicitly granted a platform-admin capability.

All authorization must be enforced by the backend. Hiding UI controls is not authorization.

## 4. MVP scope

### Phase 1 — Foundation
- React + TypeScript + Vite frontend.
- Node.js + Express + TypeScript backend.
- MongoDB connection using Mongoose.
- Environment validation, request logging, centralized error handling.
- `GET /api/health`.
- Frontend API client and a page that checks backend health.

### Phase 2 — Authentication and authorization
- Registration or administrator-created users.
- Login, logout, session/refresh handling, and current-user endpoint.
- Password hashing using Argon2id or bcrypt.
- Role-based and organization-scoped authorization.
- Rate limiting and authentication tests.

### Phase 3 — Logistics management
- CRUD for shipments, drivers, and vehicles as appropriate to role.
- Assignment workflow with validation.
- Shipment status history.
- Pagination, filtering, and consistent API errors.

### Phase 4 — Real-time tracking
- Socket.IO connection authenticated by the backend.
- Server-authorized rooms scoped to organizations and resources.
- Driver location simulator for local development.
- Latest known location and timestamp stored separately from historical location records.
- Live map or a tracking dashboard with live coordinates/status.

### Phase 5 — Delay detection and AI
- Deterministic delay rules based on ETA, expected delivery time, or simulated conditions.
- BullMQ background jobs backed by Redis.
- Routing/ETA provider integration behind a service interface; a mock provider is acceptable initially.
- LLM analysis only after a rule or operator action identifies a problem.
- Structured AI output validated by a schema.
- Human approval required for consequential actions.

### Phase 6 — Hardening
- Unit and integration tests for critical workflows.
- Structured logs and request/correlation IDs.
- Idempotent job handlers and retry/backoff.
- Docker setup and CI checks.
- README setup instructions, architecture decisions, and demo walkthrough.

## 5. Explicitly out of scope for the first version

- Microservices.
- Kafka or another distributed event broker.
- Kubernetes.
- A custom machine-learning model.
- Fully autonomous dispatch or route changes.
- Billing, payments, payroll, and complex inventory.
- Production-grade driver background tracking on every mobile platform.

Add these only if a clear requirement emerges.

## 6. Technology decisions

- **Frontend:** React, TypeScript, Vite, React Router.
- **Backend:** Node.js, Express, TypeScript.
- **Database:** MongoDB with Mongoose.
- **Validation:** Zod (or one consistent validation library).
- **Real time:** Socket.IO.
- **Background jobs:** BullMQ + Redis, introduced in the relevant phase.
- **Testing:** Vitest and Supertest; frontend tests as needed.
- **AI:** provider-neutral service wrapper with a structured-output contract.
- **Deployment:** Docker and GitHub Actions when the MVP works.

Prefer a modular monolith with a separately runnable worker process. Do not split into microservices without a demonstrated need.

## 7. Why Node.js for this project?

FleetFlow has many I/O-heavy operations: API requests, database access, socket connections, external routing calls, LLM API calls, and notifications. Node.js's event-driven runtime and non-blocking I/O are a natural fit for coordinating these operations, and TypeScript can be shared across the React and Express codebases.

Do not claim that Node.js is always faster than Python. An async Python framework can also handle concurrent I/O well. The project should justify Node.js through its workload, real-time architecture, tooling, and shared TypeScript—not through an inaccurate language-performance claim.

CPU-heavy work and model inference should be delegated to worker processes or an external service if they become necessary.

## 8. Non-functional requirements

- Validate all external input.
- Apply authentication and authorization on every protected endpoint and socket event.
- Never trust client-supplied role, user ID, organization ID, or room name without server-side verification.
- Keep secrets out of source control; provide `.env.example` only.
- Use consistent error response shapes and avoid leaking stack traces in production.
- Avoid logging passwords, tokens, or sensitive payloads.
- Use pagination for potentially large lists.
- Make background jobs retry-safe and idempotent.
- Avoid calling an LLM or routing API for every GPS update.
- Document any mocked service or known limitation honestly.

## 9. Definition of done for a feature

A feature is done when:
1. Its acceptance criteria are met.
2. Input validation and authorization are implemented.
3. Relevant tests pass.
4. Existing build/type-check checks pass.
5. API and environment documentation is updated.
6. `IMPLEMENTATION_STATUS.md` reflects the actual state.
7. No unrelated files were rewritten without a reason.
