# DropSign Full Platform v1 Design

**Date:** 2026-05-12  
**Status:** Draft for user review  
**Scope:** Channel Talk-style signature platform

---

## Overview

DropSign v1 is a full signature operations platform, not only a browser SDK.
It gives three customer groups a single shared product surface:

- Developers install a website widget with a project key, call APIs, and receive webhooks.
- Operators configure projects, widgets, documents, templates, signers, billing, and logs from a dashboard.
- Non-developers create signing links and send documents without writing code.

The existing `drop-sign` package remains the browser signing and placement engine.
The cloud product is a separate full-stack application that consumes the SDK.

---

## Product Principles

1. **One install, many workflows.** A customer should be able to add DropSign to a site once and then control behavior from the dashboard.
2. **Every signature creates an operational record.** Widget signing, link signing, API signing, and template signing all produce the same event, audit, artifact, and webhook model.
3. **SDK stays small.** The SDK captures signatures and placement. Account, document, webhook, billing, template, and notification logic live in DropSign Cloud.
4. **Do not overclaim legal status.** v1 records practical audit evidence, document hashes, signer metadata, and event timelines, but it does not claim regulated qualified e-signature certification.
5. **API-first internals.** Dashboard and public signing pages use the same backend APIs exposed to external developers where safe.

---

## System Architecture

### Applications

| Application | Responsibility |
|---|---|
| `drop-sign` SDK | Existing TypeScript SDK for signature drawing, placement UI, and normalized placement output. |
| Widget loader | CDN-served script installed on customer websites. Loads project configuration and boots the SDK. |
| Dashboard app | Authenticated web app for workspaces, projects, widgets, documents, templates, signers, logs, billing, and team settings. |
| Public signing app | Tokenized signing pages for external recipients. Supports links, multi-signer routing, and document completion. |
| API service | Tenant-aware REST API for dashboard, widget, public signing, and external developer integrations. |
| Worker service | Background jobs for PDF generation, email, reminders, webhook delivery, audit sealing, usage aggregation, and cleanup. |
| Admin/support console | Internal-only support view for account lookup, event inspection, failed jobs, and abuse handling. |

### Infrastructure

| Component | Decision |
|---|---|
| Primary database | PostgreSQL. Stores tenant data, metadata, statuses, audit records, and webhook delivery state. |
| Object storage | Private S3-compatible bucket. Stores original PDFs, completed PDFs, signature images, and exports. |
| Queue | Redis-backed queue or managed job queue. Used for emails, webhooks, PDF rendering, reminders, and billing usage jobs. |
| CDN | Serves `widget.js` and versioned widget assets with long cache lifetimes. |
| Email provider | Sends signing requests, reminders, completion notices, and operational alerts. |
| Billing provider | Stripe-compatible subscription, plan, usage, and invoice lifecycle. |
| Observability | Structured logs, metrics, traces, job dashboards, and error tracking for API, widget, and workers. |

The cloud application should live outside the current SDK package. A separate monorepo such as
`dropsign-cloud` can consume the published SDK package and keep product services, dashboard code,
and infrastructure together.

---

## Core Domain Model

| Entity | Purpose |
|---|---|
| `Workspace` | Billing and team boundary. Owns projects, members, documents, templates, and usage. |
| `Member` | Authenticated dashboard user with workspace role. |
| `Project` | Installable unit with public project key, widget settings, API keys, webhooks, and environments. |
| `ProjectApiKey` | Server API credential. Stored hashed; shown once on creation. |
| `WidgetConfig` | Button position, color, labels, page targeting, mobile behavior, custom trigger rules, and enabled workflows. |
| `Document` | Uploaded source document and generated completed document state. |
| `Template` | Reusable document layout with fields, roles, routing defaults, and message defaults. |
| `Field` | Signature, initials, date, name, text, checkbox, or metadata-backed value with page and normalized placement. |
| `SigningRequest` | A sendable signing workflow created from a document, template, widget event, API call, or dashboard action. |
| `Signer` | Recipient identity, role, routing order, status, auth token, and signer metadata. |
| `SignatureArtifact` | Signature image, placement, field values, generated PDF references, hashes, and completion metadata. |
| `AuditEvent` | Append-only timeline record for request creation, viewing, signing, completion, webhook delivery, and document generation. |
| `WebhookEndpoint` | Project-level endpoint with secret, subscribed events, enabled state, and delivery policy. |
| `WebhookDelivery` | Attempt log, response status, response body excerpt, retry count, and final state. |
| `Subscription` | Plan, limits, billing state, renewal data, and account restrictions. |
| `UsageRecord` | Counted billable events: signatures, documents, API calls, storage, seats, and webhook volume. |

---

## User Surfaces

### Website Widget

Customers install:

```html
<script
  src="https://cdn.dropsign.example/widget.js"
  data-project-key="pk_live_example"
  async
></script>
```

The loader fetches project configuration, renders a floating button or attaches to custom triggers,
starts the SDK signing flow, then submits signature artifacts to the API. It supports:

- Floating button position, color, label, and mobile placement.
- Custom trigger selectors such as `[data-dropsign-trigger]`.
- Page targeting rules based on path, host, and query.
- Runtime identity via `window.DropSign.identify({ userId, email, name, metadata })`.
- Runtime document context via `window.DropSign.setContext({ documentId, requestId, metadata })`.
- Client callbacks: `onReady`, `onOpen`, `onComplete`, `onCancel`, `onError`.

### Dashboard

The dashboard includes:

- Auth, workspace creation, workspace switcher, member invites, roles, and permissions.
- Project list, environments, project keys, server API keys, and install snippets.
- Widget visual settings, page targeting, custom trigger settings, and preview.
- Document upload, document detail, source/completed file download, and retention controls.
- Template builder for fields, signer roles, routing, and reusable messages.
- Signing request creation for link signing and email-based signing.
- Signature records, signer status, audit timeline, webhook deliveries, failed jobs, and exports.
- Billing plan, usage, invoices, payment method, quota alerts, and upgrade/downgrade flows.
- Internal support-facing diagnostics guarded by admin-only permissions.

### Public Signing

External signers receive a secure tokenized URL. The page:

- Shows document context, required fields, signer identity, and signing progress.
- Uses the SDK for drawing signatures and placing or filling assigned fields.
- Enforces signer role and required field completion.
- Supports sequential or parallel routing.
- Shows completion state and a signer download link when project settings allow recipients to download completed documents.

### API And Webhooks

The server API supports:

- Project configuration lookup for widgets.
- Signing request creation, cancellation, resend, and status fetch.
- Document upload, template creation, field creation, and completed document download.
- API keys, webhook endpoint management, usage summary, and audit fetches.

Webhooks cover:

- `signature.started`
- `signature.completed`
- `signature.cancelled`
- `signing_request.created`
- `signing_request.viewed`
- `signing_request.completed`
- `document.completed`
- `document.failed`
- `webhook.failed`

Webhook payloads include event id, project id, workspace id, request id, document id, signer id,
timestamps, metadata, artifact references, and an HMAC signature header.

---

## Primary Data Flows

### 1. Website Widget Signing

1. Browser loads `widget.js` from the CDN.
2. Loader reads `data-project-key` and calls the config endpoint.
3. API returns public widget settings, allowed origins, enabled workflows, and version flags.
4. Loader verifies current origin and path targeting, then renders the button or attaches custom triggers.
5. User signs with the SDK.
6. Widget posts signature data, normalized placement, runtime identity, and metadata to the API.
7. API creates or updates a `SigningRequest`, stores `SignatureArtifact`, writes `AuditEvent`, and enqueues document/webhook/email jobs.
8. Widget receives a completion response and fires client callbacks.

### 2. Dashboard Template Creation

1. Member uploads a PDF.
2. API stores the original in private object storage and creates a `Document`.
3. Dashboard opens the template builder.
4. Member places fields with normalized page coordinates, assigns each field to a signer role, and saves a `Template`.
5. Future requests created from the template inherit fields, routing, messages, and defaults.

### 3. Link Signing

1. Member creates a signing request from a document or template.
2. API creates `SigningRequest` and `Signer` rows with secure tokens.
3. Worker sends email invitations when enabled.
4. Signer opens the public signing URL.
5. Public app validates token, signer status, routing order, and expiry.
6. Signer completes required fields.
7. API stores artifacts, advances routing, and completes the request when all signers are done.

### 4. Multi-Signer Routing

`SigningRequest.routingMode` is either `parallel` or `sequential`.

- In `parallel`, all signers can sign immediately.
- In `sequential`, only the lowest incomplete routing order can sign.
- Fields are assigned to signer roles. A signer can only fill fields assigned to their role.
- Request completion requires every required signer and required field to be complete.

### 5. Completed Document Generation

1. Completion event enqueues a PDF generation job.
2. Worker loads source PDF, template fields, signer values, and signature artifacts.
3. Worker applies signatures and field values to a new PDF.
4. Worker calculates document hash, stores the completed PDF, updates `Document` and `SigningRequest`, and appends audit events.
5. Completion email and webhook jobs run after the completed PDF is stored.

### 6. Webhook Delivery

1. Domain event creates webhook delivery rows for matching endpoints.
2. Worker signs each payload with endpoint secret.
3. Worker sends request with timeout and records status, latency, and response excerpt.
4. Failed deliveries retry with exponential backoff and a maximum attempt policy.
5. Dashboard exposes delivery history and manual resend.

### 7. Billing And Usage

1. API records usage at the moment signatures, documents, API calls, storage, seats, and webhooks are consumed.
2. Worker aggregates usage into billing-period summaries.
3. Billing provider webhooks update subscription state.
4. API enforces plan limits and returns actionable upgrade errors when limits are exceeded.

---

## Security And Privacy

- Tenant isolation is enforced by `workspaceId` on every workspace-owned entity.
- Dashboard access uses role-based permissions: owner, admin, developer, member, viewer, support-admin.
- Public project keys are not secrets; server API keys are secrets and stored hashed.
- Signing links use high-entropy tokens, expiry, single-signer scope, and revocation state.
- Uploaded files are private by default and served through short-lived signed URLs.
- Webhooks include HMAC signatures and event ids for replay protection.
- API endpoints use rate limits by workspace, project, API key, IP, and token.
- Widget config endpoint validates allowed origins.
- Object uploads validate MIME type, file size, page count, and PDF parseability.
- Audit events are append-only at the application layer.
- Data retention, export, and deletion are workspace-level settings.
- Admin/support access is logged as audit events.

---

## Error Handling

| Failure | Behavior |
|---|---|
| Widget config fetch fails | Widget stays hidden, logs safe client error, calls `onError` if registered. |
| Origin not allowed | Widget does not boot and records a rejected config access event. |
| Signature upload fails | Widget keeps local completion state, exposes retry while the page is open, and records the failure if the API was reached. |
| Invalid signing token | Public signing page shows expired or invalid link state without leaking document data. |
| Signer signs out of order | API rejects with routing error and public page shows waiting state. |
| Required fields missing | Client prevents submit; API revalidates before accepting. |
| PDF generation fails | Request moves to `document_failed`, records job error, dashboard exposes retry. |
| Email send fails | Worker retries; dashboard shows failed notification and manual resend. |
| Webhook delivery fails | Worker retries; endpoint can be disabled after repeated failures; dashboard shows attempts. |
| Billing limit exceeded | API blocks billable action with upgrade-required response and records quota event. |
| Duplicate callback/API retry | Idempotency keys and event ids prevent duplicate signing artifacts and webhook events. |

---

## Testing Strategy

### SDK

- Keep existing Vitest coverage for signature modal, triggers, placement, cleanup, messages, and options.
- Add integration tests for widget callbacks that consume SDK results.

### Widget

- Browser tests for loader boot, allowed origins, page targeting, custom triggers, mobile position, callbacks, and config fetch failure.
- Contract tests for config response shape and artifact upload payload.

### API

- Unit tests for domain transitions: request creation, signer routing, required field validation, completion, cancellation, revocation, and quotas.
- Integration tests with PostgreSQL for tenant isolation, API keys, webhook endpoints, audit events, and usage recording.
- Idempotency tests for duplicate uploads, duplicate job runs, billing webhooks, and webhook retries.

### Dashboard

- Component tests for settings forms, template builder state, signer routing UI, webhook logs, and billing states.
- End-to-end tests for project creation, install snippet copy, widget settings update, document upload, template creation, request creation, and record inspection.

### Public Signing

- End-to-end tests for link open, required field completion, multi-signer routing, expired token, revoked token, and completed document download.

### Workers

- PDF golden tests comparing generated output structure, page count, field placement, and hash creation.
- Email provider fake tests for invitation, reminder, completion, and failure paths.
- Webhook delivery tests for signing header, timeout, retry schedule, manual resend, and disabled endpoint behavior.
- Billing tests for plan limit enforcement, usage aggregation, subscription webhook idempotency, and downgrade restrictions.

---

## Release Structure

Full Platform v1 is one product scope, but implementation should be delivered as ordered modules:

1. Cloud foundation: auth, workspace, project, database, storage, API shell.
2. Widget platform: CDN loader, project config, widget settings, SDK boot, signature event ingest.
3. Dashboard foundation: project setup, install guide, widget settings, signature records.
4. Document and template system: upload, fields, builder, template save, completed PDF generation.
5. Link signing and public signing app.
6. Multi-signer routing.
7. Email notifications and reminders.
8. Webhook/API management and delivery logs.
9. Audit timeline, exports, retention, and admin support tools.
10. Billing, plans, quotas, and usage enforcement.

Each module must ship with database migrations, API contracts, dashboard flows, worker jobs where needed,
and tests before moving to the next module.

---

## Acceptance Criteria

DropSign Full Platform v1 is complete when:

- A developer can create a project, install the script tag, identify a user, collect a signature, and receive a webhook.
- An operator can configure widget appearance, page targeting, and mobile behavior without changing site code.
- A non-developer can upload a PDF, place fields, create a signing link, and receive a completed document.
- A workspace can invite team members, assign roles, view audit timelines, and inspect failed jobs.
- A request can support multiple signers with parallel or sequential routing.
- Completed PDFs are generated, hashed, stored, downloadable, and linked from audit records.
- Webhook delivery includes signed payloads, retries, logs, and manual resend.
- Email invitations, reminders, completion notices, and failure notifications work.
- Billing plans, usage limits, invoices, and quota enforcement work.
- Tests cover SDK, widget, API, dashboard, public signing, workers, billing, and security-sensitive flows.
