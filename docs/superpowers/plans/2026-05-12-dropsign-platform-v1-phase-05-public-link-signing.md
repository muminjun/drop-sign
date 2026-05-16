# DropSign Platform v1 Phase 05 Public Link Signing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the tokenized public signing app so external signers can open secure links, complete required assigned fields with the DropSign SDK, submit signatures, see terminal states, and download completed documents only when the project allows it.

**Architecture:** Public signing is implemented as an unauthenticated route in the cloud web app backed by API routes that validate signer tokens server-side before exposing any document context. Token validation, routing gates, required field validation, artifact persistence, audit events, completion state updates, and download-link policy live in shared server modules so the page and API use the same rules. The page uses the published DropSign SDK only for field capture/placement and treats all browser-submitted values as untrusted until the completion API revalidates them.

**Tech Stack:** TypeScript, Next.js App Router in `apps/web`, Prisma with PostgreSQL, Vitest for server/domain tests, Playwright for end-to-end tests, `drop-sign` for signature capture, Node `crypto` for token hashing and timing-safe comparisons.

---

## Boundaries And Assumptions

- Execute implementation commands from `/Users/minjun/Documents/dropsign-cloud`.
- Create or modify only the files listed in each task under `/Users/minjun/Documents/dropsign-cloud`.
- Do not edit `/Users/minjun/Documents/drop-sign/tsup.config.ts`.
- Do not edit any plan files in `/Users/minjun/Documents/drop-sign/docs/superpowers/plans`.
- Use the exact file paths and public contracts in this plan. Imports use the existing `@/` app alias for `apps/web` and `@dropsign/db` for database access.
- Public signing links use this route shape: `/sign/[token]`.
- API routes use these endpoints:
  - `GET /api/public/signing/[token]`
  - `POST /api/public/signing/[token]/complete`
  - `GET /api/public/signing/[token]/download`
- Token values are never stored in plaintext. The database stores `sha256(token)` as `Signer.tokenHash`.
- Completion is idempotent per signer. A repeated completion request after `Signer.status = completed` returns the completed response without creating duplicate artifacts or audit events.

## File Map

- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`: server-rendered public signing page shell.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/PublicSigningClient.tsx`: client component that renders states, loads the SDK, tracks field completion, and submits values.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/public-signing.css`: scoped public signer page styles.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.ts`: token validation API route.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.ts`: signer completion API route.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/download/route.ts`: project-policy-controlled completed document redirect route.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.ts`: token hashing and validation helpers.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/types.ts`: public signing response and submit payload types.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.ts`: read-only signer context loader.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.ts`: transactional completion service.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.ts`: signed completed document URL service.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/public-signing-errors.ts`: typed public signing errors mapped to stable states.
- Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`: add tokenized signing fields, project download policy, signer status, field values, artifacts, audit events, and extend the Phase 04 `Document` model fields `title`, `sourceObjectKey`, and `completedObjectKey`.
- Create `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512050000_public_link_signing/migration.sql`: database migration for Phase 05 fields and indexes.
- Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts`: export Prisma enums and client types used by the web app.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/test/factories/public-signing.ts`: deterministic test fixtures.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.test.ts`: unit tests for token hashing and timing-safe validation.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.test.ts`: unit tests for valid, invalid, expired, revoked, waiting, completed states.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.test.ts`: unit tests for required fields, assigned fields, completion, idempotency, and audit events.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.test.ts`: unit tests for project-controlled download behavior.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.test.ts`: route contract tests for validation API.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.test.ts`: route contract tests for completion API.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/public-link-signing.spec.ts`: Playwright tests for open link, required field completion, expired token, revoked token, waiting signer, completed state, and allowed download link.
- Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/package.json`: add `drop-sign` and the public signing test scripts.

## Public Contracts

Use these TypeScript contracts exactly across route handlers, services, and client components.

```ts
export type PublicSigningState =
  | 'ready'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'waiting'
  | 'completed';

export type PublicSigningFieldKind =
  | 'signature'
  | 'initials'
  | 'date'
  | 'name'
  | 'text'
  | 'checkbox';

export type PublicSigningField = {
  id: string;
  kind: PublicSigningFieldKind;
  label: string;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | boolean | null;
};

export type PublicSigningContext =
  | {
      state: 'ready';
      requestId: string;
      signerId: string;
      signerName: string;
      signerEmail: string;
      documentName: string;
      documentPreviewUrl: string;
      expiresAt: string;
      fields: PublicSigningField[];
      canDownloadCompletedDocument: boolean;
    }
  | {
      state: 'completed';
      requestId: string;
      signerId: string;
      signerName: string;
      signerEmail: string;
      documentName: string;
      completedAt: string;
      downloadUrl: string | null;
    }
  | {
      state: 'invalid' | 'expired' | 'revoked' | 'waiting';
      message: string;
    };

export type PublicSigningCompletionFieldValue =
  | {
      fieldId: string;
      kind: 'signature' | 'initials';
      imageDataUrl: string;
      typedValue?: never;
      checked?: never;
    }
  | {
      fieldId: string;
      kind: 'date' | 'name' | 'text';
      typedValue: string;
      imageDataUrl?: never;
      checked?: never;
    }
  | {
      fieldId: string;
      kind: 'checkbox';
      checked: boolean;
      imageDataUrl?: never;
      typedValue?: never;
    };

export type PublicSigningCompletionRequest = {
  values: PublicSigningCompletionFieldValue[];
  sdkArtifact: {
    placementVersion: 'dropsign-v1';
    browserUserAgent: string;
    capturedAt: string;
  };
};
```

## Task 1: Database Model For Public Signing

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512050000_public_link_signing/migration.sql`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts`

- [ ] **Step 1: Write the failing schema assertion test**

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/src/public-link-signing-schema.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'packages/db/prisma/schema.prisma'), 'utf8');

describe('public link signing schema', () => {
  it('defines signer token and terminal-state fields', () => {
    expect(schema).toContain('enum SignerStatus');
    expect(schema).toContain('pending');
    expect(schema).toContain('completed');
    expect(schema).toContain('revoked');
    expect(schema).toContain('tokenHash      String   @unique');
    expect(schema).toContain('tokenExpiresAt DateTime');
    expect(schema).toContain('completedAt    DateTime?');
    expect(schema).toContain('revokedAt      DateTime?');
  });

  it('defines field values, signature artifacts, and project download policy', () => {
    expect(schema).toContain('allowSignerDownloads Boolean @default(false)');
    expect(schema).toContain('model SigningFieldValue');
    expect(schema).toContain('@@unique([signerId, fieldId])');
    expect(schema).toContain('model SignatureArtifact');
    expect(schema).toContain('sdkPlacementVersion String');
    expect(schema).toContain('title               String');
    expect(schema).toContain('sourceObjectKey     String');
    expect(schema).toContain('completedObjectKey String?');
  });
});
```

- [ ] **Step 2: Run the schema assertion test to verify it fails**

Run:

```bash
pnpm --filter @dropsign/db test -- public-link-signing-schema.test.ts
```

Expected: FAIL with output containing `expected '...' to contain 'tokenHash      String   @unique'`.

- [ ] **Step 3: Add Prisma schema fields**

Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma` so these definitions exist. Preserve existing fields, relations, indexes, and enum values from Phases 01-04 unless this task explicitly names a migration. Keep the Phase 04 `Document` identity and storage fields unchanged: `title`, `sourceObjectKey`, and `completedObjectKey`.

```prisma
enum SigningRequestStatus {
  draft
  sent
  in_progress
  completed
  cancelled
  document_failed
}

enum RoutingMode {
  parallel
  sequential
}

enum SignerStatus {
  pending
  viewed
  completed
  revoked
}

enum SigningFieldKind {
  signature
  initials
  date
  name
  text
  checkbox
}

enum AuditEventType {
  signing_request_viewed
  signature_completed
  signing_request_completed
  document_completed
  public_signing_rejected
}

model Project {
  id                     String           @id @default(cuid())
  workspaceId            String
  name                   String
  publicKey              String           @unique
  allowSignerDownloads   Boolean          @default(false)
  createdAt              DateTime         @default(now())
  updatedAt              DateTime         @updatedAt
  signingRequests        SigningRequest[]
}

model Document {
  id                  String           @id @default(cuid())
  workspaceId         String
  projectId           String
  title               String
  sourceObjectKey     String
  previewStorageKey   String?
  completedObjectKey String?
  completedSha256     String?
  completedAt         DateTime?
  createdAt           DateTime         @default(now())
  updatedAt           DateTime         @updatedAt
  signingRequests     SigningRequest[]
  fields              SigningField[]
}

model SigningRequest {
  id          String               @id @default(cuid())
  workspaceId String
  projectId   String
  documentId  String
  status      SigningRequestStatus @default(sent)
  routingMode RoutingMode          @default(parallel)
  createdAt   DateTime             @default(now())
  updatedAt   DateTime             @updatedAt
  completedAt DateTime?
  project     Project              @relation(fields: [projectId], references: [id])
  document    Document             @relation(fields: [documentId], references: [id])
  signers     Signer[]
  fields      SigningField[]
  auditEvents AuditEvent[]

  @@index([projectId, status])
  @@index([workspaceId, createdAt])
}

model Signer {
  id             String              @id @default(cuid())
  workspaceId    String
  requestId      String
  email          String
  name           String
  role           String
  routingOrder   Int                 @default(1)
  status         SignerStatus        @default(pending)
  tokenHash      String              @unique
  tokenExpiresAt DateTime
  viewedAt       DateTime?
  completedAt    DateTime?
  revokedAt      DateTime?
  createdAt      DateTime            @default(now())
  updatedAt      DateTime            @updatedAt
  request        SigningRequest      @relation(fields: [requestId], references: [id])
  fieldValues    SigningFieldValue[]
  artifacts      SignatureArtifact[]

  @@index([requestId, status])
  @@index([workspaceId, email])
}

model SigningField {
  id          String              @id @default(cuid())
  workspaceId String
  requestId   String
  documentId  String
  role        String
  kind        SigningFieldKind
  label       String
  required    Boolean             @default(true)
  page        Int
  x           Float
  y           Float
  width       Float
  height      Float
  createdAt   DateTime            @default(now())
  request     SigningRequest      @relation(fields: [requestId], references: [id])
  document    Document            @relation(fields: [documentId], references: [id])
  values      SigningFieldValue[]

  @@index([requestId, role])
}

model SigningFieldValue {
  id            String       @id @default(cuid())
  workspaceId   String
  requestId     String
  signerId      String
  fieldId       String
  stringValue   String?
  booleanValue  Boolean?
  imageDataUrl  String?
  completedAt   DateTime     @default(now())
  signer        Signer       @relation(fields: [signerId], references: [id])
  field         SigningField @relation(fields: [fieldId], references: [id])

  @@unique([signerId, fieldId])
  @@index([requestId])
}

model SignatureArtifact {
  id                  String   @id @default(cuid())
  workspaceId         String
  requestId           String
  signerId            String
  sdkPlacementVersion String
  browserUserAgent    String
  capturedAt          DateTime
  createdAt           DateTime @default(now())
  signer              Signer   @relation(fields: [signerId], references: [id])

  @@index([requestId, signerId])
}

model AuditEvent {
  id          String         @id @default(cuid())
  workspaceId String
  projectId   String
  requestId   String?
  signerId    String?
  type        AuditEventType
  metadata    Json
  createdAt   DateTime       @default(now())
  request     SigningRequest? @relation(fields: [requestId], references: [id])

  @@index([workspaceId, createdAt])
  @@index([requestId, createdAt])
}
```

- [ ] **Step 4: Add SQL migration**

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512050000_public_link_signing/migration.sql`:

```sql
CREATE TYPE "SignerStatus" AS ENUM ('pending', 'viewed', 'completed', 'revoked');
CREATE TYPE "SigningRequestStatus" AS ENUM ('draft', 'sent', 'in_progress', 'completed', 'cancelled', 'document_failed');
CREATE TYPE "RoutingMode" AS ENUM ('parallel', 'sequential');
CREATE TYPE "SigningFieldKind" AS ENUM ('signature', 'initials', 'date', 'name', 'text', 'checkbox');
CREATE TYPE "AuditEventType" AS ENUM ('signing_request_viewed', 'signature_completed', 'signing_request_completed', 'document_completed', 'public_signing_rejected');

ALTER TABLE "Project"
  ADD COLUMN IF NOT EXISTS "allowSignerDownloads" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Document"
  ADD COLUMN IF NOT EXISTS "previewStorageKey" text,
  ADD COLUMN IF NOT EXISTS "completedObjectKey" text,
  ADD COLUMN IF NOT EXISTS "completedSha256" text,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "SigningRequest"
  ADD COLUMN IF NOT EXISTS "status" "SigningRequestStatus" NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS "routingMode" "RoutingMode" NOT NULL DEFAULT 'parallel',
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE "Signer"
  ADD COLUMN IF NOT EXISTS "status" "SignerStatus" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'signer',
  ADD COLUMN IF NOT EXISTS "routingOrder" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "tokenHash" text,
  ADD COLUMN IF NOT EXISTS "tokenExpiresAt" TIMESTAMP(3) NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS "viewedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Signer_tokenHash_key" ON "Signer"("tokenHash");
CREATE INDEX IF NOT EXISTS "Signer_requestId_status_idx" ON "Signer"("requestId", "status");
CREATE INDEX IF NOT EXISTS "Signer_workspaceId_email_idx" ON "Signer"("workspaceId", "email");

CREATE TABLE IF NOT EXISTS "SigningField" (
  "id" text NOT NULL PRIMARY KEY,
  "workspaceId" text NOT NULL,
  "requestId" text NOT NULL,
  "documentId" text NOT NULL,
  "role" text NOT NULL,
  "kind" "SigningFieldKind" NOT NULL,
  "label" text NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "page" INTEGER NOT NULL,
  "x" DOUBLE PRECISION NOT NULL,
  "y" DOUBLE PRECISION NOT NULL,
  "width" DOUBLE PRECISION NOT NULL,
  "height" DOUBLE PRECISION NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SigningField_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SigningRequest"("id") ON DELETE RESTRICT ON UPdate CASCADE,
  CONSTRAINT "SigningField_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPdate CASCADE
);

CREATE INDEX IF NOT EXISTS "SigningField_requestId_role_idx" ON "SigningField"("requestId", "role");

CREATE TABLE IF NOT EXISTS "SigningFieldValue" (
  "id" text NOT NULL PRIMARY KEY,
  "workspaceId" text NOT NULL,
  "requestId" text NOT NULL,
  "signerId" text NOT NULL,
  "fieldId" text NOT NULL,
  "stringValue" text,
  "booleanValue" BOOLEAN,
  "imageDataUrl" text,
  "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SigningFieldValue_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE RESTRICT ON UPdate CASCADE,
  CONSTRAINT "SigningFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "SigningField"("id") ON DELETE RESTRICT ON UPdate CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SigningFieldValue_signerId_fieldId_key" ON "SigningFieldValue"("signerId", "fieldId");
CREATE INDEX IF NOT EXISTS "SigningFieldValue_requestId_idx" ON "SigningFieldValue"("requestId");

CREATE TABLE IF NOT EXISTS "SignatureArtifact" (
  "id" text NOT NULL PRIMARY KEY,
  "workspaceId" text NOT NULL,
  "requestId" text NOT NULL,
  "signerId" text NOT NULL,
  "sdkPlacementVersion" text NOT NULL,
  "browserUserAgent" text NOT NULL,
  "capturedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SignatureArtifact_signerId_fkey" FOREIGN KEY ("signerId") REFERENCES "Signer"("id") ON DELETE RESTRICT ON UPdate CASCADE
);

CREATE INDEX IF NOT EXISTS "SignatureArtifact_requestId_signerId_idx" ON "SignatureArtifact"("requestId", "signerId");

CREATE TABLE IF NOT EXISTS "AuditEvent" (
  "id" text NOT NULL PRIMARY KEY,
  "workspaceId" text NOT NULL,
  "projectId" text NOT NULL,
  "requestId" text,
  "signerId" text,
  "type" "AuditEventType" NOT NULL,
  "metadata" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "SigningRequest"("id") ON DELETE SET NULL ON UPdate CASCADE
);

CREATE INDEX IF NOT EXISTS "AuditEvent_workspaceId_createdAt_idx" ON "AuditEvent"("workspaceId", "createdAt");
CREATE INDEX IF NOT EXISTS "AuditEvent_requestId_createdAt_idx" ON "AuditEvent"("requestId", "createdAt");
```

- [ ] **Step 5: Export database types**

Modify `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts`:

```ts
export { PrismaClient } from '@prisma/client';
export type {
  AuditEvent,
  Document,
  Project,
  Signer,
  SigningField,
  SigningFieldValue,
  SigningRequest,
  SignatureArtifact,
} from '@prisma/client';
export {
  AuditEventType,
  Prisma,
  RoutingMode,
  SignerStatus,
  SigningFieldKind,
  SigningRequestStatus,
} from '@prisma/client';
```

- [ ] **Step 6: Run schema tests and Prisma validation**

Run:

```bash
pnpm --filter @dropsign/db test -- public-link-signing-schema.test.ts
pnpm --filter @dropsign/db prisma validate
pnpm --filter @dropsign/db prisma generate
```

Expected: all commands exit `0`; Vitest reports `2 passed`; Prisma reports the schema is valid and client generation completed.

- [ ] **Step 7: Commit database model**

Run:

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/20260512050000_public_link_signing/migration.sql packages/db/src/index.ts packages/db/src/public-link-signing-schema.test.ts
git commit -m "feat: add public signing data model"
```

Expected: commit succeeds and includes only the four listed paths.

## Task 2: Token Hashing And Public Signing Error Types

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/public-signing-errors.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/types.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.test.ts`

- [ ] **Step 1: Write failing token tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { hashSigningToken, isSigningTokenMatch, normalizeSigningToken } from './token';

describe('public signing token helpers', () => {
  it('normalizes URL tokens without changing entropy characters', () => {
    expect(normalizeSigningToken('  abc.DEF_123-xyz  ')).toBe('abc.DEF_123-xyz');
  });

  it('rejects empty and whitespace-only tokens', () => {
    expect(() => normalizeSigningToken('')).toThrow('Signing token is required');
    expect(() => normalizeSigningToken('    ')).toThrow('Signing token is required');
  });

  it('hashes tokens with sha256 hex output', () => {
    expect(hashSigningToken('signer_token_123')).toBe(
      'e9a7302662ff15326f5ee715b7c97f3dafde60a1239c3d5746ebd502c9358d88',
    );
  });

  it('uses timing-safe comparison for equal hashes and rejects mismatches', () => {
    const token = 'token_for_timing_safe_compare';
    const hash = hashSigningToken(token);

    expect(isSigningTokenMatch(token, hash)).toBe(true);
    expect(isSigningTokenMatch('different_token', hash)).toBe(false);
    expect(isSigningTokenMatch(token, 'not-a-sha256-hash')).toBe(false);
  });
});
```

- [ ] **Step 2: Run token tests to verify they fail**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/token.test.ts
```

Expected: FAIL with output containing `Cannot find module './token'`.

- [ ] **Step 3: Add public signing types**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/types.ts`:

```ts
export type PublicSigningState =
  | 'ready'
  | 'invalid'
  | 'expired'
  | 'revoked'
  | 'waiting'
  | 'completed';

export type PublicSigningFieldKind =
  | 'signature'
  | 'initials'
  | 'date'
  | 'name'
  | 'text'
  | 'checkbox';

export type PublicSigningField = {
  id: string;
  kind: PublicSigningFieldKind;
  label: string;
  required: boolean;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string | boolean | null;
};

export type PublicSigningContext =
  | {
      state: 'ready';
      requestId: string;
      signerId: string;
      signerName: string;
      signerEmail: string;
      documentName: string;
      documentPreviewUrl: string;
      expiresAt: string;
      fields: PublicSigningField[];
      canDownloadCompletedDocument: boolean;
    }
  | {
      state: 'completed';
      requestId: string;
      signerId: string;
      signerName: string;
      signerEmail: string;
      documentName: string;
      completedAt: string;
      downloadUrl: string | null;
    }
  | {
      state: 'invalid' | 'expired' | 'revoked' | 'waiting';
      message: string;
    };

export type PublicSigningCompletionFieldValue =
  | {
      fieldId: string;
      kind: 'signature' | 'initials';
      imageDataUrl: string;
      typedValue?: never;
      checked?: never;
    }
  | {
      fieldId: string;
      kind: 'date' | 'name' | 'text';
      typedValue: string;
      imageDataUrl?: never;
      checked?: never;
    }
  | {
      fieldId: string;
      kind: 'checkbox';
      checked: boolean;
      imageDataUrl?: never;
      typedValue?: never;
    };

export type PublicSigningCompletionRequest = {
  values: PublicSigningCompletionFieldValue[];
  sdkArtifact: {
    placementVersion: 'dropsign-v1';
    browserUserAgent: string;
    capturedAt: string;
  };
};

export type PublicSigningCompletionResponse = {
  state: 'completed';
  requestId: string;
  signerId: string;
  completedAt: string;
  downloadUrl: string | null;
};
```

- [ ] **Step 4: Add typed public signing errors**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/public-signing-errors.ts`:

```ts
import type { PublicSigningState } from './types';

export class PublicSigningError extends Error {
  constructor(
    readonly state: Exclude<PublicSigningState, 'ready' | 'completed'>,
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'PublicSigningError';
  }
}

export function invalidSigningLink(): PublicSigningError {
  return new PublicSigningError('invalid', 'This signing link is invalid.', 404);
}

export function expiredSigningLink(): PublicSigningError {
  return new PublicSigningError('expired', 'This signing link has expired.', 410);
}

export function revokedSigningLink(): PublicSigningError {
  return new PublicSigningError('revoked', 'This signing link has been revoked.', 410);
}

export function waitingForRoutingTurn(): PublicSigningError {
  return new PublicSigningError(
    'waiting',
    'This document is waiting for another signer before your turn.',
    409,
  );
}

export function requiredFieldsMissing(fieldIds: string[]): PublicSigningError {
  return new PublicSigningError(
    'invalid',
    `Missing required field values: ${fieldIds.join(', ')}`,
    422,
  );
}

export function fieldNotAssignedToSigner(fieldId: string): PublicSigningError {
  return new PublicSigningError('invalid', `Field ${fieldId} is not assigned to this signer.`, 403);
}
```

- [ ] **Step 5: Add token helper implementation**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/token.ts`:

```ts
import { createHash, timingSafeEqual } from 'node:crypto';

export function normalizeSigningToken(token: string): string {
  const normalized = token.trim();

  if (normalized.length === 0) {
    throw new Error('Signing token is required');
  }

  return normalized;
}

export function hashSigningToken(token: string): string {
  return createHash('sha256').update(normalizeSigningToken(token), 'utf8').digest('hex');
}

export function isSigningTokenMatch(token: string, expectedHash: string): boolean {
  if (!/^[a-f0-9]{64}$/u.test(expectedHash)) {
    return false;
  }

  const actual = Buffer.from(hashSigningToken(token), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

- [ ] **Step 6: Run token tests**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/token.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 7: Commit token helpers**

Run:

```bash
git add apps/web/lib/public-signing/token.ts apps/web/lib/public-signing/public-signing-errors.ts apps/web/lib/public-signing/types.ts apps/web/lib/public-signing/token.test.ts
git commit -m "feat: add public signing token validation"
```

Expected: commit succeeds and includes only the four listed paths.

## Task 3: Public Signing Context Loader

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/test/factories/public-signing.ts`

- [ ] **Step 1: Create deterministic public signing test factory**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/test/factories/public-signing.ts`:

```ts
import { hashSigningToken } from '@/lib/public-signing/token';

export const activeToken = 'public_active_token';
export const expiredToken = 'public_expired_token';
export const revokedToken = 'public_revoked_token';
export const waitingToken = 'public_waiting_token';
export const completedToken = 'public_completed_token';

export function publicSigningFixture(now = new Date('2026-05-12T12:00:00.000Z')) {
  const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
  const expiredAt = new Date(now.getTime() - 60 * 1000);
  const completedAt = new Date('2026-05-12T12:05:00.000Z');

  return {
    now,
    projects: [
      {
        id: 'project_1',
        workspaceId: 'workspace_1',
        name: 'Acme Sales',
        publicKey: 'pk_test_acme',
        allowSignerDownloads: true,
      },
    ],
    documents: [
      {
        id: 'document_1',
        workspaceId: 'workspace_1',
        projectId: 'project_1',
        title: 'Mutual NDA.pdf',
        sourceObjectKey: 'documents/source/nda.pdf',
        previewStorageKey: 'documents/preview/nda-page-1.png',
        completedObjectKey: 'documents/completed/nda-completed.pdf',
      },
    ],
    requests: [
      {
        id: 'request_1',
        workspaceId: 'workspace_1',
        projectId: 'project_1',
        documentId: 'document_1',
        status: 'sent',
        routingMode: 'parallel',
      },
      {
        id: 'request_waiting',
        workspaceId: 'workspace_1',
        projectId: 'project_1',
        documentId: 'document_1',
        status: 'sent',
        routingMode: 'sequential',
      },
      {
        id: 'request_completed',
        workspaceId: 'workspace_1',
        projectId: 'project_1',
        documentId: 'document_1',
        status: 'completed',
        routingMode: 'parallel',
        completedAt,
      },
    ],
    signers: [
      {
        id: 'signer_active',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        email: 'alex@example.com',
        name: 'Alex Kim',
        role: 'recipient',
        routingOrder: 1,
        status: 'pending',
        tokenHash: hashSigningToken(activeToken),
        tokenExpiresAt: expiresAt,
        viewedAt: null,
        completedAt: null,
        revokedAt: null,
      },
      {
        id: 'signer_expired',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        email: 'expired@example.com',
        name: 'Expired User',
        role: 'recipient',
        routingOrder: 1,
        status: 'pending',
        tokenHash: hashSigningToken(expiredToken),
        tokenExpiresAt: expiredAt,
        viewedAt: null,
        completedAt: null,
        revokedAt: null,
      },
      {
        id: 'signer_revoked',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        email: 'revoked@example.com',
        name: 'Revoked User',
        role: 'recipient',
        routingOrder: 1,
        status: 'revoked',
        tokenHash: hashSigningToken(revokedToken),
        tokenExpiresAt: expiresAt,
        viewedAt: null,
        completedAt: null,
        revokedAt: now,
      },
      {
        id: 'signer_waiting_first',
        workspaceId: 'workspace_1',
        requestId: 'request_waiting',
        email: 'first@example.com',
        name: 'First User',
        role: 'first',
        routingOrder: 1,
        status: 'pending',
        tokenHash: hashSigningToken('first_token'),
        tokenExpiresAt: expiresAt,
        viewedAt: null,
        completedAt: null,
        revokedAt: null,
      },
      {
        id: 'signer_waiting_second',
        workspaceId: 'workspace_1',
        requestId: 'request_waiting',
        email: 'second@example.com',
        name: 'Second User',
        role: 'second',
        routingOrder: 2,
        status: 'pending',
        tokenHash: hashSigningToken(waitingToken),
        tokenExpiresAt: expiresAt,
        viewedAt: null,
        completedAt: null,
        revokedAt: null,
      },
      {
        id: 'signer_completed',
        workspaceId: 'workspace_1',
        requestId: 'request_completed',
        email: 'done@example.com',
        name: 'Done User',
        role: 'recipient',
        routingOrder: 1,
        status: 'completed',
        tokenHash: hashSigningToken(completedToken),
        tokenExpiresAt: expiresAt,
        viewedAt: completedAt,
        completedAt,
        revokedAt: null,
      },
    ],
    fields: [
      {
        id: 'field_signature',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        documentId: 'document_1',
        role: 'recipient',
        kind: 'signature',
        label: 'Signature',
        required: true,
        page: 1,
        x: 0.18,
        y: 0.72,
        width: 0.32,
        height: 0.12,
      },
      {
        id: 'field_name',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        documentId: 'document_1',
        role: 'recipient',
        kind: 'name',
        label: 'Full name',
        required: true,
        page: 1,
        x: 0.18,
        y: 0.64,
        width: 0.32,
        height: 0.05,
      },
      {
        id: 'field_optional_checkbox',
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        documentId: 'document_1',
        role: 'recipient',
        kind: 'checkbox',
        label: 'Send me a copy',
        required: false,
        page: 1,
        x: 0.18,
        y: 0.82,
        width: 0.04,
        height: 0.04,
      },
    ],
  };
}
```

- [ ] **Step 2: Write failing context loader tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import {
  activeToken,
  completedToken,
  expiredToken,
  publicSigningFixture,
  revokedToken,
  waitingToken,
} from '@/test/factories/public-signing';
import { getPublicSigningContext } from './get-public-signing-context';

function createPrismaMock(fixture = publicSigningFixture()) {
  const findSigner = (tokenHash: string) => {
    const signer = fixture.signers.find((candidate) => candidate.tokenHash === tokenHash);
    if (!signer) {
      return null;
    }

    const request = fixture.requests.find((candidate) => candidate.id === signer.requestId);
    const project = fixture.projects.find((candidate) => candidate.id === request?.projectId);
    const document = fixture.documents.find((candidate) => candidate.id === request?.documentId);
    const signers = fixture.signers.filter((candidate) => candidate.requestId === signer.requestId);
    const fields = fixture.fields.filter(
      (candidate) => candidate.requestId === signer.requestId && candidate.role === signer.role,
    );

    return {
      ...signer,
      request: {
        ...request,
        project,
        document,
        signers,
        fields,
      },
    };
  };

  return {
    signer: {
      findUnique: vi.fn(({ where }) => Promise.resolve(findSigner(where.tokenHash))),
      update: vi.fn(({ data, where }) =>
        Promise.resolve({
          ...fixture.signers.find((candidate) => candidate.id === where.id),
          ...data,
        }),
      ),
    },
    auditEvent: {
      create: vi.fn(() => Promise.resolve({ id: 'audit_viewed' })),
    },
  };
}

describe('getPublicSigningContext', () => {
  it('returns ready context and records first view for a valid token', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: activeToken,
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async (storageKey) => `https://assets.example/${storageKey}`,
    });

    expect(context).toMatchObject({
      state: 'ready',
      requestId: 'request_1',
      signerId: 'signer_active',
      signerName: 'Alex Kim',
      signerEmail: 'alex@example.com',
      documentName: 'Mutual NDA.pdf',
      documentPreviewUrl: 'https://assets.example/documents/preview/nda-page-1.png',
      canDownloadCompletedDocument: true,
    });
    expect(context.state === 'ready' ? context.fields.map((field) => field.id) : []).toEqual([
      'field_signature',
      'field_name',
      'field_optional_checkbox',
    ]);
    expect(prisma.signer.update).toHaveBeenCalledWith({
      where: { id: 'signer_active' },
      data: { status: 'viewed', viewedAt: new Date('2026-05-12T12:00:00.000Z') },
    });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'signing_request_viewed',
        signerId: 'signer_active',
        requestId: 'request_1',
      }),
    });
  });

  it('returns invalid state without document data for an unknown token', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: 'unknown_token',
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async () => 'https://assets.example/not-used.png',
    });

    expect(context).toEqual({ state: 'invalid', message: 'This signing link is invalid.' });
  });

  it('returns expired state without document data', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: expiredToken,
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async () => 'https://assets.example/not-used.png',
    });

    expect(context).toEqual({ state: 'expired', message: 'This signing link has expired.' });
  });

  it('returns revoked state without document data', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: revokedToken,
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async () => 'https://assets.example/not-used.png',
    });

    expect(context).toEqual({ state: 'revoked', message: 'This signing link has been revoked.' });
  });

  it('returns waiting state when sequential routing blocks the signer', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: waitingToken,
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async () => 'https://assets.example/not-used.png',
    });

    expect(context).toEqual({
      state: 'waiting',
      message: 'This document is waiting for another signer before your turn.',
    });
  });

  it('returns completed context with download URL only when policy allows it', async () => {
    const prisma = createPrismaMock();

    const context = await getPublicSigningContext({
      prisma,
      token: completedToken,
      now: new Date('2026-05-12T12:00:00.000Z'),
      getPreviewUrl: async () => 'https://assets.example/not-used.png',
      getDownloadUrl: async () => 'https://assets.example/download/completed.pdf',
    });

    expect(context).toEqual({
      state: 'completed',
      requestId: 'request_completed',
      signerId: 'signer_completed',
      signerName: 'Done User',
      signerEmail: 'done@example.com',
      documentName: 'Mutual NDA.pdf',
      completedAt: '2026-05-12T12:05:00.000Z',
      downloadUrl: 'https://assets.example/download/completed.pdf',
    });
  });
});
```

- [ ] **Step 3: Run context loader tests to verify they fail**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/get-public-signing-context.test.ts
```

Expected: FAIL with output containing `Cannot find module './get-public-signing-context'`.

- [ ] **Step 4: Implement context loader**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/get-public-signing-context.ts`:

```ts
import type { PrismaClient } from '@dropsign/db';
import { hashSigningToken } from './token';
import type { PublicSigningContext, PublicSigningFieldKind } from './types';

type PrismaLike = Pick<PrismaClient, 'signer' | 'auditEvent'>;

type StorageUrlResolver = (storageKey: string) => Promise<string>;

const fieldKindMap = {
  signature: 'signature',
  initials: 'initials',
  date: 'date',
  name: 'name',
  text: 'text',
  checkbox: 'checkbox',
} as const satisfies Record<string, PublicSigningFieldKind>;

export async function getPublicSigningContext({
  prisma,
  token,
  now = new Date(),
  getPreviewUrl,
  getDownloadUrl,
}: {
  prisma: PrismaLike;
  token: string;
  now?: Date;
  getPreviewUrl: StorageUrlResolver;
  getDownloadUrl?: StorageUrlResolver;
}): Promise<PublicSigningContext> {
  const signer = await prisma.signer.findUnique({
    where: { tokenHash: hashSigningToken(token) },
    include: {
      request: {
        include: {
          project: true,
          document: true,
          signers: true,
          fields: true,
        },
      },
    },
  });

  if (!signer) {
    return { state: 'invalid', message: 'This signing link is invalid.' };
  }

  if (signer.revokedAt || signer.status === 'revoked') {
    return { state: 'revoked', message: 'This signing link has been revoked.' };
  }

  if (signer.tokenExpiresAt.getTime() <= now.getTime()) {
    return { state: 'expired', message: 'This signing link has expired.' };
  }

  const request = signer.request;

  if (signer.status === 'completed' && signer.completedAt) {
    const storageKey = request.document.completedObjectKey;
    const downloadUrl =
      request.project.allowSignerDownloads && storageKey && getDownloadUrl
        ? await getDownloadUrl(storageKey)
        : null;

    return {
      state: 'completed',
      requestId: request.id,
      signerId: signer.id,
      signerName: signer.name,
      signerEmail: signer.email,
      documentName: request.document.title,
      completedAt: signer.completedAt.toISOString(),
      downloadUrl,
    };
  }

  if (request.routingMode === 'sequential') {
    const lowestIncompleteOrder = Math.min(
      ...request.signers
        .filter((requestSigner) => requestSigner.status !== 'completed')
        .map((requestSigner) => requestSigner.routingOrder),
    );

    if (signer.routingOrder > lowestIncompleteOrder) {
      return {
        state: 'waiting',
        message: 'This document is waiting for another signer before your turn.',
      };
    }
  }

  if (!signer.viewedAt) {
    await prisma.signer.update({
      where: { id: signer.id },
      data: { status: 'viewed', viewedAt: now },
    });
    await prisma.auditEvent.create({
      data: {
        workspaceId: signer.workspaceId,
        projectId: request.projectId,
        requestId: request.id,
        signerId: signer.id,
        type: 'signing_request_viewed',
        metadata: {
          signerEmail: signer.email,
          source: 'public_link',
        },
      },
    });
  }

  return {
    state: 'ready',
    requestId: request.id,
    signerId: signer.id,
    signerName: signer.name,
    signerEmail: signer.email,
    documentName: request.document.title,
    documentPreviewUrl: await getPreviewUrl(request.document.previewStorageKey ?? request.document.sourceObjectKey),
    expiresAt: signer.tokenExpiresAt.toISOString(),
    fields: request.fields
      .filter((field) => field.role === signer.role)
      .map((field) => ({
        id: field.id,
        kind: fieldKindMap[field.kind],
        label: field.label,
        required: field.required,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        value: null,
      })),
    canDownloadCompletedDocument: request.project.allowSignerDownloads,
  };
}
```

- [ ] **Step 5: Run context loader tests**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/get-public-signing-context.test.ts
```

Expected: PASS with `6 passed`.

- [ ] **Step 6: Commit context loader**

Run:

```bash
git add apps/web/test/factories/public-signing.ts apps/web/lib/public-signing/get-public-signing-context.ts apps/web/lib/public-signing/get-public-signing-context.test.ts
git commit -m "feat: load public signing context"
```

Expected: commit succeeds and includes only the three listed paths.

## Task 4: Signer Completion Service

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.test.ts`

- [ ] **Step 1: Write failing completion service tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { activeToken, completedToken, publicSigningFixture } from '@/test/factories/public-signing';
import { completePublicSigning } from './complete-public-signing';

const signaturePng =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=';

function createPrismaMock(fixture = publicSigningFixture()) {
  const fieldValues: unknown[] = [];
  const artifacts: unknown[] = [];
  const auditEvents: unknown[] = [];

  const findSigner = (tokenHash: string) => {
    const signer = fixture.signers.find((candidate) => candidate.tokenHash === tokenHash);
    if (!signer) {
      return null;
    }

    const request = fixture.requests.find((candidate) => candidate.id === signer.requestId);
    const project = fixture.projects.find((candidate) => candidate.id === request?.projectId);
    const document = fixture.documents.find((candidate) => candidate.id === request?.documentId);
    const signers = fixture.signers.filter((candidate) => candidate.requestId === signer.requestId);
    const fields = fixture.fields.filter((candidate) => candidate.requestId === signer.requestId);

    return {
      ...signer,
      request: {
        ...request,
        project,
        document,
        signers,
        fields,
      },
    };
  };

  const tx = {
    signer: {
      findUnique: vi.fn(({ where }) => Promise.resolve(findSigner(where.tokenHash))),
      update: vi.fn(({ data, where }) =>
        Promise.resolve({
          ...fixture.signers.find((candidate) => candidate.id === where.id),
          ...data,
        }),
      ),
    },
    signingFieldValue: {
      upsert: vi.fn(({ create }) => {
        fieldValues.push(create);
        return Promise.resolve(create);
      }),
    },
    signatureArtifact: {
      create: vi.fn(({ data }) => {
        artifacts.push(data);
        return Promise.resolve({ id: 'artifact_1', ...data });
      }),
    },
    signingRequest: {
      update: vi.fn(({ data }) => Promise.resolve(data)),
    },
    auditEvent: {
      create: vi.fn(({ data }) => {
        auditEvents.push(data);
        return Promise.resolve({ id: `audit_${auditEvents.length}`, ...data });
      }),
    },
  };

  return {
    tx,
    prisma: {
      $transaction: vi.fn((callback) => callback(tx)),
    },
    fieldValues,
    artifacts,
    auditEvents,
  };
}

describe('completePublicSigning', () => {
  it('rejects completion when a required field is missing', async () => {
    const { prisma } = createPrismaMock();

    await expect(
      completePublicSigning({
        prisma,
        token: activeToken,
        now: new Date('2026-05-12T12:10:00.000Z'),
        payload: {
          values: [{ fieldId: 'field_signature', kind: 'signature', imageDataUrl: signaturePng }],
          sdkArtifact: {
            placementVersion: 'dropsign-v1',
            browserUserAgent: 'Vitest Browser',
            capturedAt: '2026-05-12T12:09:59.000Z',
          },
        },
      }),
    ).rejects.toThrow('Missing required field values: field_name');
  });

  it('rejects values for fields assigned to another signer role', async () => {
    const { prisma } = createPrismaMock();

    await expect(
      completePublicSigning({
        prisma,
        token: activeToken,
        now: new Date('2026-05-12T12:10:00.000Z'),
        payload: {
          values: [
            { fieldId: 'field_signature', kind: 'signature', imageDataUrl: signaturePng },
            { fieldId: 'field_name', kind: 'name', typedValue: 'Alex Kim' },
            { fieldId: 'field_other_role', kind: 'text', typedValue: 'blocked' },
          ],
          sdkArtifact: {
            placementVersion: 'dropsign-v1',
            browserUserAgent: 'Vitest Browser',
            capturedAt: '2026-05-12T12:09:59.000Z',
          },
        },
      }),
    ).rejects.toThrow('Field field_other_role is not assigned to this signer.');
  });

  it('stores field values, artifact, signer completion, and audit event', async () => {
    const { prisma, fieldValues, artifacts, auditEvents } = createPrismaMock();

    const response = await completePublicSigning({
      prisma,
      token: activeToken,
      now: new Date('2026-05-12T12:10:00.000Z'),
      getDownloadUrl: async () => 'https://assets.example/download/completed.pdf',
      payload: {
        values: [
          { fieldId: 'field_signature', kind: 'signature', imageDataUrl: signaturePng },
          { fieldId: 'field_name', kind: 'name', typedValue: 'Alex Kim' },
          { fieldId: 'field_optional_checkbox', kind: 'checkbox', checked: true },
        ],
        sdkArtifact: {
          placementVersion: 'dropsign-v1',
          browserUserAgent: 'Vitest Browser',
          capturedAt: '2026-05-12T12:09:59.000Z',
        },
      },
    });

    expect(response).toEqual({
      state: 'completed',
      requestId: 'request_1',
      signerId: 'signer_active',
      completedAt: '2026-05-12T12:10:00.000Z',
      downloadUrl: 'https://assets.example/download/completed.pdf',
    });
    expect(fieldValues).toHaveLength(3);
    expect(artifacts).toEqual([
      expect.objectContaining({
        workspaceId: 'workspace_1',
        requestId: 'request_1',
        signerId: 'signer_active',
        sdkPlacementVersion: 'dropsign-v1',
        browserUserAgent: 'Vitest Browser',
      }),
    ]);
    expect(auditEvents).toContainEqual(
      expect.objectContaining({
        type: 'signature_completed',
        signerId: 'signer_active',
        requestId: 'request_1',
      }),
    );
  });

  it('returns completed response without duplicate writes when signer already completed', async () => {
    const { prisma, fieldValues, artifacts, auditEvents } = createPrismaMock();

    const response = await completePublicSigning({
      prisma,
      token: completedToken,
      now: new Date('2026-05-12T12:10:00.000Z'),
      getDownloadUrl: async () => 'https://assets.example/download/completed.pdf',
      payload: {
        values: [],
        sdkArtifact: {
          placementVersion: 'dropsign-v1',
          browserUserAgent: 'Vitest Browser',
          capturedAt: '2026-05-12T12:09:59.000Z',
        },
      },
    });

    expect(response).toMatchObject({
      state: 'completed',
      requestId: 'request_completed',
      signerId: 'signer_completed',
      completedAt: '2026-05-12T12:05:00.000Z',
    });
    expect(fieldValues).toHaveLength(0);
    expect(artifacts).toHaveLength(0);
    expect(auditEvents).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run completion tests to verify they fail**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/complete-public-signing.test.ts
```

Expected: FAIL with output containing `Cannot find module './complete-public-signing'`.

- [ ] **Step 3: Implement completion service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/complete-public-signing.ts`:

```ts
import type { PrismaClient } from '@dropsign/db';
import {
  expiredSigningLink,
  fieldNotAssignedToSigner,
  invalidSigningLink,
  requiredFieldsMissing,
  revokedSigningLink,
  waitingForRoutingTurn,
} from './public-signing-errors';
import { hashSigningToken } from './token';
import type {
  PublicSigningCompletionFieldValue,
  PublicSigningCompletionRequest,
  PublicSigningCompletionResponse,
} from './types';

type PrismaLike = Pick<PrismaClient, '$transaction'>;
type StorageUrlResolver = (storageKey: string) => Promise<string>;

export async function completePublicSigning({
  prisma,
  token,
  payload,
  now = new Date(),
  getDownloadUrl,
}: {
  prisma: PrismaLike;
  token: string;
  payload: PublicSigningCompletionRequest;
  now?: Date;
  getDownloadUrl?: StorageUrlResolver;
}): Promise<PublicSigningCompletionResponse> {
  return prisma.$transaction(async (tx) => {
    const signer = await tx.signer.findUnique({
      where: { tokenHash: hashSigningToken(token) },
      include: {
        request: {
          include: {
            project: true,
            document: true,
            signers: true,
            fields: true,
          },
        },
      },
    });

    if (!signer) {
      throw invalidSigningLink();
    }

    if (signer.revokedAt || signer.status === 'revoked') {
      throw revokedSigningLink();
    }

    if (signer.tokenExpiresAt.getTime() <= now.getTime()) {
      throw expiredSigningLink();
    }

    if (signer.status === 'completed' && signer.completedAt) {
      return {
        state: 'completed',
        requestId: signer.request.id,
        signerId: signer.id,
        completedAt: signer.completedAt.toISOString(),
        downloadUrl:
          signer.request.project.allowSignerDownloads &&
          signer.request.document.completedObjectKey &&
          getDownloadUrl
            ? await getDownloadUrl(signer.request.document.completedObjectKey)
            : null,
      };
    }

    if (signer.request.routingMode === 'sequential') {
      const lowestIncompleteOrder = Math.min(
        ...signer.request.signers
          .filter((requestSigner) => requestSigner.status !== 'completed')
          .map((requestSigner) => requestSigner.routingOrder),
      );

      if (signer.routingOrder > lowestIncompleteOrder) {
        throw waitingForRoutingTurn();
      }
    }

    const assignedFields = signer.request.fields.filter((field) => field.role === signer.role);
    const assignedById = new Map(assignedFields.map((field) => [field.id, field]));
    const valuesByFieldId = new Map(payload.values.map((value) => [value.fieldId, value]));

    for (const value of payload.values) {
      if (!assignedById.has(value.fieldId)) {
        throw fieldNotAssignedToSigner(value.fieldId);
      }
    }

    const missingRequired = assignedFields
      .filter((field) => field.required)
      .filter((field) => !hasCompletedValue(valuesByFieldId.get(field.id)))
      .map((field) => field.id);

    if (missingRequired.length > 0) {
      throw requiredFieldsMissing(missingRequired);
    }

    for (const value of payload.values) {
      const field = assignedById.get(value.fieldId);

      if (!field || !hasCompletedValue(value)) {
        continue;
      }

      await tx.signingFieldValue.upsert({
        where: { signerId_fieldId: { signerId: signer.id, fieldId: field.id } },
        update: toFieldValueData(value, now),
        create: {
          workspaceId: signer.workspaceId,
          requestId: signer.requestId,
          signerId: signer.id,
          fieldId: field.id,
          ...toFieldValueData(value, now),
        },
      });
    }

    await tx.signatureArtifact.create({
      data: {
        workspaceId: signer.workspaceId,
        requestId: signer.requestId,
        signerId: signer.id,
        sdkPlacementVersion: payload.sdkArtifact.placementVersion,
        browserUserAgent: payload.sdkArtifact.browserUserAgent,
        capturedAt: new Date(payload.sdkArtifact.capturedAt),
      },
    });

    await tx.signer.update({
      where: { id: signer.id },
      data: { status: 'completed', completedAt: now },
    });

    const allSignersComplete = signer.request.signers.every((requestSigner) =>
      requestSigner.id === signer.id ? true : requestSigner.status === 'completed',
    );

    if (allSignersComplete) {
      await tx.signingRequest.update({
        where: { id: signer.requestId },
        data: { status: 'completed', completedAt: now },
      });
    }

    await tx.auditEvent.create({
      data: {
        workspaceId: signer.workspaceId,
        projectId: signer.request.projectId,
        requestId: signer.requestId,
        signerId: signer.id,
        type: 'signature_completed',
        metadata: {
          source: 'public_link',
          fieldCount: payload.values.length,
          completedRequest: allSignersComplete,
        },
      },
    });

    if (allSignersComplete) {
      await tx.auditEvent.create({
        data: {
          workspaceId: signer.workspaceId,
          projectId: signer.request.projectId,
          requestId: signer.requestId,
          signerId: signer.id,
          type: 'signing_request_completed',
          metadata: {
            source: 'public_link',
          },
        },
      });
    }

    return {
      state: 'completed',
      requestId: signer.request.id,
      signerId: signer.id,
      completedAt: now.toISOString(),
      downloadUrl:
        signer.request.project.allowSignerDownloads &&
        signer.request.document.completedObjectKey &&
        getDownloadUrl
          ? await getDownloadUrl(signer.request.document.completedObjectKey)
          : null,
    };
  });
}

function hasCompletedValue(value: PublicSigningCompletionFieldValue | undefined): boolean {
  if (!value) {
    return false;
  }

  if (value.kind === 'signature' || value.kind === 'initials') {
    return /^data:image\/png;base64,[a-z0-9+/=]+$/iu.test(value.imageDataUrl);
  }

  if (value.kind === 'checkbox') {
    return value.checked === true;
  }

  return value.typedValue.trim().length > 0;
}

function toFieldValueData(value: PublicSigningCompletionFieldValue, completedAt: Date) {
  if (value.kind === 'signature' || value.kind === 'initials') {
    return {
      stringValue: null,
      booleanValue: null,
      imageDataUrl: value.imageDataUrl,
      completedAt,
    };
  }

  if (value.kind === 'checkbox') {
    return {
      stringValue: null,
      booleanValue: value.checked,
      imageDataUrl: null,
      completedAt,
    };
  }

  return {
    stringValue: value.typedValue.trim(),
    booleanValue: null,
    imageDataUrl: null,
    completedAt,
  };
}
```

- [ ] **Step 4: Run completion service tests**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/complete-public-signing.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit completion service**

Run:

```bash
git add apps/web/lib/public-signing/complete-public-signing.ts apps/web/lib/public-signing/complete-public-signing.test.ts
git commit -m "feat: complete public signing requests"
```

Expected: commit succeeds and includes only the two listed paths.

## Task 5: Completed Document Download Policy

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.test.ts`

- [ ] **Step 1: Write failing download policy tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { activeToken, completedToken, publicSigningFixture } from '@/test/factories/public-signing';
import { getPublicSigningDownloadUrl } from './download-public-signing-document';

function createPrismaMock({
  allowSignerDownloads = true,
  completedObjectKey = 'documents/completed/nda-completed.pdf',
} = {}) {
  const fixture = publicSigningFixture();
  fixture.projects[0].allowSignerDownloads = allowSignerDownloads;
  fixture.documents[0].completedObjectKey = completedObjectKey;

  return {
    signer: {
      findUnique: vi.fn(({ where }) => {
        const signer = fixture.signers.find((candidate) => candidate.tokenHash === where.tokenHash);
        if (!signer) {
          return Promise.resolve(null);
        }

        const request = fixture.requests.find((candidate) => candidate.id === signer.requestId);
        const project = fixture.projects.find((candidate) => candidate.id === request?.projectId);
        const document = fixture.documents.find((candidate) => candidate.id === request?.documentId);

        return Promise.resolve({
          ...signer,
          request: {
            ...request,
            project,
            document,
          },
        });
      }),
    },
  };
}

describe('getPublicSigningDownloadUrl', () => {
  it('returns a signed completed document URL for a completed signer when project allows downloads', async () => {
    const url = await getPublicSigningDownloadUrl({
      prisma: createPrismaMock(),
      token: completedToken,
      now: new Date('2026-05-12T12:20:00.000Z'),
      signStorageUrl: async (storageKey) => `https://assets.example/signed/${storageKey}`,
    });

    expect(url).toBe('https://assets.example/signed/documents/completed/nda-completed.pdf');
  });

  it('rejects download before signer completion', async () => {
    await expect(
      getPublicSigningDownloadUrl({
        prisma: createPrismaMock(),
        token: activeToken,
        now: new Date('2026-05-12T12:20:00.000Z'),
        signStorageUrl: async () => 'https://assets.example/not-used.pdf',
      }),
    ).rejects.toThrow('This signing link is invalid.');
  });

  it('rejects download when project disables signer downloads', async () => {
    await expect(
      getPublicSigningDownloadUrl({
        prisma: createPrismaMock({ allowSignerDownloads: false }),
        token: completedToken,
        now: new Date('2026-05-12T12:20:00.000Z'),
        signStorageUrl: async () => 'https://assets.example/not-used.pdf',
      }),
    ).rejects.toThrow('This signing link is invalid.');
  });

  it('rejects download when completed PDF is not stored yet', async () => {
    await expect(
      getPublicSigningDownloadUrl({
        prisma: createPrismaMock({ completedObjectKey: null }),
        token: completedToken,
        now: new Date('2026-05-12T12:20:00.000Z'),
        signStorageUrl: async () => 'https://assets.example/not-used.pdf',
      }),
    ).rejects.toThrow('This signing link is invalid.');
  });
});
```

- [ ] **Step 2: Run download policy tests to verify they fail**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/download-public-signing-document.test.ts
```

Expected: FAIL with output containing `Cannot find module './download-public-signing-document'`.

- [ ] **Step 3: Implement download policy service**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/lib/public-signing/download-public-signing-document.ts`:

```ts
import type { PrismaClient } from '@dropsign/db';
import { invalidSigningLink } from './public-signing-errors';
import { hashSigningToken } from './token';

type PrismaLike = Pick<PrismaClient, 'signer'>;

export async function getPublicSigningDownloadUrl({
  prisma,
  token,
  signStorageUrl,
}: {
  prisma: PrismaLike;
  token: string;
  now?: Date;
  signStorageUrl: (storageKey: string) => Promise<string>;
}): Promise<string> {
  const signer = await prisma.signer.findUnique({
    where: { tokenHash: hashSigningToken(token) },
    include: {
      request: {
        include: {
          project: true,
          document: true,
        },
      },
    },
  });

  if (
    !signer ||
    signer.status !== 'completed' ||
    !signer.completedAt ||
    !signer.request.project.allowSignerDownloads ||
    !signer.request.document.completedObjectKey
  ) {
    throw invalidSigningLink();
  }

  return signStorageUrl(signer.request.document.completedObjectKey);
}
```

- [ ] **Step 4: Run download policy tests**

Run:

```bash
pnpm --filter @dropsign/web test -- lib/public-signing/download-public-signing-document.test.ts
```

Expected: PASS with `4 passed`.

- [ ] **Step 5: Commit download policy**

Run:

```bash
git add apps/web/lib/public-signing/download-public-signing-document.ts apps/web/lib/public-signing/download-public-signing-document.test.ts
git commit -m "feat: enforce signer download policy"
```

Expected: commit succeeds and includes only the two listed paths.

## Task 6: Public Signing API Routes

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/download/route.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.test.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.test.ts`

- [ ] **Step 1: Write failing route contract tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { GET } from './route';

vi.mock('@/lib/db', () => ({ prisma: { signer: { findUnique: vi.fn() } } }));
vi.mock('@/lib/storage', () => ({
  getSignedReadUrl: vi.fn((storageKey: string) => Promise.resolve(`https://assets.example/${storageKey}`)),
}));
vi.mock('@/lib/public-signing/get-public-signing-context', () => ({
  getPublicSigningContext: vi.fn(() =>
    Promise.resolve({
      state: 'invalid',
      message: 'This signing link is invalid.',
    }),
  ),
}));

describe('GET /api/public/signing/[token]', () => {
  it('returns no-store JSON for public signing context', async () => {
    const response = await GET(new Request('https://app.example/api/public/signing/bad'), {
      params: Promise.resolve({ token: 'bad' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      state: 'invalid',
      message: 'This signing link is invalid.',
    });
  });
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { POST } from './route';

vi.mock('@/lib/db', () => ({ prisma: { $transaction: vi.fn() } }));
vi.mock('@/lib/storage', () => ({
  getSignedReadUrl: vi.fn((storageKey: string) => Promise.resolve(`https://assets.example/${storageKey}`)),
}));
vi.mock('@/lib/public-signing/complete-public-signing', () => ({
  completePublicSigning: vi.fn(() =>
    Promise.resolve({
      state: 'completed',
      requestId: 'request_1',
      signerId: 'signer_active',
      completedAt: '2026-05-12T12:10:00.000Z',
      downloadUrl: null,
    }),
  ),
}));

describe('POST /api/public/signing/[token]/complete', () => {
  it('returns completion response with no-store cache headers', async () => {
    const response = await POST(
      new Request('https://app.example/api/public/signing/public_active_token/complete', {
        method: 'POST',
        body: JSON.stringify({
          values: [
            {
              fieldId: 'field_name',
              kind: 'name',
              typedValue: 'Alex Kim',
            },
          ],
          sdkArtifact: {
            placementVersion: 'dropsign-v1',
            browserUserAgent: 'Vitest Browser',
            capturedAt: '2026-05-12T12:09:59.000Z',
          },
        }),
      }),
      { params: Promise.resolve({ token: 'public_active_token' }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    await expect(response.json()).resolves.toEqual({
      state: 'completed',
      requestId: 'request_1',
      signerId: 'signer_active',
      completedAt: '2026-05-12T12:10:00.000Z',
      downloadUrl: null,
    });
  });
});
```

- [ ] **Step 2: Run route tests to verify they fail**

Run:

```bash
pnpm --filter @dropsign/web test -- app/api/public/signing
```

Expected: FAIL with output containing `Cannot find module './route'`.

- [ ] **Step 3: Implement validation route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPublicSigningContext } from '@/lib/public-signing/get-public-signing-context';
import { getSignedReadUrl } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const context = await getPublicSigningContext({
    prisma,
    token,
    getPreviewUrl: getSignedReadUrl,
    getDownloadUrl: getSignedReadUrl,
  });

  return NextResponse.json(context, {
    headers: {
      'cache-control': 'no-store',
    },
  });
}
```

- [ ] **Step 4: Implement completion route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/complete/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { completePublicSigning } from '@/lib/public-signing/complete-public-signing';
import { PublicSigningError } from '@/lib/public-signing/public-signing-errors';
import type { PublicSigningCompletionRequest } from '@/lib/public-signing/types';
import { getSignedReadUrl } from '@/lib/storage';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;
  const payload = (await request.json()) as PublicSigningCompletionRequest;

  try {
    const response = await completePublicSigning({
      prisma,
      token,
      payload,
      getDownloadUrl: getSignedReadUrl,
    });

    return NextResponse.json(response, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof PublicSigningError) {
      return NextResponse.json(
        { state: error.state, message: error.message },
        {
          status: error.status,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    throw error;
  }
}
```

- [ ] **Step 5: Implement download route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/api/public/signing/[token]/download/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getPublicSigningDownloadUrl } from '@/lib/public-signing/download-public-signing-document';
import { PublicSigningError } from '@/lib/public-signing/public-signing-errors';
import { getSignedReadUrl } from '@/lib/storage';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  try {
    const url = await getPublicSigningDownloadUrl({
      prisma,
      token,
      signStorageUrl: getSignedReadUrl,
    });

    return NextResponse.redirect(url, {
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof PublicSigningError) {
      return NextResponse.json(
        { state: error.state, message: error.message },
        {
          status: error.status,
          headers: {
            'cache-control': 'no-store',
          },
        },
      );
    }

    throw error;
  }
}
```

- [ ] **Step 6: Run route tests**

Run:

```bash
pnpm --filter @dropsign/web test -- app/api/public/signing
```

Expected: PASS with `2 passed`.

- [ ] **Step 7: Commit API routes**

Run:

```bash
git add apps/web/app/api/public/signing/[token]/route.ts apps/web/app/api/public/signing/[token]/complete/route.ts apps/web/app/api/public/signing/[token]/download/route.ts apps/web/app/api/public/signing/[token]/route.test.ts apps/web/app/api/public/signing/[token]/complete/route.test.ts
git commit -m "feat: add public signing API routes"
```

Expected: commit succeeds and includes only the five listed paths.

## Task 7: Public Signer Page And SDK Integration

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/PublicSigningClient.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/public-signing.css`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/package.json`

- [ ] **Step 1: Add SDK dependency**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/package.json` so `dependencies` includes the SDK package:

```json
{
  "dependencies": {
    "drop-sign": "^0.1.0"
  }
}
```

Keep existing dependencies unchanged.

- [ ] **Step 2: Write failing page smoke test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/PublicSigningClient.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import PublicSigningClient from './PublicSigningClient';

describe('PublicSigningClient', () => {
  it('renders invalid token state without document details', () => {
    render(<PublicSigningClient token="bad" initialContext={{ state: 'invalid', message: 'This signing link is invalid.' }} />);

    expect(screen.getByRole('heading', { name: 'Signing link unavailable' })).toBeInTheDocument();
    expect(screen.getByText('This signing link is invalid.')).toBeInTheDocument();
    expect(screen.queryByText('Mutual NDA.pdf')).not.toBeInTheDocument();
  });

  it('renders ready fields and disables submit until required values are filled', () => {
    render(
      <PublicSigningClient
        token="public_active_token"
        initialContext={{
          state: 'ready',
          requestId: 'request_1',
          signerId: 'signer_active',
          signerName: 'Alex Kim',
          signerEmail: 'alex@example.com',
          documentName: 'Mutual NDA.pdf',
          documentPreviewUrl: 'https://assets.example/preview.png',
          expiresAt: '2026-05-12T13:00:00.000Z',
          canDownloadCompletedDocument: true,
          fields: [
            {
              id: 'field_name',
              kind: 'name',
              label: 'Full name',
              required: true,
              page: 1,
              x: 0.18,
              y: 0.64,
              width: 0.32,
              height: 0.05,
              value: null,
            },
          ],
        }}
      />,
    );

    expect(screen.getByRole('heading', { title: 'Mutual NDA.pdf' })).toBeInTheDocument();
    expect(screen.getByLabelText('Full name')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Complete signing' })).toBeDisabled();
  });
});
```

- [ ] **Step 3: Run page smoke test to verify it fails**

Run:

```bash
pnpm --filter @dropsign/web test -- app/sign/[token]/PublicSigningClient.test.tsx
```

Expected: FAIL with output containing `Cannot find module './PublicSigningClient'`.

- [ ] **Step 4: Implement server page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx`:

```tsx
import PublicSigningClient from './PublicSigningClient';
import './public-signing.css';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function PublicSigningPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <PublicSigningClient
      token={token}
      initialContext={{
        state: 'invalid',
        message: 'Loading signing link...',
      }}
      fetchContextOnMount
    />
  );
}
```

- [ ] **Step 5: Implement client page with SDK integration**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/PublicSigningClient.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { DropSign } from 'drop-sign';
import type {
  PublicSigningCompletionFieldValue,
  PublicSigningCompletionResponse,
  PublicSigningContext,
  PublicSigningField,
} from '@/lib/public-signing/types';

type FieldValueState = Record<string, string | boolean>;

export default function PublicSigningClient({
  token,
  initialContext,
  fetchContextOnMount = false,
}: {
  token: string;
  initialContext: PublicSigningContext;
  fetchContextOnMount?: boolean;
}) {
  const [context, setContext] = useState(initialContext);
  const [fieldValues, setFieldValues] = useState<FieldValueState>({});
  const [signatureImages, setSignatureImages] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!fetchContextOnMount) {
      return;
    }

    let cancelled = false;

    fetch(`/api/public/signing/${encodeURIComponent(token)}`, {
      headers: { accept: 'application/json' },
    })
      .then((response) => response.json())
      .then((nextContext: PublicSigningContext) => {
        if (!cancelled) {
          setContext(nextContext);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setContext({ state: 'invalid', message: 'This signing link is invalid.' });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [fetchContextOnMount, token]);

  const requiredComplete = useMemo(() => {
    if (context.state !== 'ready') {
      return false;
    }

    return context.fields
      .filter((field) => field.required)
      .every((field) => {
        if (field.kind === 'signature' || field.kind === 'initials') {
          return Boolean(signatureImages[field.id]);
        }

        if (field.kind === 'checkbox') {
          return fieldValues[field.id] === true;
        }

        return String(fieldValues[field.id] ?? '').trim().length > 0;
      });
  }, [context, fieldValues, signatureImages]);

  if (context.state !== 'ready') {
    return <TerminalState context={context} />;
  }

  async function captureSignature(field: PublicSigningField) {
    const sdk = new DropSign({
      mode: field.kind === 'initials' ? 'initials' : 'signature',
    });
    const result = await sdk.open();

    setSignatureImages((current) => ({
      ...current,
      [field.id]: result.imageDataUrl,
    }));
  }

  async function completeSigning() {
    if (context.state !== 'ready' || !requiredComplete) {
      return;
    }

    setSubmitting(true);
    setErrorMessage(null);

    const values: PublicSigningCompletionFieldValue[] = context.fields.flatMap((field) => {
      if (field.kind === 'signature' || field.kind === 'initials') {
        const imageDataUrl = signatureImages[field.id];
        return imageDataUrl ? [{ fieldId: field.id, kind: field.kind, imageDataUrl }] : [];
      }

      if (field.kind === 'checkbox') {
        return [{ fieldId: field.id, kind: 'checkbox', checked: fieldValues[field.id] === true }];
      }

      return [
        {
          fieldId: field.id,
          kind: field.kind,
          typedValue: String(fieldValues[field.id] ?? ''),
        },
      ];
    });

    const response = await fetch(`/api/public/signing/${encodeURIComponent(token)}/complete`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        values,
        sdkArtifact: {
          placementVersion: 'dropsign-v1',
          browserUserAgent: window.navigator.userAgent,
          capturedAt: new Date().toISOString(),
        },
      }),
    });
    const body = (await response.json()) as PublicSigningCompletionResponse | { message: string };

    setSubmitting(false);

    if (!response.ok) {
      setErrorMessage('message' in body ? body.message : 'Signing could not be completed.');
      return;
    }

    if ('state' in body && body.state === 'completed') {
      setContext({
        state: 'completed',
        requestId: body.requestId,
        signerId: body.signerId,
        signerName: context.signerName,
        signerEmail: context.signerEmail,
        documentName: context.documentName,
        completedAt: body.completedAt,
        downloadUrl: body.downloadUrl,
      });
    }
  }

  return (
    <main className="public-signing">
      <section className="public-signing__document">
        <div className="public-signing__header">
          <div>
            <p>{context.signerName}</p>
            <h1>{context.documentName}</h1>
          </div>
          <span>{completedCount(context.fields, fieldValues, signatureImages)} / {context.fields.length}</span>
        </div>
        <img src={context.documentPreviewUrl} alt={`${context.documentName} preview`} />
      </section>

      <aside className="public-signing__panel" aria-label="Assigned fields">
        {context.fields.map((field) => (
          <label className="public-signing__field" key={field.id}>
            <span>
              {field.label}
              {field.required ? <strong>Required</strong> : null}
            </span>
            {field.kind === 'signature' || field.kind === 'initials' ? (
              <button type="button" onClick={() => captureSignature(field)}>
                {signatureImages[field.id] ? 'Replace signature' : 'Add signature'}
              </button>
            ) : null}
            {field.kind === 'checkbox' ? (
              <input
                aria-label={field.label}
                type="checkbox"
                checked={fieldValues[field.id] === true}
                onChange={(event) =>
                  setFieldValues((current) => ({ ...current, [field.id]: event.target.checked }))
                }
              />
            ) : null}
            {field.kind === 'date' || field.kind === 'name' || field.kind === 'text' ? (
              <input
                aria-label={field.label}
                type={field.kind === 'date' ? 'date' : 'text'}
                value={String(fieldValues[field.id] ?? '')}
                onChange={(event) =>
                  setFieldValues((current) => ({ ...current, [field.id]: event.target.value }))
                }
              />
            ) : null}
          </label>
        ))}

        {errorMessage ? <p className="public-signing__error">{errorMessage}</p> : null}

        <button
          className="public-signing__submit"
          disabled={!requiredComplete || submitting}
          type="button"
          onClick={completeSigning}
        >
          {submitting ? 'Completing...' : 'Complete signing'}
        </button>
      </aside>
    </main>
  );
}

function TerminalState({ context }: { context: Exclude<PublicSigningContext, { state: 'ready' }> }) {
  if (context.state === 'completed') {
    return (
      <main className="public-signing public-signing--terminal">
        <h1>Signing complete</h1>
        <p>{context.documentName} was completed at {new Date(context.completedAt).toLocaleString()}.</p>
        {context.downloadUrl ? <a href={context.downloadUrl}>Download completed document</a> : null}
      </main>
    );
  }

  return (
    <main className="public-signing public-signing--terminal">
      <h1>Signing link unavailable</h1>
      <p>{context.message}</p>
    </main>
  );
}

function completedCount(
  fields: PublicSigningField[],
  fieldValues: FieldValueState,
  signatureImages: Record<string, string>,
) {
  return fields.filter((field) => {
    if (field.kind === 'signature' || field.kind === 'initials') {
      return Boolean(signatureImages[field.id]);
    }

    if (field.kind === 'checkbox') {
      return fieldValues[field.id] === true;
    }

    return String(fieldValues[field.id] ?? '').trim().length > 0;
  }).length;
}
```

- [ ] **Step 6: Add public signing styles**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/public-signing.css`:

```css
.public-signing {
  min-height: 100vh;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 360px;
  background: #f7f8fb;
  color: #16181d;
}

.public-signing__document {
  padding: 32px;
  min-width: 0;
}

.public-signing__header {
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: center;
  margin-bottom: 20px;
}

.public-signing__header p {
  margin: 0 0 4px;
  color: #626976;
  font-size: 14px;
}

.public-signing__header h1 {
  margin: 0;
  font-size: 28px;
  line-height: 1.2;
}

.public-signing__header span {
  font-variant-numeric: tabular-nums;
  color: #424854;
}

.public-signing__document img {
  width: 100%;
  max-width: 920px;
  background: white;
  border: 1px solid #d9dde5;
  box-shadow: 0 12px 30px rgb(23 29 39 / 10%);
}

.public-signing__panel {
  border-left: 1px solid #d9dde5;
  background: #ffffff;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.public-signing__field {
  display: grid;
  gap: 8px;
}

.public-signing__field span {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-weight: 600;
}

.public-signing__field strong {
  color: #7c2d12;
  font-size: 12px;
}

.public-signing__field input {
  min-height: 40px;
  border: 1px solid #b9c0cc;
  border-radius: 6px;
  padding: 0 10px;
  font: inherit;
}

.public-signing__field button,
.public-signing__submit,
.public-signing--terminal a {
  min-height: 42px;
  border: 0;
  border-radius: 6px;
  padding: 0 14px;
  font: inherit;
  font-weight: 700;
  background: #2156d9;
  color: #ffffff;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  text-decoration: none;
}

.public-signing__submit:disabled {
  background: #9aa3b2;
  cursor: not-allowed;
}

.public-signing__error {
  color: #b42318;
  margin: 0;
}

.public-signing--terminal {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px;
}

.public-signing--terminal h1 {
  margin: 0 0 12px;
  font-size: 32px;
}

.public-signing--terminal p {
  margin: 0 0 20px;
  color: #4b5563;
}

@media (max-width: 820px) {
  .public-signing {
    grid-template-columns: 1fr;
  }

  .public-signing__document {
    padding: 20px;
  }

  .public-signing__panel {
    border-left: 0;
    border-top: 1px solid #d9dde5;
  }
}
```

- [ ] **Step 7: Run page smoke test**

Run:

```bash
pnpm --filter @dropsign/web test -- app/sign/[token]/PublicSigningClient.test.tsx
```

Expected: PASS with `2 passed`.

- [ ] **Step 8: Commit public signer page**

Run:

```bash
git add apps/web/package.json apps/web/app/sign/[token]/page.tsx apps/web/app/sign/[token]/PublicSigningClient.tsx apps/web/app/sign/[token]/PublicSigningClient.test.tsx apps/web/app/sign/[token]/public-signing.css
git commit -m "feat: add public signer page"
```

Expected: commit succeeds and includes only the five listed paths.

## Task 8: End-To-End Public Link Signing Coverage

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/public-link-signing.spec.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/package.json`

- [ ] **Step 1: Add Playwright script**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/package.json` so `scripts` includes:

```json
{
  "scripts": {
    "e2e:public-signing": "playwright test e2e/public-link-signing.spec.ts"
  }
}
```

Keep existing scripts unchanged.

- [ ] **Step 2: Write E2E tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/public-link-signing.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const readyContext = {
  state: 'ready',
  requestId: 'request_1',
  signerId: 'signer_active',
  signerName: 'Alex Kim',
  signerEmail: 'alex@example.com',
  documentName: 'Mutual NDA.pdf',
  documentPreviewUrl:
    'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22600%22 height=%22800%22%3E%3Crect width=%22600%22 height=%22800%22 fill=%22white%22/%3E%3Ctext x=%2240%22 y=%2260%22 font-size=%2228%22%3EMutual NDA%3C/text%3E%3C/svg%3E',
  expiresAt: '2026-05-12T13:00:00.000Z',
  canDownloadCompletedDocument: true,
  fields: [
    {
      id: 'field_name',
      kind: 'name',
      label: 'Full name',
      required: true,
      page: 1,
      x: 0.18,
      y: 0.64,
      width: 0.32,
      height: 0.05,
      value: null,
    },
  ],
};

test('signer opens link, completes required field, and sees download link', async ({ page }) => {
  await page.route('**/api/public/signing/public_active_token/complete', async (route) => {
    const body = route.request().postDataJSON();

    expect(body.values).toEqual([{ fieldId: 'field_name', kind: 'name', typedValue: 'Alex Kim' }]);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'completed',
        requestId: 'request_1',
        signerId: 'signer_active',
        completedAt: '2026-05-12T12:10:00.000Z',
        downloadUrl: '/api/public/signing/public_active_token/download',
      }),
    });
  });
  await page.route('**/api/public/signing/public_active_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(readyContext),
    }),
  );

  await page.goto('/sign/public_active_token');
  await expect(page.getByRole('heading', { title: 'Mutual NDA.pdf' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Complete signing' })).toBeDisabled();

  await page.getByLabel('Full name').fill('Alex Kim');
  await page.getByRole('button', { name: 'Complete signing' }).click();

  await expect(page.getByRole('heading', { name: 'Signing complete' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download completed document' })).toHaveAttribute(
    'href',
    '/api/public/signing/public_active_token/download',
  );
});

test('expired token shows terminal expired state without document name', async ({ page }) => {
  await page.route('**/api/public/signing/public_expired_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'expired', message: 'This signing link has expired.' }),
    }),
  );

  await page.goto('/sign/public_expired_token');

  await expect(page.getByRole('heading', { name: 'Signing link unavailable' })).toBeVisible();
  await expect(page.getByText('This signing link has expired.')).toBeVisible();
  await expect(page.getByText('Mutual NDA.pdf')).toHaveCount(0);
});

test('revoked token shows terminal revoked state without document name', async ({ page }) => {
  await page.route('**/api/public/signing/public_revoked_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ state: 'revoked', message: 'This signing link has been revoked.' }),
    }),
  );

  await page.goto('/sign/public_revoked_token');

  await expect(page.getByRole('heading', { name: 'Signing link unavailable' })).toBeVisible();
  await expect(page.getByText('This signing link has been revoked.')).toBeVisible();
  await expect(page.getByText('Mutual NDA.pdf')).toHaveCount(0);
});

test('sequential signer waiting state shows routing message', async ({ page }) => {
  await page.route('**/api/public/signing/public_waiting_token', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        state: 'waiting',
        message: 'This document is waiting for another signer before your turn.',
      }),
    }),
  );

  await page.goto('/sign/public_waiting_token');

  await expect(page.getByRole('heading', { name: 'Signing link unavailable' })).toBeVisible();
  await expect(
    page.getByText('This document is waiting for another signer before your turn.'),
  ).toBeVisible();
});
```

- [ ] **Step 3: Run E2E tests after the public signing page is implemented**

Run:

```bash
pnpm --filter @dropsign/web e2e:public-signing
```

Expected: PASS with `4 passed`. A failure showing no request to `/api/public/signing/public_active_token` means `fetchContextOnMount` is not wired; a failure showing `Mutual NDA.pdf` on expired or revoked tests means terminal-state rendering is leaking document details.

- [ ] **Step 4: Confirm client fetch-on-mount is wired for browser-visible token validation**

Open `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/page.tsx` and verify it passes `fetchContextOnMount` to `PublicSigningClient`. Open `/Users/minjun/Documents/dropsign-cloud/apps/web/app/sign/[token]/PublicSigningClient.tsx` and verify it contains this exact fetch call:

```tsx
fetch(`/api/public/signing/${encodeURIComponent(token)}`, {
  headers: { accept: 'application/json' },
})
```

Expected: the page shell loads without direct database access, and the browser calls `GET /api/public/signing/[token]` before rendering document details.

- [ ] **Step 5: Run E2E tests to verify they pass**

Run:

```bash
pnpm --filter @dropsign/web e2e:public-signing
```

Expected: PASS with `4 passed`.

- [ ] **Step 6: Commit E2E coverage**

Run:

```bash
git add apps/web/package.json apps/web/e2e/public-link-signing.spec.ts apps/web/app/sign/[token]/page.tsx apps/web/app/sign/[token]/PublicSigningClient.tsx
git commit -m "test: cover public link signing e2e"
```

Expected: commit succeeds and includes only the listed files that changed in this task.

## Final Verification

Run these commands from `/Users/minjun/Documents/dropsign-cloud` after all tasks are complete:

```bash
pnpm install
pnpm --filter @dropsign/db prisma validate
pnpm --filter @dropsign/db prisma generate
pnpm --filter @dropsign/db test -- public-link-signing-schema.test.ts
pnpm --filter @dropsign/web test -- lib/public-signing app/api/public/signing app/sign/[token]/PublicSigningClient.test.tsx
pnpm --filter @dropsign/web e2e:public-signing
pnpm --filter @dropsign/web lint
pnpm --filter @dropsign/web typecheck
```

Expected outcomes:

- `pnpm install` exits `0` and updates the lockfile only if `drop-sign` was newly added.
- `prisma validate` exits `0` with schema-valid output.
- `prisma generate` exits `0` and regenerates Prisma client files.
- DB tests report the public signing schema assertions passed.
- Web tests report token, context, completion, download, route, and client smoke tests passed.
- Playwright reports `4 passed` for `public-link-signing.spec.ts`.
- `lint` exits `0` with no warnings.
- `typecheck` exits `0`.

## Commit Boundaries

- `feat: add public signing data model`
- `feat: add public signing token validation`
- `feat: load public signing context`
- `feat: complete public signing requests`
- `feat: enforce signer download policy`
- `feat: add public signing API routes`
- `feat: add public signer page`
- `test: cover public link signing e2e`

## Self-Review Checklist

- Secure tokenized signer URLs: Task 1 stores hashes; Task 2 hashes and compares tokens; Tasks 3, 4, and 5 validate tokens before returning data or completing work.
- Signer page in `apps/web`: Task 7 creates `/sign/[token]` page and client component.
- Token validation states: Task 3 covers invalid, expired, revoked, waiting, and completed states.
- Required field completion: Task 4 validates required fields server-side; Task 7 disables submit until required client values exist.
- SDK integration: Task 7 uses `drop-sign` for signature and initials capture.
- Signer completion API: Task 6 creates `POST /api/public/signing/[token]/complete`.
- Completed state and project-controlled download link: Tasks 3, 4, 5, and 6 expose download links only when `Project.allowSignerDownloads` is true and completed storage exists.
- E2E tests: Task 8 covers successful signing, expired token, revoked token, waiting state, required field gating, and download link visibility.
