# DropSign Platform v1 Phase 09 Audit Exports And Admin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add append-only audit timelines, workspace exports, retention controls, failed job visibility, and an internal admin support console.

**Architecture:** Audit writes are centralized in `packages/domain` and `apps/api` so dashboard, public signing, widget ingest, workers, and admin actions share one event shape. Export and retention work runs through `apps/worker` jobs that read tenant-scoped data and write generated artifacts to object storage. Admin/support views use separate support-admin permissions and log every support access as audit events.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Next.js App Router, Vitest, Playwright, object storage package from Phase 01, worker job adapter from earlier phases.

---

## Task 1: Harden Audit Event Domain And Schema

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/audit.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/audit-domain.test.ts`

- [ ] **Step 1: Write the failing audit domain test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/audit-domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  AUDIT_EVENT_TYPES,
  createAuditEventInput,
  isSupportAuditEvent,
} from '@dropsign/domain/audit';

describe('audit domain', () => {
  it('defines user, document, webhook, billing, and support event types', () => {
    expect(AUDIT_EVENT_TYPES).toContain('signing_request.created');
    expect(AUDIT_EVENT_TYPES).toContain('signature.completed');
    expect(AUDIT_EVENT_TYPES).toContain('document.completed');
    expect(AUDIT_EVENT_TYPES).toContain('webhook.delivery_failed');
    expect(AUDIT_EVENT_TYPES).toContain('support.workspace_viewed');
  });

  it('normalizes append-only audit event input', () => {
    const input = createAuditEventInput({
      workspaceId: 'wrk_1',
      projectId: 'proj_1',
      actorType: 'member',
      actorId: 'mem_1',
      type: 'signature.completed',
      targetType: 'signing_request',
      targetId: 'req_1',
      metadata: { signerId: 'signer_1' },
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });

    expect(input).toEqual({
      workspaceId: 'wrk_1',
      projectId: 'proj_1',
      actorType: 'member',
      actorId: 'mem_1',
      type: 'signature.completed',
      targetType: 'signing_request',
      targetId: 'req_1',
      metadata: { signerId: 'signer_1' },
      ipAddress: '127.0.0.1',
      userAgent: 'Vitest',
    });
  });

  it('recognizes support access event types', () => {
    expect(isSupportAuditEvent('support.workspace_viewed')).toBe(true);
    expect(isSupportAuditEvent('signature.completed')).toBe(false);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/audit-domain.test.ts
```

Expected: FAIL with a module resolution error for `@dropsign/domain/audit`.

- [ ] **Step 3: Add audit domain module**

Create `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/audit.ts`:

```ts
export const AUDIT_EVENT_TYPES = [
  'workspace.created',
  'member.invited',
  'project.created',
  'widget.config_updated',
  'signing_request.created',
  'signing_request.viewed',
  'signature.started',
  'signature.completed',
  'signature.cancelled',
  'document.uploaded',
  'document.completed',
  'document.failed',
  'webhook.delivery_succeeded',
  'webhook.delivery_failed',
  'billing.subscription_updated',
  'billing.quota_exceeded',
  'support.workspace_viewed',
  'support.document_viewed',
  'support.job_retried',
] as const;

export type AuditEventType = (typeof AUDIT_EVENT_TYPES)[number];

export const AUDIT_ACTOR_TYPES = ['system', 'member', 'signer', 'api_key', 'widget', 'support_admin'] as const;

export type AuditActorType = (typeof AUDIT_ACTOR_TYPES)[number];

export interface AuditEventInput {
  workspaceId: string;
  projectId?: string | null;
  actorType: AuditActorType;
  actorId?: string | null;
  type: AuditEventType;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

export function createAuditEventInput(input: AuditEventInput): AuditEventInput {
  return {
    workspaceId: input.workspaceId,
    projectId: input.projectId ?? null,
    actorType: input.actorType,
    actorId: input.actorId ?? null,
    type: input.type,
    targetType: input.targetType,
    targetId: input.targetId,
    metadata: input.metadata,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
  };
}

export function isSupportAuditEvent(type: AuditEventType): boolean {
  return type.startsWith('support.');
}
```

- [ ] **Step 4: Extend Prisma audit model**

Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma` so `AuditEvent` has this shape:

```prisma
model AuditEvent {
  id          String   @id @default(cuid())
  workspaceId String
  projectId   String?
  actorType   String
  actorId     String?
  type        String
  targetType  String
  targetId    String
  metadata    Json
  ipAddress   String?
  userAgent   String?
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@index([workspaceId, createdAt])
  @@index([projectId, createdAt])
  @@index([targetType, targetId])
  @@index([type, createdAt])
}
```

Ensure `Workspace` and `Project` include relation fields:

```prisma
model Workspace {
  auditEvents AuditEvent[]
}

model Project {
  auditEvents AuditEvent[]
}
```

- [ ] **Step 5: Run the test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/api/test/audit-domain.test.ts
```

Expected: Prisma generation succeeds and the audit domain test passes.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma packages/domain/src/audit.ts apps/api/test/audit-domain.test.ts
git commit -m "feat: harden audit event domain"
```

Expected: commit succeeds.

## Task 2: Add Audit Write And Timeline APIs

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/audit/audit-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/audit/audit-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/audit-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing API test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/audit-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app';

describe('audit routes', () => {
  it('lists tenant-scoped audit events newest first', async () => {
    const db = {
      auditEvent: {
        findMany: vi.fn(async () => [
          {
            id: 'aud_2',
            type: 'signature.completed',
            targetType: 'signing_request',
            targetId: 'req_1',
            createdAt: new Date('2026-05-13T01:00:00.000Z'),
            metadata: { signerId: 'signer_1' },
          },
        ]),
      },
    };
    const app = await buildApiApp({
      db,
      auth: {
        requireSession: vi.fn(async () => ({
          user: { id: 'user_support_1' },
          member: { id: 'mem_support_1', workspaceId: 'support_workspace', role: 'support_admin' },
        })),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/audit-events?targetType=signing_request&targetId=req_1',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      {
        id: 'aud_2',
        type: 'signature.completed',
        targetType: 'signing_request',
        targetId: 'req_1',
        createdAt: '2026-05-13T01:00:00.000Z',
        metadata: { signerId: 'signer_1' },
      },
    ]);
    expect(db.auditEvent.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'wrk_1',
        targetType: 'signing_request',
        targetId: 'req_1',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/audit-routes.test.ts
```

Expected: FAIL because `/v1/audit-events` is missing.

- [ ] **Step 3: Implement audit service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/audit/audit-service.ts`:

```ts
import { createAuditEventInput } from '@dropsign/domain/audit';
import type { AuditEventInput } from '@dropsign/domain/audit';

interface AuditDb {
  auditEvent: {
    create(args: { data: AuditEventInput }): Promise<unknown>;
    findMany(args: {
      where: Record<string, unknown>;
      orderBy: { createdAt: 'desc' };
      take: number;
    }): Promise<Array<{
      id: string;
      type: string;
      targetType: string;
      targetId: string;
      createdAt: Date;
      metadata: unknown;
    }>>;
  };
}

export async function appendAuditEvent(db: AuditDb, input: AuditEventInput): Promise<void> {
  await db.auditEvent.create({ data: createAuditEventInput(input) });
}

export async function listAuditEvents(input: {
  db: AuditDb;
  workspaceId: string;
  targetType?: string;
  targetId?: string;
}) {
  const where: Record<string, unknown> = { workspaceId: input.workspaceId };
  if (input.targetType) where.targetType = input.targetType;
  if (input.targetId) where.targetId = input.targetId;

  return input.db.auditEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
```

- [ ] **Step 4: Implement audit routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/audit/audit-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { listAuditEvents } from './audit-service';

export async function registerAuditRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/audit-events', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const query = request.query as { targetType?: string; targetId?: string };
    const events = await listAuditEvents({
      db: app.db,
      workspaceId,
      targetType: query.targetType,
      targetId: query.targetId,
    });
    return events.map((event) => ({
      ...event,
      createdAt: event.createdAt.toISOString(),
    }));
  });
}
```

- [ ] **Step 5: Register audit routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`:

```ts
import { registerAuditRoutes } from './modules/audit/audit-routes';

export async function buildApiApp(options: BuildApiAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  await registerCorePlugins(app, options);
  await registerAuditRoutes(app);
  return app;
}
```

- [ ] **Step 6: Run the API test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/audit-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/audit apps/api/src/app.ts apps/api/test/audit-routes.test.ts
git commit -m "feat: expose audit timelines"
```

Expected: commit succeeds.

## Task 3: Add Complete Workspace Export Worker

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/export-workspace.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/export-workspace.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`

- [ ] **Step 1: Write the failing export test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/export-workspace.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runExportWorkspaceJob } from '../src/jobs/export-workspace';

describe('runExportWorkspaceJob', () => {
  it('exports every tenant-scoped workspace record needed for legal portability', async () => {
    const db = {
      signingRequest: {
        findMany: vi.fn(async () => [{ id: 'req_1', status: 'completed' }]),
      },
      document: {
        findMany: vi.fn(async () => [{ id: 'doc_1', objectKey: 'documents/wrk_1/doc_1.pdf' }]),
      },
      signatureArtifact: {
        findMany: vi.fn(async () => [{ id: 'sig_art_1', objectKey: 'signatures/wrk_1/sig_1.png' }]),
      },
      webhookDelivery: {
        findMany: vi.fn(async () => [{ id: 'whd_1', status: 'failed' }]),
      },
      emailDelivery: {
        findMany: vi.fn(async () => [{ id: 'email_1', status: 'delivered' }]),
      },
      template: {
        findMany: vi.fn(async () => [{ id: 'tpl_1', fields: [{ id: 'field_1', type: 'signature' }] }]),
      },
      objectReference: {
        findMany: vi.fn(async () => [{ id: 'obj_1', objectKey: 'documents/wrk_1/doc_1.pdf' }]),
      },
      auditEvent: {
        findMany: vi.fn(async () => [{ id: 'aud_1', type: 'signature.completed' }]),
      },
      exportArtifact: {
        update: vi.fn(async (args) => args),
      },
    };
    const storage = {
      putObject: vi.fn(async () => ({
        key: 'exports/wrk_1/export_1.json',
        sha256: 'hash_123',
        size: 128,
      })),
    };

    await runExportWorkspaceJob({
      db,
      storage,
      exportId: 'export_1',
      workspaceId: 'wrk_1',
    });

    expect(storage.putObject).toHaveBeenCalledWith({
      key: 'exports/wrk_1/export_1.json',
      contentType: 'application/json',
      body: expect.stringContaining('"signatureArtifacts"'),
    });
    const body = JSON.parse(storage.putObject.mock.calls[0][0].body);
    expect(Object.keys(body.records)).toEqual([
      'signingRequests',
      'documents',
      'signatureArtifacts',
      'webhookDeliveries',
      'emailDeliveries',
      'templates',
      'objectReferences',
      'auditEvents',
    ]);
    expect(body.records.documents).toEqual([{ id: 'doc_1', objectKey: 'documents/wrk_1/doc_1.pdf' }]);
    expect(db.document.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'wrk_1' } });
    expect(db.signatureArtifact.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'wrk_1' } });
    expect(db.webhookDelivery.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'wrk_1' } });
    expect(db.emailDelivery.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'wrk_1' } });
    expect(db.template.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'wrk_1' },
      include: { fields: true },
    });
    expect(db.objectReference.findMany).toHaveBeenCalledWith({ where: { workspaceId: 'wrk_1' } });
    expect(db.exportArtifact.update).toHaveBeenCalledWith({
      where: { id: 'export_1' },
      data: {
        status: 'completed',
        objectKey: 'exports/wrk_1/export_1.json',
        sha256: 'hash_123',
        size: 128,
        completedAt: expect.any(Date),
      },
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/export-workspace.test.ts
```

Expected: FAIL because `runExportWorkspaceJob` is missing.

- [ ] **Step 3: Add export artifact schema**

Add this model to `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`:

```prisma
model ExportArtifact {
  id          String   @id @default(cuid())
  workspaceId String
  requestedByMemberId String?
  status      String   @default("queued")
  objectKey   String?
  sha256      String?
  size        Int?
  completedAt DateTime?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
  @@index([status, createdAt])
}
```

Add relation to `Workspace`:

```prisma
model Workspace {
  exportArtifacts ExportArtifact[]
}
```

- [ ] **Step 4: Implement export job**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/export-workspace.ts`:

```ts
interface ExportDb {
  signingRequest: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  document: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  signatureArtifact: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  webhookDelivery: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  emailDelivery: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  template: {
    findMany(args: {
      where: { workspaceId: string };
      include: { fields: true };
    }): Promise<unknown[]>;
  };
  objectReference: {
    findMany(args: { where: { workspaceId: string } }): Promise<unknown[]>;
  };
  auditEvent: {
    findMany(args: { where: { workspaceId: string }; orderBy: { createdAt: 'asc' } }): Promise<unknown[]>;
  };
  exportArtifact: {
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

interface ExportStorage {
  putObject(args: {
    key: string;
    contentType: string;
    body: string;
  }): Promise<{ key: string; sha256: string; size: number }>;
}

export async function runExportWorkspaceJob(input: {
  db: ExportDb;
  storage: ExportStorage;
  exportId: string;
  workspaceId: string;
}): Promise<void> {
  const signingRequests = await input.db.signingRequest.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const documents = await input.db.document.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const signatureArtifacts = await input.db.signatureArtifact.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const webhookDeliveries = await input.db.webhookDelivery.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const emailDeliveries = await input.db.emailDelivery.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const templates = await input.db.template.findMany({
    where: { workspaceId: input.workspaceId },
    include: { fields: true },
  });
  const objectReferences = await input.db.objectReference.findMany({
    where: { workspaceId: input.workspaceId },
  });
  const auditEvents = await input.db.auditEvent.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: 'asc' },
  });

  const body = JSON.stringify(
    {
      workspaceId: input.workspaceId,
      exportedAt: new Date().toISOString(),
      records: {
        signingRequests,
        documents,
        signatureArtifacts,
        webhookDeliveries,
        emailDeliveries,
        templates,
        objectReferences,
        auditEvents,
      },
    },
    null,
    2,
  );
  const stored = await input.storage.putObject({
    key: `exports/${input.workspaceId}/${input.exportId}.json`,
    contentType: 'application/json',
    body,
  });

  await input.db.exportArtifact.update({
    where: { id: input.exportId },
    data: {
      status: 'completed',
      objectKey: stored.key,
      sha256: stored.sha256,
      size: stored.size,
      completedAt: new Date(),
    },
  });
}
```

- [ ] **Step 5: Run the export test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/worker/test/export-workspace.test.ts
```

Expected: Prisma generation succeeds and test passes.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma apps/worker/src/jobs/export-workspace.ts apps/worker/test/export-workspace.test.ts
git commit -m "feat: export workspace records"
```

Expected: commit succeeds.

## Task 4: Add Export Request, List, And Signed Download APIs

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/exports/export-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/export-routes.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/settings/exports/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/settings/export-list.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/export-list.test.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing export API test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/export-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app';

describe('export routes', () => {
  it('creates tenant-scoped export requests for the authenticated workspace member', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      exportArtifact: {
        create: vi.fn(async ({ data }) => ({ id: 'export_1', ...data })),
      },
    };
    const app = await buildApiApp({
      db,
      queues: { workspaceExports: queue },
      auth: {
        requireSession: vi.fn(async () => ({
          member: { id: 'mem_1', workspaceId: 'wrk_1', role: 'owner' },
        })),
      },
    });

    const response = await app.inject({ method: 'POST', url: '/v1/exports' });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toMatchObject({ id: 'export_1', status: 'queued' });
    expect(db.exportArtifact.create).toHaveBeenCalledWith({
      data: { workspaceId: 'wrk_1', requestedByMemberId: 'mem_1', status: 'queued' },
    });
    expect(queue.add).toHaveBeenCalledWith('workspace.export', {
      exportId: 'export_1',
      workspaceId: 'wrk_1',
    });
  });

  it('lists only exports for the authenticated member workspace', async () => {
    const db = {
      exportArtifact: {
        findMany: vi.fn(async () => [
          { id: 'export_1', status: 'completed', objectKey: 'exports/wrk_1/export_1.json' },
        ]),
      },
    };
    const app = await buildApiApp({
      db,
      auth: {
        requireSession: vi.fn(async () => ({
          member: { id: 'mem_1', workspaceId: 'wrk_1', role: 'admin' },
        })),
      },
    });

    const response = await app.inject({ method: 'GET', url: '/v1/exports' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      { id: 'export_1', status: 'completed', objectKey: 'exports/wrk_1/export_1.json' },
    ]);
    expect(db.exportArtifact.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'wrk_1' },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  it('returns a short-lived signed download URL for a completed tenant export', async () => {
    const db = {
      exportArtifact: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'export_1',
          workspaceId: 'wrk_1',
          status: 'completed',
          objectKey: 'exports/wrk_1/export_1.json',
        })),
      },
    };
    const storage = {
      createSignedDownloadUrl: vi.fn(async () => 'https://storage.example/export_1?sig=abc'),
    };
    const app = await buildApiApp({
      db,
      storage,
      auth: {
        requireSession: vi.fn(async () => ({
          member: { id: 'mem_1', workspaceId: 'wrk_1', role: 'owner' },
        })),
      },
    });

    const response = await app.inject({ method: 'GET', url: '/v1/exports/export_1/download' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      url: 'https://storage.example/export_1?sig=abc',
      expiresInSeconds: 300,
    });
    expect(db.exportArtifact.findFirstOrThrow).toHaveBeenCalledWith({
      where: { id: 'export_1', workspaceId: 'wrk_1', status: 'completed' },
    });
    expect(storage.createSignedDownloadUrl).toHaveBeenCalledWith({
      key: 'exports/wrk_1/export_1.json',
      expiresInSeconds: 300,
    });
  });
});
```

- [ ] **Step 2: Run the export API test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/export-routes.test.ts
```

Expected: FAIL because `/v1/exports` routes are missing.

- [ ] **Step 3: Implement export API routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/exports/export-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';

export async function registerExportRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/exports', async (_, reply) => {
    const session = await app.auth.requireSession();
    const artifact = await app.db.exportArtifact.create({
      data: {
        workspaceId: session.member.workspaceId,
        requestedByMemberId: session.member.id,
        status: 'queued',
      },
    });
    await app.queues.workspaceExports.add('workspace.export', {
      exportId: artifact.id,
      workspaceId: session.member.workspaceId,
    });
    return reply.code(202).send({ id: artifact.id, status: artifact.status });
  });

  app.get('/v1/exports', async () => {
    const session = await app.auth.requireSession();
    return app.db.exportArtifact.findMany({
      where: { workspaceId: session.member.workspaceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  });

  app.get('/v1/exports/:exportId/download', async (request) => {
    const session = await app.auth.requireSession();
    const params = request.params as { exportId: string };
    const artifact = await app.db.exportArtifact.findFirstOrThrow({
      where: {
        id: params.exportId,
        workspaceId: session.member.workspaceId,
        status: 'completed',
      },
    });
    const url = await app.storage.createSignedDownloadUrl({
      key: artifact.objectKey,
      expiresInSeconds: 300,
    });
    return { url, expiresInSeconds: 300 };
  });
}
```

- [ ] **Step 4: Register export routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`:

```ts
import { registerAuditRoutes } from './modules/audit/audit-routes';
import { registerExportRoutes } from './modules/exports/export-routes';

export async function buildApiApp(options: BuildApiAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  await registerCorePlugins(app, options);
  await registerAuditRoutes(app);
  await registerExportRoutes(app);
  return app;
}
```

- [ ] **Step 5: Add export dashboard UI test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/export-list.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ExportList } from '../components/settings/export-list';

describe('ExportList', () => {
  it('shows request, list, and download actions', () => {
    const onRequestExport = vi.fn();
    const onDownload = vi.fn();

    render(
      <ExportList
        exports={[
          { id: 'export_1', status: 'completed', createdAt: '2026-05-13T00:00:00.000Z' },
          { id: 'export_2', status: 'queued', createdAt: '2026-05-13T01:00:00.000Z' },
        ]}
        onRequestExport={onRequestExport}
        onDownload={onDownload}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Request export' }));
    fireEvent.click(screen.getByRole('button', { name: 'Download export_1' }));

    expect(onRequestExport).toHaveBeenCalledOnce();
    expect(onDownload).toHaveBeenCalledWith('export_1');
    expect(screen.getByText('queued')).toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement export dashboard UI**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/settings/export-list.tsx`:

```tsx
interface ExportRow {
  id: string;
  status: string;
  createdAt: string;
}

export function ExportList({
  exports,
  onRequestExport,
  onDownload,
}: {
  exports: ExportRow[];
  onRequestExport: () => void;
  onDownload: (exportId: string) => void;
}) {
  return (
    <section>
      <button type="button" onClick={onRequestExport}>Request export</button>
      <ul>
        {exports.map((artifact) => (
          <li key={artifact.id}>
            <span>{artifact.id}</span>
            <span>{artifact.status}</span>
            {artifact.status === 'completed' ? (
              <button type="button" onClick={() => onDownload(artifact.id)}>
                Download {artifact.id}
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/settings/exports/page.tsx`:

```tsx
import { ExportList } from '../../../components/settings/export-list';

async function requestExport() {
  'use server';
  await fetch(`${process.env.DROPSIGN_API_URL}/v1/exports`, { method: 'POST', cache: 'no-store' });
}

async function downloadExport(exportId: string) {
  'use server';
  const response = await fetch(`${process.env.DROPSIGN_API_URL}/v1/exports/${exportId}/download`, {
    cache: 'no-store',
  });
  return response.json();
}

export default async function WorkspaceExportsPage() {
  const response = await fetch(`${process.env.DROPSIGN_API_URL}/v1/exports`, { cache: 'no-store' });
  const exports = await response.json();
  return <ExportList exports={exports} onRequestExport={requestExport} onDownload={downloadExport} />;
}
```

- [ ] **Step 7: Run export API and UI tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/export-routes.test.ts apps/web/tests/export-list.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/exports apps/api/src/app.ts apps/api/test/export-routes.test.ts apps/web/app apps/web/components/settings apps/web/tests/export-list.test.tsx
git commit -m "feat: add workspace export requests"
```

Expected: commit succeeds.

## Task 5: Add Retention Controls And Failed Job Visibility

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/apply-retention.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/apply-retention.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/operations/operations-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/operations-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing retention worker test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/apply-retention.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runApplyRetentionJob } from '../src/jobs/apply-retention';

describe('runApplyRetentionJob', () => {
  it('deletes expired completed exports and masks expired audit metadata by workspace policy', async () => {
    const now = new Date('2026-05-13T00:00:00.000Z');
    const db = {
      workspaceRetentionSetting: {
        findMany: vi.fn(async () => [
          { workspaceId: 'wrk_1', exportRetentionDays: 7, auditRetentionDays: 365 },
        ]),
      },
      exportArtifact: {
        deleteMany: vi.fn(async () => ({ count: 2 })),
      },
      auditEvent: {
        updateMany: vi.fn(async () => ({ count: 3 })),
      },
    };

    await runApplyRetentionJob({ db, now });

    expect(db.exportArtifact.deleteMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'wrk_1',
        status: 'completed',
        completedAt: { lt: new Date('2026-05-06T00:00:00.000Z') },
      },
    });
    expect(db.auditEvent.updateMany).toHaveBeenCalledWith({
      where: {
        workspaceId: 'wrk_1',
        createdAt: { lt: new Date('2025-05-13T00:00:00.000Z') },
      },
      data: { metadata: { retained: false, reason: 'audit_retention_expired' } },
    });
  });
});
```

- [ ] **Step 2: Add retention and failed job schema**

Add these models to `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`:

```prisma
model WorkspaceRetentionSetting {
  id                  String   @id @default(cuid())
  workspaceId          String   @unique
  exportRetentionDays  Int      @default(30)
  auditRetentionDays   Int      @default(2555)
  createdAt            DateTime @default(now())
  updatedAt            DateTime @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}

model FailedJob {
  id          String   @id @default(cuid())
  workspaceId String?
  queue       String
  jobName     String
  jobId       String
  status      String   @default("failed")
  attempts    Int
  error       String
  payload     Json
  failedAt    DateTime @default(now())
  resolvedAt  DateTime?

  workspace Workspace? @relation(fields: [workspaceId], references: [id], onDelete: SetNull)

  @@index([workspaceId, failedAt])
  @@index([status, failedAt])
}
```

Add relation fields to `Workspace`:

```prisma
model Workspace {
  retentionSetting WorkspaceRetentionSetting?
  failedJobs       FailedJob[]
}
```

- [ ] **Step 3: Implement retention worker job**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/apply-retention.ts`:

```ts
interface RetentionDb {
  workspaceRetentionSetting: {
    findMany(): Promise<Array<{
      workspaceId: string;
      exportRetentionDays: number;
      auditRetentionDays: number;
    }>>;
  };
  exportArtifact: {
    deleteMany(args: { where: Record<string, unknown> }): Promise<{ count: number }>;
  };
  auditEvent: {
    updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  };
}

function daysBefore(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
}

export async function runApplyRetentionJob({ db, now }: { db: RetentionDb; now: Date }) {
  const settings = await db.workspaceRetentionSetting.findMany();
  for (const setting of settings) {
    await db.exportArtifact.deleteMany({
      where: {
        workspaceId: setting.workspaceId,
        status: 'completed',
        completedAt: { lt: daysBefore(now, setting.exportRetentionDays) },
      },
    });
    await db.auditEvent.updateMany({
      where: {
        workspaceId: setting.workspaceId,
        createdAt: { lt: daysBefore(now, setting.auditRetentionDays) },
      },
      data: { metadata: { retained: false, reason: 'audit_retention_expired' } },
    });
  }
}
```

- [ ] **Step 4: Write failed job API test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/operations-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app';

describe('operations routes', () => {
  it('lists failed jobs for the authenticated workspace', async () => {
    const db = {
      failedJob: {
        findMany: vi.fn(async () => [{ id: 'fail_1', queue: 'webhooks', error: '500' }]),
      },
    };
    const app = await buildApiApp({
      db,
      auth: {
        requireSession: vi.fn(async () => ({
          member: { id: 'mem_1', workspaceId: 'wrk_1', role: 'admin' },
        })),
      },
    });

    const response = await app.inject({ method: 'GET', url: '/v1/operations/failed-jobs' });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([{ id: 'fail_1', queue: 'webhooks', error: '500' }]);
    expect(db.failedJob.findMany).toHaveBeenCalledWith({
      where: { workspaceId: 'wrk_1', status: 'failed' },
      orderBy: { failedAt: 'desc' },
      take: 100,
    });
  });
});
```

- [ ] **Step 5: Implement failed job API route and registration**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/operations/operations-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';

export async function registerOperationsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/operations/failed-jobs', async () => {
    const session = await app.auth.requireSession();
    return app.db.failedJob.findMany({
      where: { workspaceId: session.member.workspaceId, status: 'failed' },
      orderBy: { failedAt: 'desc' },
      take: 100,
    });
  });
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`:

```ts
import { registerAuditRoutes } from './modules/audit/audit-routes';
import { registerExportRoutes } from './modules/exports/export-routes';
import { registerOperationsRoutes } from './modules/operations/operations-routes';

export async function buildApiApp(options: BuildApiAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  await registerCorePlugins(app, options);
  await registerAuditRoutes(app);
  await registerExportRoutes(app);
  await registerOperationsRoutes(app);
  return app;
}
```

- [ ] **Step 6: Run retention and failed job tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/worker/test/apply-retention.test.ts apps/api/test/operations-routes.test.ts
```

Expected: Prisma generation succeeds and both tests pass.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma apps/worker/src/jobs/apply-retention.ts apps/worker/test/apply-retention.test.ts apps/api/src/modules/operations apps/api/test/operations-routes.test.ts apps/api/src/app.ts
git commit -m "feat: add retention and failed job operations"
```

Expected: commit succeeds.

## Task 6: Add Internal Support Admin Console

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/admin/admin-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/admin-routes.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(admin)/support/workspaces/[workspaceId]/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/admin/support-workspace-summary.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/support-workspace-summary.test.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing admin API test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/admin-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app';

describe('admin routes', () => {
  it('allows support-admin to view workspace diagnostics and logs access', async () => {
    const db = {
      workspaceMember: {
        findFirst: vi.fn(async () => ({
          id: 'mem_support_1',
          workspaceId: 'support_workspace',
          userId: 'user_support_1',
          role: 'support_admin',
        })),
      },
      workspace: {
        findUniqueOrThrow: vi.fn(async () => ({ id: 'wrk_1', name: 'Acme' })),
      },
      auditEvent: {
        create: vi.fn(async ({ data }) => ({ id: 'aud_1', ...data })),
      },
    };
    const app = await buildApiApp({
      db,
      auth: {
        requireSession: vi.fn(async () => ({
          user: { id: 'user_1' },
          member: { id: 'mem_1', workspaceId: 'wrk_1', role: 'admin' },
        })),
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/workspaces/wrk_1',
      cookies: { session: 'valid-support-session' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ id: 'wrk_1', name: 'Acme' });
    expect(db.workspaceMember.findFirst).toHaveBeenCalledWith({
      where: { userId: 'user_support_1', role: 'support_admin' },
    });
    expect(db.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        workspaceId: 'wrk_1',
        actorType: 'support_admin',
        actorId: 'mem_support_1',
        type: 'support.workspace_viewed',
      }),
    });
  });

  it('rejects non-support roles', async () => {
    const db = {
      workspaceMember: {
        findFirst: vi.fn(async () => ({
          id: 'mem_1',
          workspaceId: 'wrk_1',
          userId: 'user_1',
          role: 'admin',
        })),
      },
    };
    const app = await buildApiApp({ db });
    const response = await app.inject({
      method: 'GET',
      url: '/v1/admin/workspaces/wrk_1',
      cookies: { session: 'valid-member-session' },
    });

    expect(response.statusCode).toBe(403);
  });
});
```

- [ ] **Step 2: Run the admin API test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/admin-routes.test.ts
```

Expected: FAIL because admin routes are missing.

- [ ] **Step 3: Implement admin routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/admin/admin-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { appendAuditEvent } from '../audit/audit-service';

export async function registerAdminRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/admin/workspaces/:workspaceId', async (request, reply) => {
    const session = await app.auth.requireSession(request);
    const supportMember = await app.db.workspaceMember.findFirst({
      where: {
        userId: session.user.id,
        role: 'support_admin',
      },
    });
    if (!supportMember) {
      return reply.code(403).send({ error: 'Support admin access required' });
    }
    const params = request.params as { workspaceId: string };
    const workspace = await app.db.workspace.findUniqueOrThrow({
      where: { id: params.workspaceId },
    });

    await appendAuditEvent(app.db, {
      workspaceId: params.workspaceId,
      actorType: 'support_admin',
      actorId: supportMember.id,
      type: 'support.workspace_viewed',
      targetType: 'workspace',
      targetId: params.workspaceId,
      metadata: {},
      ipAddress: request.ip,
      userAgent: request.headers['user-agent'] ?? null,
    });

    return workspace;
  });
}
```

- [ ] **Step 4: Register admin routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`:

```ts
import { registerAuditRoutes } from './modules/audit/audit-routes';
import { registerAdminRoutes } from './modules/admin/admin-routes';
import { registerExportRoutes } from './modules/exports/export-routes';
import { registerOperationsRoutes } from './modules/operations/operations-routes';

export async function buildApiApp(options: BuildApiAppOptions = {}) {
  const app = Fastify({ logger: options.logger ?? false });
  await registerCorePlugins(app, options);
  await registerAuditRoutes(app);
  await registerExportRoutes(app);
  await registerOperationsRoutes(app);
  await registerAdminRoutes(app);
  return app;
}
```

- [ ] **Step 5: Write the failing admin UI test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/support-workspace-summary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SupportWorkspaceSummary } from '../components/admin/support-workspace-summary';

describe('SupportWorkspaceSummary', () => {
  it('shows workspace diagnostics without exposing raw document content', () => {
    render(
      <SupportWorkspaceSummary
        workspace={{ id: 'wrk_1', name: 'Acme' }}
        stats={{ projects: 2, signingRequests: 5, failedJobs: 1 }}
      />,
    );

    expect(screen.getByText('Acme')).toBeInTheDocument();
    expect(screen.getByText('Projects: 2')).toBeInTheDocument();
    expect(screen.getByText('Failed jobs: 1')).toBeInTheDocument();
    expect(screen.queryByText('Document body')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Implement admin UI component and page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/admin/support-workspace-summary.tsx`:

```tsx
export function SupportWorkspaceSummary({
  workspace,
  stats,
}: {
  workspace: { id: string; name: string };
  stats: { projects: number; signingRequests: number; failedJobs: number };
}) {
  return (
    <section>
      <h1>{workspace.name}</h1>
      <p>Workspace ID: {workspace.id}</p>
      <p>Projects: {stats.projects}</p>
      <p>Signing requests: {stats.signingRequests}</p>
      <p>Failed jobs: {stats.failedJobs}</p>
    </section>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(admin)/support/workspaces/[workspaceId]/page.tsx`:

```tsx
import { SupportWorkspaceSummary } from '../../../../../components/admin/support-workspace-summary';

export default async function SupportWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const response = await fetch(`${process.env.DROPSIGN_API_URL}/v1/admin/workspaces/${workspaceId}`, {
    cache: 'no-store',
  });
  const workspace = (await response.json()) as { id: string; name: string };

  return (
    <main>
      <SupportWorkspaceSummary
        workspace={workspace}
        stats={workspace.stats}
      />
    </main>
  );
}
```

- [ ] **Step 7: Run admin tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/admin-routes.test.ts apps/web/tests/support-workspace-summary.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/admin apps/api/src/app.ts apps/api/test/admin-routes.test.ts apps/web/app apps/web/components/admin apps/web/tests/support-workspace-summary.test.tsx
git commit -m "feat: add support admin diagnostics"
```

Expected: commit succeeds.

## Phase Verification

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/audit-domain.test.ts apps/api/test/audit-routes.test.ts apps/worker/test/export-workspace.test.ts apps/api/test/export-routes.test.ts apps/web/tests/export-list.test.tsx apps/worker/test/apply-retention.test.ts apps/api/test/operations-routes.test.ts apps/api/test/admin-routes.test.ts apps/web/tests/support-workspace-summary.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 2: Run workspace checks**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands pass.

- [ ] **Step 3: Confirm support access is audited**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/admin-routes.test.ts -t "logs access"
```

Expected: PASS and the test asserts an audit event with type `support.workspace_viewed`.
