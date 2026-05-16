# DropSign Platform v1 Master Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the full Channel Talk-style DropSign platform as a separate cloud monorepo while keeping the existing `drop-sign` SDK focused on browser signing and placement.

**Architecture:** The implementation lives in a sibling monorepo at `/Users/minjun/Documents/dropsign-cloud`. The cloud repo uses a TypeScript pnpm workspace with `apps/api`, `apps/web`, `apps/widget`, `apps/worker`, and shared packages for config, database, domain logic, UI, and test helpers. Each phase produces working, tested software and commits independently.

**Tech Stack:** TypeScript, pnpm workspaces, Fastify, Next.js App Router, Prisma, PostgreSQL, Zod, BullMQ-compatible worker boundaries, Vitest, Playwright, pdf-lib, S3-compatible object storage, HMAC webhook signatures, Stripe-compatible billing integration.

---

## Source Spec

Read the approved design before executing any phase:

- `/Users/minjun/Documents/drop-sign/docs/superpowers/specs/2026-05-12-dropsign-full-platform-v1-design.md`

The current SDK repo remains at:

- `/Users/minjun/Documents/drop-sign`

The new cloud platform repo is created at:

- `/Users/minjun/Documents/dropsign-cloud`

Creating the sibling repo requires filesystem approval when implementation starts because it is outside the current writable root.

## Phase Files

Execute phases in order. Independent UI polish inside a phase can be parallelized, but cross-phase contracts must land before downstream phases begin.

1. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-01-cloud-foundation.md`
2. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-02-widget-platform.md`
3. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-03-dashboard-foundation.md`
4. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-04-documents-templates-pdf.md`
5. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-05-public-link-signing.md`
6. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-06-multi-signer-routing.md`
7. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-07-email-notifications-reminders.md`
8. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-08-webhook-api-management.md`
9. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-09-audit-exports-admin.md`
10. `/Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-10-billing-plans-usage.md`

## Shared Monorepo Layout

All phases use this target file layout unless a phase file explicitly extends it:

```text
/Users/minjun/Documents/dropsign-cloud/
  apps/
    api/
      src/
        app.ts
        server.ts
        routes/
        plugins/
        modules/
      test/
    web/
      app/
      components/
      lib/
      tests/
    widget/
      src/
      test/
      vite.config.ts
    worker/
      src/
      test/
  packages/
    config/
      src/index.ts
    db/
      prisma/schema.prisma
      src/client.ts
    domain/
      src/
    email/
      src/
    storage/
      src/
    testkit/
      src/
    ui/
      src/
  package.json
  pnpm-workspace.yaml
  tsconfig.base.json
  vitest.config.ts
  playwright.config.ts
  eslint.config.js
  prettier.config.js
```

## Shared Commands

Use these commands once Phase 01 creates the monorepo:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm install
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
```

Expected final result after each phase: all commands pass, plus phase-specific Playwright or worker tests.

## Cross-Phase Contract Rules

- API route wiring is standardized as `apps/api/src/app.ts` exporting `buildApiApp(...)` for tests and dependency injection. `apps/api/src/server.ts` is only the runtime `listen` wrapper, and `apps/api/src/index.ts` may re-export public app types.
- Later phases must append route/plugin registration to the existing `buildApiApp` path. Do not replace `apps/api/src/app.ts` with a snippet that drops routes from earlier phases.
- Shared packages used in later phases are bootstrapped in Phase 01 with manifests, tsconfigs, and empty exports. Later phases add source files to those packages instead of creating incompatible package boundaries.
- Under `moduleResolution: "NodeNext"`, local relative TypeScript imports must use emitted JavaScript extensions such as `./foo.js` and `../modules/foo.js`. Package imports remain extensionless.
- Prisma schema changes are cumulative. Preserve existing fields, relations, indexes, and enum values unless a phase explicitly includes a migration and code updates for renaming or removing them.
- The browser SDK dependency name is `drop-sign` for this plan set. Do not use `@dropsign/sdk` unless a separate package rename/publish phase has already landed.
- Public project keys are not secrets. Server API keys are secrets and must be stored hashed.
- Browser-provided identity values are hints only. They never authorize signer, request, or document binding.
- Any widget flow that binds to an existing signer, request, or document requires a backend-minted `WidgetSession`.
- The stable `widget.js` bootstrap must use no-cache or short-cache headers. Versioned widget assets may be immutable.
- Webhook delivery failures are internal dashboard/audit events. They must not emit customer-facing `webhook.failed` events.
- Every workspace-owned row includes `workspaceId`; every project-owned row includes `projectId` where relevant.
- Every externally retried operation uses an idempotency key or stable event id.

## Execution Checklist

- [x] **Step 1: Confirm working tree before implementation**

Run:

```bash
cd /Users/minjun/Documents/drop-sign
git status --short
```

Expected: only user-approved plan/doc changes are present. Do not revert unrelated changes such as `tsup.config.ts`.

- [x] **Step 2: Create or enter isolated implementation workspace**

Use `superpowers:using-git-worktrees` if implementing inside an existing repo. If creating the sibling cloud repo, request approval to write `/Users/minjun/Documents/dropsign-cloud`.

- [x] **Step 3: Execute Phase 01**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-01-cloud-foundation.md
```

Expected: cloud foundation lands with auth, workspace, project, base schema, and tests.

- [x] **Step 4: Execute Phase 02**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-02-widget-platform.md
```

Expected: installable widget flow lands with config fetch, safe runtime context, and artifact ingest.

- [x] **Step 5: Execute Phase 03**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-03-dashboard-foundation.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: dashboard shell, workspace/project settings, auth-protected navigation, and dashboard tests land green and committed.

- [x] **Step 6: Execute Phase 04**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-04-documents-templates-pdf.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: document upload, template/field editing, PDF generation/storage, and related tests land green and committed.

- [x] **Step 7: Execute Phase 05**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-05-public-link-signing.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: public signing links, signer verification, signature capture, completion flow, and tests land green and committed.

- [x] **Step 8: Execute Phase 06**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-06-multi-signer-routing.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: ordered and parallel multi-signer routing, recipient state transitions, reminder integration points, and tests land green and committed.

- [x] **Step 9: Execute Phase 07**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-07-email-notifications-reminders.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: email delivery adapter, notification templates, reminder scheduling, delivery logs, and tests land green and committed.

- [x] **Step 10: Execute Phase 08**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-08-webhook-api-management.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: API key management, webhook endpoint CRUD, HMAC delivery/retry logs, and tests land green and committed.

- [x] **Step 11: Execute Phase 09**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-09-audit-exports-admin.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: audit timelines, complete workspace exports, export request/download UI, retention jobs, failed job visibility, support-admin RBAC, and tests land green and committed.

- [x] **Step 12: Execute Phase 10**

Open:

```bash
less /Users/minjun/Documents/drop-sign/docs/superpowers/plans/2026-05-12-dropsign-platform-v1-phase-10-billing-plans-usage.md
```

Run this after the phase:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

Expected: billing plans, usage metering, quota enforcement, subscription state handling, and tests land green and committed.

- [x] **Step 13: Final full-platform verification**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm e2e
pnpm --filter @dropsign/widget test:browser
pnpm --filter @dropsign/e2e test
```

Expected: all checks pass. Playwright covers widget install, dashboard setup, template creation, public signing, multi-signer routing, webhook delivery logs, audit export, and billing quota enforcement.

- [x] **Step 14: Commit the completed implementation**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git status --short
git add .
git commit -m "feat: implement dropsign platform v1"
```

Expected: final commit contains only the platform implementation in `dropsign-cloud`.
