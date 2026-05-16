# DropSign Platform v1 Phase 07 Email Notifications And Reminders Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add invitation, reminder, completion, and failure notification email workflows backed by worker jobs and dashboard resend controls.

**Architecture:** Email sending lives behind `packages/email` so tests can use a fake provider and production can use a transactional provider. API routes enqueue email jobs; `apps/worker` owns retryable delivery execution and writes `EmailDelivery` records. Dashboard pages expose resend actions and delivery history without embedding provider-specific logic.

**Tech Stack:** TypeScript, Fastify, Prisma, PostgreSQL, Zod, BullMQ-style job adapter, Vitest, Next.js App Router, React Testing Library, Playwright, provider-neutral email interface.

---

## Task 1: Add Email Delivery Schema

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/email.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-delivery-schema.test.ts`

- [ ] **Step 1: Write the failing schema/domain test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-delivery-schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  EMAIL_DELIVERY_STATUSES,
  EMAIL_TYPES,
  isTerminalEmailStatus,
} from '@dropsign/domain/email';

describe('email delivery domain', () => {
  it('defines explicit email types used by worker jobs', () => {
    expect(EMAIL_TYPES).toEqual([
      'signing_invitation',
      'signing_reminder',
      'signing_completed',
      'document_failed',
    ]);
  });

  it('knows which email statuses stop retrying', () => {
    expect(isTerminalEmailStatus('sent')).toBe(true);
    expect(isTerminalEmailStatus('failed')).toBe(true);
    expect(isTerminalEmailStatus('queued')).toBe(false);
    expect(isTerminalEmailStatus('sending')).toBe(false);
  });

  it('keeps retryable statuses separate from terminal statuses', () => {
    expect(EMAIL_DELIVERY_STATUSES).toEqual(['queued', 'sending', 'sent', 'failed']);
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/email-delivery-schema.test.ts
```

Expected: FAIL with a module resolution error for `@dropsign/domain/email`.

- [ ] **Step 3: Add the domain constants**

Create `/Users/minjun/Documents/dropsign-cloud/packages/domain/src/email.ts`:

```ts
export const EMAIL_TYPES = [
  'signing_invitation',
  'signing_reminder',
  'signing_completed',
  'document_failed',
] as const;

export type EmailType = (typeof EMAIL_TYPES)[number];

export const EMAIL_DELIVERY_STATUSES = ['queued', 'sending', 'sent', 'failed'] as const;

export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

export function isTerminalEmailStatus(status: EmailDeliveryStatus): boolean {
  return status === 'sent' || status === 'failed';
}
```

- [ ] **Step 4: Extend the Prisma schema**

Add these enums and model to `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`:

```prisma
enum EmailType {
  signing_invitation
  signing_reminder
  signing_completed
  document_failed
}

enum EmailDeliveryStatus {
  queued
  sending
  sent
  failed
}

model EmailDelivery {
  id               String              @id @default(cuid())
  workspaceId      String
  projectId        String
  signingRequestId String?
  signerId         String?
  type             EmailType
  toEmail          String
  subject          String
  status           EmailDeliveryStatus @default(queued)
  providerMessageId String?
  lastError        String?
  attemptCount     Int                 @default(0)
  scheduledAt      DateTime            @default(now())
  sentAt           DateTime?
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt

  workspace        Workspace           @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project          Project             @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId, createdAt])
  @@index([projectId, status])
  @@index([signingRequestId])
  @@index([signerId])
}
```

Add relation fields to existing models:

```prisma
model Workspace {
  emailDeliveries EmailDelivery[]
}

model Project {
  emailDeliveries EmailDelivery[]
}
```

- [ ] **Step 5: Generate Prisma client and run the test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm prisma generate --schema packages/db/prisma/schema.prisma
pnpm vitest run apps/api/test/email-delivery-schema.test.ts
```

Expected: PASS for the email domain test and successful Prisma generation.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma packages/domain/src/email.ts apps/api/test/email-delivery-schema.test.ts
git commit -m "feat: add email delivery domain model"
```

Expected: commit succeeds with the domain model and schema changes.

## Task 2: Create Provider-Neutral Email Package

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/email/src/types.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/email/src/fake-provider.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/email/src/templates.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/email/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/email/test/fake-provider.test.ts`

- [ ] **Step 1: Write the failing provider test**

Create `/Users/minjun/Documents/dropsign-cloud/packages/email/test/fake-provider.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { FakeEmailProvider, renderSigningInvitation } from '../src/index';

describe('FakeEmailProvider', () => {
  it('records sent emails and returns a stable provider message id', async () => {
    const provider = new FakeEmailProvider();

    const result = await provider.send({
      to: 'signer@example.com',
      subject: 'Sign Service Agreement',
      html: '<p>Please sign</p>',
      text: 'Please sign',
      tags: { requestId: 'req_123' },
    });

    expect(result.providerMessageId).toBe('fake_1');
    expect(provider.sent).toHaveLength(1);
    expect(provider.sent[0]?.to).toBe('signer@example.com');
  });

  it('renders signing invitation content with the signer link', () => {
    const rendered = renderSigningInvitation({
      workspaceName: 'Acme',
      documentTitle: 'Service Agreement',
      signerName: 'Min',
      signingUrl: 'https://sign.dropsign.test/s/abc',
    });

    expect(rendered.subject).toBe('Acme requested your signature');
    expect(rendered.text).toContain('Service Agreement');
    expect(rendered.text).toContain('https://sign.dropsign.test/s/abc');
    expect(rendered.html).toContain('href="https://sign.dropsign.test/s/abc"');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/email/test/fake-provider.test.ts
```

Expected: FAIL because `packages/email/src/index.ts` does not exist.

- [ ] **Step 3: Add package types**

Create `/Users/minjun/Documents/dropsign-cloud/packages/email/src/types.ts`:

```ts
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  tags?: Record<string, string>;
}

export interface EmailSendResult {
  providerMessageId: string;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}
```

- [ ] **Step 4: Add fake provider**

Create `/Users/minjun/Documents/dropsign-cloud/packages/email/src/fake-provider.ts`:

```ts
import type { EmailMessage, EmailProvider, EmailSendResult } from './types.js';

export class FakeEmailProvider implements EmailProvider {
  readonly sent: EmailMessage[] = [];

  async send(message: EmailMessage): Promise<EmailSendResult> {
    this.sent.push(message);
    return { providerMessageId: `fake_${this.sent.length}` };
  }
}
```

- [ ] **Step 5: Add templates**

Create `/Users/minjun/Documents/dropsign-cloud/packages/email/src/templates.ts`:

```ts
export interface SigningInvitationInput {
  workspaceName: string;
  documentTitle: string;
  signerName: string;
  signingUrl: string;
}

export function renderSigningInvitation(input: SigningInvitationInput) {
  const subject = `${input.workspaceName} requested your signature`;
  const text = [
    `Hi ${input.signerName},`,
    `${input.workspaceName} requested your signature on ${input.documentTitle}.`,
    `Open the signing link: ${input.signingUrl}`,
  ].join('\n\n');
  const html = [
    `<p>Hi ${escapeHtml(input.signerName)},</p>`,
    `<p>${escapeHtml(input.workspaceName)} requested your signature on ${escapeHtml(input.documentTitle)}.</p>`,
    `<p><a href="${escapeAttribute(input.signingUrl)}">Review and sign</a></p>`,
  ].join('');

  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll(\"'\", '&#39;');
}

function escapeAttribute(value: string): string {
  return escapeHtml(value);
}
```

- [ ] **Step 6: Export the package API**

Create `/Users/minjun/Documents/dropsign-cloud/packages/email/src/index.ts`:

```ts
export type { EmailMessage, EmailProvider, EmailSendResult } from './types.js';
export { FakeEmailProvider } from './fake-provider.js';
export { renderSigningInvitation } from './templates.js';
export type { SigningInvitationInput } from './templates.js';
```

- [ ] **Step 7: Run the package test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/email/test/fake-provider.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/email
git commit -m "feat: add provider-neutral email package"
```

Expected: commit succeeds with package code and tests.

## Task 3: Add Worker Email Job Execution

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/send-email.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/email-provider.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/send-email.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/index.ts`

- [ ] **Step 1: Write the failing worker test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/send-email.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { FakeEmailProvider } from '@dropsign/email';
import { runSendEmailJob } from '../src/jobs/send-email.js';

describe('runSendEmailJob', () => {
  it('marks queued delivery as sent after provider success', async () => {
    const provider = new FakeEmailProvider();
    const db = {
      emailDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'em_1',
          toEmail: 'signer@example.com',
          subject: 'Please sign',
          status: 'queued',
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await runSendEmailJob({
      db,
      provider,
      deliveryId: 'em_1',
      html: '<p>Please sign</p>',
      text: 'Please sign',
    });

    expect(provider.sent).toHaveLength(1);
    expect(db.emailDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'em_1' },
      data: {
        status: 'sent',
        providerMessageId: 'fake_1',
        sentAt: expect.any(Date),
      },
    });
  });

  it('records failure and increments attempt count when provider throws', async () => {
    const provider = {
      send: vi.fn(async () => {
        throw new Error('provider down');
      }),
    };
    const db = {
      emailDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'em_2',
          toEmail: 'signer@example.com',
          subject: 'Please sign',
          status: 'queued',
          attemptCount: 0,
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await expect(
      runSendEmailJob({
        db,
        provider,
        deliveryId: 'em_2',
        html: '<p>Please sign</p>',
        text: 'Please sign',
      }),
    ).rejects.toThrow('provider down');

    expect(db.emailDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'em_2' },
      data: {
        status: 'queued',
        lastError: 'provider down',
        attemptCount: { increment: 1 },
        scheduledAt: expect.any(Date),
      },
    });
  });

  it('marks delivery failed after max retry attempts are exhausted', async () => {
    const provider = {
      send: vi.fn(async () => {
        throw new Error('provider rejected message');
      }),
    };
    const db = {
      emailDelivery: {
        findUniqueOrThrow: vi.fn(async () => ({
          id: 'em_3',
          toEmail: 'signer@example.com',
          subject: 'Please sign',
          status: 'queued',
          attemptCount: 2,
        })),
        update: vi.fn(async (args) => args),
      },
    };

    await expect(
      runSendEmailJob({
        db,
        provider,
        deliveryId: 'em_3',
        html: '<p>Please sign</p>',
        text: 'Please sign',
      }),
    ).rejects.toThrow('provider rejected message');

    expect(db.emailDelivery.update).toHaveBeenLastCalledWith({
      where: { id: 'em_3' },
      data: {
        status: 'failed',
        lastError: 'provider rejected message',
        attemptCount: { increment: 1 },
      },
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/send-email.test.ts
```

Expected: FAIL because `runSendEmailJob` is missing.

- [ ] **Step 3: Implement email job**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/send-email.ts`:

```ts
import type { EmailProvider } from '@dropsign/email';

export const MAX_EMAIL_DELIVERY_ATTEMPTS = 3;

export function nextEmailRetryAt(attemptNumber: number, now = new Date()): Date {
  const delayMinutes = [5, 30, 120][Math.max(0, attemptNumber - 1)] ?? 120;
  return new Date(now.getTime() + delayMinutes * 60_000);
}

interface EmailDb {
  emailDelivery: {
    findUniqueOrThrow(args: { where: { id: string } }): Promise<{
      id: string;
      toEmail: string;
      subject: string;
      status: string;
      attemptCount: number;
    }>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
}

export interface SendEmailJobInput {
  db: EmailDb;
  provider: EmailProvider;
  deliveryId: string;
  html: string;
  text: string;
}

export async function runSendEmailJob(input: SendEmailJobInput): Promise<void> {
  const delivery = await input.db.emailDelivery.findUniqueOrThrow({
    where: { id: input.deliveryId },
  });

  await input.db.emailDelivery.update({
    where: { id: delivery.id },
    data: { status: 'sending' },
  });

  try {
    const result = await input.provider.send({
      to: delivery.toEmail,
      subject: delivery.subject,
      html: input.html,
      text: input.text,
      tags: { deliveryId: delivery.id },
    });

    await input.db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'sent',
        providerMessageId: result.providerMessageId,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown email provider error';
    const nextAttemptCount = delivery.attemptCount + 1;
    const isTerminalFailure = nextAttemptCount >= MAX_EMAIL_DELIVERY_ATTEMPTS;
    await input.db.emailDelivery.update({
      where: { id: delivery.id },
      data: {
        status: isTerminalFailure ? 'failed' : 'queued',
        lastError: message,
        attemptCount: { increment: 1 },
        ...(isTerminalFailure ? {} : { scheduledAt: nextEmailRetryAt(nextAttemptCount) }),
      },
    });
    throw error;
  }
}
```

- [ ] **Step 4: Add provider factory**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/email-provider.ts`:

```ts
import { FakeEmailProvider } from '@dropsign/email';
import type { EmailProvider } from '@dropsign/email';

export function createEmailProvider(): EmailProvider {
  return new FakeEmailProvider();
}
```

- [ ] **Step 5: Export worker job**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/index.ts`:

```ts
export { createEmailProvider } from './email-provider.js';
export { runSendEmailJob } from './jobs/send-email.js';
export type { SendEmailJobInput } from './jobs/send-email.js';
```

- [ ] **Step 6: Run the worker test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/worker/test/send-email.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/worker/src apps/worker/test/send-email.test.ts
git commit -m "feat: process email delivery jobs"
```

Expected: commit succeeds.

## Task 4: Add API Endpoints For Resend And Reminder Queueing

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-service.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write the failing API test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-routes.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { buildApiApp } from '../src/app.js';

describe('email routes', () => {
  it('queues a signing reminder for a signer in the active workspace', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      signer: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'signer_1',
          email: 'signer@example.com',
          signingRequestId: 'req_1',
          projectId: 'proj_1',
          workspaceId: 'wrk_1',
        })),
      },
      emailDelivery: {
        create: vi.fn(async ({ data }) => ({ id: 'email_1', ...data })),
      },
    };
    const app = await buildApiApp({ db, queues: { email: queue } });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/signers/signer_1/reminders',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toEqual({ deliveryId: 'email_1', jobId: 'job_1' });
    expect(queue.add).toHaveBeenCalledWith('send-email', {
      deliveryId: 'email_1',
      template: 'signing_reminder',
    });
  });

  it('lists deliveries for a signing request in the active workspace', async () => {
    const db = {
      emailDelivery: {
        findMany: vi.fn(async () => [
          {
            id: 'email_1',
            toEmail: 'signer@example.com',
            type: 'signing_invitation',
            status: 'sent',
            attemptCount: 1,
          },
        ]),
      },
    };
    const app = await buildApiApp({ db, queues: { email: { add: vi.fn() } } });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/signing-requests/req_1/email-deliveries',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual([
      {
        id: 'email_1',
        toEmail: 'signer@example.com',
        type: 'signing_invitation',
        status: 'sent',
        attemptCount: 1,
      },
    ]);
    expect(db.emailDelivery.findMany).toHaveBeenCalledWith({
      where: { signingRequestId: 'req_1', workspaceId: 'wrk_1' },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        toEmail: true,
        type: true,
        status: true,
        attemptCount: true,
      },
    });
  });

  it('resends a failed email delivery by resetting state and enqueueing a job', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_2' })) };
    const db = {
      emailDelivery: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'email_2',
          workspaceId: 'wrk_1',
          status: 'failed',
          type: 'document_failed',
        })),
        update: vi.fn(async ({ data }) => ({ id: 'email_2', ...data })),
      },
    };
    const app = await buildApiApp({ db, queues: { email: queue } });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/email-deliveries/email_2/resend',
      headers: { 'x-workspace-id': 'wrk_1' },
    });

    expect(response.statusCode).toBe(202);
    expect(JSON.parse(response.body)).toEqual({ deliveryId: 'email_2', jobId: 'job_2' });
    expect(db.emailDelivery.update).toHaveBeenCalledWith({
      where: { id: 'email_2' },
      data: {
        status: 'queued',
        lastError: null,
        scheduledAt: expect.any(Date),
      },
    });
    expect(queue.add).toHaveBeenCalledWith('send-email', {
      deliveryId: 'email_2',
      template: 'document_failed',
    });
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/email-routes.test.ts
```

Expected: FAIL because the reminder route is not registered.

- [ ] **Step 3: Add email service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-service.ts`:

```ts
interface EmailServiceInput {
  db: {
    signer: {
      findFirstOrThrow(args: { where: { id: string; workspaceId: string } }): Promise<{
        id: string;
        email: string;
        signingRequestId: string;
        projectId: string;
        workspaceId: string;
      }>;
    };
    emailDelivery: {
      create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
      findMany(args: Record<string, unknown>): Promise<unknown[]>;
      findFirstOrThrow(args: Record<string, unknown>): Promise<{
        id: string;
        status: string;
        type: string;
      }>;
      update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
    };
  };
  queue: {
    add(name: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
  };
}

export async function queueSigningReminder(input: EmailServiceInput & {
  workspaceId: string;
  signerId: string;
}) {
  const signer = await input.db.signer.findFirstOrThrow({
    where: { id: input.signerId, workspaceId: input.workspaceId },
  });
  const delivery = await input.db.emailDelivery.create({
    data: {
      workspaceId: signer.workspaceId,
      projectId: signer.projectId,
      signingRequestId: signer.signingRequestId,
      signerId: signer.id,
      type: 'signing_reminder',
      toEmail: signer.email,
      subject: 'Reminder: please sign',
      status: 'queued',
    },
  });
  const job = await input.queue.add('send-email', {
    deliveryId: delivery.id,
    template: 'signing_reminder',
  });

  return { deliveryId: delivery.id, jobId: job.id ?? null };
}

export async function listEmailDeliveries(input: EmailServiceInput & {
  workspaceId: string;
  signingRequestId: string;
}) {
  return input.db.emailDelivery.findMany({
    where: { signingRequestId: input.signingRequestId, workspaceId: input.workspaceId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      toEmail: true,
      type: true,
      status: true,
      attemptCount: true,
    },
  });
}

export async function resendFailedEmailDelivery(input: EmailServiceInput & {
  workspaceId: string;
  deliveryId: string;
}) {
  const delivery = await input.db.emailDelivery.findFirstOrThrow({
    where: { id: input.deliveryId, workspaceId: input.workspaceId, status: 'failed' },
  });
  await input.db.emailDelivery.update({
    where: { id: delivery.id },
    data: {
      status: 'queued',
      lastError: null,
      scheduledAt: new Date(),
    },
  });
  const job = await input.queue.add('send-email', {
    deliveryId: delivery.id,
    template: delivery.type,
  });

  return { deliveryId: delivery.id, jobId: job.id ?? null };
}
```

- [ ] **Step 4: Add routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-routes.ts`:

```ts
import type { FastifyInstance } from 'fastify';
import {
  listEmailDeliveries,
  queueSigningReminder,
  resendFailedEmailDelivery,
} from './email-service.js';

export async function registerEmailRoutes(app: FastifyInstance): Promise<void> {
  app.get('/v1/signing-requests/:requestId/email-deliveries', async (request, reply) => {
    const params = request.params as { requestId: string };
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }

    const deliveries = await listEmailDeliveries({
      db: app.db,
      queue: app.queues.email,
      workspaceId,
      signingRequestId: params.requestId,
    });

    return reply.code(200).send(deliveries);
  });

  app.post('/v1/signers/:signerId/reminders', async (request, reply) => {
    const params = request.params as { signerId: string };
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }

    const result = await queueSigningReminder({
      db: app.db,
      queue: app.queues.email,
      workspaceId,
      signerId: params.signerId,
    });

    return reply.code(202).send(result);
  });

  app.post('/v1/email-deliveries/:deliveryId/resend', async (request, reply) => {
    const params = request.params as { deliveryId: string };
    const workspaceId = request.headers['x-workspace-id'];
    if (typeof workspaceId !== 'string') {
      return reply.code(400).send({ error: 'Missing x-workspace-id header' });
    }

    const result = await resendFailedEmailDelivery({
      db: app.db,
      queue: app.queues.email,
      workspaceId,
      deliveryId: params.deliveryId,
    });

    return reply.code(202).send(result);
  });
}
```

- [ ] **Step 5: Register routes in the app**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` by appending these registrations to the existing `buildApiApp` implementation and preserving all earlier route registrations:

```ts
import Fastify from 'fastify';
import sensible from '@fastify/sensible';
import { registerEmailRoutes } from './modules/email/email-routes.js';

export async function buildApiApp(deps: { db: unknown; queues: { email: unknown } }) {
  const app = Fastify();
  app.decorate('db', deps.db);
  app.decorate('queues', deps.queues);
  await app.register(sensible);
  await registerEmailRoutes(app);
  return app;
}
```

- [ ] **Step 6: Run the route test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/email-routes.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/email apps/api/src/app.ts apps/api/test/email-routes.test.ts
git commit -m "feat: queue reminder emails from api"
```

Expected: commit succeeds.

## Task 5: Add Dashboard Resend Controls

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/signing-requests/[requestId]/email-deliveries/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/components/email-deliveries-table.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/email-deliveries-table.test.tsx`

- [ ] **Step 1: Write the failing component test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/tests/email-deliveries-table.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { EmailDeliveriesTable } from '../components/email-deliveries-table';

describe('EmailDeliveriesTable', () => {
  it('renders delivery state and calls resend action', async () => {
    const onResend = vi.fn(async () => undefined);

    render(
      <EmailDeliveriesTable
        deliveries={[
          {
            id: 'email_1',
            toEmail: 'signer@example.com',
            type: 'signing_invitation',
            status: 'failed',
            attemptCount: 3,
          },
        ]}
        onResend={onResend}
      />,
    );

    expect(screen.getByText('signer@example.com')).toBeInTheDocument();
    expect(screen.getByText('failed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Resend' }));
    expect(onResend).toHaveBeenCalledWith('email_1');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/email-deliveries-table.test.tsx
```

Expected: FAIL because `EmailDeliveriesTable` is missing.

- [ ] **Step 3: Implement the table**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/components/email-deliveries-table.tsx`:

```tsx
'use client';

export interface EmailDeliveryRow {
  id: string;
  toEmail: string;
  type: string;
  status: string;
  attemptCount: number;
}

export function EmailDeliveriesTable({
  deliveries,
  onResend,
}: {
  deliveries: EmailDeliveryRow[];
  onResend: (id: string) => Promise<void>;
}) {
  return (
    <table>
      <thead>
        <tr>
          <th>Recipient</th>
          <th>Type</th>
          <th>Status</th>
          <th>Attempts</th>
          <th>Action</th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((delivery) => (
          <tr key={delivery.id}>
            <td>{delivery.toEmail}</td>
            <td>{delivery.type}</td>
            <td>{delivery.status}</td>
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

- [ ] **Step 4: Add the dashboard page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/(dashboard)/signing-requests/[requestId]/email-deliveries/page.tsx`:

```tsx
import { EmailDeliveriesTable } from '../../../../../components/email-deliveries-table';

async function resendEmail(deliveryId: string) {
  'use server';
  await fetch(`${process.env.DROPSIGN_API_URL}/v1/email-deliveries/${deliveryId}/resend`, {
    method: 'POST',
    cache: 'no-store',
  });
}

export default async function EmailDeliveriesPage({
  params,
}: {
  params: Promise<{ requestId: string }>;
}) {
  const { requestId } = await params;
  const response = await fetch(
    `${process.env.DROPSIGN_API_URL}/v1/signing-requests/${requestId}/email-deliveries`,
    { cache: 'no-store' },
  );
  const deliveries = (await response.json()) as Parameters<typeof EmailDeliveriesTable>[0]['deliveries'];

  return (
    <main>
      <h1>Email deliveries</h1>
      <EmailDeliveriesTable deliveries={deliveries} onResend={resendEmail} />
    </main>
  );
}
```

- [ ] **Step 5: Run the component test**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/web/tests/email-deliveries-table.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/app apps/web/components/email-deliveries-table.tsx apps/web/tests/email-deliveries-table.test.tsx
git commit -m "feat: show email delivery resend controls"
```

Expected: commit succeeds.

## Task 6: Add Lifecycle Email Enqueueing And Scheduled Reminders

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-lifecycle-service.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-lifecycle-service.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/signing-requests/signing-request-service.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/schedule-email-reminders.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/schedule-email-reminders.test.ts`

- [ ] **Step 1: Write failing lifecycle enqueue tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/test/email-lifecycle-service.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  enqueueCompletionEmail,
  enqueueDocumentFailureEmail,
  enqueueSigningInvitationEmails,
} from '../src/modules/email/email-lifecycle-service';

describe('email lifecycle service', () => {
  it('enqueues one invitation email per signer when a signing request is created', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      emailDelivery: {
        create: vi.fn(async ({ data }) => ({ id: `email_${data.signerId}`, ...data })),
      },
    };

    await enqueueSigningInvitationEmails({
      db,
      queue,
      workspaceId: 'wrk_1',
      projectId: 'proj_1',
      signingRequestId: 'req_1',
      documentTitle: 'Service Agreement',
      signers: [
        { id: 'signer_1', email: 'a@example.com' },
        { id: 'signer_2', email: 'b@example.com' },
      ],
    });

    expect(db.emailDelivery.create).toHaveBeenCalledTimes(2);
    expect(db.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'signing_invitation',
        signingRequestId: 'req_1',
        signerId: 'signer_1',
        toEmail: 'a@example.com',
        subject: 'Signature requested: Service Agreement',
        status: 'queued',
      }),
    });
    expect(queue.add).toHaveBeenCalledWith('send-email', {
      deliveryId: 'email_signer_1',
      template: 'signing_invitation',
    });
  });

  it('enqueues completion email only after completed PDF storage exists', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_2' })) };
    const db = {
      signingRequest: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'req_1',
          workspaceId: 'wrk_1',
          projectId: 'proj_1',
          completedPdfStorageKey: 'completed/req_1.pdf',
          ownerEmail: 'owner@example.com',
        })),
      },
      emailDelivery: {
        create: vi.fn(async ({ data }) => ({ id: 'email_complete', ...data })),
      },
    };

    const result = await enqueueCompletionEmail({
      db,
      queue,
      workspaceId: 'wrk_1',
      signingRequestId: 'req_1',
    });

    expect(result).toEqual({ deliveryId: 'email_complete', jobId: 'job_2' });
    expect(db.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'signing_completed',
        toEmail: 'owner@example.com',
        subject: 'Signed document is ready',
        status: 'queued',
      }),
    });
  });

  it('does not enqueue completion email before completed PDF storage exists', async () => {
    const queue = { add: vi.fn() };
    const db = {
      signingRequest: {
        findFirstOrThrow: vi.fn(async () => ({
          id: 'req_1',
          workspaceId: 'wrk_1',
          projectId: 'proj_1',
          completedPdfStorageKey: null,
          ownerEmail: 'owner@example.com',
        })),
      },
      emailDelivery: { create: vi.fn() },
    };

    await expect(
      enqueueCompletionEmail({ db, queue, workspaceId: 'wrk_1', signingRequestId: 'req_1' }),
    ).rejects.toThrow('Completed PDF must be stored before completion email is queued');
    expect(queue.add).not.toHaveBeenCalled();
  });

  it('enqueues document failure notification', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_3' })) };
    const db = {
      emailDelivery: {
        create: vi.fn(async ({ data }) => ({ id: 'email_failed', ...data })),
      },
    };

    await enqueueDocumentFailureEmail({
      db,
      queue,
      workspaceId: 'wrk_1',
      projectId: 'proj_1',
      signingRequestId: 'req_1',
      ownerEmail: 'owner@example.com',
      reason: 'PDF render failed',
    });

    expect(db.emailDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'document_failed',
        toEmail: 'owner@example.com',
        subject: 'Document processing failed',
        status: 'queued',
        lastError: 'PDF render failed',
      }),
    });
    expect(queue.add).toHaveBeenCalledWith('send-email', {
      deliveryId: 'email_failed',
      template: 'document_failed',
    });
  });
});
```

- [ ] **Step 2: Add lifecycle enqueue implementation**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/email/email-lifecycle-service.ts`:

```ts
interface LifecycleDb {
  signingRequest?: {
    findFirstOrThrow(args: Record<string, unknown>): Promise<{
      id: string;
      workspaceId: string;
      projectId: string;
      completedPdfStorageKey: string | null;
      ownerEmail: string;
    }>;
  };
  emailDelivery: {
    create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
  };
}

interface EmailQueue {
  add(name: string, payload: Record<string, unknown>, options?: Record<string, unknown>): Promise<{ id?: string }>;
}

async function enqueueDelivery(queue: EmailQueue, deliveryId: string, template: string) {
  const job = await queue.add('send-email', { deliveryId, template });
  return { deliveryId, jobId: job.id ?? null };
}

export async function enqueueSigningInvitationEmails(input: {
  db: LifecycleDb;
  queue: EmailQueue;
  workspaceId: string;
  projectId: string;
  signingRequestId: string;
  documentTitle: string;
  signers: Array<{ id: string; email: string }>;
}) {
  return Promise.all(
    input.signers.map(async (signer) => {
      const delivery = await input.db.emailDelivery.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId,
          signingRequestId: input.signingRequestId,
          signerId: signer.id,
          type: 'signing_invitation',
          toEmail: signer.email,
          subject: `Signature requested: ${input.documentTitle}`,
          status: 'queued',
        },
      });
      return enqueueDelivery(input.queue, delivery.id, 'signing_invitation');
    }),
  );
}

export async function enqueueCompletionEmail(input: {
  db: LifecycleDb;
  queue: EmailQueue;
  workspaceId: string;
  signingRequestId: string;
}) {
  const request = await input.db.signingRequest!.findFirstOrThrow({
    where: { id: input.signingRequestId, workspaceId: input.workspaceId },
  });
  if (!request.completedPdfStorageKey) {
    throw new Error('Completed PDF must be stored before completion email is queued');
  }
  const delivery = await input.db.emailDelivery.create({
    data: {
      workspaceId: request.workspaceId,
      projectId: request.projectId,
      signingRequestId: request.id,
      type: 'signing_completed',
      toEmail: request.ownerEmail,
      subject: 'Signed document is ready',
      status: 'queued',
    },
  });
  return enqueueDelivery(input.queue, delivery.id, 'signing_completed');
}

export async function enqueueDocumentFailureEmail(input: {
  db: LifecycleDb;
  queue: EmailQueue;
  workspaceId: string;
  projectId: string;
  signingRequestId: string;
  ownerEmail: string;
  reason: string;
}) {
  const delivery = await input.db.emailDelivery.create({
    data: {
      workspaceId: input.workspaceId,
      projectId: input.projectId,
      signingRequestId: input.signingRequestId,
      type: 'document_failed',
      toEmail: input.ownerEmail,
      subject: 'Document processing failed',
      status: 'queued',
      lastError: input.reason,
    },
  });
  return enqueueDelivery(input.queue, delivery.id, 'document_failed');
}
```

- [ ] **Step 3: Wire request creation to invitation enqueueing**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/modules/signing-requests/signing-request-service.ts` so the create path calls `enqueueSigningInvitationEmails` immediately after the signing request and signer rows are committed:

```ts
import { enqueueSigningInvitationEmails } from '../email/email-lifecycle-service';

export async function createSigningRequest(input: CreateSigningRequestInput) {
  const signingRequest = await input.db.signingRequest.create({
    data: buildSigningRequestCreateData(input),
    include: { signers: true, document: true },
  });

  await enqueueSigningInvitationEmails({
    db: input.db,
    queue: input.queues.email,
    workspaceId: input.workspaceId,
    projectId: input.projectId,
    signingRequestId: signingRequest.id,
    documentTitle: signingRequest.document.title,
    signers: signingRequest.signers.map((signer) => ({
      id: signer.id,
      email: signer.email,
    })),
  });

  return signingRequest;
}
```

- [ ] **Step 4: Write failing scheduled reminder worker test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/test/schedule-email-reminders.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { runScheduleEmailRemindersJob } from '../src/jobs/schedule-email-reminders.js';

describe('runScheduleEmailRemindersJob', () => {
  it('creates reminder deliveries for signers past the reminder interval', async () => {
    const queue = { add: vi.fn(async () => ({ id: 'job_1' })) };
    const db = {
      signer: {
        findMany: vi.fn(async () => [
          {
            id: 'signer_1',
            email: 'signer@example.com',
            workspaceId: 'wrk_1',
            projectId: 'proj_1',
            signingRequestId: 'req_1',
          },
        ]),
      },
      emailDelivery: {
        create: vi.fn(async ({ data }) => ({ id: 'email_reminder', ...data })),
      },
    };

    await runScheduleEmailRemindersJob({ db, queue, now: new Date('2026-05-12T12:00:00Z') });

    expect(db.signer.findMany).toHaveBeenCalledWith({
      where: {
        status: 'pending',
        signingRequest: { status: 'in_progress' },
        lastReminderSentAt: { lt: new Date('2026-05-09T12:00:00Z') },
      },
    });
    expect(queue.add).toHaveBeenCalledWith('send-email', {
      deliveryId: 'email_reminder',
      template: 'signing_reminder',
    });
  });
});
```

- [ ] **Step 5: Implement scheduled reminder job**

Create `/Users/minjun/Documents/dropsign-cloud/apps/worker/src/jobs/schedule-email-reminders.ts`:

```ts
const REMINDER_INTERVAL_MS = 3 * 24 * 60 * 60 * 1000;

export async function runScheduleEmailRemindersJob(input: {
  db: {
    signer: {
      findMany(args: Record<string, unknown>): Promise<
        Array<{
          id: string;
          email: string;
          workspaceId: string;
          projectId: string;
          signingRequestId: string;
        }>
      >;
    };
    emailDelivery: {
      create(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
    };
  };
  queue: {
    add(name: string, payload: Record<string, unknown>): Promise<{ id?: string }>;
  };
  now: Date;
}) {
  const cutoff = new Date(input.now.getTime() - REMINDER_INTERVAL_MS);
  const signers = await input.db.signer.findMany({
    where: {
      status: 'pending',
      signingRequest: { status: 'in_progress' },
      lastReminderSentAt: { lt: cutoff },
    },
  });

  for (const signer of signers) {
    const delivery = await input.db.emailDelivery.create({
      data: {
        workspaceId: signer.workspaceId,
        projectId: signer.projectId,
        signingRequestId: signer.signingRequestId,
        signerId: signer.id,
        type: 'signing_reminder',
        toEmail: signer.email,
        subject: 'Reminder: please sign',
        status: 'queued',
      },
    });
    await input.queue.add('send-email', {
      deliveryId: delivery.id,
      template: 'signing_reminder',
    });
  }
}
```

- [ ] **Step 6: Run lifecycle and scheduled reminder tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/test/email-lifecycle-service.test.ts apps/worker/test/schedule-email-reminders.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/modules/email/email-lifecycle-service.ts apps/api/src/modules/signing-requests/signing-request-service.ts apps/api/test/email-lifecycle-service.test.ts apps/worker/src/jobs/schedule-email-reminders.ts apps/worker/test/schedule-email-reminders.test.ts
git commit -m "feat: enqueue lifecycle email notifications"
```

Expected: commit succeeds.

## Phase Verification

- [ ] **Step 1: Run unit and integration tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/email/test/fake-provider.test.ts apps/worker/test/send-email.test.ts apps/worker/test/schedule-email-reminders.test.ts apps/api/test/email-routes.test.ts apps/api/test/email-lifecycle-service.test.ts apps/web/tests/email-deliveries-table.test.tsx
```

Expected: all listed tests pass.

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

- [ ] **Step 3: Commit any verification fixes**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git status --short
git add apps packages
git commit -m "test: verify email notification phase"
```

Expected: commit only if verification required code changes; otherwise `git status --short` is clean.
