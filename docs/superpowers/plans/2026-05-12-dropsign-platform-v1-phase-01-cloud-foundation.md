# DropSign Platform v1 Phase 01 Cloud Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the DropSign Cloud foundation as a sibling pnpm TypeScript monorepo with a tenant-aware Fastify API, Prisma PostgreSQL schema, auth/session base, storage abstraction, health endpoint, project create/list endpoints, and base tests.

**Architecture:** Create `/Users/minjun/Documents/dropsign-cloud` outside the existing SDK repo so cloud services can evolve independently while later consuming the published SDK. The API app owns HTTP, auth/session, tenant middleware, and route wiring; shared config and Prisma database code live in packages with explicit exports. Project endpoints use a repository boundary so route tests can run without PostgreSQL while Prisma schema and migrations define the production persistence model.

**Tech Stack:** pnpm workspace, TypeScript strict mode, Fastify, Zod, Prisma with PostgreSQL, Vitest, pino logging, dotenv, tsx, ESLint, Prettier.

---

### File Structure

Create only files under `/Users/minjun/Documents/dropsign-cloud` during implementation.

- Create: `/Users/minjun/Documents/dropsign-cloud/package.json` - root scripts and workspace tooling.
- Create: `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml` - app/package workspace patterns.
- Create: `/Users/minjun/Documents/dropsign-cloud/tsconfig.base.json` - strict shared TypeScript settings.
- Create: `/Users/minjun/Documents/dropsign-cloud/eslint.config.js` - ESLint v9 flat config.
- Create: `/Users/minjun/Documents/dropsign-cloud/prettier.config.js` - shared formatting config.
- Create: `/Users/minjun/Documents/dropsign-cloud/vitest.config.ts` - root Vitest config for cross-package tests.
- Create: `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts` - root Playwright config and e2e entry point.
- Create: `/Users/minjun/Documents/dropsign-cloud/.gitignore` - ignored dependencies, build output, env files, and coverage.
- Create: `/Users/minjun/Documents/dropsign-cloud/.env.example` - documented local environment variables.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/package.json` - API dependencies and scripts.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/tsconfig.json` - API TypeScript config.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/vitest.config.ts` - API test config.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` - Fastify app factory and route registration.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/server.ts` - runtime listener wrapper.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/index.ts` - optional package exports.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/types/fastify.d.ts` - Fastify request decorations.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/session.ts` - session foundation from signed dev headers.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/tenant.ts` - workspace tenant guard.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.ts` - health endpoint.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.ts` - project create/list endpoints.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/repositories/projectRepository.ts` - repository interface and Prisma implementation.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/test/buildTestApp.ts` - test app factory with in-memory repository.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.test.ts` - health route test.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.test.ts` - project route tests.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/package.json` - config package manifest.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/tsconfig.json` - config TypeScript config.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.ts` - environment parsing and typed config.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.test.ts` - environment parsing tests.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/package.json` - database package manifest and Prisma scripts.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/tsconfig.json` - database TypeScript config.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma` - PostgreSQL schema for `Workspace`, `Member`, `Project`, `ProjectApiKey`, `WidgetConfig`, and `AuditEvent`.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/src/client.ts` - Prisma client singleton helper.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts` - database package exports.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/package.json` - storage package manifest.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/tsconfig.json` - storage TypeScript config.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.ts` - storage abstraction interface and local in-memory test implementation.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.test.ts` - storage interface tests.
- Create placeholder app directories for later phases: `/Users/minjun/Documents/dropsign-cloud/apps/web`, `/Users/minjun/Documents/dropsign-cloud/apps/widget`, `/Users/minjun/Documents/dropsign-cloud/apps/worker`, and `/Users/minjun/Documents/dropsign-cloud/apps/e2e`.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/e2e/package.json` - e2e workspace package manifest with `name: @dropsign/e2e` and a `test` script that runs `playwright test`. Later phases add test files under `apps/e2e/tests/`; the manifest must exist so `pnpm --filter @dropsign/e2e` resolves.
- Create minimal skeleton packages for later phases: `/Users/minjun/Documents/dropsign-cloud/packages/contracts`, `/Users/minjun/Documents/dropsign-cloud/packages/api-client`, `/Users/minjun/Documents/dropsign-cloud/packages/domain`, `/Users/minjun/Documents/dropsign-cloud/packages/email`, `/Users/minjun/Documents/dropsign-cloud/packages/billing`, `/Users/minjun/Documents/dropsign-cloud/packages/testkit`, and `/Users/minjun/Documents/dropsign-cloud/packages/ui`, each with `package.json`, `tsconfig.json`, and `src/index.ts`.

Do not edit `/Users/minjun/Documents/drop-sign/tsup.config.ts`. Do not edit any existing plan files in `/Users/minjun/Documents/drop-sign/docs/superpowers/plans`.

### Task 1: Create The Monorepo Skeleton

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml`
- Create: `/Users/minjun/Documents/dropsign-cloud/tsconfig.base.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/eslint.config.js`
- Create: `/Users/minjun/Documents/dropsign-cloud/prettier.config.js`
- Create: `/Users/minjun/Documents/dropsign-cloud/vitest.config.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/.gitignore`
- Create: `/Users/minjun/Documents/dropsign-cloud/.env.example`

- [x] **Step 1: Create the sibling repo directory**

Run:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud
cd /Users/minjun/Documents/dropsign-cloud
git init
mkdir -p apps/api apps/web apps/widget apps/worker apps/e2e packages/config packages/db packages/storage
```

Expected: `Initialized empty Git repository in /Users/minjun/Documents/dropsign-cloud/.git/` if the directory has no existing Git repository. If Git reports `Reinitialized existing Git repository`, continue only when `git status --short` shows no unrelated user work.

- [x] **Step 2: Write the workspace files**

Create `/Users/minjun/Documents/dropsign-cloud/package.json`:

```json
{
  "name": "dropsign-cloud",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@10.10.0",
  "scripts": {
    "build": "pnpm -r build",
    "dev": "pnpm --filter @dropsign/api dev",
    "lint": "eslint . --max-warnings 0",
    "test": "vitest run --passWithNoTests",
    "e2e": "playwright test",
    "typecheck": "pnpm -r typecheck",
    "format": "prettier --write \"**/*.{ts,json,md,yml,yaml}\"",
    "db:generate": "pnpm --filter @dropsign/db prisma:generate",
    "db:migrate": "pnpm --filter @dropsign/db prisma:migrate"
  },
  "devDependencies": {
    "@eslint/js": "^9.26.0",
    "@types/node": "^22.15.17",
    "@playwright/test": "^1.52.0",
    "eslint": "^9.26.0",
    "globals": "^16.1.0",
    "prettier": "^3.5.3",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3",
    "typescript-eslint": "^8.32.1",
    "vitest": "^3.1.3"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml`:

```yaml
packages:
  - apps/*
  - packages/*
```

Create `/Users/minjun/Documents/dropsign-cloud/tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "isolatedModules": true,
    "noEmitOnError": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": true,
    "types": ["node"]
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/eslint.config.js`:

```js
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ['dist', 'coverage', 'node_modules', 'packages/db/src/generated'],
  },
);
```

Create `/Users/minjun/Documents/dropsign-cloud/prettier.config.js`:

```js
export default {
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  semi: true,
};
```

Create `/Users/minjun/Documents/dropsign-cloud/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['apps/**/*.test.ts', 'packages/**/*.test.ts'],
    passWithNoTests: true,
  },
});
```

Create `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts`:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './apps',
  testMatch: ['**/e2e/**/*.spec.ts', '**/tests/**/*.spec.ts'],
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
  },
});
```

Create `/Users/minjun/Documents/dropsign-cloud/.gitignore`:

```gitignore
node_modules
dist
coverage
.env
.env.*
!.env.example
*.log
.DS_Store
packages/db/src/generated
```

Create `/Users/minjun/Documents/dropsign-cloud/.env.example`:

```dotenv
NODE_ENV=development
PORT=4000
DATABASE_URL=postgresql://dropsign:dropsign@localhost:5432/dropsign_cloud
SESSION_HEADER_SECRET=replace-with-32-byte-local-secret
```

- [x] **Step 3: Create placeholder shared packages used by later phases**

Create these directories:

```bash
mkdir -p packages/contracts/src packages/api-client/src packages/domain/src packages/email/src packages/billing/src packages/testkit/src packages/ui/src
```

For each placeholder package, create a `package.json` with the workspace package name, a `tsconfig.json` extending `../../tsconfig.base.json`, and an empty `src/index.ts`. Use these package names:

```text
@dropsign/contracts
@dropsign/api-client
@dropsign/domain
@dropsign/email
@dropsign/billing
@dropsign/testkit
@dropsign/ui
```

Each placeholder `package.json` must include `private: true`, `type: "module"`, an export for `./src/index.ts`, and `build`, `test`, and `typecheck` scripts matching the config/db/storage package shape. Later phases append source files to these packages; they must not need to create package manifests from scratch.

Create `/Users/minjun/Documents/dropsign-cloud/apps/e2e/package.json`:

```json
{
  "name": "@dropsign/e2e",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "^1.52.0"
  }
}
```

- [x] **Step 4: Install dependencies**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm install
```

Expected: `pnpm-lock.yaml` is created and the install exits with code `0`.

- [x] **Step 5: Run baseline commands**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm test
```

Expected: PASS with output containing `No test files found` and exit code `0` because the root script uses `vitest run --passWithNoTests`.

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm typecheck
```

Expected: placeholder shared packages typecheck successfully with empty `src/index.ts` files.

- [x] **Step 6: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json eslint.config.js prettier.config.js vitest.config.ts playwright.config.ts .gitignore .env.example apps packages/contracts packages/api-client packages/domain packages/email packages/billing packages/testkit packages/ui
git commit -m "chore: scaffold dropsign cloud workspace"
```

Expected: commit succeeds with root workspace, lint, format, test, e2e, and environment files plus `pnpm-lock.yaml`.

### Task 2: Add Typed Runtime Config

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.test.ts`

- [x] **Step 1: Write the failing config tests**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/packages/config/src
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/config/package.json`:

```json
{
  "name": "@dropsign/config",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "dotenv": "^16.5.0",
    "zod": "^3.24.4"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/config/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { parseConfig } from './index.js';

describe('parseConfig', () => {
  it('parses a valid API environment', () => {
    const config = parseConfig({
      NODE_ENV: 'test',
      PORT: '4100',
      DATABASE_URL: 'postgresql://dropsign:dropsign@localhost:5432/dropsign_cloud',
      SESSION_HEADER_SECRET: 'test-secret-with-more-than-32-characters',
    });

    expect(config).toEqual({
      nodeEnv: 'test',
      port: 4100,
      databaseUrl: 'postgresql://dropsign:dropsign@localhost:5432/dropsign_cloud',
      sessionHeaderSecret: 'test-secret-with-more-than-32-characters',
    });
  });

  it('rejects a missing database URL with a field-specific issue', () => {
    expect(() =>
      parseConfig({
        NODE_ENV: 'test',
        PORT: '4100',
        SESSION_HEADER_SECRET: 'test-secret-with-more-than-32-characters',
      }),
    ).toThrow('DATABASE_URL');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/config test
```

Expected: FAIL with `Cannot find module './index.js'`.

- [x] **Step 3: Implement typed config parsing**

Create `/Users/minjun/Documents/dropsign-cloud/packages/config/src/index.ts`:

```ts
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

const environmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().startsWith('postgresql://'),
  SESSION_HEADER_SECRET: z.string().min(32),
});

export type AppConfig = {
  nodeEnv: 'development' | 'test' | 'production';
  port: number;
  databaseUrl: string;
  sessionHeaderSecret: string;
};

export function parseConfig(source: NodeJS.ProcessEnv): AppConfig {
  const parsed = environmentSchema.safeParse(source);

  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid DropSign Cloud configuration: ${message}`);
  }

  return {
    nodeEnv: parsed.data.NODE_ENV,
    port: parsed.data.PORT,
    databaseUrl: parsed.data.DATABASE_URL,
    sessionHeaderSecret: parsed.data.SESSION_HEADER_SECRET,
  };
}

export function loadConfig(): AppConfig {
  loadDotenv();
  return parseConfig(process.env);
}
```

- [x] **Step 4: Run test to verify it passes**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/config test
```

Expected: PASS with `2 tests`.

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/config typecheck
```

Expected: PASS with no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/config package.json pnpm-lock.yaml
git commit -m "feat: add typed cloud configuration"
```

Expected: commit succeeds with the config package and lockfile changes.

### Task 3: Add Prisma Database Package And PostgreSQL Schema

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/src/client.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts`

- [x] **Step 1: Write the Prisma package files with a schema validation target**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/packages/db/prisma /Users/minjun/Documents/dropsign-cloud/packages/db/src
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/package.json`:

```json
{
  "name": "@dropsign/db",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "prisma generate && tsc -p tsconfig.json",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:validate": "prisma validate",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@prisma/client": "^6.7.0"
  },
  "devDependencies": {
    "prisma": "^6.7.0"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum MemberRole {
  owner
  admin
  developer
  member
  viewer
  support_admin
}

enum ProjectEnvironment {
  test
  live
}

enum AuditEventActorType {
  member
  api_key
  system
  support_admin
}

model Workspace {
  id        String   @id @default(cuid())
  name      String
  slug      String   @unique
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  members     Member[]
  projects    Project[]
  auditEvents AuditEvent[]
}

model Member {
  id          String     @id @default(cuid())
  workspaceId String
  email       String
  name        String
  role        MemberRole @default(member)
  createdAt   DateTime   @default(now())
  updatedAt   DateTime   @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  auditEvents AuditEvent[]

  @@unique([workspaceId, email])
  @@index([workspaceId, role])
}

model Project {
  id          String             @id @default(cuid())
  workspaceId String
  name        String
  environment ProjectEnvironment @default(test)
  publicKey   String             @unique
  allowedOrigins String[]
  createdAt   DateTime           @default(now())
  updatedAt   DateTime           @updatedAt

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  apiKeys ProjectApiKey[]
  widgetConfig WidgetConfig?
  auditEvents AuditEvent[]

  @@index([workspaceId, environment])
}

model ProjectApiKey {
  id          String    @id @default(cuid())
  workspaceId String
  projectId   String
  name        String
  keyPrefix   String
  keyHash     String
  lastUsedAt  DateTime?
  revokedAt   DateTime?
  createdAt   DateTime  @default(now())

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, keyPrefix])
  @@index([workspaceId, projectId])
}

model WidgetConfig {
  id          String   @id @default(cuid())
  workspaceId String
  projectId   String   @unique
  buttonLabel String   @default("Sign")
  buttonColor String   @default("#111827")
  position    String   @default("bottom-right")
  mobilePosition String @default("bottom")
  enabledWorkflows String[] @default(["widget_signature"])
  pageTargeting Json     @default("{\"mode\":\"all\",\"rules\":[]}")
  customTriggers String[] @default([])
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([workspaceId])
}

model AuditEvent {
  id          String              @id @default(cuid())
  workspaceId String
  projectId   String?
  memberId    String?
  actorType   AuditEventActorType
  eventType   String
  message     String
  metadata    Json                @default("{}")
  createdAt   DateTime            @default(now())

  workspace Workspace @relation(fields: [workspaceId], references: [id], onDelete: Cascade)
  project Project? @relation(fields: [projectId], references: [id], onDelete: SetNull)
  member Member? @relation(fields: [memberId], references: [id], onDelete: SetNull)

  @@index([workspaceId, createdAt])
  @@index([projectId, createdAt])
}
```

- [x] **Step 2: Run schema validation**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm install
pnpm --filter @dropsign/db prisma:validate
```

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [x] **Step 3: Generate Prisma client and add database exports**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/db prisma:generate
```

Expected: PASS with `Generated Prisma Client`.

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/src/client.ts`:

```ts
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
  dropsignPrisma?: PrismaClient;
};

export function createPrismaClient(databaseUrl?: string): PrismaClient {
  return new PrismaClient({
    datasources: databaseUrl
      ? {
          db: {
            url: databaseUrl,
          },
        }
      : undefined,
  });
}

export const prisma = globalForPrisma.dropsignPrisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.dropsignPrisma = prisma;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/db/src/index.ts`:

```ts
export { createPrismaClient, prisma } from './client.js';
export type { PrismaClient } from '@prisma/client';
export { Prisma } from '@prisma/client';
```

- [x] **Step 4: Run typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/db typecheck
```

Expected: PASS with no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db package.json pnpm-lock.yaml
git commit -m "feat: add prisma cloud data model"
```

Expected: commit succeeds with the database package, generated Prisma metadata in `node_modules/.pnpm`, and lockfile changes staged only as tracked project files.

### Task 4: Add Storage Abstraction

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.test.ts`

- [x] **Step 1: Write the failing storage tests**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/packages/storage/src
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/storage/package.json`:

```json
{
  "name": "@dropsign/storage",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "exports": {
    ".": {
      "types": "./src/index.ts",
      "default": "./src/index.ts"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/storage/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { InMemoryStorage } from './index.js';

describe('InMemoryStorage', () => {
  it('stores an object and returns a signed read URL', async () => {
    const storage = new InMemoryStorage('https://storage.test');
    await storage.putObject({
      bucket: 'documents',
      key: 'workspace/project/source.pdf',
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    });

    const url = await storage.createSignedReadUrl({
      bucket: 'documents',
      key: 'workspace/project/source.pdf',
      expiresInSeconds: 300,
    });

    expect(url).toBe(
      'https://storage.test/documents/workspace%2Fproject%2Fsource.pdf?expiresInSeconds=300',
    );
    await expect(
      storage.getObject({ bucket: 'documents', key: 'workspace/project/source.pdf' }),
    ).resolves.toEqual({
      body: new Uint8Array([1, 2, 3]),
      contentType: 'application/pdf',
    });
  });

  it('throws a not found error for a missing object', async () => {
    const storage = new InMemoryStorage('https://storage.test');

    await expect(
      storage.getObject({ bucket: 'documents', key: 'missing.pdf' }),
    ).rejects.toThrow('Object not found: documents/missing.pdf');
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/storage test
```

Expected: FAIL with `Cannot find module './index.js'`.

- [x] **Step 3: Implement the storage contract**

Create `/Users/minjun/Documents/dropsign-cloud/packages/storage/src/index.ts`:

```ts
export type PutObjectInput = {
  bucket: string;
  key: string;
  body: Uint8Array;
  contentType: string;
};

export type GetObjectInput = {
  bucket: string;
  key: string;
};

export type StoredObject = {
  body: Uint8Array;
  contentType: string;
};

export type CreateSignedReadUrlInput = {
  bucket: string;
  key: string;
  expiresInSeconds: number;
};

export interface ObjectStorage {
  putObject(input: PutObjectInput): Promise<void>;
  getObject(input: GetObjectInput): Promise<StoredObject>;
  createSignedReadUrl(input: CreateSignedReadUrlInput): Promise<string>;
}

export class InMemoryStorage implements ObjectStorage {
  private readonly objects = new Map<string, StoredObject>();

  constructor(private readonly baseUrl: string) {}

  async putObject(input: PutObjectInput): Promise<void> {
    this.objects.set(this.objectId(input.bucket, input.key), {
      body: input.body,
      contentType: input.contentType,
    });
  }

  async getObject(input: GetObjectInput): Promise<StoredObject> {
    const object = this.objects.get(this.objectId(input.bucket, input.key));

    if (!object) {
      throw new Error(`Object not found: ${input.bucket}/${input.key}`);
    }

    return object;
  }

  async createSignedReadUrl(input: CreateSignedReadUrlInput): Promise<string> {
    const encodedKey = encodeURIComponent(input.key);
    return `${this.baseUrl}/${input.bucket}/${encodedKey}?expiresInSeconds=${input.expiresInSeconds}`;
  }

  private objectId(bucket: string, key: string): string {
    return `${bucket}/${key}`;
  }
}
```

- [x] **Step 4: Run tests and typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/storage test
pnpm --filter @dropsign/storage typecheck
```

Expected: PASS with `2 tests` and no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/storage package.json pnpm-lock.yaml
git commit -m "feat: add storage abstraction"
```

Expected: commit succeeds with the storage package and lockfile changes.

### Task 5: Add Fastify API Health Endpoint

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/vitest.config.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/server.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.test.ts`

- [x] **Step 1: Write the failing health route test**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/apps/api/src/routes
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/package.json`:

```json
{
  "name": "@dropsign/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "test": "vitest run",
    "typecheck": "tsc -p tsconfig.json --noEmit"
  },
  "dependencies": {
    "@dropsign/config": "workspace:*",
    "@dropsign/db": "workspace:*",
    "@fastify/cors": "^10.0.1",
    "@fastify/sensible": "^6.0.2",
    "fastify": "^5.3.2",
    "nanoid": "^5.1.5",
    "zod": "^3.24.4"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*.ts"]
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/routes/health.test.ts', 'src/routes/projects.test.ts'],
  },
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildApiApp } from '../app.js';

describe('GET /health', () => {
  it('returns service status', async () => {
    const app = await buildApiApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'dropsign-api',
    });

    await app.close();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm install
pnpm --filter @dropsign/api test -- --runInBand
```

Expected: FAIL with `Cannot find module '../app.js'`.

- [x] **Step 3: Implement Fastify app factory and health route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';

export const healthRoutes: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    return {
      ok: true,
      service: 'dropsign-api',
    };
  });
};
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`:

```ts
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { healthRoutes } from './routes/health.js';

export type BuildApiAppOptions = {
  logger?: boolean;
};

export async function buildApiApp(options: BuildApiAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  await app.register(sensible);
  await app.register(healthRoutes);

  return app;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/server.ts`:

```ts
import { loadConfig } from '@dropsign/config';
import { buildApiApp } from './app.js';

const config = loadConfig();
const app = await buildApiApp({ logger: config.nodeEnv !== 'test' });

try {
  await app.listen({ host: '0.0.0.0', port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/index.ts`:

```ts
export { buildApiApp, type BuildApiAppOptions } from './app.js';
```

- [x] **Step 4: Run test and typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- --runInBand
pnpm --filter @dropsign/api typecheck
```

Expected: PASS with `1 test` and no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api package.json pnpm-lock.yaml
git commit -m "feat: add api health endpoint"
```

Expected: commit succeeds with the API app, route test, and lockfile changes.

### Task 6: Add Auth Session And Tenant Middleware

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/types/fastify.d.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/session.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/tenant.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/test/buildTestApp.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.test.ts`

- [x] **Step 1: Write failing tests for protected tenant behavior**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins /Users/minjun/Documents/dropsign-cloud/apps/api/src/types /Users/minjun/Documents/dropsign-cloud/apps/api/src/test
```

Replace `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/health.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test/buildTestApp.js';

describe('GET /health', () => {
  it('returns service status without a session', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      service: 'dropsign-api',
    });

    await app.close();
  });

  it('rejects protected routes when a session header is missing', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects',
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({
      error: 'Unauthorized',
      message: 'Missing DropSign session headers',
    });

    await app.close();
  });
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/test/buildTestApp.ts`:

```ts
import { buildApiApp, type BuildApiAppOptions } from '../app.js';

export async function buildTestApp(options: BuildApiAppOptions = {}) {
  return buildApiApp({
    logger: false,
    ...options,
  });
}
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- --runInBand
```

Expected: FAIL with `Cannot find module '../test/buildTestApp.js'` or a 404 for `/v1/projects`.

- [x] **Step 3: Implement request decorations and middleware**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/types/fastify.d.ts`:

```ts
import type { MemberRole } from '../plugins/session.js';

declare module 'fastify' {
  interface FastifyRequest {
    session: {
      memberId: string;
      workspaceId: string;
      role: MemberRole;
      email: string;
    } | null;
    workspaceId: string | null;
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/session.ts`:

```ts
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';

export type MemberRole = 'owner' | 'admin' | 'developer' | 'member' | 'viewer' | 'support_admin';

const roles = new Set<MemberRole>([
  'owner',
  'admin',
  'developer',
  'member',
  'viewer',
  'support_admin',
]);

export const sessionPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('session', null);

  app.addHook('preHandler', async (request) => {
    const memberId = readHeader(request, 'x-dropsign-member-id');
    const workspaceId = readHeader(request, 'x-dropsign-workspace-id');
    const role = readHeader(request, 'x-dropsign-role');
    const email = readHeader(request, 'x-dropsign-email');

    if (!memberId && !workspaceId && !role && !email) {
      request.session = null;
      return;
    }

    if (!memberId || !workspaceId || !role || !email || !roles.has(role as MemberRole)) {
      throw app.httpErrors.unauthorized('Invalid DropSign session headers');
    }

    request.session = {
      memberId,
      workspaceId,
      role: role as MemberRole,
      email,
    };
  });
};

export function requireSession(request: FastifyRequest): NonNullable<FastifyRequest['session']> {
  if (!request.session) {
    throw request.server.httpErrors.unauthorized('Missing DropSign session headers');
  }

  return request.session;
}

function readHeader(request: FastifyRequest, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/plugins/tenant.ts`:

```ts
import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import { requireSession } from './session.js';

export const tenantPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest('workspaceId', null);
};

export function requireTenant(request: FastifyRequest): string {
  const session = requireSession(request);
  const workspaceId = readWorkspaceHeader(request) ?? session.workspaceId;

  if (workspaceId !== session.workspaceId) {
    throw request.server.httpErrors.forbidden('Workspace header does not match session workspace');
  }

  request.workspaceId = workspaceId;
  return workspaceId;
}

function readWorkspaceHeader(request: FastifyRequest): string | undefined {
  const value = request.headers['x-dropsign-workspace-id'];
  return Array.isArray(value) ? value[0] : value;
}
```

Replace `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` with:

```ts
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { sessionPlugin } from './plugins/session.js';
import { tenantPlugin } from './plugins/tenant.js';
import { healthRoutes } from './routes/health.js';

export type BuildApiAppOptions = {
  logger?: boolean;
};

export async function buildApiApp(options: BuildApiAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });

  await app.register(sensible);
  await app.register(sessionPlugin);
  await app.register(tenantPlugin);
  await app.register(healthRoutes);

  app.get('/v1/projects', async (request) => {
    const { requireTenant } = await import('./plugins/tenant.js');
    requireTenant(request);
    return { projects: [] };
  });

  return app;
}
```

- [x] **Step 4: Run tests and typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- --runInBand
pnpm --filter @dropsign/api typecheck
```

Expected: PASS with `2 tests` and no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api
git commit -m "feat: add session and tenant middleware"
```

Expected: commit succeeds with API middleware and tests.

### Task 7: Add Project Repository And Project Endpoints

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/repositories/projectRepository.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/test/buildTestApp.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.test.ts`

- [x] **Step 1: Write failing project endpoint tests**

Create directories:

```bash
mkdir -p /Users/minjun/Documents/dropsign-cloud/apps/api/src/repositories
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildTestApp } from '../test/buildTestApp.js';

const sessionHeaders = {
  'x-dropsign-member-id': 'mem_123',
  'x-dropsign-workspace-id': 'wrk_123',
  'x-dropsign-role': 'owner',
  'x-dropsign-email': 'owner@example.com',
};

describe('project routes', () => {
  it('creates a project with a widget config and audit event', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: sessionHeaders,
      payload: {
        name: 'Acme Production',
        environment: 'live',
        allowedOrigins: ['https://acme.example'],
      },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      project: {
        workspaceId: 'wrk_123',
        name: 'Acme Production',
        environment: 'live',
        allowedOrigins: ['https://acme.example'],
        widgetConfig: {
          buttonLabel: 'Sign',
          buttonColor: '#111827',
          position: 'bottom-right',
          mobilePosition: 'bottom',
        },
      },
      auditEvent: {
        workspaceId: 'wrk_123',
        actorType: 'member',
        eventType: 'project.created',
        message: 'Project Acme Production created',
      },
    });
    expect(response.json().project.publicKey).toMatch(/^pk_live_/);

    await app.close();
  });

  it('lists only projects for the session workspace', async () => {
    const app = await buildTestApp();

    await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: sessionHeaders,
      payload: {
        name: 'Acme Test',
        environment: 'test',
        allowedOrigins: ['https://test.acme.example'],
      },
    });

    await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: {
        ...sessionHeaders,
        'x-dropsign-workspace-id': 'wrk_other',
      },
      payload: {
        name: 'Other Workspace',
        environment: 'test',
        allowedOrigins: ['https://other.example'],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/projects',
      headers: sessionHeaders,
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().projects).toHaveLength(1);
    expect(response.json().projects[0]).toMatchObject({
      workspaceId: 'wrk_123',
      name: 'Acme Test',
      environment: 'test',
      allowedOrigins: ['https://test.acme.example'],
    });

    await app.close();
  });

  it('rejects project creation with an invalid origin URL', async () => {
    const app = await buildTestApp();

    const response = await app.inject({
      method: 'POST',
      url: '/v1/projects',
      headers: sessionHeaders,
      payload: {
        name: 'Bad Origin',
        environment: 'test',
        allowedOrigins: ['not-a-url'],
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({
      error: 'Bad Request',
      message: 'allowedOrigins.0: Invalid url',
    });

    await app.close();
  });
});
```

- [x] **Step 2: Run test to verify it fails**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- --runInBand
```

Expected: FAIL because `/v1/projects` returns the temporary empty route and `POST /v1/projects` returns 404.

- [x] **Step 3: Implement project repository and routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/repositories/projectRepository.ts`:

```ts
import type { PrismaClient } from '@dropsign/db';
import { nanoid } from 'nanoid';

export type ProjectEnvironment = 'test' | 'live';

export type WidgetConfigRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  buttonLabel: string;
  buttonColor: string;
  position: string;
  mobilePosition: string;
};

export type ProjectRecord = {
  id: string;
  workspaceId: string;
  name: string;
  environment: ProjectEnvironment;
  publicKey: string;
  allowedOrigins: string[];
  widgetConfig: WidgetConfigRecord;
  createdAt: string;
};

export type AuditEventRecord = {
  id: string;
  workspaceId: string;
  projectId: string;
  memberId: string;
  actorType: 'member';
  eventType: 'project.created';
  message: string;
  createdAt: string;
};

export type CreateProjectInput = {
  workspaceId: string;
  memberId: string;
  name: string;
  environment: ProjectEnvironment;
  allowedOrigins: string[];
};

export interface ProjectRepository {
  createProject(input: CreateProjectInput): Promise<{
    project: ProjectRecord;
    auditEvent: AuditEventRecord;
  }>;
  listProjects(workspaceId: string): Promise<ProjectRecord[]>;
}

export class InMemoryProjectRepository implements ProjectRepository {
  private readonly projects: ProjectRecord[] = [];
  private readonly auditEvents: AuditEventRecord[] = [];

  async createProject(input: CreateProjectInput): Promise<{
    project: ProjectRecord;
    auditEvent: AuditEventRecord;
  }> {
    const projectId = `prj_${nanoid(12)}`;
    const now = new Date().toISOString();
    const project: ProjectRecord = {
      id: projectId,
      workspaceId: input.workspaceId,
      name: input.name,
      environment: input.environment,
      publicKey: `pk_${input.environment}_${nanoid(24)}`,
      allowedOrigins: input.allowedOrigins,
      createdAt: now,
      widgetConfig: {
        id: `wcfg_${nanoid(12)}`,
        workspaceId: input.workspaceId,
        projectId,
        buttonLabel: 'Sign',
        buttonColor: '#111827',
        position: 'bottom-right',
        mobilePosition: 'bottom',
      },
    };
    const auditEvent: AuditEventRecord = {
      id: `aud_${nanoid(12)}`,
      workspaceId: input.workspaceId,
      projectId,
      memberId: input.memberId,
      actorType: 'member',
      eventType: 'project.created',
      message: `Project ${input.name} created`,
      createdAt: now,
    };

    this.projects.push(project);
    this.auditEvents.push(auditEvent);

    return { project, auditEvent };
  }

  async listProjects(workspaceId: string): Promise<ProjectRecord[]> {
    return this.projects.filter((project) => project.workspaceId === workspaceId);
  }
}

export class PrismaProjectRepository implements ProjectRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createProject(input: CreateProjectInput): Promise<{
    project: ProjectRecord;
    auditEvent: AuditEventRecord;
  }> {
    const publicKey = `pk_${input.environment}_${nanoid(24)}`;

    const result = await this.prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          workspaceId: input.workspaceId,
          name: input.name,
          environment: input.environment,
          publicKey,
          allowedOrigins: input.allowedOrigins,
          widgetConfig: {
            create: {
              workspaceId: input.workspaceId,
            },
          },
        },
        include: {
          widgetConfig: true,
        },
      });

      const auditEvent = await tx.auditEvent.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: project.id,
          memberId: input.memberId,
          actorType: 'member',
          eventType: 'project.created',
          message: `Project ${input.name} created`,
        },
      });

      return { project, auditEvent };
    });

    return {
      project: mapProject(result.project),
      auditEvent: {
        id: result.auditEvent.id,
        workspaceId: result.auditEvent.workspaceId,
        projectId: result.auditEvent.projectId ?? result.project.id,
        memberId: result.auditEvent.memberId ?? input.memberId,
        actorType: 'member',
        eventType: 'project.created',
        message: result.auditEvent.message,
        createdAt: result.auditEvent.createdAt.toISOString(),
      },
    };
  }

  async listProjects(workspaceId: string): Promise<ProjectRecord[]> {
    const projects = await this.prisma.project.findMany({
      where: { workspaceId },
      include: { widgetConfig: true },
      orderBy: { createdAt: 'desc' },
    });

    return projects.map(mapProject);
  }
}

function mapProject(project: {
  id: string;
  workspaceId: string;
  name: string;
  environment: ProjectEnvironment;
  publicKey: string;
  allowedOrigins: string[];
  createdAt: Date;
  widgetConfig: {
    id: string;
    workspaceId: string;
    projectId: string;
    buttonLabel: string;
    buttonColor: string;
    position: string;
    mobilePosition: string;
  } | null;
}): ProjectRecord {
  if (!project.widgetConfig) {
    throw new Error(`Project ${project.id} is missing widget config`);
  }

  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    environment: project.environment,
    publicKey: project.publicKey,
    allowedOrigins: project.allowedOrigins,
    createdAt: project.createdAt.toISOString(),
    widgetConfig: {
      id: project.widgetConfig.id,
      workspaceId: project.widgetConfig.workspaceId,
      projectId: project.widgetConfig.projectId,
      buttonLabel: project.widgetConfig.buttonLabel,
      buttonColor: project.widgetConfig.buttonColor,
      position: project.widgetConfig.position,
      mobilePosition: project.widgetConfig.mobilePosition,
    },
  };
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/routes/projects.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { requireSession } from '../plugins/session.js';
import { requireTenant } from '../plugins/tenant.js';
import type { ProjectRepository } from '../repositories/projectRepository.js';

const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  environment: z.enum(['test', 'live']).default('test'),
  allowedOrigins: z.array(z.string().url()).min(1).max(20),
});

export type ProjectRoutesOptions = {
  projectRepository: ProjectRepository;
};

export const projectRoutes: FastifyPluginAsync<ProjectRoutesOptions> = async (
  app,
  { projectRepository },
) => {
  app.get('/v1/projects', async (request) => {
    const workspaceId = requireTenant(request);
    const projects = await projectRepository.listProjects(workspaceId);
    return { projects };
  });

  app.post('/v1/projects', async (request, reply) => {
    const session = requireSession(request);
    const workspaceId = requireTenant(request);
    const parsed = createProjectSchema.safeParse(request.body);

    if (!parsed.success) {
      const message = parsed.error.issues
        .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
        .join('; ');
      throw app.httpErrors.badRequest(message);
    }

    const result = await projectRepository.createProject({
      workspaceId,
      memberId: session.memberId,
      name: parsed.data.name,
      environment: parsed.data.environment,
      allowedOrigins: parsed.data.allowedOrigins,
    });

    return reply.code(201).send(result);
  });
};
```

Replace `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` with:

```ts
import { prisma } from '@dropsign/db';
import sensible from '@fastify/sensible';
import Fastify, { type FastifyInstance } from 'fastify';
import { sessionPlugin } from './plugins/session.js';
import { tenantPlugin } from './plugins/tenant.js';
import {
  PrismaProjectRepository,
  type ProjectRepository,
} from './repositories/projectRepository.js';
import { healthRoutes } from './routes/health.js';
import { projectRoutes } from './routes/projects.js';

export type BuildApiAppOptions = {
  logger?: boolean;
  projectRepository?: ProjectRepository;
};

export async function buildApiApp(options: BuildApiAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? false,
  });
  const projectRepository = options.projectRepository ?? new PrismaProjectRepository(prisma);

  await app.register(sensible);
  await app.register(sessionPlugin);
  await app.register(tenantPlugin);
  await app.register(healthRoutes);
  await app.register(projectRoutes, { projectRepository });

  return app;
}
```

Replace `/Users/minjun/Documents/dropsign-cloud/apps/api/src/test/buildTestApp.ts` with:

```ts
import { InMemoryProjectRepository } from '../repositories/projectRepository.js';
import { buildApiApp, type BuildApiAppOptions } from '../app.js';

export async function buildTestApp(options: BuildApiAppOptions = {}) {
  return buildApiApp({
    logger: false,
    projectRepository: new InMemoryProjectRepository(),
    ...options,
  });
}
```

- [x] **Step 4: Run tests and typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api test -- --runInBand
pnpm --filter @dropsign/api typecheck
```

Expected: PASS with `5 tests` and no TypeScript errors.

- [x] **Step 5: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api
git commit -m "feat: add tenant project endpoints"
```

Expected: commit succeeds with repository-backed project API routes.

### Task 8: Add Workspace Seed Migration For Local Manual Testing

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/schema.prisma`
- Generated by command: `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512000000_cloud_foundation/migration.sql`

- [x] **Step 1: Verify the schema targets PostgreSQL before migration**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/db prisma:validate
```

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [x] **Step 2: Create the first migration against a local PostgreSQL database**

Start PostgreSQL separately with this database URL:

```bash
export DATABASE_URL=postgresql://dropsign:dropsign@localhost:5432/dropsign_cloud
```

Run this exact command to create a deterministic migration file path:

```bash
cd /Users/minjun/Documents/dropsign-cloud
mkdir -p packages/db/prisma/migrations/20260512000000_cloud_foundation
pnpm --filter @dropsign/db prisma migrate diff --from-empty --to-schema-datamodel packages/db/prisma/schema.prisma --script > packages/db/prisma/migrations/20260512000000_cloud_foundation/migration.sql
```

Expected: PASS with `/Users/minjun/Documents/dropsign-cloud/packages/db/prisma/migrations/20260512000000_cloud_foundation/migration.sql` created and containing `CREATE TABLE`.

- [x] **Step 3: Commit**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat: add initial cloud database migration"
```

Expected: commit succeeds with the initial PostgreSQL migration.

### Task 9: Final Verification

**Files:**
- Modify only if verification exposes an implementation defect in a file created by this plan under `/Users/minjun/Documents/dropsign-cloud`.

- [x] **Step 1: Run all package tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm test
```

Expected: PASS with config, storage, and API tests. The output includes `9 tests` after Tasks 2, 4, 5, 6, and 7 are complete.

- [x] **Step 2: Run all typechecks**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm typecheck
```

Expected: PASS across `@dropsign/config`, `@dropsign/db`, `@dropsign/storage`, and `@dropsign/api`.

- [x] **Step 3: Run Prisma validation**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/db prisma:validate
```

Expected: PASS with `The schema at prisma/schema.prisma is valid`.

- [x] **Step 4: Build all packages**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm build
```

Expected: PASS and generated `dist` directories under `apps/api`, `packages/config`, `packages/db`, and `packages/storage`.

- [x] **Step 5: Run the API manually**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
cp .env.example .env
pnpm dev
```

Expected: Fastify starts on port `4000`.

In a second terminal, run:

```bash
curl -s http://localhost:4000/health
```

Expected:

```json
{"ok":true,"service":"dropsign-api"}
```

Stop `pnpm dev` with `Ctrl-C`.

- [x] **Step 6: Commit verification fixes if any were required**

Run only when Step 1, Step 2, Step 3, or Step 4 required code changes:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps packages package.json pnpm-lock.yaml tsconfig.base.json
git commit -m "fix: stabilize cloud foundation verification"
```

Expected: commit succeeds only when verification produced a tracked code or config fix.

### Commit Boundaries

- `chore: scaffold dropsign cloud workspace` after Task 1.
- `feat: add typed cloud configuration` after Task 2.
- `feat: add prisma cloud data model` after Task 3.
- `feat: add storage abstraction` after Task 4.
- `feat: add api health endpoint` after Task 5.
- `feat: add session and tenant middleware` after Task 6.
- `feat: add tenant project endpoints` after Task 7.
- `feat: add initial cloud database migration` after Task 8.
- `fix: stabilize cloud foundation verification` only when Task 9 requires a correction.

### Completion Criteria

- `/Users/minjun/Documents/dropsign-cloud` is a pnpm workspace with strict TypeScript package boundaries.
- `@dropsign/config` parses `NODE_ENV`, `PORT`, `DATABASE_URL`, and `SESSION_HEADER_SECRET` with field-specific errors.
- `@dropsign/db` contains a valid PostgreSQL Prisma schema for `Workspace`, `Member`, `Project`, `ProjectApiKey`, `WidgetConfig`, and `AuditEvent`.
- `@dropsign/storage` exports an `ObjectStorage` interface and a tested `InMemoryStorage` implementation.
- `@dropsign/api` exposes `GET /health`, `GET /v1/projects`, and `POST /v1/projects`.
- Project endpoints require DropSign session headers, enforce workspace tenant scoping, create a default widget config, and record a `project.created` audit event through the repository boundary.
- `pnpm test`, `pnpm typecheck`, `pnpm --filter @dropsign/db prisma:validate`, `pnpm build`, and `pnpm e2e` pass from `/Users/minjun/Documents/dropsign-cloud`.
