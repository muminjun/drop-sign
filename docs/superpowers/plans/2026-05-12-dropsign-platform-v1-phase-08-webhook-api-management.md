# DropSign Platform v1 Phase 08 Webhook And API Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add secure API key management, webhook endpoint configuration, signed webhook delivery, retry logs, and manual resend without emitting recursive failure webhooks.

**Architecture:** API key creation and webhook endpoint management live in `apps/api`. Webhook event expansion and delivery execution live in `apps/worker`, with delivery attempts recorded in PostgreSQL. Dashboard pages manage endpoints and inspect delivery logs through API routes, while failure records remain internal operational state rather than customer-delivered `webhook.failed` events.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Node `crypto`, undici/fetch, Vitest, Next.js App Router, React Testing Library, Playwright.

---

## Task 0: Add Webhook Persistence Schema

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-schema.test.ts`

- [ ] **Step 1: Write the failing schema test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CUSTOMER_WEBHOOK_EVENTS } from '@dropsign/domain/webhooks';

describe('webhook schema contract', () => {
  it('defines customer events without recursive webhook.failed events', () => {
    expect(CUSTOMER_WEBHOOK_EVENTS).toContain('document.failed');
    expect(CUSTOMER_WEBHOOK_EVENTS).not.toContain('webhook.failed');
  });
});
```

- [ ] **Step 2: Add Prisma schema models before endpoint code**

Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`:

```prisma
enum WebhookDeliveryStatus {
  queued
  delivering
  succeeded
  failed
}

model WebhookEndpoint {
  id             String            @id @default(cuid())
  projectId      String
  url            String
  secret         String
  events         String[]
  enabled        Boolean           @default(true)
  maxAttempts    Int               @default(5)
  timeoutMs      Int               @default(10000)
  retryBackoffMs Json              @default("[60000,300000,1800000,7200000]")
  createdAt      DateTime          @default(now())
  updatedAt      DateTime          @updatedAt

  project        Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  deliveries     WebhookDelivery[]

  @@index([projectId, enabled])
}

model WebhookEvent {
  id          String            @id @default(cuid())
  eventId     String            @unique
  projectId   String
  eventType   String
  payload     Json
  createdAt   DateTime          @default(now())

  project     Project           @relation(fields: [projectId], references: [id], onDelete: Cascade)
  deliveries  WebhookDelivery[]

  @@index([projectId, eventType])
}

model WebhookDelivery {
  id                  String                @id @default(cuid())
  eventId             String
  endpointId          String
  projectId           String
  eventType           String
  payload             Json
  status              WebhookDeliveryStatus @default(queued)
  attemptCount        Int                   @default(0)
  nextAttemptAt       DateTime              @default(now())
  responseStatus      Int?
  responseBodyExcerpt String?
  lastError           String?
  deliveredAt         DateTime?
  createdAt           DateTime              @default(now())
  updatedAt           DateTime              @updatedAt

  event               WebhookEvent          @relation(fields: [eventId], references: [eventId], onDelete: Cascade)
  endpoint            WebhookEndpoint       @relation(fields: [endpointId], references: [id], onDelete: Cascade)
  project             Project               @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([eventId, endpointId])
  @@index([projectId, createdAt])
  @@index([endpointId, status])
  @@index([status, nextAttemptAt])
}
```

Add relation fields to the existing `Project` model:

```prisma
model Project {
  webhookEndpoints WebhookEndpoint[]
  webhookEvents    WebhookEvent[]
  webhookDeliveries WebhookDelivery[]
}
```

- [ ] **Step 3: Generate migration and Prisma client**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma migrate dev --schema packages/db/prisma/schema.prisma --name add_webhook_delivery_tables
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/api/test/webhook-schema.test.ts
```

Expected: migration is created, Prisma client generation succeeds, and the schema contract test passes.

- [ ] **Step 4: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations apps/api/test/webhook-schema.test.ts
git commit -m "feat: add webhook persistence schema"
```

Expected: commit succeeds.

## Task 1: Add API Key Domain And Routes

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/api-keys.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/api-keys/api-key-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/api-keys/api-key-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/api-key-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing API key test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/api-key-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('api key routes', () => {
  it('creates an API key, stores only the hash, and returns the raw key once', async () => {
    const db = {
      project: {
        findFirstOrThrow: vi.fn(async () => ({ id: 'proj_1', workspaceId: 'wrk_1' })),
      },
      projectApiKey: {
        create: vi.fn(async ({ data }) => ({ id: 'key_1', ...data })),
      },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/proj_1/api-keys',
      headers: { 'x-workspace-id': 'wrk_1' },
      payload: { name: 'Production server' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as { id: string; apiKey: string };
    expect(body.id).toBe('key_1');
    expect(body.apiKey).toMatch(/^dsk_live_/);
    expect(db.projectApiKey.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj_1',
        name: 'Production server',
        keyHash: expect.any(String),
        keyPrefix: expect.stringMatching(/^dsk_live_/),
      }),
    });
    expect(JSON.stringify(db.projectApiKey.create.mock.calls[0])).not.toContain(body.apiKey);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/api-key-routes.test.ts
```

Expected: FAIL because API key routes are missing.

- [ ] **Step 3: Implement API key utilities**

Create `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/api-keys.ts`:

```ts
import { createHash, randomBytes } from 'node:crypto';

export function createRawApiKey(environment: 'live' | 'test' = 'live'): string {
  return `dsk_${environment}_${randomBytes(24).toString('base64url')}`;
}

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function apiKeyPrefix(rawKey: string): string {
  return rawKey.slice(0, 16);
}
```

- [ ] **Step 4: Implement API key service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/api-keys/api-key-service.ts`:

```ts
import { apiKeyPrefix, createRawApiKey, hashApiKey } from '@dropsign/domain/api-keys';

interface ApiKeyDb {
  project: {
    findFirstOrThrow(args: { where: { id: string; workspaceId: string } }): Promise<{ id: string }>;
  };
  projectApiKey: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export async function createProjectApiKey(input: {
  db: ApiKeyDb;
  workspaceId: string;
  projectId: string;
  name: string;
}) {
  await input.db.project.findFirstOrThrow({
    where: { id: input.projectId, workspaceId: input.workspaceId },
  });

  const apiKey = createRawApiKey('live');
  const record = await input.db.projectApiKey.create({
    data: {
      projectId: input.projectId,
      name: input.name,
      keyHash: hashApiKey(apiKey),
      keyPrefix: apiKeyPrefix(apiKey),
    },
  });

  return { id: record.id, apiKey };
}
```

- [ ] **Step 5: Implement API key routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/api-keys/api-key-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { createProjectApiKey } from './api-key-service.js';

const createApiKeyBody = z.object({
  name: z.string().min(1),
});

export async function registerApiKeyRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/projects/:projectId/api-keys', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const params = request.params as { projectId: string };
    const body = createApiKeyBody.parse(request.body);
    const result = await createProjectApiKey({
      db: app.db,
      workspaceId,
      projectId: params.projectId,
      name: body.name,
    });
    return reply.code(201).send(result);
  });
}
```

- [ ] **Step 6: Register the routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` by appending these registrations to the existing `buildApiApp` implementation and preserving all earlier route registrations:

```ts
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { registerApiKeyRoutes } from './modules/api-keys/api-key-routes.js';

export async function buildApiApp(deps: { db: unknown }) {
  const app = Fastify();
  app.decorate('db', deps.db);
  await app.register(sensible);
  await registerApiKeyRoutes(app);
  return app;
}
```

- [ ] **Step 7: Run the API key test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/api-key-routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/domain/src/api-keys.ts apps/api/src/modules/api-keys apps/api/src/app.ts apps/api/test/api-key-routes.test.ts
git commit -m "feat: manage project api keys"
```

Expected: commit succeeds.

## Task 2: Add Webhook Endpoint Management

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/webhooks.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-endpoint-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing endpoint route test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-endpoint-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('webhook endpoint routes', () => {
  it('creates endpoint with supported event subscriptions only', async () => {
    const db = {
      project: {
        findFirstOrThrow: vi.fn(async () => ({ id: 'proj_1', workspaceId: 'wrk_1' })),
      },
      webhookEndpoint: {
        create: vi.fn(async ({ data }) => ({ id: 'wh_1', ...data })),
      },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/proj_1/webhook-endpoints',
      headers: { 'x-workspace-id': 'wrk_1' },
      payload: {
        url: 'https://example.com/webhooks/dropsign',
        events: ['signature.completed', 'document.completed'],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(JSON.parse(response.body)).toEqual({ id: 'wh_1' });
    expect(db.webhookEndpoint.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        projectId: 'proj_1',
        url: 'https://example.com/webhooks/dropsign',
        events: ['signature.completed', 'document.completed'],
        enabled: true,
        maxAttempts: 5,
        timeoutMs: 10000,
        retryBackoffMs: [60000, 300000, 1800000, 7200000],
        secret: expect.stringMatching(/^whsec_/),
      }),
    });
  });

  it('rejects webhook.failed as a customer-delivered event', async () => {
    const db = {
      project: { findFirstOrThrow: vi.fn(async () => ({ id: 'proj_1', workspaceId: 'wrk_1' })) },
      webhookEndpoint: { create: vi.fn() },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects/proj_1/webhook-endpoints',
      headers: { 'x-workspace-id': 'wrk_1' },
      payload: {
        url: 'https://example.com/webhooks/dropsign',
        events: ['webhook.failed'],
      },
    });

    expect(response.statusCode).toBe(400);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/webhook-endpoint-routes.test.ts
```

Expected: FAIL because webhook routes are missing.

- [ ] **Step 3: Add webhook domain constants**

Create `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/webhooks.ts`:

```ts
import { randomBytes } from 'node:crypto';

export const CUSTOMER_WEBHOOK_EVENTS = [
  'signature.started',
  'signature.completed',
  'signature.cancelled',
  'signing_request.created',
  'signing_request.viewed',
  'signing_request.completed',
  'document.completed',
  'document.failed',
] as const;

export type CustomerWebhookEvent = (typeof CUSTOMER_WEBHOOK_EVENTS)[number];

export function createWebhookSecret(): string {
  return `whsec_${randomBytes(32).toString('base64url')}`;
}

export function isCustomerWebhookEvent(value: string): value is CustomerWebhookEvent {
  return CUSTOMER_WEBHOOK_EVENTS.includes(value as CustomerWebhookEvent);
}
```

- [ ] **Step 4: Add webhook service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-service.ts`:

```ts
import { createWebhookSecret } from '@dropsign/domain/webhooks';
import type { CustomerWebhookEvent } from '@dropsign/domain/webhooks';

interface WebhookDb {
  project: {
    findFirstOrThrow(args: { where: { id: string; workspaceId: string } }): Promise<{ id: string }>;
  };
  webhookEndpoint: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export async function createWebhookEndpoint(input: {
  db: WebhookDb;
  workspaceId: string;
  projectId: string;
  url: string;
  events: CustomerWebhookEvent[];
}) {
  await input.db.project.findFirstOrThrow({
    where: { id: input.projectId, workspaceId: input.workspaceId },
  });
  const endpoint = await input.db.webhookEndpoint.create({
    data: {
      projectId: input.projectId,
      url: input.url,
      events: input.events,
      enabled: true,
      maxAttempts: 5,
      timeoutMs: 10_000,
      retryBackoffMs: [60_000, 300_000, 1_800_000, 7_200_000],
      secret: createWebhookSecret(),
    },
  });
  return { id: endpoint.id };
}
```

- [ ] **Step 5: Add webhook routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CUSTOMER_WEBHOOK_EVENTS } from '@dropsign/domain/webhooks';
import { createWebhookEndpoint } from './webhook-service.js';

const createEndpointBody = z.object({
  url: z.string().url(),
  events: z.array(z.enum(CUSTOMER_WEBHOOK_EVENTS)).min(1),
});

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/projects/:projectId/webhook-endpoints', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const params = request.params as { projectId: string };
    const parsed = createEndpointBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid webhook endpoint payload' });
    }
    const result = await createWebhookEndpoint({
      db: app.db,
      workspaceId,
      projectId: params.projectId,
      url: parsed.data.url,
      events: parsed.data.events,
    });
    return reply.code(201).send(result);
  });
}
```

- [ ] **Step 6: Register webhook routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` by appending these registrations to the existing `buildApiApp` implementation and preserving all earlier route registrations:

```ts
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { registerApiKeyRoutes } from './modules/api-keys/api-key-routes.js';
import { registerWebhookRoutes } from './modules/webhooks/webhook-routes.js';

export async function buildApiApp(deps: { db: unknown }) {
  const app = Fastify();
  app.decorate('db', deps.db);
  await app.register(sensible);
  await registerApiKeyRoutes(app);
  await registerWebhookRoutes(app);
  return app;
}
```

- [ ] **Step 7: Run endpoint route tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/webhook-endpoint-routes.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/domain/src/webhooks.ts apps/api/src/modules/webhooks apps/api/src/app.ts apps/api/test/webhook-endpoint-routes.test.ts
git commit -m "feat: manage webhook endpoints"
```

Expected: commit succeeds.

## Task 2B: Add Idempotent Webhook Event Expansion

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-event-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-event-service.test.ts`

- [ ] **Step 1: Write failing event expansion tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-event-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { enqueueWebhookEvent } from '../src/modules/webhooks/webhook-event-service';

describe('enqueueWebhookEvent', () => {
  it('creates one delivery per enabled subscribed endpoint with the same eventId', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      webhookEvent: {
        upsert: vi.fn(async ({ create }) => create),
      },
      webhookEndpoint: {
        findMany: vi.fn(async () => [
          { id: 'we_1', projectId: 'proj_1' },
          { id: 'we_2', projectId: 'proj_1' },
        ]),
      },
      webhookDelivery: {
        upsert: vi.fn(async ({ create }) => ({ id: `del_${create.endpointId}`, ...create })),
      },
    };

    await enqueueWebhookEvent({
      db,
      queue,
      projectId: 'proj_1',
      eventId: 'evt_123',
      eventType: 'signature.completed',
      payload: { eventId: 'evt_123' },
    });

    expect(db.webhookDelivery.upsert).toHaveBeenCalledTimes(2);
    expect(db.webhookDelivery.upsert).toHaveBeenCalledWith({
      where: { eventId_endpointId: { eventId: 'evt_123', endpointId: 'we_1' } },
      create: expect.objectContaining({
        eventId: 'evt_123',
        endpointId: 'we_1',
        status: 'queued',
      }),
      update: {},
    });
    expect(queue.add).toHaveBeenCalledWith('deliver-webhook', { deliveryId: 'del_we_1' });
  });

  it('does not create duplicate delivery rows when the same eventId is replayed', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      webhookEvent: {
        upsert: vi.fn(async ({ create }) => create),
      },
      webhookEndpoint: {
        findMany: vi.fn(async () => [{ id: 'we_1', projectId: 'proj_1' }]),
      },
      webhookDelivery: {
        upsert: vi.fn(async () => ({ id: 'existing_delivery', status: 'queued' })),
      },
    };

    await enqueueWebhookEvent({
      db,
      queue,
      projectId: 'proj_1',
      eventId: 'evt_replay',
      eventType: 'signature.completed',
      payload: { eventId: 'evt_replay' },
    });

    expect(db.webhookDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId_endpointId: { eventId: 'evt_replay', endpointId: 'we_1' } },
        update: {},
      }),
    );
  });
});
```

- [ ] **Step 2: Implement idempotent event expansion**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-event-service.ts`:

```ts
export async function enqueueWebhookEvent(input: {
  db: {
    webhookEvent: {
      upsert(args: Record<string, unknown>): Promise<unknown>;
    };
    webhookEndpoint: {
      findMany(args: Record<string, unknown>): Promise<Array<{ id: string; projectId: string }>>;
    };
    webhookDelivery: {
      upsert(args: Record<string, unknown>): Promise<{ id: string }>;
    };
  };
  queue: {
    add(name: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
  };
  projectId: string;
  eventId: string;
  eventType: string;
  payload: Record<string, unknown>;
}) {
  await input.db.webhookEvent.upsert({
    where: { eventId: input.eventId },
    create: {
      eventId: input.eventId,
      projectId: input.projectId,
      eventType: input.eventType,
      payload: input.payload,
    },
    update: {},
  });

  const endpoints = await input.db.webhookEndpoint.findMany({
    where: {
      projectId: input.projectId,
      enabled: true,
      events: { has: input.eventType },
    },
  });

  for (const endpoint of endpoints) {
    const delivery = await input.db.webhookDelivery.upsert({
      where: { eventId_endpointId: { eventId: input.eventId, endpointId: endpoint.id } },
      create: {
        eventId: input.eventId,
        projectId: input.projectId,
        endpointId: endpoint.id,
        eventType: input.eventType,
        payload: input.payload,
        status: 'queued',
      },
      update: {},
    });
    await input.queue.add('deliver-webhook', { deliveryId: delivery.id });
  }
}
```

- [ ] **Step 3: Run event expansion tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/webhook-event-service.test.ts
```

Expected: PASS and duplicate `eventId` replay uses the `@@unique([eventId, endpointId])` delivery key instead of inserting duplicate rows.

- [ ] **Step 4: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/webhooks/webhook-event-service.ts apps/api/test/webhook-event-service.test.ts
git commit -m "feat: enqueue idempotent webhook events"
```

Expected: commit succeeds.

## Task 3: Implement Signed Webhook Delivery Worker

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/deliver-webhook.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/deliver-webhook.test.ts`

- [ ] **Step 1: Write the failing worker test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/deliver-webhook.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runDeliverWebhookJob } from '../src/jobs/deliver-webhook.js';

describe('runDeliverWebhookJob', () => {
  it('sends signed webhook payload and records successful delivery', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok', { status: 200 }));
    const db = {
      webhookDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'del_1',
          eventId: 'evt_1',
          eventType: 'signature.completed',
          payload: { eventId: 'evt_1' },
          attemptCount: 0,
          endpoint: {
            id: 'we_1',
            url: 'https://example.com/webhook',
            secret: 'whsec_secret',
            enabled: true,
            maxAttempts: 5,
            timeoutMs: 10000,
            retryBackoffMs: [60000, 300000],
          },
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await runDeliverWebhookJob({ db, fetchImpl, deliveryId: 'del_1' });

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://example.com/webhook',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
          'x-dropsign-signature': expect.stringMatching(/^t=\\d+,v1=/),
        }),
      }),
    );
    expect(db.webhookDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'del_1' },
      data: expect.objectContaining({ status: 'succeeded', responseStatus: 200 }),
    });
  });

  it('records internal failure without creating another webhook event', async () => {
    const fetchImpl = vi.fn(async () => new Response('down', { status: 503 }));
    const db = {
      webhookDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'del_2',
          eventId: 'evt_2',
          eventType: 'document.failed',
          payload: { eventId: 'evt_2' },
          attemptCount: 4,
          endpoint: {
            id: 'we_1',
            url: 'https://example.com/webhook',
            secret: 'whsec_secret',
            enabled: true,
            maxAttempts: 5,
            timeoutMs: 10000,
            retryBackoffMs: [60000, 300000],
          },
        })),
        update: vi.fn(async (args) => args),
      },
      webhookEvent: {
        create: vi.fn(),
      },
    };

    await expect(runDeliverWebhookJob({ db, fetchImpl, deliveryId: 'del_2' })).rejects.toThrow(
      'Webhook delivery failed with status 503',
    );

    expect(db.webhookEvent.create).not.toHaveBeenCalled();
    expect(db.webhookDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'del_2' },
      data: expect.objectContaining({
        status: 'failed',
        responseStatus: 503,
        responseBodyExcerpt: 'down',
        attemptCount: { increment: 1 },
      }),
    });
  });

  it('does not call fetch for disabled endpoints and marks the delivery failed terminally', async () => {
    const fetchImpl = vi.fn();
    const db = {
      webhookDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'del_disabled',
          eventId: 'evt_disabled',
          eventType: 'signature.completed',
          payload: { eventId: 'evt_disabled' },
          attemptCount: 0,
          endpoint: {
            id: 'we_disabled',
            url: 'https://example.com/webhook',
            secret: 'whsec_secret',
            enabled: false,
            maxAttempts: 5,
            timeoutMs: 10000,
            retryBackoffMs: [60000],
          },
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await runDeliverWebhookJob({ db, fetchImpl, deliveryId: 'del_disabled' });

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(db.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'del_disabled' },
      data: {
        status: 'failed',
        lastError: 'Webhook endpoint is disabled',
      },
    });
  });

  it('times out slow endpoints and schedules retry with backoff before max attempts', async () => {
    const fetchImpl = vi.fn(async (_url: string, init?: RequestInit) => {
      await new Promise((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        setTimeout(resolve, 50);
      });
      return new Response('late', { status: 200 });
    });
    const db = {
      webhookDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'del_timeout',
          eventId: 'evt_timeout',
          eventType: 'signature.completed',
          payload: { eventId: 'evt_timeout' },
          attemptCount: 1,
          endpoint: {
            id: 'we_1',
            url: 'https://example.com/webhook',
            secret: 'whsec_secret',
            enabled: true,
            maxAttempts: 5,
            timeoutMs: 1,
            retryBackoffMs: [60000, 300000],
          },
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await expect(runDeliverWebhookJob({ db, fetchImpl, deliveryId: 'del_timeout' })).rejects.toThrow(
      'Webhook delivery timed out',
    );

    expect(db.webhookDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'del_timeout' },
      data: expect.objectContaining({
        status: 'queued',
        lastError: 'Webhook delivery timed out',
        attemptCount: { increment: 1 },
        nextAttemptAt: expect.any(Date),
      }),
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/deliver-webhook.test.ts
```

Expected: FAIL because `runDeliverWebhookJob` is missing.

- [ ] **Step 3: Implement delivery worker**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/deliver-webhook.ts`:

```ts
import { createHmac } from 'node:crypto';

interface WebhookDeliveryDb {
  webhookDelivery: {
    findUniqueOrThrow(args: { where: { id: string }; include: { endpoint: true } }): Promise<{
      id: string;
      eventId: string;
      eventType: string;
      payload: unknown;
      attemptCount: number;
      endpoint: {
        id: string;
        url: string;
        secret: string;
        enabled: boolean;
        maxAttempts: number;
        timeoutMs: number;
        retryBackoffMs: number[];
      };
    }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

export async function runDeliverWebhookJob(input: {
  db: WebhookDeliveryDb;
  fetchImpl: typeof fetch;
  deliveryId: string;
}): Promise<void> {
  const delivery = await input.db.webhookDelivery.findUniqueOrThrow({
    where: { id: input.deliveryId },
    include: { endpoint: true },
  });

  if (!delivery.endpoint.enabled) {
    await input.db.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        lastError: 'Webhook endpoint is disabled',
      },
    });
    return;
  }

  const body = JSON.stringify(delivery.payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = createHmac('sha256', delivery.endpoint.secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');

  await input.db.webhookDelivery.update({
    where: { id: delivery.id },
    data: { status: 'delivering' },
  });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), delivery.endpoint.timeoutMs);
  let response: Response;
  try {
    response = await input.fetchImpl(delivery.endpoint.url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-dropsign-signature': `t=${timestamp},v1=${signature}`,
        'x-dropsign-event-id': delivery.eventId,
      },
      body,
      signal: controller.signal,
    });
  } catch (error) {
    const message =
      error instanceof DOMException && error.name === 'AbortError'
        ? 'Webhook delivery timed out'
        : error instanceof Error
          ? error.message
          : 'Webhook delivery failed';
    await recordWebhookFailure({ db: input.db, delivery, message });
    throw new Error(message);
  } finally {
    clearTimeout(timeout);
  }

  const responseText = await response.text();

  if (!response.ok) {
    await recordWebhookFailure({
      db: input.db,
      delivery,
      message: `Webhook delivery failed with status ${response.status}`,
      responseStatus: response.status,
      responseBodyExcerpt: responseText.slice(0, 500),
    });
    throw new Error(`Webhook delivery failed with status ${response.status}`);
  }

  await input.db.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: 'succeeded',
      responseStatus: response.status,
      responseBodyExcerpt: responseText.slice(0, 500),
      deliveredAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
}

async function recordWebhookFailure(input: {
  db: WebhookDeliveryDb;
  delivery: Awaited<ReturnType<WebhookDeliveryDb['webhookDelivery']['findUniqueOrThrow']>>;
  message: string;
  responseStatus?: number;
  responseBodyExcerpt?: string;
}) {
  const nextAttemptCount = input.delivery.attemptCount + 1;
  const isTerminal = nextAttemptCount >= input.delivery.endpoint.maxAttempts;
  const backoffMs =
    input.delivery.endpoint.retryBackoffMs[Math.min(input.delivery.attemptCount, input.delivery.endpoint.retryBackoffMs.length - 1)] ??
    300_000;

  await input.db.webhookDelivery.update({
    where: { id: input.delivery.id },
    data: {
      status: isTerminal ? 'failed' : 'queued',
      responseStatus: input.responseStatus,
      responseBodyExcerpt: input.responseBodyExcerpt,
      lastError: input.message,
      attemptCount: { increment: 1 },
      ...(isTerminal ? {} : { nextAttemptAt: new Date(Date.now() + backoffMs) }),
    },
  });
}
```

- [ ] **Step 4: Run delivery tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/deliver-webhook.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/worker/src/jobs/deliver-webhook.ts apps/worker/test/deliver-webhook.test.ts
git commit -m "feat: deliver signed webhooks"
```

Expected: commit succeeds.

## Task 4: Add Webhook Delivery Listing And Manual Resend API

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-delivery-service.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-delivery-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write failing delivery route tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/webhook-delivery-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('webhook delivery routes', () => {
  it('lists webhook deliveries for a project', async () => {
    const db = {
      project: { findFirstOrThrow: vi.fn(async () => ({ id: 'proj_1', workspaceId: 'wrk_1' })) },
      webhookDelivery: {
        findMany: vi.fn(async () => [
          {
            id: 'del_1',
            eventId: 'evt_1',
            eventType: 'signature.completed',
            status: 'failed',
            responseStatus: 503,
            attemptCount: 5,
          },
        ]),
      },
    };
    const app = await buildApiApp({ db, queues: { webhooks: { add: vi.fn() } } });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects/proj_1/webhook-deliveries',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)[0]).toEqual({
      id: 'del_1',
      eventId: 'evt_1',
      eventType: 'signature.completed',
      status: 'failed',
      responseStatus: 503,
      attemptCount: 5,
    });
  });

  it('manually resends a failed webhook delivery by resetting attempts and re-enqueueing', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      webhookDelivery: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'del_1',
          projectId: 'proj_1',
          status: 'failed',
          endpoint: { project: { workspaceId: 'wrk_1' } },
        })),
        update: vi.fn(async ({ data }) => ({ id: 'del_1', ...data })),
      },
    };
    const app = await buildApiApp({ db, queues: { webhooks: queue } });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/webhook-deliveries/del_1/resend',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toEqual({ deliveryId: 'del_1', jobId: 'job_1' });
    expect(db.webhookDelivery.update).toHaveBeenCalledWith({
      where: { id: 'del_1' },
      data: {
        status: 'queued',
        attemptCount: 0,
        nextAttemptAt: expect.any(Date),
        lastError: null,
        responseStatus: null,
        responseBodyExcerpt: null,
      },
    });
    expect(queue.add).toHaveBeenCalledWith('deliver-webhook', { deliveryId: 'del_1' });
  });
});
```

- [ ] **Step 2: Implement delivery service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-delivery-service.ts`:

```ts
interface WebhookDeliveryServiceDb {
  project?: {
    findFirstOrThrow(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  webhookDelivery: {
    findMany(args: Record<string, unknown>): Promise<unknown[]>;
    findFirstOrThrow(args: Record<string, unknown>): Promise<{ id: string; status: string }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

export async function listWebhookDeliveries(input: {
  db: WebhookDeliveryServiceDb;
  workspaceId: string;
  projectId: string;
}) {
  await input.db.project!.findFirstOrThrow({
    where: { id: input.projectId, workspaceId: input.workspaceId },
  });
  return input.db.webhookDelivery.findMany({
    where: { projectId: input.projectId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      eventId: true,
      eventType: true,
      status: true,
      responseStatus: true,
      attemptCount: true,
    },
  });
}

export async function resendWebhookDelivery(input: {
  db: WebhookDeliveryServiceDb;
  queue: {
    add(name: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
  };
  workspaceId: string;
  deliveryId: string;
}) {
  const delivery = await input.db.webhookDelivery.findFirstOrThrow({
    where: {
      id: input.deliveryId,
      status: 'failed',
      endpoint: { project: { workspaceId: input.workspaceId } },
    },
  });
  await input.db.webhookDelivery.update({
    where: { id: delivery.id },
    data: {
      status: 'queued',
      attemptCount: 0,
      nextAttemptAt: new Date(),
      lastError: null,
      responseStatus: null,
      responseBodyExcerpt: null,
    },
  });
  const job = await input.queue.add('deliver-webhook', { deliveryId: delivery.id });
  return { deliveryId: delivery.id, jobId: job.id ?? null };
}
```

- [ ] **Step 3: Add routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/webhooks/webhook-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CUSTOMER_WEBHOOK_EVENTS } from '@dropsign/domain/webhooks';
import { createWebhookEndpoint } from './webhook-service.js';
import {
  listWebhookDeliveries,
  resendWebhookDelivery,
} from './webhook-delivery-service.js';

const createEndpointBody = z.object({
  url: z.string().url(),
  events: z.array(z.enum(CUSTOMER_WEBHOOK_EVENTS)).min(1),
});

export async function registerWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/projects/:projectId/webhook-deliveries', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const params = request.params as { projectId: string };
    const deliveries = await listWebhookDeliveries({
      db: app.db,
      workspaceId,
      projectId: params.projectId,
    });
    return reply.code(200).send(deliveries);
  });

  app.post('/v1/webhook-deliveries/:deliveryId/resend', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const params = request.params as { deliveryId: string };
    const result = await resendWebhookDelivery({
      db: app.db,
      queue: app.queues.webhooks,
      workspaceId,
      deliveryId: params.deliveryId,
    });
    return reply.code(202).send(result);
  });

  app.post('/v1/projects/:projectId/webhook-endpoints', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    const params = request.params as { projectId: string };
    const parsed = createEndpointBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid webhook endpoint payload' });
    }
    const result = await createWebhookEndpoint({
      db: app.db,
      workspaceId,
      projectId: params.projectId,
      url: parsed.data.url,
      events: parsed.data.events,
    });
    return reply.code(201).send(result);
  });
}
```

- [ ] **Step 4: Register webhook queue dependency in app**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` by appending these registrations to the existing `buildApiApp` implementation and preserving all earlier route registrations:

```ts
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { registerApiKeyRoutes } from './modules/api-keys/api-key-routes.js';
import { registerWebhookRoutes } from './modules/webhooks/webhook-routes.js';

export async function buildApiApp(deps: { db: unknown; queues: { webhooks: unknown } }) {
  const app = Fastify();
  app.decorate('db', deps.db);
  app.decorate('queues', deps.queues);
  await app.register(sensible);
  await registerApiKeyRoutes(app);
  await registerWebhookRoutes(app);
  return app;
}
```

- [ ] **Step 5: Run route tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/webhook-delivery-routes.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/webhooks/webhook-delivery-service.ts apps/api/src/modules/webhooks/webhook-routes.ts apps/api/src/app.ts apps/api/test/webhook-delivery-routes.test.ts
git commit -m "feat: manage webhook delivery retries"
```

Expected: commit succeeds.

## Task 5: Add Dashboard Webhook Settings And Delivery Logs

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/webhook-endpoint-form.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/webhook-delivery-log.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/webhook-delivery-log.test.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/projects/[projectId]/webhooks/page.tsx`

- [ ] **Step 1: Write failing delivery log test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/webhook-delivery-log.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WebhookDeliveryLog } from '../components/webhook-delivery-log';

describe('WebhookDeliveryLog', () => {
  it('renders failed delivery without showing webhook.failed as an event option', () => {
    render(
      <WebhookDeliveryLog
        onResend={vi.fn(async () => undefined)}
        deliveries={[
          {
            id: 'del_1',
            eventType: 'document.failed',
            status: 'failed',
            responseStatus: 503,
            attemptCount: 4,
          },
        ]}
      />,
    );

    expect(screen.getByText('document.failed')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    expect(screen.queryByText('webhook.failed')).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/webhook-delivery-log.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement delivery log component**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/webhook-delivery-log.tsx`:

```tsx
export interface WebhookDeliveryRow {
  id: string;
  eventType: string;
  status: string;
  responseStatus: number | null;
  attemptCount: number;
}

export function WebhookDeliveryLog({
  deliveries,
  onResend,
}: {
  deliveries: WebhookDeliveryRow[];
  onResend: (deliveryId: string) => Promise<void>;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Status</th>
          <th>HTTP</th>
          <th>Attempts</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((delivery) => (
          <tr key={delivery.id}>
            <td>{delivery.eventType}</td>
            <td>{delivery.status}</td>
            <td>{delivery.responseStatus ?? '-'}</td>
            <td>{delivery.attemptCount}</td>
            <td>
              <button type="button" onClick={() => void onResend(delivery.id)}>
                Resend
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Implement endpoint form**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/webhook-endpoint-form.tsx`:

```tsx
'use client';

import { CUSTOMER_WEBHOOK_EVENTS } from '@dropsign/domain/webhooks';

export function WebhookEndpointForm({
  onSubmit,
}: {
  onSubmit: (input: { url: string; events: string[] }) => Promise<void>;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        const url = String(form.get('url'));
        const events = form.getAll('events').map(String);
        void onSubmit({ url, events });
      }}
    >
      <label>
        Endpoint URL
        <input name="url" type="url" required />
      </label>
      {CUSTOMER_WEBHOOK_EVENTS.map((eventName) => (
        <label key={eventName}>
          <input name="events" type="checkbox" value={eventName} />
          {eventName}
        </label>
      ))}
      <button type="submit">Create endpoint</button>
    </form>
  );
}
```

- [ ] **Step 5: Add dashboard page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/projects/[projectId]/webhooks/page.tsx`:

```tsx
import { WebhookDeliveryLog } from '../../../../../components/webhook-delivery-log';

async function resendWebhookDelivery(deliveryId: string) {
  'use server';
  await fetch(`${process.env.DROPSIGN_API_URL}/v1/webhook-deliveries/${deliveryId}/resend`, {
    method: 'POST',
    cache: 'no-store',
  });
}

export default async function ProjectWebhooksPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const response = await fetch(
    `${process.env.DROPSIGN_API_URL}/v1/projects/${projectId}/webhook-deliveries`,
    { cache: 'no-store' },
  );
  const deliveries = (await response.json()) as Parameters<typeof WebhookDeliveryLog>[0]['deliveries'];

  return (
    <main>
      <h1>Webhooks</h1>
      <WebhookDeliveryLog deliveries={deliveries} onResend={resendWebhookDelivery} />
    </main>
  );
}
```

- [ ] **Step 6: Run dashboard webhook tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/webhook-delivery-log.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/components/webhook-endpoint-form.tsx apps/web/components/webhook-delivery-log.tsx apps/web/tests/webhook-delivery-log.test.tsx apps/web/app
git commit -m "feat: show webhook settings and delivery logs"
```

Expected: commit succeeds.

## Phase Verification

- [ ] **Step 1: Run focused tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/webhook-schema.test.ts apps/api/test/api-key-routes.test.ts apps/api/test/webhook-endpoint-routes.test.ts apps/api/test/webhook-event-service.test.ts apps/api/test/webhook-delivery-routes.test.ts apps/worker/test/deliver-webhook.test.ts apps/web/tests/webhook-delivery-log.test.tsx
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

- [ ] **Step 3: Confirm non-recursive webhook failure behavior**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/deliver-webhook.test.ts -t "records internal failure"
```

Expected: PASS and no test creates a `webhook.failed` customer event.
