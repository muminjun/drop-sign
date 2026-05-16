# DropSign Platform v1 Phase 10 Billing Plans And Usage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add billing plans, subscriptions, invoices, usage records, quota enforcement, and Stripe-compatible billing webhooks.

**Architecture:** Plan definitions live in `packages/domain`; subscription and usage persistence live in Prisma. API quota checks run before billable actions and return upgrade-required responses when limits are exceeded. Billing provider integration is abstracted behind `packages/billing`, with worker/API handlers processing provider webhooks idempotently and dashboard pages showing plan, usage, invoices, and payment state.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, Next.js App Router, Vitest, React Testing Library, provider-neutral billing package, Stripe-compatible event model.

---

## Repository Target

This phase intentionally targets the sibling cloud platform repository:

```text
/Users/minjun/Documents/dropsign-cloud
```

The current repository `/Users/minjun/Documents/drop-sign` remains the SDK/documentation repository.
Do not move these implementation paths back into the SDK repo during execution.

## Task 1: Add Billing Domain And Plan Limits

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/billing.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-domain.test.ts`

- [x] **Step 1: Write the failing billing domain test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-domain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  PLAN_LIMITS,
  getPlanLimits,
  isUsageWithinLimit,
  usageLimitExceededCode,
} from '@dropsign/domain/billing';

describe('billing domain', () => {
  it('defines plan limits for free, pro, and business plans', () => {
    expect(Object.keys(PLAN_LIMITS)).toEqual(['free', 'pro', 'business']);
    expect(getPlanLimits('free')).toMatchObject({
      signaturesPerMonth: 25,
      documentsPerMonth: 10,
      apiCallsPerMonth: 1000,
      storageMb: 250,
      seats: 1,
      webhooksPerMonth: 100,
    });
  });

  it('detects usage inside and outside limits', () => {
    expect(isUsageWithinLimit({ used: 24, limit: 25 })).toBe(true);
    expect(isUsageWithinLimit({ used: 25, limit: 25 })).toBe(false);
    expect(isUsageWithinLimit({ used: 1000, limit: null })).toBe(true);
  });

  it.each([
    ['signatures', 'signature_quota_exceeded'],
    ['documents', 'document_quota_exceeded'],
    ['apiCalls', 'api_quota_exceeded'],
    ['storageMb', 'storage_quota_exceeded'],
    ['seats', 'seat_quota_exceeded'],
    ['webhooks', 'webhook_quota_exceeded'],
  ] as const)('maps %s usage to %s', (dimension, code) => {
    expect(usageLimitExceededCode(dimension)).toBe(code);
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-domain.test.ts
```

Expected: FAIL with module resolution error for `@dropsign/domain/billing`.

- [x] **Step 3: Implement billing domain**

Create `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/billing.ts`:

```ts
export const PLAN_IDS = ['free', 'pro', 'business'] as const;

export type PlanId = (typeof PLAN_IDS)[number];

export interface PlanLimits {
  signaturesPerMonth: number | null;
  documentsPerMonth: number | null;
  apiCallsPerMonth: number | null;
  storageMb: number | null;
  seats: number | null;
  webhooksPerMonth: number | null;
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    signaturesPerMonth: 25,
    documentsPerMonth: 10,
    apiCallsPerMonth: 1000,
    storageMb: 250,
    seats: 1,
    webhooksPerMonth: 100,
  },
  pro: {
    signaturesPerMonth: 1000,
    documentsPerMonth: 250,
    apiCallsPerMonth: 50000,
    storageMb: 10240,
    seats: 5,
    webhooksPerMonth: 10000,
  },
  business: {
    signaturesPerMonth: null,
    documentsPerMonth: null,
    apiCallsPerMonth: null,
    storageMb: 102400,
    seats: 50,
    webhooksPerMonth: null,
  },
};

export type UsageDimension =
  | 'signatures'
  | 'documents'
  | 'apiCalls'
  | 'storageMb'
  | 'seats'
  | 'webhooks';

export function getPlanLimits(planId: PlanId): PlanLimits {
  return PLAN_LIMITS[planId];
}

export function isUsageWithinLimit(input: { used: number; limit: number | null }): boolean {
  if (input.limit === null) return true;
  return input.used < input.limit;
}

export function usageLimitExceededCode(dimension: UsageDimension): string {
  const map: Record<UsageDimension, string> = {
    signatures: 'signature_quota_exceeded',
    documents: 'document_quota_exceeded',
    apiCalls: 'api_quota_exceeded',
    storageMb: 'storage_quota_exceeded',
    seats: 'seat_quota_exceeded',
    webhooks: 'webhook_quota_exceeded',
  };
  return map[dimension];
}
```

- [x] **Step 4: Run the domain test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-domain.test.ts
```

Expected: PASS.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/domain/src/billing.ts apps/api/test/billing-domain.test.ts
git commit -m "feat: define billing plan limits"
```

Expected: commit succeeds.

## Task 2: Add Subscription And Usage Schema

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/usage-schema.test.ts`

- [x] **Step 1: Write the failing schema smoke test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/usage-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { PLAN_IDS } from '@dropsign/domain/billing';

describe('billing schema contract', () => {
  it('keeps supported plan ids stable for persisted subscriptions', () => {
    expect(PLAN_IDS).toEqual(['free', 'pro', 'business']);
  });
});
```

- [x] **Step 2: Run the smoke test and verify billing persistence is still absent**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma validate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/api/test/usage-schema.test.ts
```

Expected: Prisma validation and the smoke test pass against the previous schema, but billing persistence is still incomplete because `Subscription`, `UsageRecord`, `BillingWebhookEvent`, `Invoice`, and `PaymentMethodState` are not present in `packages/db/prisma/schema.prisma`.

- [x] **Step 3: Add Prisma models**

In `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`, keep the existing fields from previous phases and update these existing model blocks to include the listed billing relations:

```prisma
model Workspace {
  id                 String              @id @default(cuid())
  name               String
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt
  projects           Project[]
  members            Member[]
  auditEvents        AuditEvent[]
  exportArtifacts    ExportArtifact[]
  subscription       Subscription?
  usageRecords       UsageRecord[]
  invoices           Invoice[]
  paymentMethodState PaymentMethodState?
}

model Project {
  id           String          @id @default(cuid())
  workspaceId  String
  name         String
  publicKey    String          @unique
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt
  workspace    Workspace       @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  apiKeys      ProjectApiKey[]
  widgetConfig WidgetConfig?
  auditEvents  AuditEvent[]
  usageRecords UsageRecord[]

  @@index([workspaceId])
}
```

Then add these models:

```prisma
model Subscription {
  id                 String   @id @default(cuid())
  workspaceId        String   @unique
  planId             String
  status             String
  providerCustomerId String?
  providerSubscriptionId String?
  currentPeriodStart DateTime
  currentPeriodEnd   DateTime
  cancelAtPeriodEnd  Boolean  @default(false)
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  workspace          Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([status])
  @@index([providerCustomerId])
  @@index([providerSubscriptionId])
}

model UsageRecord {
  id          String   @id @default(cuid())
  workspaceId String
  projectId   String?
  dimension   String
  quantity    Int
  sourceType  String
  sourceId    String
  periodStart DateTime
  periodEnd   DateTime
  createdAt   DateTime @default(now())

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project     Project?  @relation(fields: [projectId], references: [id], onDelete: SetNull)

  @@unique([workspaceId, dimension, sourceType, sourceId])
  @@index([workspaceId, dimension, periodStart, periodEnd])
  @@index([projectId, createdAt])
}

model BillingWebhookEvent {
  id              String   @id @default(cuid())
  provider        String
  providerEventId String
  type            String
  processedAt     DateTime?
  receivedAt      DateTime @default(now())
  payload         Json

  @@unique([provider, providerEventId])
  @@index([provider, type])
  @@index([processedAt])
}

model Invoice {
  id                String   @id @default(cuid())
  workspaceId       String
  providerInvoiceId String   @unique
  status            String
  amountDueCents    Int
  currency          String
  hostedInvoiceUrl  String?
  createdAt         DateTime @default(now())

  workspace         Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
}

model PaymentMethodState {
  id          String   @id @default(cuid())
  workspaceId String   @unique
  providerPaymentMethodId String?
  brand       String?
  last4       String?
  expMonth    Int?
  expYear     Int?
  status      String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  workspace   Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
}
```

- [x] **Step 4: Run Prisma generation and schema smoke test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/api/test/usage-schema.test.ts
```

Expected: Prisma generation succeeds and test passes.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma apps/api/test/usage-schema.test.ts
git commit -m "feat: add subscription and usage schema"
```

Expected: commit succeeds.

## Task 3: Implement Usage Recording And Quota Checks

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/usage-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/quota-plugin.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/quota-service.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/quota-plugin.test.ts`

- [x] **Step 1: Write the failing quota service test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/quota-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { assertWithinQuota, recordUsage } from '../src/modules/billing/usage-service';

describe('usage service', () => {
  it('records usage idempotently by source', async () => {
    const db = {
      usageRecord: {
        upsert: vi.fn(async ({ create }) => create),
      },
    };

    await recordUsage({
      db,
      workspaceId: 'wrk_1',
      projectId: 'proj_1',
      dimension: 'signatures',
      quantity: 1,
      sourceType: 'signature_artifact',
      sourceId: 'sig_1',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-06-01T00:00:00.000Z'),
    });

    expect(db.usageRecord.upsert).toHaveBeenCalledWith({
      where: {
        workspaceId_dimension_sourceType_sourceId: {
          workspaceId: 'wrk_1',
          dimension: 'signatures',
          sourceType: 'signature_artifact',
          sourceId: 'sig_1',
        },
      },
      update: {},
      create: expect.objectContaining({ quantity: 1 }),
    });
  });

  it.each([
    ['signatures', 25, 'signature_quota_exceeded'],
    ['documents', 10, 'document_quota_exceeded'],
    ['apiCalls', 1000, 'api_quota_exceeded'],
    ['storageMb', 250, 'storage_quota_exceeded'],
    ['seats', 1, 'seat_quota_exceeded'],
    ['webhooks', 100, 'webhook_quota_exceeded'],
  ] as const)('throws upgrade-required error when %s quota is exhausted', async (dimension, used, code) => {
    const db = {
      subscription: {
        findUnique: vi.fn(async () => ({ planId: 'free' })),
      },
      usageRecord: {
        aggregate: vi.fn(async () => ({ _sum: { quantity: used } })),
      },
    };

    await expect(
      assertWithinQuota({
        db,
        workspaceId: 'wrk_1',
        dimension,
        periodStart: new Date('2026-05-01T00:00:00.000Z'),
        periodEnd: new Date('2026-06-01T00:00:00.000Z'),
      }),
    ).rejects.toMatchObject({
      code,
      statusCode: 402,
    });
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/quota-service.test.ts
```

Expected: FAIL because `usage-service` is missing.

- [x] **Step 3: Implement usage service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/usage-service.ts`:

```ts
import {
  getPlanLimits,
  isUsageWithinLimit,
  usageLimitExceededCode,
} from '@dropsign/domain/billing';
import type { PlanId, UsageDimension } from '@dropsign/domain/billing';

export class QuotaExceededError extends Error {
  readonly statusCode = 402;
  readonly code: string;

  constructor(dimension: UsageDimension) {
    super(`Quota exceeded for ${dimension}`);
    this.code = usageLimitExceededCode(dimension);
  }
}

interface UsageDb {
  subscription?: {
    findUnique(args: { where: { workspaceId: string } }): Promise<{ planId: PlanId } | null>;
  };
  usageRecord: {
    upsert?(args: Record<string, unknown>): Promise<unknown>;
    aggregate?(args: Record<string, unknown>): Promise<{ _sum: { quantity: number | null } }>;
  };
}

export async function recordUsage(input: {
  db: UsageDb;
  workspaceId: string;
  projectId?: string | null;
  dimension: UsageDimension;
  quantity: number;
  sourceType: string;
  sourceId: string;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  await input.db.usageRecord.upsert?.({
    where: {
      workspaceId_dimension_sourceType_sourceId: {
        workspaceId: input.workspaceId,
        dimension: input.dimension,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
      },
    },
    update: {},
    create: {
      workspaceId: input.workspaceId,
      projectId: input.projectId ?? null,
      dimension: input.dimension,
      quantity: input.quantity,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
  });
}

export async function assertWithinQuota(input: {
  db: UsageDb;
  workspaceId: string;
  dimension: UsageDimension;
  periodStart: Date;
  periodEnd: Date;
}): Promise<void> {
  const subscription = await input.db.subscription?.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const planId = subscription?.planId ?? 'free';
  const limits = getPlanLimits(planId);
  const limit = limitForDimension(limits, input.dimension);
  const aggregate = await input.db.usageRecord.aggregate?.({
    where: {
      workspaceId: input.workspaceId,
      dimension: input.dimension,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    _sum: { quantity: true },
  });
  const used = aggregate?._sum.quantity ?? 0;

  if (!isUsageWithinLimit({ used, limit })) {
    throw new QuotaExceededError(input.dimension);
  }
}

function limitForDimension(
  limits: ReturnType<typeof getPlanLimits>,
  dimension: UsageDimension,
): number | null {
  const map: Record<UsageDimension, number | null> = {
    signatures: limits.signaturesPerMonth,
    documents: limits.documentsPerMonth,
    apiCalls: limits.apiCallsPerMonth,
    storageMb: limits.storageMb,
    seats: limits.seats,
    webhooks: limits.webhooksPerMonth,
  };
  return map[dimension];
}
```

- [x] **Step 4: Add quota plugin**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/quota-plugin.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { QuotaExceededError } from './usage-service.js';

export async function registerQuotaErrorHandler(app: FastifyInstance): Promise<void> {
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof QuotaExceededError) {
      return reply.code(error.statusCode).send({
        error: 'upgrade_required',
        code: error.code,
        message: error.message,
      });
    }
    throw error;
  });
}
```

- [x] **Step 5: Run quota tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/quota-service.test.ts
```

Expected: PASS.

- [x] **Step 6: Write the failing quota plugin HTTP test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/quota-plugin.test.ts`:

```ts
import Fastify from 'fastify';
import { describe, expect, it } from 'vitest';
import { registerQuotaErrorHandler } from '../src/modules/billing/quota-plugin';
import { QuotaExceededError } from '../src/modules/billing/usage-service';

describe('quota plugin', () => {
  it('serializes quota failures as upgrade-required HTTP 402 responses', async () => {
    const app = Fastify();
    await registerQuotaErrorHandler(app);
    app.get('/quota-test', async () => {
      throw new QuotaExceededError('signatures');
    });

    const response = await app.inject({ method: 'GET', url: '/quota-test' });

    expect(response.statusCode).toBe(402);
    expect(JSON.parse(response.body)).toEqual({
      error: 'upgrade_required',
      code: 'signature_quota_exceeded',
      message: 'Quota exceeded for signatures',
    });
  });
});
```

- [x] **Step 7: Run quota plugin test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/quota-plugin.test.ts
```

Expected: PASS.

- [x] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/billing apps/api/test/quota-service.test.ts apps/api/test/quota-plugin.test.ts
git commit -m "feat: enforce usage quotas"
```

Expected: commit succeeds.

## Task 4: Add Billing Provider Webhook Processing

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/types.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/fake-provider.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-webhook-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-webhook-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [x] **Step 1: Write the failing webhook route test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-webhook-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('billing webhook routes', () => {
  it('processes subscription updated events idempotently', async () => {
    const db = {
      billingWebhookEvent: {
        findUnique: vi.fn(async () => null),
        create: vi.fn(async ({ data }) => data),
        update: vi.fn(async ({ data }) => data),
      },
      subscription: {
        upsert: vi.fn(async ({ create }) => create),
      },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhooks/stripe',
      headers: { 'stripe-signature': 'test_signature' },
      payload: {
        id: 'evt_1',
        type: 'customer.subscription.updated',
        data: {
          object: {
            metadata: { workspaceId: 'wrk_1' },
            id: 'sub_1',
            customer: 'cus_1',
            status: 'active',
            items: { data: [{ price: { lookup_key: 'pro' } }] },
            current_period_start: 1777593600,
            current_period_end: 1780272000,
            cancel_at_period_end: false,
          },
        },
      },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true });
    expect(db.subscription.upsert).toHaveBeenCalledWith({
      where: { workspaceId: 'wrk_1' },
      update: expect.objectContaining({ planId: 'pro', status: 'active' }),
      create: expect.objectContaining({ workspaceId: 'wrk_1', planId: 'pro' }),
    });
    expect(db.billingWebhookEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        provider: 'stripe',
        providerEventId: 'evt_1',
      }),
    });
  });

  it('does not process a duplicate already-processed provider event', async () => {
    const db = {
      billingWebhookEvent: {
        findUnique: vi.fn(async () => ({ id: 'bwe_1', processedAt: new Date() })),
        create: vi.fn(),
        update: vi.fn(),
      },
      subscription: {
        upsert: vi.fn(),
      },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/billing/webhooks/stripe',
      headers: { 'stripe-signature': 'test_signature' },
      payload: { id: 'evt_1', type: 'customer.subscription.updated', data: { object: {} } },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({ received: true, duplicate: true });
    expect(db.billingWebhookEvent.create).not.toHaveBeenCalled();
    expect(db.subscription.upsert).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-webhook-routes.test.ts
```

Expected: FAIL because billing webhook routes are missing.

- [x] **Step 3: Add billing package types**

Create `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/types.ts`:

```ts
export interface BillingSubscriptionEvent {
  id: string;
  workspaceId: string;
  providerSubscriptionId: string;
  providerCustomerId: string;
  planId: 'free' | 'pro' | 'business';
  status: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
}

export interface BillingProvider {
  parseSubscriptionUpdated(payload: unknown): BillingSubscriptionEvent;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/stripe-compatible-provider.ts`:

```ts
import { z } from 'zod';
import type { BillingProvider, BillingSubscriptionEvent } from './types.js';

const stripeSubscriptionEventSchema = z.object({
  id: z.string(),
  type: z.literal('customer.subscription.updated'),
  data: z.object({
    object: z.object({
      metadata: z.object({ workspaceId: z.string() }),
      id: z.string(),
      customer: z.string(),
      status: z.string(),
      items: z.object({
        data: z.array(z.object({ price: z.object({ lookup_key: z.enum(['free', 'pro', 'business']) }) })).min(1),
      }),
      current_period_start: z.number(),
      current_period_end: z.number(),
      cancel_at_period_end: z.boolean(),
    }),
  }),
});

export class StripeCompatibleBillingProvider implements BillingProvider {
  parseSubscriptionUpdated(payload: unknown): BillingSubscriptionEvent {
    const event = stripeSubscriptionEventSchema.parse(payload);
    const object = event.data.object;
    return {
      id: event.id,
      workspaceId: object.metadata.workspaceId,
      providerSubscriptionId: object.id,
      providerCustomerId: object.customer,
      planId: object.items.data[0].price.lookup_key,
      status: object.status,
      currentPeriodStart: new Date(object.current_period_start * 1000),
      currentPeriodEnd: new Date(object.current_period_end * 1000),
      cancelAtPeriodEnd: object.cancel_at_period_end,
    };
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/billing/src/index.ts`:

```ts
export type { BillingProvider, BillingSubscriptionEvent } from './types.js';
export { StripeCompatibleBillingProvider } from './stripe-compatible-provider.js';
```

- [x] **Step 4: Implement billing webhook route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-webhook-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { StripeCompatibleBillingProvider } from '@dropsign/billing';

export async function registerBillingWebhookRoutes(app: FastifyInstance): Promise<void> {
  app.post('/v1/billing/webhooks/stripe', async (request) => {
    const payload = request.body as any;
    const provider = new StripeCompatibleBillingProvider();
    const existing = await app.db.billingWebhookEvent.findUnique({
      where: { provider_providerEventId: { provider: 'stripe', providerEventId: payload.id } },
    });
    if (existing?.processedAt) {
      return { received: true, duplicate: true };
    }
    const stored = existing ?? await app.db.billingWebhookEvent.create({
      data: {
        provider: 'stripe',
        providerEventId: payload.id,
        type: payload.type,
        payload,
      },
    });

    if (payload.type === 'customer.subscription.updated') {
      const event = provider.parseSubscriptionUpdated(payload);
      await app.db.subscription.upsert({
        where: { workspaceId: event.workspaceId },
        update: {
          planId: event.planId,
          status: event.status,
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        },
        create: {
          workspaceId: event.workspaceId,
          planId: event.planId,
          status: event.status,
          providerCustomerId: event.providerCustomerId,
          providerSubscriptionId: event.providerSubscriptionId,
          currentPeriodStart: event.currentPeriodStart,
          currentPeriodEnd: event.currentPeriodEnd,
          cancelAtPeriodEnd: event.cancelAtPeriodEnd,
        },
      });
    }

    await app.db.billingWebhookEvent.update({
      where: { id: stored.id },
      data: { processedAt: new Date() },
    });

    return { received: true };
  });
}
```

- [x] **Step 5: Register billing webhook routes**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` to include this route-registration shape while preserving all earlier route registrations:

```ts
import Fastify from 'fastify';
import { registerApiKeyRoutes } from './modules/api-keys/api-key-routes.js';
import { registerAuditRoutes } from './modules/audit/audit-routes.js';
import { registerBillingWebhookRoutes } from './modules/billing/billing-webhook-routes.js';
import { registerBillingSummaryRoutes } from './modules/billing/billing-summary-routes.js';
import { registerQuotaErrorHandler } from './modules/billing/quota-plugin.js';
import { registerEmailRoutes } from './modules/email/email-routes.js';
import { registerWebhookRoutes } from './modules/webhooks/webhook-routes.js';

export async function buildApiApp(deps: { db: unknown; queues?: { email?: unknown; webhook?: unknown } }) {
  const app = Fastify();
  app.decorate('db', deps.db);
  app.decorate('queues', deps.queues ?? {});
  await registerQuotaErrorHandler(app);
  await registerApiKeyRoutes(app);
  await registerAuditRoutes(app);
  await registerEmailRoutes(app);
  await registerWebhookRoutes(app);
  await registerBillingSummaryRoutes(app);
  await registerBillingWebhookRoutes(app);
  return app;
}
```

- [x] **Step 6: Run billing webhook test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-webhook-routes.test.ts
```

Expected: PASS.

- [x] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/billing apps/api/src/modules/billing/billing-webhook-routes.ts apps/api/src/app.ts apps/api/test/billing-webhook-routes.test.ts
git commit -m "feat: process billing webhooks"
```

Expected: commit succeeds.

## Task 5: Add Billing Summary API

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-summary-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-summary-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-summary-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [x] **Step 1: Write the failing billing summary route test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/billing-summary-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('billing summary routes', () => {
  it('returns plan, usage, invoices, and payment method state for the active workspace', async () => {
    const db = {
      subscription: {
        findUnique: vi.fn(async () => ({ planId: 'free', status: 'active' })),
      },
      usageRecord: {
        groupBy: vi.fn(async () => [
          { dimension: 'signatures', _sum: { quantity: 25 } },
          { dimension: 'documents', _sum: { quantity: 4 } },
        ]),
      },
      invoice: {
        findMany: vi.fn(async () => [
          { id: 'inv_1', status: 'open', amountDueCents: 1200, currency: 'usd' },
        ]),
      },
      paymentMethodState: {
        findUnique: vi.fn(async () => ({ brand: 'visa', last4: '4242', status: 'valid' })),
      },
    };
    const app = await buildApiApp({ db });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/billing/summary',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      planId: 'free',
      subscriptionStatus: 'active',
      usage: [
        { label: 'Signatures', used: 25, limit: 25 },
        { label: 'Documents', used: 4, limit: 10 },
        { label: 'API calls', used: 0, limit: 1000 },
        { label: 'Storage', used: 0, limit: 250 },
        { label: 'Seats', used: 0, limit: 1 },
        { label: 'Webhooks', used: 0, limit: 100 },
      ],
      invoices: [{ id: 'inv_1', status: 'open', amountDueCents: 1200, currency: 'usd' }],
      paymentMethod: { brand: 'visa', last4: '4242', status: 'valid' },
    });
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-summary-routes.test.ts
```

Expected: FAIL because `/v1/billing/summary` is missing.

- [x] **Step 3: Implement billing summary service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-summary-service.ts`:

```ts
import { getPlanLimits } from '@dropsign/domain/billing';
import type { PlanId } from '@dropsign/domain/billing';

interface BillingSummaryDb {
  subscription: {
    findUnique(args: { where: { workspaceId: string } }): Promise<{ planId: PlanId; status: string } | null>;
  };
  usageRecord: {
    groupBy(args: Record<string, unknown>): Promise<Array<{ dimension: string; _sum: { quantity: number | null } }>>;
  };
  invoice: {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; status: string; amountDueCents: number; currency: string }>>;
  };
  paymentMethodState: {
    findUnique(args: { where: { workspaceId: string } }): Promise<{ brand: string | null; last4: string | null; status: string } | null>;
  };
}

export async function getBillingSummary(input: { db: BillingSummaryDb; workspaceId: string }) {
  const subscription = await input.db.subscription.findUnique({
    where: { workspaceId: input.workspaceId },
  });
  const planId = subscription?.planId ?? 'free';
  const limits = getPlanLimits(planId);
  const usageRows = await input.db.usageRecord.groupBy({
    by: ['dimension'],
    where: { workspaceId: input.workspaceId },
    _sum: { quantity: true },
  });
  const usedByDimension = new Map(usageRows.map((row) => [row.dimension, row._sum.quantity ?? 0]));
  const invoices = await input.db.invoice.findMany({
    where: { workspaceId: input.workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });
  const paymentMethod = await input.db.paymentMethodState.findUnique({
    where: { workspaceId: input.workspaceId },
  });

  return {
    planId,
    subscriptionStatus: subscription?.status ?? 'free',
    usage: [
      { label: 'Signatures', used: usedByDimension.get('signatures') ?? 0, limit: limits.signaturesPerMonth },
      { label: 'Documents', used: usedByDimension.get('documents') ?? 0, limit: limits.documentsPerMonth },
      { label: 'API calls', used: usedByDimension.get('apiCalls') ?? 0, limit: limits.apiCallsPerMonth },
      { label: 'Storage', used: usedByDimension.get('storageMb') ?? 0, limit: limits.storageMb },
      { label: 'Seats', used: usedByDimension.get('seats') ?? 0, limit: limits.seats },
      { label: 'Webhooks', used: usedByDimension.get('webhooks') ?? 0, limit: limits.webhooksPerMonth },
    ],
    invoices,
    paymentMethod,
  };
}
```

- [x] **Step 4: Implement billing summary route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/billing/billing-summary-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import { getBillingSummary } from './billing-summary-service.js';

export async function registerBillingSummaryRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/billing/summary', async (request, reply) => {
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }
    return getBillingSummary({ db: app.db, workspaceId });
  });
}
```

- [x] **Step 5: Run billing summary route test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-summary-routes.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/billing/billing-summary-routes.ts apps/api/src/modules/billing/billing-summary-service.ts apps/api/src/app.ts apps/api/test/billing-summary-routes.test.ts
git commit -m "feat: expose billing summary"
```

Expected: commit succeeds.

## Task 6: Add Dashboard Billing Page

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/billing/usage-meter.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/billing/billing-summary.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/billing-summary.test.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/settings/billing/page.tsx`

- [x] **Step 1: Write the failing billing UI test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/billing-summary.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { BillingSummary } from '../components/billing/billing-summary';

describe('BillingSummary', () => {
  it('shows plan, usage, invoices, payment method state, and quota warning', () => {
    render(
      <BillingSummary
        planId="free"
        subscriptionStatus="active"
        usage={[
          { label: 'Signatures', used: 25, limit: 25 },
          { label: 'Documents', used: 4, limit: 10 },
        ]}
        invoices={[{ id: 'inv_1', status: 'open', amountDueCents: 1200, currency: 'usd' }]}
        paymentMethod={{ brand: 'visa', last4: '4242', status: 'valid' }}
      />,
    );

    expect(screen.getByText('free')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('Signatures: 25 / 25')).toBeInTheDocument();
    expect(screen.getByText('Upgrade required')).toBeInTheDocument();
    expect(screen.getByText('$12.00 open')).toBeInTheDocument();
    expect(screen.getByText('visa ending in 4242')).toBeInTheDocument();
    expect(screen.getByText('valid')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/billing-summary.test.tsx
```

Expected: FAIL because billing UI components are missing.

- [x] **Step 3: Add usage meter**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/billing/usage-meter.tsx`:

```tsx
export function UsageMeter({
  label,
  used,
  limit,
}: {
  label: string;
  used: number;
  limit: number | null;
}) {
  const exhausted = limit !== null && used >= limit;

  return (
    <div>
      <p>
        {label}: {used} / {limit === null ? 'Unlimited' : limit}
      </p>
      {exhausted ? <strong>Upgrade required</strong> : null}
    </div>
  );
}
```

- [x] **Step 4: Add billing summary**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/billing/billing-summary.tsx`:

```tsx
import { UsageMeter } from './usage-meter.js';

interface UsageRow {
  label: string;
  used: number;
  limit: number | null;
}

interface InvoiceRow {
  id: string;
  status: string;
  amountDueCents: number;
  currency: string;
}

interface PaymentMethodSummary {
  brand: string | null;
  last4: string | null;
  status: string;
}

export function BillingSummary({
  planId,
  subscriptionStatus,
  usage,
  invoices,
  paymentMethod,
}: {
  planId: string;
  subscriptionStatus: string;
  usage: UsageRow[];
  invoices: InvoiceRow[];
  paymentMethod: PaymentMethodSummary | null;
}) {
  return (
    <section>
      <h1>Billing</h1>
      <p>{planId}</p>
      <p>{subscriptionStatus}</p>
      {usage.map((row) => (
        <UsageMeter key={row.label} label={row.label} used={row.used} limit={row.limit} />
      ))}
      <h2>Payment method</h2>
      {paymentMethod ? (
        <p>
          {paymentMethod.brand ?? 'card'} ending in {paymentMethod.last4 ?? 'unknown'}{' '}
          <span>{paymentMethod.status}</span>
        </p>
      ) : (
        <p>No payment method on file</p>
      )}
      <h2>Invoices</h2>
      <ul>
        {invoices.map((invoice) => (
          <li key={invoice.id}>
            {formatMoney(invoice.amountDueCents, invoice.currency)} {invoice.status}
          </li>
        ))}
      </ul>
    </section>
  );
}

function formatMoney(amountDueCents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountDueCents / 100);
}
```

- [x] **Step 5: Add billing page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/settings/billing/page.tsx`:

```tsx
import { BillingSummary } from '../../../../components/billing/billing-summary';

export default async function BillingPage() {
  const response = await fetch(`${process.env.DROPSIGN_API_URL}/v1/billing/summary`, {
    cache: 'no-store',
  });
  const summary = (await response.json()) as Parameters<typeof BillingSummary>[0];

  return (
    <main>
      <BillingSummary {...summary} />
    </main>
  );
}
```

- [x] **Step 6: Run billing UI test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/billing-summary.test.tsx
```

Expected: PASS.

- [x] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/components/billing apps/web/app/(dashboard)/settings/billing/page.tsx apps/web/tests/billing-summary.test.tsx
git commit -m "feat: show billing summary"
```

Expected: commit succeeds.

## Phase Verification

- [x] **Step 1: Run focused tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/billing-domain.test.ts apps/api/test/usage-schema.test.ts apps/api/test/quota-service.test.ts apps/api/test/quota-plugin.test.ts apps/api/test/billing-webhook-routes.test.ts apps/api/test/billing-summary-routes.test.ts apps/web/tests/billing-summary.test.tsx
```

Expected: all focused tests pass.

- [x] **Step 2: Run workspace checks**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands pass.

- [x] **Step 3: Confirm quota API behavior**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/quota-service.test.ts -t "upgrade-required"
```

Expected: PASS and exhausted usage produces `statusCode: 402` with code `signature_quota_exceeded`.
