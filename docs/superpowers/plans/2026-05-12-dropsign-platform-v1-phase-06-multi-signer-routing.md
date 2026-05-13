# Multi-Signer Routing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add DropSign Cloud v1 multi-signer routing so signing requests support `parallel` and `sequential` routing, signer roles and ordering, assigned-field enforcement, route gating, completion rules, dashboard signer setup, public waiting state, and API/E2E coverage.

**Architecture:** Keep routing rules in a shared API domain service so REST handlers, public signing session reads, and artifact submission use the same decisions. Persist request routing mode and signer ordering/status in PostgreSQL, enforce field assignment on the server before accepting field values, and expose route state to the public app so out-of-turn signers see a waiting page instead of document data. Dashboard request creation collects signer roles, email, required flag, and route order, then sends the same API payload used by external clients.

**Tech Stack:** TypeScript, Node.js API service, PostgreSQL, Prisma migrations, Next.js dashboard, Next.js public signing app, Vitest, Supertest, Playwright, pnpm.

---

## Files

Create:

- `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512060000_multi_signer_routing/migration.sql`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.test.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.test.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.test.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.test.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.test.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/e2e/tests/multi-signer-routing.spec.ts`

Modify:

- `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signatureArtifacts.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/types.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.test.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`
- `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.test.tsx`
- `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.ts`
- `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.test.ts`
- `/Users/minjun/Documents/dropsign-cloud/apps/e2e/support/api.ts`

## Data Contract

Use these exact domain values across database, API, dashboard, and public signing:

```ts
export type RoutingMode = 'parallel' | 'sequential';
export type SignerStatus = 'pending' | 'waiting' | 'viewed' | 'completed' | 'declined';
export type SigningRequestStatus = 'draft' | 'sent' | 'partially_completed' | 'completed' | 'cancelled' | 'document_failed';

export interface SignerInput {
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  required: boolean;
}

export interface PublicSigningSession {
  requestId: string;
  signerId: string;
  signerName: string;
  signerEmail: string;
  signerRole: string;
  routingMode: RoutingMode;
  signerStatus: SignerStatus;
  canSign: boolean;
  waitingFor: Array<{ signerId: string; name: string; role: string; routingOrder: number }>;
  assignedFields: Array<{
    id: string;
    type: 'signature' | 'initials' | 'date' | 'name' | 'text' | 'checkbox' | 'metadata';
    required: boolean;
    role: string;
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}
```

API errors for this phase:

```ts
export const routingErrors = {
  signerBlocked: {
    code: 'SIGNER_ROUTING_BLOCKED',
    message: 'This signer is waiting for earlier routing steps to finish.',
    status: 409,
  },
  fieldNotAssigned: {
    code: 'FIELD_NOT_ASSIGNED_TO_SIGNER',
    message: 'A submitted field is not assigned to this signer role.',
    status: 422,
  },
  requiredFieldsMissing: {
    code: 'REQUIRED_FIELDS_MISSING',
    message: 'All required fields assigned to this signer must be completed.',
    status: 422,
  },
} as const;
```

## Task 1: Persist Routing Mode, Signer Ordering, And Signer Status

**Files:**

- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512060000_multi_signer_routing/migration.sql`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/types.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.test.ts`

- [ ] **Step 1: Write the failing API contract test**

Add this test to `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiTestApp, createWorkspaceMemberAuth } from '../test/apiTestHarness';

describe('POST /v1/signing-requests multi-signer routing', () => {
  it('creates a sequential request with signer roles, required flags, and routing order', async () => {
    const { app, prisma } = await createApiTestApp();
    const auth = await createWorkspaceMemberAuth(prisma, { role: 'member' });
    const document = await prisma.document.create({
      data: {
        workspaceId: auth.workspaceId,
        projectId: auth.projectId,
        sourceObjectKey: 'documents/source/sequential-contract.pdf',
        status: 'uploaded',
        title: 'Sequential Contract',
      },
    });

    const response = await request(app)
      .post('/v1/signing-requests')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        documentId: document.id,
        routingMode: 'sequential',
        signers: [
          {
            email: 'buyer@example.com',
            name: 'Buyer One',
            role: 'buyer',
            routingOrder: 1,
            required: true,
          },
          {
            email: 'seller@example.com',
            name: 'Seller One',
            role: 'seller',
            routingOrder: 2,
            required: true,
          },
        ],
      })
      .expect(201);

    expect(response.body).toMatchObject({
      documentId: document.id,
      routingMode: 'sequential',
      status: 'sent',
      signers: [
        {
          email: 'buyer@example.com',
          name: 'Buyer One',
          role: 'buyer',
          routingOrder: 1,
          required: true,
          status: 'pending',
        },
        {
          email: 'seller@example.com',
          name: 'Seller One',
          role: 'seller',
          routingOrder: 2,
          required: true,
          status: 'waiting',
        },
      ],
    });

    const storedRequest = await prisma.signingRequest.findUniqueOrThrow({
      where: { id: response.body.id },
      include: { signers: { orderBy: { routingOrder: 'asc' } } },
    });

    expect(storedRequest.routingMode).toBe('sequential');
    expect(storedRequest.signers.map((signer) => [signer.role, signer.routingOrder, signer.status])).toEqual([
      ['buyer', 1, 'pending'],
      ['seller', 2, 'waiting'],
    ]);
  });

  it('creates a parallel request with all signers immediately pending', async () => {
    const { app, prisma } = await createApiTestApp();
    const auth = await createWorkspaceMemberAuth(prisma, { role: 'member' });
    const document = await prisma.document.create({
      data: {
        workspaceId: auth.workspaceId,
        projectId: auth.projectId,
        sourceObjectKey: 'documents/source/parallel-contract.pdf',
        status: 'uploaded',
        title: 'Parallel Contract',
      },
    });

    const response = await request(app)
      .post('/v1/signing-requests')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({
        documentId: document.id,
        routingMode: 'parallel',
        signers: [
          { email: 'finance@example.com', name: 'Finance', role: 'finance', routingOrder: 1, required: true },
          { email: 'legal@example.com', name: 'Legal', role: 'legal', routingOrder: 1, required: true },
        ],
      })
      .expect(201);

    expect(response.body.signers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ role: 'finance', routingOrder: 1, status: 'pending' }),
        expect.objectContaining({ role: 'legal', routingOrder: 1, status: 'pending' }),
      ]),
    );
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- signingRequests.test.ts
```

Expected: FAIL with one of these concrete failures: Prisma reports `Unknown argument routingMode`, the response body lacks `routingMode`, or signers do not include `routingOrder` and `status`.

- [ ] **Step 3: Add Prisma schema fields and migration**

In `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`, update the routing-related models and enums to include these exact fields:

```prisma
enum RoutingMode {
  parallel
  sequential
}

enum SignerStatus {
  pending
  waiting
  viewed
  completed
  declined
}

model SigningRequest {
  id          String               @id @default(cuid())
  workspaceId String
  projectId   String
  documentId  String
  routingMode RoutingMode          @default(parallel)
  status      SigningRequestStatus @default(sent)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project   Project   @relation(fields: [projectId], references: [id], onDelete: Cascade)
  document  Document  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  signers   Signer[]
  fields    Field[]

  @@index([workspaceId, status])
  @@index([projectId, status])
}

model Signer {
  id               String       @id @default(cuid())
  workspaceId      String
  signingRequestId String
  email            String
  name             String
  role             String
  routingOrder     Int          @default(1)
  required         Boolean      @default(true)
  status           SignerStatus @default(pending)
  tokenHash        String
  tokenExpiresAt   DateTime
  completedAt      DateTime?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt

  workspace      Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  signingRequest SigningRequest @relation(fields: [signingRequestId], references: [id], onDelete: Cascade)

  @@index([workspaceId, status])
  @@index([signingRequestId, routingOrder])
  @@unique([signingRequestId, role, email])
}

model Field {
  id               String  @id @default(cuid())
  workspaceId      String
  signingRequestId String
  role             String
  type             String
  required         Boolean @default(false)
  page             Int
  x                Float
  y                Float
  width            Float
  height           Float

  workspace      Workspace      @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  signingRequest SigningRequest @relation(fields: [signingRequestId], references: [id], onDelete: Cascade)

  @@index([signingRequestId, role])
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512060000_multi_signer_routing/migration.sql`:

```sql
CREATE TYPE "RoutingMode" AS ENUM ('parallel', 'sequential');
CREATE TYPE "SignerStatus" AS ENUM ('pending', 'waiting', 'viewed', 'completed', 'declined');

ALTER TABLE "SigningRequest"
  ADD COLUMN "routingMode" "RoutingMode" NOT NULL DEFAULT 'parallel';

ALTER TABLE "Signer"
  ADD COLUMN "role" text NOT NULL DEFAULT 'signer',
  ADD COLUMN "routingOrder" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "status" "SignerStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN "completedAt" TIMESTAMP(3);

ALTER TABLE "Field"
  ADD COLUMN "role" text NOT NULL DEFAULT 'signer';

CREATE INDEX "SigningRequest_workspaceId_status_idx" ON "SigningRequest"("workspaceId", "status");
CREATE INDEX "SigningRequest_projectId_status_idx" ON "SigningRequest"("projectId", "status");
CREATE INDEX "Signer_workspaceId_status_idx" ON "Signer"("workspaceId", "status");
CREATE INDEX "Signer_signingRequestId_routingOrder_idx" ON "Signer"("signingRequestId", "routingOrder");
CREATE UNIQUE INDEX "Signer_signingRequestId_role_email_key" ON "Signer"("signingRequestId", "role", "email");
CREATE INDEX "Field_signingRequestId_role_idx" ON "Field"("signingRequestId", "role");
```

Update `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/types.ts`:

```ts
export type RoutingMode = 'parallel' | 'sequential';
export type SignerStatus = 'pending' | 'waiting' | 'viewed' | 'completed' | 'declined';
export type SigningRequestStatus =
  | 'draft'
  | 'sent'
  | 'partially_completed'
  | 'completed'
  | 'cancelled'
  | 'document_failed';

export interface SignerInput {
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  required: boolean;
}
```

- [ ] **Step 4: Update request creation to set initial signer statuses**

In `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.ts`, parse the new payload and create signers with these initial statuses:

```ts
import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../prisma';
import { requireWorkspaceMember } from '../auth/requireWorkspaceMember';

const signerInputSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.string().min(1).regex(/^[a-zA-Z0-9_-]+$/),
  routingOrder: z.number().int().min(1),
  required: z.boolean().default(true),
});

const createSigningRequestSchema = z.object({
  documentId: z.string().min(1),
  routingMode: z.enum(['parallel', 'sequential']).default('parallel'),
  signers: z.array(signerInputSchema).min(1),
});

const initialSignerStatus = (
  routingMode: 'parallel' | 'sequential',
  routingOrder: number,
  minimumOrder: number,
) => {
  if (routingMode === 'parallel') return 'pending';
  return routingOrder === minimumOrder ? 'pending' : 'waiting';
};

export const signingRequestsRouter = Router();

signingRequestsRouter.post('/v1/signing-requests', requireWorkspaceMember, async (req, res) => {
  const input = createSigningRequestSchema.parse(req.body);
  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: input.documentId,
      workspaceId: req.auth.workspaceId,
    },
  });
  const minimumOrder = Math.min(...input.signers.map((signer) => signer.routingOrder));

  const signingRequest = await prisma.signingRequest.create({
    data: {
      workspaceId: req.auth.workspaceId,
      projectId: document.projectId,
      documentId: document.id,
      routingMode: input.routingMode,
      status: 'sent',
      signers: {
        create: input.signers.map((signer) => ({
          workspaceId: req.auth.workspaceId,
          email: signer.email,
          name: signer.name,
          role: signer.role,
          routingOrder: signer.routingOrder,
          required: signer.required,
          status: initialSignerStatus(input.routingMode, signer.routingOrder, minimumOrder),
          tokenHash: req.services.signingTokens.createHash(),
          tokenExpiresAt: req.services.clock.addDays(30),
        })),
      },
    },
    include: { signers: { orderBy: [{ routingOrder: 'asc' }, { createdAt: 'asc' }] } },
  });

  res.status(201).json(signingRequest);
});
```

- [ ] **Step 5: Run the passing test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- signingRequests.test.ts
```

Expected: PASS for both `POST /v1/signing-requests multi-signer routing` tests.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260512060000_multi_signer_routing/migration.sql apps/api/src/signing/types.ts apps/api/src/routes/signingRequests.ts apps/api/src/routes/signingRequests.test.ts
git commit -m "feat: persist multi-signer routing metadata"
```

Expected: commit succeeds with the five listed paths staged.

## Task 2: Centralize Route Gating Rules

**Files:**

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`

- [ ] **Step 1: Write failing domain tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateSignerRoute, nextSequentialStatuses } from './routing';

const signers = [
  { id: 'buyer-1', name: 'Buyer One', role: 'buyer', routingOrder: 1, status: 'completed' as const },
  { id: 'seller-1', name: 'Seller One', role: 'seller', routingOrder: 2, status: 'pending' as const },
  { id: 'legal-1', name: 'Legal One', role: 'legal', routingOrder: 3, status: 'waiting' as const },
];

describe('evaluateSignerRoute', () => {
  it('allows every incomplete signer when routing is parallel', () => {
    expect(evaluateSignerRoute({ routingMode: 'parallel', signerId: 'legal-1', signers })).toEqual({
      canSign: true,
      waitingFor: [],
    });
  });

  it('allows only the lowest incomplete routing order when routing is sequential', () => {
    expect(evaluateSignerRoute({ routingMode: 'sequential', signerId: 'seller-1', signers })).toEqual({
      canSign: true,
      waitingFor: [],
    });
    expect(evaluateSignerRoute({ routingMode: 'sequential', signerId: 'legal-1', signers })).toEqual({
      canSign: false,
      waitingFor: [{ signerId: 'seller-1', name: 'Seller One', role: 'seller', routingOrder: 2 }],
    });
  });
});

describe('nextSequentialStatuses', () => {
  it('moves the next routing order from waiting to pending after a signer completes', () => {
    expect(nextSequentialStatuses({ completedSignerId: 'seller-1', signers })).toEqual([
      { signerId: 'legal-1', status: 'pending' },
    ]);
  });
});
```

- [ ] **Step 2: Run the failing domain test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- routing.test.ts
```

Expected: FAIL with `Cannot find module './routing'`.

- [ ] **Step 3: Implement routing service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.ts`:

```ts
import type { RoutingMode, SignerStatus } from './types';

export interface RouteSigner {
  id: string;
  name: string;
  role: string;
  routingOrder: number;
  status: SignerStatus;
}

export interface WaitingSigner {
  signerId: string;
  name: string;
  role: string;
  routingOrder: number;
}

const incompleteStatuses = new Set<SignerStatus>(['pending', 'waiting', 'viewed']);

export function evaluateSignerRoute(input: {
  routingMode: RoutingMode;
  signerId: string;
  signers: RouteSigner[];
}): { canSign: boolean; waitingFor: WaitingSigner[] } {
  const signer = input.signers.find((candidate) => candidate.id === input.signerId);
  if (!signer || signer.status === 'completed' || signer.status === 'declined') {
    return { canSign: false, waitingFor: [] };
  }

  if (input.routingMode === 'parallel') {
    return { canSign: true, waitingFor: [] };
  }

  const incompleteOrders = input.signers
    .filter((candidate) => incompleteStatuses.has(candidate.status))
    .map((candidate) => candidate.routingOrder);
  const activeOrder = Math.min(...incompleteOrders);

  if (signer.routingOrder === activeOrder) {
    return { canSign: true, waitingFor: [] };
  }

  const waitingFor = input.signers
    .filter(
      (candidate) =>
        incompleteStatuses.has(candidate.status) && candidate.routingOrder === activeOrder,
    )
    .map((candidate) => ({
      signerId: candidate.id,
      name: candidate.name,
      role: candidate.role,
      routingOrder: candidate.routingOrder,
    }));

  return { canSign: false, waitingFor };
}

export function nextSequentialStatuses(input: {
  completedSignerId: string;
  signers: RouteSigner[];
}): Array<{ signerId: string; status: 'pending' }> {
  const remaining = input.signers.filter(
    (signer) => signer.id !== input.completedSignerId && incompleteStatuses.has(signer.status),
  );

  if (remaining.length === 0) {
    return [];
  }

  const nextOrder = Math.min(...remaining.map((signer) => signer.routingOrder));
  return remaining
    .filter((signer) => signer.routingOrder === nextOrder && signer.status === 'waiting')
    .map((signer) => ({ signerId: signer.id, status: 'pending' }));
}
```

- [ ] **Step 4: Run the passing domain test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- routing.test.ts
```

Expected: PASS for all three routing service assertions.

- [ ] **Step 5: Write the failing public signing session test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`:

```ts
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApiTestApp, seedSequentialSigningRequest } from '../test/apiTestHarness';

describe('GET /api/public/signing/:token route gating', () => {
  it('returns waiting state without assigned fields for an out-of-turn sequential signer', async () => {
    const { app, prisma } = await createApiTestApp();
    const seeded = await seedSequentialSigningRequest(prisma, {
      firstSignerStatus: 'pending',
      secondSignerStatus: 'waiting',
      fields: [
        { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true },
        { id: 'seller-signature', role: 'seller', type: 'signature', required: true },
      ],
    });

    const response = await request(app)
      .get(`/api/public/signing/${seeded.secondSignerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      signerId: seeded.secondSignerId,
      signerRole: 'seller',
      routingMode: 'sequential',
      signerStatus: 'waiting',
      canSign: false,
      waitingFor: [
        {
          signerId: seeded.firstSignerId,
          name: 'Buyer One',
          role: 'buyer',
          routingOrder: 1,
        },
      ],
      assignedFields: [],
    });
  });

  it('returns assigned fields for an active sequential signer', async () => {
    const { app, prisma } = await createApiTestApp();
    const seeded = await seedSequentialSigningRequest(prisma, {
      firstSignerStatus: 'pending',
      secondSignerStatus: 'waiting',
      fields: [
        { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true },
        { id: 'seller-signature', role: 'seller', type: 'signature', required: true },
      ],
    });

    const response = await request(app)
      .get(`/api/public/signing/${seeded.firstSignerToken}`)
      .expect(200);

    expect(response.body).toMatchObject({
      signerId: seeded.firstSignerId,
      signerRole: 'buyer',
      routingMode: 'sequential',
      canSign: true,
      waitingFor: [],
      assignedFields: [
        expect.objectContaining({
          id: 'buyer-signature',
          role: 'buyer',
          type: 'signature',
          required: true,
        }),
      ],
    });
  });
});
```

- [ ] **Step 6: Run the failing public session test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- publicSigning.test.ts
```

Expected: FAIL because `canSign`, `waitingFor`, or `assignedFields` are not returned.

- [ ] **Step 7: Use routing service in public session endpoint**

In `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.ts`, return route-aware public sessions:

```ts
import { Router } from 'express';
import { prisma } from '../prisma';
import { evaluateSignerRoute } from '../signing/routing';
import { verifySigningToken } from '../signing/tokens';

export const publicSigningRouter = Router();

publicSigningRouter.get('/api/public/signing/:token', async (req, res) => {
  const token = await verifySigningToken(req.params.token);
  const signer = await prisma.signer.findFirstOrThrow({
    where: {
      id: token.signerId,
      tokenHash: token.hash,
      tokenExpiresAt: { gt: new Date() },
    },
    include: {
      signingRequest: {
        include: {
          signers: { orderBy: [{ routingOrder: 'asc' }, { createdAt: 'asc' }] },
          fields: { orderBy: [{ page: 'asc' }, { y: 'asc' }, { x: 'asc' }] },
        },
      },
    },
  });

  const route = evaluateSignerRoute({
    routingMode: signer.signingRequest.routingMode,
    signerId: signer.id,
    signers: signer.signingRequest.signers,
  });

  if (signer.status === 'pending') {
    await prisma.signer.update({
      where: { id: signer.id },
      data: { status: 'viewed' },
    });
  }

  res.json({
    requestId: signer.signingRequestId,
    signerId: signer.id,
    signerName: signer.name,
    signerEmail: signer.email,
    signerRole: signer.role,
    routingMode: signer.signingRequest.routingMode,
    signerStatus: signer.status,
    canSign: route.canSign,
    waitingFor: route.waitingFor,
    assignedFields: route.canSign
      ? signer.signingRequest.fields.filter((field) => field.role === signer.role)
      : [],
  });
});
```

- [ ] **Step 8: Run routing and public session tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- routing.test.ts publicSigning.test.ts
```

Expected: PASS for route gating domain tests and public signing session route gating tests.

- [ ] **Step 9: Commit Task 2**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/signing/routing.ts apps/api/src/signing/routing.test.ts apps/api/src/routes/publicSigning.ts apps/api/src/routes/publicSigning.test.ts
git commit -m "feat: enforce sequential signing route visibility"
```

Expected: commit succeeds with route service and public session changes.

## Task 3: Enforce Assigned Fields And Complete Sequential Steps

**Files:**

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signatureArtifacts.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`

- [ ] **Step 1: Write failing completion rule tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { evaluateRequestCompletion, validateAssignedFieldValues } from './requestCompletion';

describe('validateAssignedFieldValues', () => {
  const fields = [
    { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true },
    { id: 'buyer-date', role: 'buyer', type: 'date', required: true },
    { id: 'buyer-approval', role: 'buyer', type: 'checkbox', required: true },
    { id: 'seller-signature', role: 'seller', type: 'signature', required: true },
  ];

  it('rejects values for fields assigned to another signer role', () => {
    expect(() =>
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [
          { fieldId: 'buyer-signature', value: 'signature-object-key' },
          { fieldId: 'seller-signature', value: 'signature-object-key' },
        ],
      }),
    ).toThrow('FIELD_NOT_ASSIGNED_TO_SIGNER');
  });

  it('rejects missing required fields assigned to the signer role', () => {
    expect(() =>
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [{ fieldId: 'buyer-signature', value: 'signature-object-key' }],
      }),
    ).toThrow('REQUIRED_FIELDS_MISSING:buyer-date,buyer-approval');
  });

  it('rejects empty strings for required typed fields', () => {
    expect(() =>
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [
          { fieldId: 'buyer-signature', value: 'signature-object-key' },
          { fieldId: 'buyer-date', value: '   ' },
          { fieldId: 'buyer-approval', value: true },
        ],
      }),
    ).toThrow('REQUIRED_FIELDS_MISSING:buyer-date');
  });

  it('rejects missing signature artifact values for required signature fields', () => {
    expect(() =>
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [
          { fieldId: 'buyer-signature', value: '' },
          { fieldId: 'buyer-date', value: '2026-05-12' },
          { fieldId: 'buyer-approval', value: true },
        ],
      }),
    ).toThrow('REQUIRED_FIELDS_MISSING:buyer-signature');
  });

  it('requires checked=true for required checkbox fields', () => {
    expect(() =>
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [
          { fieldId: 'buyer-signature', value: 'signature-object-key' },
          { fieldId: 'buyer-date', value: '2026-05-12' },
          { fieldId: 'buyer-approval', value: false },
        ],
      }),
    ).toThrow('REQUIRED_FIELDS_MISSING:buyer-approval');
  });

  it('accepts all required fields assigned to the signer role', () => {
    expect(
      validateAssignedFieldValues({
        signerRole: 'buyer',
        fields,
        submittedFieldValues: [
          { fieldId: 'buyer-signature', value: 'signature-object-key' },
          { fieldId: 'buyer-date', value: '2026-05-12' },
          { fieldId: 'buyer-approval', value: true },
        ],
      }),
    ).toEqual(['buyer-signature', 'buyer-date', 'buyer-approval']);
  });
});

describe('evaluateRequestCompletion', () => {
  it('marks request complete only when every required signer is completed', () => {
    expect(
      evaluateRequestCompletion({
        signers: [
          { id: 'buyer-1', required: true, status: 'completed' },
          { id: 'seller-1', required: true, status: 'completed' },
          { id: 'observer-1', required: false, status: 'waiting' },
        ],
      }),
    ).toBe('completed');
  });

  it('keeps request partially completed while a required signer remains incomplete', () => {
    expect(
      evaluateRequestCompletion({
        signers: [
          { id: 'buyer-1', required: true, status: 'completed' },
          { id: 'seller-1', required: true, status: 'pending' },
        ],
      }),
    ).toBe('partially_completed');
  });
});
```

- [ ] **Step 2: Run the failing completion tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- requestCompletion.test.ts
```

Expected: FAIL with `Cannot find module './requestCompletion'`.

- [ ] **Step 3: Implement completion and assignment service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.ts`:

```ts
import type { SignerStatus, SigningRequestStatus } from './types';

interface AssignedField {
  id: string;
  role: string;
  type: 'signature' | 'initials' | 'date' | 'name' | 'text' | 'checkbox' | 'metadata';
  required: boolean;
}

interface SubmittedFieldValue {
  fieldId: string;
  value?: string | boolean | number | null;
}

function isCompleteRequiredValue(field: AssignedField, value: SubmittedFieldValue | undefined) {
  if (!value) return false;
  if (field.type === 'checkbox') return value.value === true;
  if (field.type === 'signature' || field.type === 'initials') {
    return typeof value.value === 'string' && value.value.trim().length > 0;
  }
  if (typeof value.value === 'string') return value.value.trim().length > 0;
  return value.value !== null && value.value !== undefined;
}

export function validateAssignedFieldValues(input: {
  signerRole: string;
  fields: AssignedField[];
  submittedFieldValues: SubmittedFieldValue[];
}): string[] {
  const assignedFields = input.fields.filter((field) => field.role === input.signerRole);
  const assignedIds = new Set(assignedFields.map((field) => field.id));
  const submittedByFieldId = new Map(input.submittedFieldValues.map((value) => [value.fieldId, value]));

  const foreignField = input.submittedFieldValues.find((value) => !assignedIds.has(value.fieldId));
  if (foreignField) {
    throw new Error(`FIELD_NOT_ASSIGNED_TO_SIGNER:${foreignField.fieldId}`);
  }

  const missingRequired = assignedFields
    .filter((field) => field.required && !isCompleteRequiredValue(field, submittedByFieldId.get(field.id)))
    .map((field) => field.id);
  if (missingRequired.length > 0) {
    throw new Error(`REQUIRED_FIELDS_MISSING:${missingRequired.join(',')}`);
  }

  return input.submittedFieldValues.map((value) => value.fieldId);
}

export function evaluateRequestCompletion(input: {
  signers: Array<{ id: string; required: boolean; status: SignerStatus }>;
}): Extract<SigningRequestStatus, 'partially_completed' | 'completed'> {
  const requiredSigners = input.signers.filter((signer) => signer.required);
  return requiredSigners.every((signer) => signer.status === 'completed')
    ? 'completed'
    : 'partially_completed';
}
```

- [ ] **Step 4: Run the passing completion tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- requestCompletion.test.ts
```

Expected: PASS for all eight completion and assignment assertions.

- [ ] **Step 5: Write failing artifact submission API tests**

Append these tests to `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`:

```ts
describe('POST /api/public/signing/:token/complete assigned fields', () => {
  it('rejects out-of-turn sequential completion', async () => {
    const { app, prisma } = await createApiTestApp();
    const seeded = await seedSequentialSigningRequest(prisma, {
      firstSignerStatus: 'pending',
      secondSignerStatus: 'waiting',
      fields: [{ id: 'seller-signature', role: 'seller', type: 'signature', required: true }],
    });

    const response = await request(app)
      .post(`/api/public/signing/${seeded.secondSignerToken}/complete`)
      .send({
        fieldValues: [{ fieldId: 'seller-signature', value: 'signatures/seller.png' }],
      })
      .expect(409);

    expect(response.body).toEqual({
      code: 'SIGNER_ROUTING_BLOCKED',
      message: 'This signer is waiting for earlier routing steps to finish.',
    });
  });

  it('rejects a submitted field assigned to another signer role', async () => {
    const { app, prisma } = await createApiTestApp();
    const seeded = await seedSequentialSigningRequest(prisma, {
      firstSignerStatus: 'pending',
      secondSignerStatus: 'waiting',
      fields: [
        { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true },
        { id: 'seller-signature', role: 'seller', type: 'signature', required: true },
      ],
    });

    const response = await request(app)
      .post(`/api/public/signing/${seeded.firstSignerToken}/complete`)
      .send({
        fieldValues: [
          { fieldId: 'buyer-signature', value: 'signatures/buyer.png' },
          { fieldId: 'seller-signature', value: 'signatures/seller.png' },
        ],
      })
      .expect(422);

    expect(response.body).toEqual({
      code: 'FIELD_NOT_ASSIGNED_TO_SIGNER',
      message: 'A submitted field is not assigned to this signer role.',
    });
  });

  it('completes the active signer and opens the next sequential signer', async () => {
    const { app, prisma } = await createApiTestApp();
    const seeded = await seedSequentialSigningRequest(prisma, {
      firstSignerStatus: 'pending',
      secondSignerStatus: 'waiting',
      fields: [
        { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true },
        { id: 'seller-signature', role: 'seller', type: 'signature', required: true },
      ],
    });

    await request(app)
      .post(`/api/public/signing/${seeded.firstSignerToken}/complete`)
      .send({
        fieldValues: [{ fieldId: 'buyer-signature', value: 'signatures/buyer.png' }],
      })
      .expect(200);

    const signers = await prisma.signer.findMany({
      where: { signingRequestId: seeded.requestId },
      orderBy: { routingOrder: 'asc' },
    });
    const signingRequest = await prisma.signingRequest.findUniqueOrThrow({
      where: { id: seeded.requestId },
    });

    expect(signers.map((signer) => [signer.role, signer.status])).toEqual([
      ['buyer', 'completed'],
      ['seller', 'pending'],
    ]);
    expect(signingRequest.status).toBe('partially_completed');
  });
});
```

- [ ] **Step 6: Run the failing artifact submission tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- publicSigning.test.ts
```

Expected: FAIL because the complete endpoint does not reject blocked signers, does not enforce assigned fields, or does not advance the next signer.

- [ ] **Step 7: Enforce routing and field assignment in artifact completion**

In `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signatureArtifacts.ts`, implement the public completion route with these checks:

```ts
import { Router } from 'express';
import { prisma } from '../prisma';
import { evaluateSignerRoute, nextSequentialStatuses } from '../signing/routing';
import { evaluateRequestCompletion, validateAssignedFieldValues } from '../signing/requestCompletion';
import { verifySigningToken } from '../signing/tokens';

export const signatureArtifactsRouter = Router();

signatureArtifactsRouter.post('/api/public/signing/:token/complete', async (req, res) => {
  const token = await verifySigningToken(req.params.token);
  const signer = await prisma.signer.findFirstOrThrow({
    where: {
      id: token.signerId,
      tokenHash: token.hash,
      tokenExpiresAt: { gt: new Date() },
    },
    include: {
      signingRequest: {
        include: {
          signers: { orderBy: [{ routingOrder: 'asc' }, { createdAt: 'asc' }] },
          fields: true,
        },
      },
    },
  });

  const route = evaluateSignerRoute({
    routingMode: signer.signingRequest.routingMode,
    signerId: signer.id,
    signers: signer.signingRequest.signers,
  });
  if (!route.canSign) {
    res.status(409).json({
      code: 'SIGNER_ROUTING_BLOCKED',
      message: 'This signer is waiting for earlier routing steps to finish.',
    });
    return;
  }

  try {
    validateAssignedFieldValues({
      signerRole: signer.role,
      fields: signer.signingRequest.fields,
      submittedFieldValues: req.body.fieldValues,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('FIELD_NOT_ASSIGNED_TO_SIGNER')) {
      res.status(422).json({
        code: 'FIELD_NOT_ASSIGNED_TO_SIGNER',
        message: 'A submitted field is not assigned to this signer role.',
      });
      return;
    }
    res.status(422).json({
      code: 'REQUIRED_FIELDS_MISSING',
      message: 'All required fields assigned to this signer must be completed.',
    });
    return;
  }

  await prisma.$transaction(async (tx) => {
    await tx.signatureArtifact.create({
      data: {
        workspaceId: signer.workspaceId,
        signingRequestId: signer.signingRequestId,
        signerId: signer.id,
        fieldValues: req.body.fieldValues,
      },
    });

    await tx.signer.update({
      where: { id: signer.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    const signersAfterCompletion = signer.signingRequest.signers.map((candidate) =>
      candidate.id === signer.id ? { ...candidate, status: 'completed' as const } : candidate,
    );

    if (signer.signingRequest.routingMode === 'sequential') {
      const nextStatuses = nextSequentialStatuses({
        completedSignerId: signer.id,
        signers: signersAfterCompletion,
      });
      for (const nextStatus of nextStatuses) {
        await tx.signer.update({
          where: { id: nextStatus.signerId },
          data: { status: nextStatus.status },
        });
      }
    }

    await tx.signingRequest.update({
      where: { id: signer.signingRequestId },
      data: {
        status: evaluateRequestCompletion({ signers: signersAfterCompletion }),
      },
    });
  });

  res.json({ status: 'accepted' });
});
```

- [ ] **Step 8: Run the assignment and completion tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- requestCompletion.test.ts publicSigning.test.ts
```

Expected: PASS for completion rules, blocked route rejection, assigned-field rejection, and next signer activation.

- [ ] **Step 9: Commit Task 3**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/signing/requestCompletion.ts apps/api/src/signing/requestCompletion.test.ts apps/api/src/routes/signatureArtifacts.ts apps/api/src/routes/publicSigning.test.ts
git commit -m "feat: enforce signer field assignments"
```

Expected: commit succeeds with completion service and artifact route changes.

## Task 4: Add API Client Support For Routing Payloads

**Files:**

- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.test.ts`

- [ ] **Step 1: Write the failing API client test**

Add this test to `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createSigningRequest } from './signingRequests';

describe('createSigningRequest routing payload', () => {
  it('posts routing mode and signer setup to the API', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'req_123', routingMode: 'sequential' }),
    });

    await createSigningRequest({
      baseUrl: 'https://api.dropsign.example',
      token: 'api_test_token',
      fetch: fetchMock,
      input: {
        documentId: 'doc_123',
        routingMode: 'sequential',
        signers: [
          {
            email: 'buyer@example.com',
            name: 'Buyer One',
            role: 'buyer',
            routingOrder: 1,
            required: true,
          },
          {
            email: 'seller@example.com',
            name: 'Seller One',
            role: 'seller',
            routingOrder: 2,
            required: true,
          },
        ],
      },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://api.dropsign.example/v1/signing-requests', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer api_test_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: 'doc_123',
        routingMode: 'sequential',
        signers: [
          {
            email: 'buyer@example.com',
            name: 'Buyer One',
            role: 'buyer',
            routingOrder: 1,
            required: true,
          },
          {
            email: 'seller@example.com',
            name: 'Seller One',
            role: 'seller',
            routingOrder: 2,
            required: true,
          },
        ],
      }),
    });
  });
});
```

- [ ] **Step 2: Run the failing API client test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api-client test -- signingRequests.test.ts
```

Expected: FAIL because `routingMode`, `routingOrder`, `role`, or `required` are missing from the posted body.

- [ ] **Step 3: Implement typed API client payload**

In `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.ts`, export these types and function shape:

```ts
export type RoutingMode = 'parallel' | 'sequential';

export interface CreateSigningRequestSigner {
  email: string;
  name: string;
  role: string;
  routingOrder: number;
  required: boolean;
}

export interface CreateSigningRequestInput {
  documentId: string;
  routingMode: RoutingMode;
  signers: CreateSigningRequestSigner[];
}

export async function createSigningRequest(options: {
  baseUrl: string;
  token: string;
  fetch?: typeof fetch;
  input: CreateSigningRequestInput;
}) {
  const fetchImpl = options.fetch ?? fetch;
  const response = await fetchImpl(`${options.baseUrl}/v1/signing-requests`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(options.input),
  });

  if (!response.ok) {
    throw new Error(`CREATE_SIGNING_REQUEST_FAILED:${response.status}`);
  }

  return response.json();
}
```

- [ ] **Step 4: Run the passing API client test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api-client test -- signingRequests.test.ts
```

Expected: PASS for the routing payload test.

- [ ] **Step 5: Commit Task 4**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/api-client/src/signingRequests.ts packages/api-client/src/signingRequests.test.ts
git commit -m "feat: expose routing fields in api client"
```

Expected: commit succeeds with API client changes.

## Task 5: Dashboard Signer Setup UI

**Files:**

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.test.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.test.tsx`

- [ ] **Step 1: Write failing component tests for signer setup**

Create `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignerSetup } from './SignerSetup';

describe('SignerSetup', () => {
  it('renders routing mode, signer role, routing order, and required controls', () => {
    render(
      <SignerSetup
        value={{
          routingMode: 'sequential',
          signers: [
            {
              email: 'buyer@example.com',
              name: 'Buyer One',
              role: 'buyer',
              routingOrder: 1,
              required: true,
            },
          ],
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('radio', { name: 'Sequential' })).toBeChecked();
    expect(screen.getByLabelText('Signer 1 name')).toHaveValue('Buyer One');
    expect(screen.getByLabelText('Signer 1 email')).toHaveValue('buyer@example.com');
    expect(screen.getByLabelText('Signer 1 role')).toHaveValue('buyer');
    expect(screen.getByLabelText('Signer 1 routing order')).toHaveValue(1);
    expect(screen.getByLabelText('Signer 1 required')).toBeChecked();
  });

  it('adds a second signer with the next sequential order', () => {
    const onChange = vi.fn();
    render(
      <SignerSetup
        value={{
          routingMode: 'sequential',
          signers: [
            {
              email: 'buyer@example.com',
              name: 'Buyer One',
              role: 'buyer',
              routingOrder: 1,
              required: true,
            },
          ],
        }}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Add signer' }));

    expect(onChange).toHaveBeenCalledWith({
      routingMode: 'sequential',
      signers: [
        {
          email: 'buyer@example.com',
          name: 'Buyer One',
          role: 'buyer',
          routingOrder: 1,
          required: true,
        },
        {
          email: '',
          name: '',
          role: 'signer_2',
          routingOrder: 2,
          required: true,
        },
      ],
    });
  });
});
```

- [ ] **Step 2: Run the failing component tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/dashboard test -- SignerSetup.test.tsx
```

Expected: FAIL with `Cannot find module './SignerSetup'`.

- [ ] **Step 3: Implement the SignerSetup component**

Create `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.tsx`:

```tsx
'use client';

export type RoutingMode = 'parallel' | 'sequential';

export interface SignerSetupValue {
  routingMode: RoutingMode;
  signers: Array<{
    email: string;
    name: string;
    role: string;
    routingOrder: number;
    required: boolean;
  }>;
}

interface SignerSetupProps {
  value: SignerSetupValue;
  onChange: (value: SignerSetupValue) => void;
}

export function SignerSetup({ value, onChange }: SignerSetupProps) {
  const updateSigner = (index: number, patch: Partial<SignerSetupValue['signers'][number]>) => {
    onChange({
      ...value,
      signers: value.signers.map((signer, signerIndex) =>
        signerIndex === index ? { ...signer, ...patch } : signer,
      ),
    });
  };

  const addSigner = () => {
    const nextIndex = value.signers.length + 1;
    onChange({
      ...value,
      signers: [
        ...value.signers,
        {
          email: '',
          name: '',
          role: `signer_${nextIndex}`,
          routingOrder: value.routingMode === 'sequential' ? nextIndex : 1,
          required: true,
        },
      ],
    });
  };

  return (
    <section aria-labelledby="signer-setup-heading">
      <h2 id="signer-setup-heading">Signers</h2>
      <fieldset>
        <legend>Routing mode</legend>
        <label>
          <input
            checked={value.routingMode === 'parallel'}
            name="routingMode"
            onChange={() => onChange({ ...value, routingMode: 'parallel' })}
            type="radio"
          />
          Parallel
        </label>
        <label>
          <input
            checked={value.routingMode === 'sequential'}
            name="routingMode"
            onChange={() => onChange({ ...value, routingMode: 'sequential' })}
            type="radio"
          />
          Sequential
        </label>
      </fieldset>

      {value.signers.map((signer, index) => (
        <fieldset key={index}>
          <legend>{`Signer ${index + 1}`}</legend>
          <label>
            {`Signer ${index + 1} name`}
            <input
              aria-label={`Signer ${index + 1} name`}
              value={signer.name}
              onChange={(event) => updateSigner(index, { name: event.currentTarget.value })}
            />
          </label>
          <label>
            {`Signer ${index + 1} email`}
            <input
              aria-label={`Signer ${index + 1} email`}
              type="email"
              value={signer.email}
              onChange={(event) => updateSigner(index, { email: event.currentTarget.value })}
            />
          </label>
          <label>
            {`Signer ${index + 1} role`}
            <input
              aria-label={`Signer ${index + 1} role`}
              value={signer.role}
              onChange={(event) => updateSigner(index, { role: event.currentTarget.value })}
            />
          </label>
          <label>
            {`Signer ${index + 1} routing order`}
            <input
              aria-label={`Signer ${index + 1} routing order`}
              min={1}
              type="number"
              value={signer.routingOrder}
              onChange={(event) =>
                updateSigner(index, { routingOrder: Number(event.currentTarget.value) })
              }
            />
          </label>
          <label>
            <input
              aria-label={`Signer ${index + 1} required`}
              checked={signer.required}
              onChange={(event) => updateSigner(index, { required: event.currentTarget.checked })}
              type="checkbox"
            />
            Required
          </label>
        </fieldset>
      ))}

      <button type="button" onClick={addSigner}>
        Add signer
      </button>
    </section>
  );
}
```

- [ ] **Step 4: Run the passing component tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/dashboard test -- SignerSetup.test.tsx
```

Expected: PASS for rendering and adding signers.

- [ ] **Step 5: Write failing form integration test**

Add this test to `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CreateSigningRequestForm } from './CreateSigningRequestForm';

describe('CreateSigningRequestForm multi-signer routing', () => {
  it('submits routing mode and signer setup through the API client', async () => {
    const createSigningRequest = vi.fn().mockResolvedValue({ id: 'req_123' });
    render(
      <CreateSigningRequestForm
        documentId="doc_123"
        createSigningRequest={createSigningRequest}
      />,
    );

    fireEvent.click(screen.getByRole('radio', { name: 'Sequential' }));
    fireEvent.change(screen.getByLabelText('Signer 1 name'), { target: { value: 'Buyer One' } });
    fireEvent.change(screen.getByLabelText('Signer 1 email'), {
      target: { value: 'buyer@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Signer 1 role'), { target: { value: 'buyer' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add signer' }));
    fireEvent.change(screen.getByLabelText('Signer 2 name'), { target: { value: 'Seller One' } });
    fireEvent.change(screen.getByLabelText('Signer 2 email'), {
      target: { value: 'seller@example.com' },
    });
    fireEvent.change(screen.getByLabelText('Signer 2 role'), { target: { value: 'seller' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create signing request' }));

    await waitFor(() => {
      expect(createSigningRequest).toHaveBeenCalledWith({
        documentId: 'doc_123',
        routingMode: 'sequential',
        signers: [
          {
            email: 'buyer@example.com',
            name: 'Buyer One',
            role: 'buyer',
            routingOrder: 1,
            required: true,
          },
          {
            email: 'seller@example.com',
            name: 'Seller One',
            role: 'seller',
            routingOrder: 2,
            required: true,
          },
        ],
      });
    });
  });
});
```

- [ ] **Step 6: Run the failing form integration test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/dashboard test -- CreateSigningRequestForm.test.tsx
```

Expected: FAIL because the form does not render signer routing controls or does not submit routing fields.

- [ ] **Step 7: Wire SignerSetup into CreateSigningRequestForm**

In `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.tsx`, hold signer setup state and send it on submit:

```tsx
'use client';

import { useState } from 'react';
import { SignerSetup, type SignerSetupValue } from './SignerSetup';

interface CreateSigningRequestFormProps {
  documentId: string;
  createSigningRequest: (input: SignerSetupValue & { documentId: string }) => Promise<{ id: string }>;
}

const initialSignerSetup: SignerSetupValue = {
  routingMode: 'parallel',
  signers: [
    {
      email: '',
      name: '',
      role: 'signer_1',
      routingOrder: 1,
      required: true,
    },
  ],
};

export function CreateSigningRequestForm({
  documentId,
  createSigningRequest,
}: CreateSigningRequestFormProps) {
  const [signerSetup, setSignerSetup] = useState<SignerSetupValue>(initialSignerSetup);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void createSigningRequest({
          documentId,
          ...signerSetup,
        });
      }}
    >
      <SignerSetup value={signerSetup} onChange={setSignerSetup} />
      <button type="submit">Create signing request</button>
    </form>
  );
}
```

- [ ] **Step 8: Run dashboard tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/dashboard test -- SignerSetup.test.tsx CreateSigningRequestForm.test.tsx
```

Expected: PASS for signer setup rendering, adding signers, and form submission payload.

- [ ] **Step 9: Commit Task 5**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/dashboard/src/features/signing-request/SignerSetup.tsx apps/dashboard/src/features/signing-request/SignerSetup.test.tsx apps/dashboard/src/features/signing-request/CreateSigningRequestForm.tsx apps/dashboard/src/features/signing-request/CreateSigningRequestForm.test.tsx
git commit -m "feat: add dashboard signer routing setup"
```

Expected: commit succeeds with dashboard signer setup changes.

## Task 6: Public Waiting State

**Files:**

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.test.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.test.tsx`

- [ ] **Step 1: Write failing WaitingForTurn component test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WaitingForTurn } from './WaitingForTurn';

describe('WaitingForTurn', () => {
  it('shows who must finish before this signer can sign', () => {
    render(
      <WaitingForTurn
        signerName="Seller One"
        waitingFor={[
          { signerId: 'buyer-1', name: 'Buyer One', role: 'buyer', routingOrder: 1 },
          { signerId: 'finance-1', name: 'Finance One', role: 'finance', routingOrder: 1 },
        ]}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Waiting for your turn' })).toBeInTheDocument();
    expect(screen.getByText('Seller One cannot sign until these recipients finish:')).toBeInTheDocument();
    expect(screen.getByText('Buyer One')).toBeInTheDocument();
    expect(screen.getByText('buyer')).toBeInTheDocument();
    expect(screen.getByText('Finance One')).toBeInTheDocument();
    expect(screen.getByText('finance')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the failing waiting component test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- WaitingForTurn.test.tsx
```

Expected: FAIL with `Cannot find module './WaitingForTurn'`.

- [ ] **Step 3: Implement WaitingForTurn**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.tsx`:

```tsx
interface WaitingSigner {
  signerId: string;
  name: string;
  role: string;
  routingOrder: number;
}

interface WaitingForTurnProps {
  signerName: string;
  waitingFor: WaitingSigner[];
}

export function WaitingForTurn({ signerName, waitingFor }: WaitingForTurnProps) {
  return (
    <main aria-labelledby="waiting-heading">
      <h1 id="waiting-heading">Waiting for your turn</h1>
      <p>{`${signerName} cannot sign until these recipients finish:`}</p>
      <ul>
        {waitingFor.map((signer) => (
          <li key={signer.signerId}>
            <span>{signer.name}</span>
            <span>{signer.role}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
```

- [ ] **Step 4: Run the passing waiting component test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- WaitingForTurn.test.tsx
```

Expected: PASS for waiting state content.

- [ ] **Step 5: Write failing public page test**

Add this test to `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SignPage from './page';

describe('SignPage waiting state', () => {
  it('renders waiting state and hides document fields when canSign is false', async () => {
    const fetchSigningSession = vi.fn().mockResolvedValue({
      requestId: 'req_123',
      signerId: 'seller-1',
      signerName: 'Seller One',
      signerEmail: 'seller@example.com',
      signerRole: 'seller',
      routingMode: 'sequential',
      signerStatus: 'waiting',
      canSign: false,
      waitingFor: [{ signerId: 'buyer-1', name: 'Buyer One', role: 'buyer', routingOrder: 1 }],
      assignedFields: [],
    });

    render(await SignPage({ params: { token: 'seller-token' }, fetchSigningSession }));

    expect(screen.getByRole('heading', { name: 'Waiting for your turn' })).toBeInTheDocument();
    expect(screen.getByText('Buyer One')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Complete signing' })).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 6: Run the failing public page test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- page.test.tsx
```

Expected: FAIL because the page does not branch on `canSign === false`.

- [ ] **Step 7: Render waiting state in sign page**

In `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`, branch before rendering document fields:

```tsx
import { WaitingForTurn } from './WaitingForTurn';
import { SigningFields } from '../../../components/SigningFields';
import { fetchSigningSession as defaultFetchSigningSession } from '../../../lib/publicSigningApi';

interface SignPageProps {
  params: { token: string };
  fetchSigningSession?: typeof defaultFetchSigningSession;
}

export default async function SignPage({
  params,
  fetchSigningSession = defaultFetchSigningSession,
}: SignPageProps) {
  const session = await fetchSigningSession(params.token);

  if (!session.canSign) {
    return <WaitingForTurn signerName={session.signerName} waitingFor={session.waitingFor} />;
  }

  return (
    <main>
      <h1>Sign document</h1>
      <SigningFields token={params.token} fields={session.assignedFields} />
    </main>
  );
}
```

- [ ] **Step 8: Run public signing tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- WaitingForTurn.test.tsx page.test.tsx
```

Expected: PASS for waiting component and sign page waiting branch.

- [ ] **Step 9: Commit Task 6**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/app/sign/[token]/WaitingForTurn.tsx apps/web/app/sign/[token]/WaitingForTurn.test.tsx apps/web/app/sign/[token]/page.tsx apps/web/app/sign/[token]/page.test.tsx
git commit -m "feat: show public waiting state for sequential signing"
```

Expected: commit succeeds with public signing waiting state changes.

## Task 7: End-To-End Multi-Signer Routing Coverage

**Files:**

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/e2e/tests/multi-signer-routing.spec.ts`

- [ ] **Step 1: Write failing Playwright tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/e2e/tests/multi-signer-routing.spec.ts`:

```ts
import { expect, test } from '@playwright/test';
import { createDocument, createSigningRequest, loginAsWorkspaceMember } from '../support/api';

test.describe('multi-signer routing', () => {
  test('sequential signer waits until the prior signer completes', async ({ page, request }) => {
    const member = await loginAsWorkspaceMember(request);
    const document = await createDocument(request, member, {
      title: 'Sequential E2E Contract',
      sourceObjectKey: 'e2e/sequential-contract.pdf',
    });
    const signingRequest = await createSigningRequest(request, member, {
      documentId: document.id,
      routingMode: 'sequential',
      signers: [
        {
          email: 'buyer-e2e@example.com',
          name: 'Buyer E2E',
          role: 'buyer',
          routingOrder: 1,
          required: true,
        },
        {
          email: 'seller-e2e@example.com',
          name: 'Seller E2E',
          role: 'seller',
          routingOrder: 2,
          required: true,
        },
      ],
      fields: [
        { id: 'buyer-signature', role: 'buyer', type: 'signature', required: true, page: 1, x: 0.2, y: 0.2, width: 0.2, height: 0.08 },
        { id: 'seller-signature', role: 'seller', type: 'signature', required: true, page: 1, x: 0.2, y: 0.4, width: 0.2, height: 0.08 },
      ],
    });

    await page.goto(`/sign/${signingRequest.signers[1].token}`);
    await expect(page.getByRole('heading', { name: 'Waiting for your turn' })).toBeVisible();
    await expect(page.getByText('Buyer E2E')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Complete signing' })).toHaveCount(0);

    await page.goto(`/sign/${signingRequest.signers[0].token}`);
    await expect(page.getByRole('heading', { name: 'Sign document' })).toBeVisible();
    await page.getByTestId('field-buyer-signature').click();
    await page.getByRole('button', { name: 'Complete signing' }).click();
    await expect(page.getByRole('heading', { name: 'Signing complete' })).toBeVisible();

    await page.goto(`/sign/${signingRequest.signers[1].token}`);
    await expect(page.getByRole('heading', { name: 'Sign document' })).toBeVisible();
    await expect(page.getByTestId('field-seller-signature')).toBeVisible();
    await expect(page.getByTestId('field-buyer-signature')).toHaveCount(0);
  });

  test('parallel signers can sign immediately and see only their assigned fields', async ({ page, request }) => {
    const member = await loginAsWorkspaceMember(request);
    const document = await createDocument(request, member, {
      title: 'Parallel E2E Contract',
      sourceObjectKey: 'e2e/parallel-contract.pdf',
    });
    const signingRequest = await createSigningRequest(request, member, {
      documentId: document.id,
      routingMode: 'parallel',
      signers: [
        {
          email: 'finance-e2e@example.com',
          name: 'Finance E2E',
          role: 'finance',
          routingOrder: 1,
          required: true,
        },
        {
          email: 'legal-e2e@example.com',
          name: 'Legal E2E',
          role: 'legal',
          routingOrder: 1,
          required: true,
        },
      ],
      fields: [
        { id: 'finance-signature', role: 'finance', type: 'signature', required: true, page: 1, x: 0.2, y: 0.2, width: 0.2, height: 0.08 },
        { id: 'legal-signature', role: 'legal', type: 'signature', required: true, page: 1, x: 0.2, y: 0.4, width: 0.2, height: 0.08 },
      ],
    });

    await page.goto(`/sign/${signingRequest.signers[0].token}`);
    await expect(page.getByRole('heading', { name: 'Sign document' })).toBeVisible();
    await expect(page.getByTestId('field-finance-signature')).toBeVisible();
    await expect(page.getByTestId('field-legal-signature')).toHaveCount(0);

    await page.goto(`/sign/${signingRequest.signers[1].token}`);
    await expect(page.getByRole('heading', { name: 'Sign document' })).toBeVisible();
    await expect(page.getByTestId('field-legal-signature')).toBeVisible();
    await expect(page.getByTestId('field-finance-signature')).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the failing E2E tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/e2e test -- multi-signer-routing.spec.ts
```

Expected: FAIL if support factories do not accept `routingMode`, `signers`, and `fields`, or if public signing still exposes blocked signers.

- [ ] **Step 3: Update E2E support API helpers with routing payloads**

In `/Users/minjun/Documents/dropsign-cloud/apps/e2e/support/api.ts`, replace the request factory helper signature with fields and returned signer tokens:

```ts
export async function createSigningRequest(
  request: APIRequestContext,
  member: { token: string },
  input: {
    documentId: string;
    routingMode: 'parallel' | 'sequential';
    signers: Array<{
      email: string;
      name: string;
      role: string;
      routingOrder: number;
      required: boolean;
    }>;
    fields: Array<{
      id: string;
      role: string;
      type: 'signature' | 'initials' | 'date' | 'name' | 'text' | 'checkbox' | 'metadata';
      required: boolean;
      page: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }>;
  },
) {
  const response = await request.post('/v1/signing-requests', {
    headers: { Authorization: `Bearer ${member.token}` },
    data: input,
  });
  expect(response.ok()).toBeTruthy();
  return response.json();
}
```

- [ ] **Step 4: Run the passing E2E tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/e2e test -- multi-signer-routing.spec.ts
```

Expected: PASS for sequential waiting, sequential activation after first signer completion, parallel immediate access, and role-scoped fields.

- [ ] **Step 5: Commit Task 7**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/e2e/tests/multi-signer-routing.spec.ts apps/e2e/support/api.ts
git commit -m "test: cover multi-signer routing end to end"
```

Expected: commit succeeds with E2E coverage changes.

## Task 8: Full Verification And Final Commit Boundary

**Files:**

- Confirm the final diff contains exactly these paths:
  `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`,
  `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512060000_multi_signer_routing/migration.sql`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/routing.test.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/requestCompletion.test.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/publicSigning.test.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signingRequests.test.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/signatureArtifacts.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/api/src/signing/types.ts`,
  `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.ts`,
  `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/signingRequests.test.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/SignerSetup.test.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/dashboard/src/features/signing-request/CreateSigningRequestForm.test.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/WaitingForTurn.test.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.test.tsx`,
  `/Users/minjun/Documents/dropsign-cloud/apps/e2e/tests/multi-signer-routing.spec.ts`,
  `/Users/minjun/Documents/dropsign-cloud/apps/e2e/support/api.ts`.

- [ ] **Step 1: Run API verification**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api lint
pnpm --filter @dropsign/api typecheck
pnpm --filter @dropsign/api test -- routing.test.ts requestCompletion.test.ts signingRequests.test.ts publicSigning.test.ts
```

Expected: `lint` exits 0, `typecheck` exits 0, and Vitest prints PASS for `routing.test.ts`, `requestCompletion.test.ts`, `signingRequests.test.ts`, and `publicSigning.test.ts`.

- [ ] **Step 2: Run frontend and client verification**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api-client test -- signingRequests.test.ts
pnpm --filter @dropsign/dashboard test -- SignerSetup.test.tsx CreateSigningRequestForm.test.tsx
pnpm --filter @dropsign/web test -- WaitingForTurn.test.tsx page.test.tsx
```

Expected: each command exits 0. Vitest prints PASS for `signingRequests.test.ts`, `SignerSetup.test.tsx`, `CreateSigningRequestForm.test.tsx`, `WaitingForTurn.test.tsx`, and `page.test.tsx`.

- [ ] **Step 3: Run E2E verification**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/e2e test -- multi-signer-routing.spec.ts
```

Expected: Playwright exits 0 and prints `2 passed` for sequential route gating and parallel signer access.

- [ ] **Step 4: Run full repo verification**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: `pnpm lint` exits 0, `pnpm typecheck` exits 0, `pnpm test` exits 0 with no failing suites, and `pnpm build` exits 0 with successful package builds. A nonzero exit from any command fails this phase and must be fixed before opening a PR.

- [ ] **Step 5: Confirm commit boundaries**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git log --oneline -8
git status --short
```

Expected: the log contains these commits in order, and `git status --short` has no uncommitted files from Phase 06:

```text
feat: persist multi-signer routing metadata
feat: enforce sequential signing route visibility
feat: enforce signer field assignments
feat: expose routing fields in api client
feat: add dashboard signer routing setup
feat: show public waiting state for sequential signing
test: cover multi-signer routing end to end
```

## Self-Review Checklist

- [ ] Spec coverage: `SigningRequest.routingMode` supports `parallel` and `sequential`; `Signer` has `role`, `routingOrder`, `required`, and `status`; fields are role-assigned; route gating blocks out-of-turn sequential signers; request completion requires every required signer and every required assigned field; dashboard captures signer setup; public signing shows waiting state; API and E2E tests cover the behavior.
- [ ] Placeholder scan: every task names concrete files, commands, expected outcomes, and test contents.
- [ ] Type consistency: `RoutingMode`, `SignerStatus`, `SignerInput`, public session response fields, route error codes, and test payload shapes use the same names across API, client, dashboard, public signing, and E2E tasks.
