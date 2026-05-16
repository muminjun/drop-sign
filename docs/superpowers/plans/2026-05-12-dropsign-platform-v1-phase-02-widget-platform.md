# Widget Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build DropSign Cloud Phase 02: a CDN-installed website widget platform that loads public project config, enforces allowed origins and page targeting, boots the DropSign SDK, accepts runtime identity/context, uploads signature artifacts with WidgetSession tokens, and exposes tested browser and API contracts.

**Architecture:** The CDN bootstrap is a tiny no-cache `widget.js` served by the API/CDN layer; it discovers its script tag, fetches public config, verifies origin and targeting in the browser, then loads immutable versioned assets from `/widget-assets/{version}/`. The widget app is an isolated Vite package under `apps/widget` that owns `window.DropSign`, runtime callbacks, SDK boot, token/context storage, artifact upload, and retry state; the API owns public config and ingest contracts, server-side origin validation, WidgetSession verification, artifact persistence, audit events, and immutable asset cache headers.

**Tech Stack:** TypeScript, Fastify API app from `/Users/minjun/Documents/dropsign-cloud/apps/api`, Vite library build, Vitest, Playwright, PostgreSQL-backed Phase 01 persistence, object storage adapter from Phase 01, published SDK package `drop-sign`, Web Crypto/JWT or existing Phase 01 signing utilities, and Fastify `app.inject` route tests.

---

## Scope Boundaries

This phase only changes files under `/Users/minjun/Documents/dropsign-cloud`. Do not edit `/Users/minjun/Documents/drop-sign/tsup.config.ts`, the SDK source package, or existing plan files.

The worker implementing this plan must use the Phase 01 API app at `/Users/minjun/Documents/dropsign-cloud/apps/api`. Widget API code lives under `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget`, and route mounting happens in `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` with Fastify plugin registration.

## Files To Create Or Modify

- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/package.json` - widget package scripts and dependencies.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/index.html` - local browser test harness.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/vite.config.ts` - Vite library build that emits immutable widget assets.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tsconfig.json` - widget TypeScript config.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts` - public config, runtime context, callbacks, artifact payload types.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/pageTargeting.ts` - host/path/query matching.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/scriptDiscovery.ts` - current script/project key/API origin discovery.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/dropSignGlobal.ts` - `window.DropSign` API with callback queueing.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/apiClient.ts` - config fetch and artifact upload client.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/sdkBoot.ts` - `drop-sign` wrapper using `import { DropSign } from 'drop-sign'` and `DropSign.init(...)`.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/widget.ts` - boot orchestration, button/triggers, retry, callbacks.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/main.ts` - entry point for immutable Vite asset.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/bootstrap.ts` - no-cache CDN bootstrap source.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/pageTargeting.test.ts` - unit tests for targeting.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/dropSignGlobal.test.ts` - unit tests for runtime global API.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/apiClient.test.ts` - unit tests for HTTP payloads.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/widget.browser.spec.ts` - Playwright browser behavior.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/bootstrap-cache.spec.ts` - Playwright or HTTP tests for cache semantics.
- Modify: `/Users/minjun/Documents/dropsign-cloud/package.json` - add workspace scripts for widget build/test if the monorepo root owns scripts.
- Modify: `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml` - include `apps/widget` if the workspace file does not already include `apps/*`.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.ts` - shared Widget public config and ingest contracts.
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/index.ts` - export widget contracts.
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.test.ts` - contract shape tests.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.schema.ts` - runtime validation for config responses.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.repository.ts` - Phase 01 database access for project widget settings.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetSession.ts` - WidgetSession sign/verify helpers.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts` - public config, session, ingest, bootstrap routes.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.test.ts` - API contract and security tests.
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` - mount widget routes and static widget asset headers.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.audit.ts` - audit event helpers for config rejection and signature events.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetArtifact.repository.ts` - signature artifact persistence using Phase 01 storage and database helpers.
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.seed.test.ts` - test fixture helpers for projects, widget config, sessions, and artifacts.
- Modify: `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts` - add widget browser projects to the root Playwright config.

## Public Contracts

Install snippet:

```html
<script
  src="https://cdn.dropsign.example/widget.js"
  data-project-key="pk_live_example"
  async
></script>
```

No-cache bootstrap response:

```http
GET /widget.js
Cache-Control: no-store, max-age=0
Content-Type: application/javascript; charset=utf-8
```

Immutable asset response:

```http
GET /widget-assets/v1.0.0/drop-sign-widget.iife.js
Cache-Control: public, max-age=31536000, immutable
Content-Type: application/javascript; charset=utf-8
```

Config endpoint:

```http
GET /v1/widget/config?projectKey=pk_live_example&origin=https%3A%2F%2Facme.example&path=%2Fpricing&query=plan%3Dpro
```

Config success body:

```json
{
  "projectId": "proj_01HXWIDGET0000000000000000",
  "projectKey": "pk_live_example",
  "workspaceId": "ws_01HXWIDGET0000000000000000",
  "assetVersion": "v1.0.0",
  "assetUrl": "https://cdn.dropsign.example/widget-assets/v1.0.0/drop-sign-widget.iife.js",
  "apiBaseUrl": "https://api.dropsign.example",
  "allowedOrigins": ["https://acme.example"],
  "targeting": {
    "hosts": ["acme.example"],
    "paths": ["/pricing", "/checkout/*"],
    "query": [{ "key": "plan", "equals": "pro" }]
  },
  "button": {
    "enabled": true,
    "label": "Sign now",
    "position": "bottom-right",
    "color": "#2563eb",
    "mobilePosition": "bottom-center"
  },
  "triggers": [{ "selector": "[data-dropsign-trigger]", "mode": "click" }],
  "workflows": {
    "freeformSignature": true,
    "requestBoundSignature": true
  }
}
```

Config rejection body:

```json
{
  "error": {
    "code": "origin_not_allowed",
    "message": "This origin is not allowed for the project widget."
  }
}
```

Artifact upload:

```http
POST /v1/widget/artifacts
Content-Type: application/json
Idempotency-Key: widget_01HXWIDGET0000000000000000
```

```json
{
  "projectKey": "pk_live_example",
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example",
  "origin": "https://acme.example",
  "url": "https://acme.example/pricing?plan=pro",
  "identity": {
    "userId": "user_123",
    "email": "sam@example.com",
    "name": "Sam Example",
    "metadata": { "crmId": "lead_456" }
  },
  "metadata": { "source": "pricing_page" },
  "signature": {
    "mimeType": "image/png",
    "dataUrl": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB"
  },
  "placement": {
    "page": 1,
    "x": 0.25,
    "y": 0.7,
    "width": 0.35,
    "height": 0.12
  },
  "sdk": {
    "name": "drop-sign",
    "version": "0.1.0"
  }
}
```

Artifact success:

```json
{
  "artifactId": "sigart_01HXWIDGET0000000000000000",
  "requestId": "sr_01HXWIDGET0000000000000000",
  "documentId": "doc_01HXWIDGET0000000000000000",
  "status": "accepted"
}
```

Global browser API:

```ts
window.DropSign.identify({
  userId: 'user_123',
  email: 'sam@example.com',
  name: 'Sam Example',
  metadata: { crmId: 'lead_456' },
});

window.DropSign.setContext({
  sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
  metadata: { source: 'pricing_page' },
});

window.DropSign.onReady((state) => console.log(state.projectKey));
window.DropSign.onOpen(() => console.log('opened'));
window.DropSign.onComplete((result) => console.log(result.artifactId));
window.DropSign.onCancel(() => console.log('cancelled'));
window.DropSign.onError((error) => console.log(error.code));
window.DropSign.open();
```

## Task 1: Add Shared Widget Contracts

**Files:**
- Verify or create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/package.json`
- Verify or create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/index.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.test.ts`

- [ ] **Step 1: Verify the contracts package scaffold**

Phase 01 should already create `@dropsign/contracts` with `package.json`, `tsconfig.json`, and `src/index.ts`. If the package is missing because Phase 01 was executed before this review update, create those files now using the same placeholder shared-package shape from Phase 01 before writing widget contracts.

- [ ] **Step 2: Write failing contract tests**

Create `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  widgetArtifactUploadSchema,
  widgetConfigResponseSchema,
  widgetSessionClaimsSchema,
} from './widget.js';

describe('widget contracts', () => {
  it('accepts the public widget config response shape', () => {
    const parsed = widgetConfigResponseSchema.parse({
      projectId: 'proj_01HXWIDGET0000000000000000',
      projectKey: 'pk_live_example',
      workspaceId: 'ws_01HXWIDGET0000000000000000',
      assetVersion: 'v1.0.0',
      assetUrl: 'https://cdn.dropsign.example/widget-assets/v1.0.0/drop-sign-widget.iife.js',
      apiBaseUrl: 'https://api.dropsign.example',
      allowedOrigins: ['https://acme.example'],
      targeting: {
        hosts: ['acme.example'],
        paths: ['/pricing', '/checkout/*'],
        query: [{ key: 'plan', equals: 'pro' }],
      },
      button: {
        enabled: true,
        label: 'Sign now',
        position: 'bottom-right',
        color: '#2563eb',
        mobilePosition: 'bottom-center',
      },
      triggers: [{ selector: '[data-dropsign-trigger]', mode: 'click' }],
      workflows: {
        freeformSignature: true,
        requestBoundSignature: true,
      },
    });

    expect(parsed.projectKey).toBe('pk_live_example');
    expect(parsed.targeting.paths).toContain('/checkout/*');
  });

  it('rejects an artifact upload without projectKey or origin', () => {
    const result = widgetArtifactUploadSchema.safeParse({
      sessionToken: 'token',
      signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
      placement: { page: 1, x: 0.1, y: 0.1, width: 0.2, height: 0.1 },
      sdk: { name: 'drop-sign', version: '0.1.0' },
    });

    expect(result.success).toBe(false);
  });

  it('accepts request-bound WidgetSession claims', () => {
    const claims = widgetSessionClaimsSchema.parse({
      iss: 'dropsign-cloud',
      aud: 'dropsign-widget',
      sub: 'widget-session',
      jti: 'wgs_01HXWIDGET0000000000000000',
      workspaceId: 'ws_01HXWIDGET0000000000000000',
      projectId: 'proj_01HXWIDGET0000000000000000',
      projectKey: 'pk_live_example',
      origin: 'https://acme.example',
      requestId: 'sr_01HXWIDGET0000000000000000',
      signerId: 'signer_01HXWIDGET0000000000000000',
      documentId: 'doc_01HXWIDGET0000000000000000',
      metadata: { source: 'pricing_page' },
      iat: 1778563200,
      exp: 1778566800,
    });

    expect(claims.aud).toBe('dropsign-widget');
  });
});
```

- [ ] **Step 2: Run contract tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/contracts/src/widget.test.ts
```

Expected: FAIL with an import error for `./widget` or missing exported schemas.

- [ ] **Step 3: Implement shared contracts**

Create `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/widget.ts`:

```ts
import { z } from 'zod';

export const widgetOriginSchema = z.string().url().refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' || url.hostname === 'localhost';
}, 'origin must be https or localhost');

export const widgetTargetingSchema = z.object({
  hosts: z.array(z.string().min(1)).default([]),
  paths: z.array(z.string().min(1)).default([]),
  query: z.array(z.object({
    key: z.string().min(1),
    equals: z.string().min(1),
  })).default([]),
});

export const widgetConfigResponseSchema = z.object({
  projectId: z.string().min(1),
  projectKey: z.string().min(1),
  workspaceId: z.string().min(1),
  assetVersion: z.string().regex(/^v\d+\.\d+\.\d+$/),
  assetUrl: z.string().url(),
  apiBaseUrl: z.string().url(),
  allowedOrigins: z.array(widgetOriginSchema).min(1),
  targeting: widgetTargetingSchema,
  button: z.object({
    enabled: z.boolean(),
    label: z.string().min(1).max(40),
    position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    mobilePosition: z.enum(['bottom-center', 'bottom-right', 'bottom-left']),
  }),
  triggers: z.array(z.object({
    selector: z.string().min(1),
    mode: z.literal('click'),
  })).default([]),
  workflows: z.object({
    freeformSignature: z.boolean(),
    requestBoundSignature: z.boolean(),
  }),
});

export const widgetIdentitySchema = z.object({
  userId: z.string().min(1).max(200).optional(),
  email: z.string().email().optional(),
  name: z.string().min(1).max(200).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).default({ metadata: {} });

export const widgetRuntimeContextSchema = z.object({
  sessionToken: z.string().min(20).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
}).default({ metadata: {} });

export const normalizedPlacementSchema = z.object({
  page: z.number().int().min(1),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
});

export const widgetArtifactUploadSchema = z.object({
  projectKey: z.string().min(1),
  sessionToken: z.string().min(20).optional(),
  origin: widgetOriginSchema,
  url: z.string().url(),
  identity: widgetIdentitySchema,
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  signature: z.object({
    mimeType: z.literal('image/png'),
    dataUrl: z.string().regex(/^data:image\/png;base64,/),
  }),
  placement: normalizedPlacementSchema,
  sdk: z.object({
    name: z.literal('drop-sign'),
    version: z.string().min(1),
  }),
});

export const widgetArtifactResponseSchema = z.object({
  artifactId: z.string().min(1),
  requestId: z.string().min(1).nullable(),
  documentId: z.string().min(1).nullable(),
  status: z.literal('accepted'),
});

export const widgetSessionClaimsSchema = z.object({
  iss: z.literal('dropsign-cloud'),
  aud: z.literal('dropsign-widget'),
  sub: z.literal('widget-session'),
  jti: z.string().min(1),
  workspaceId: z.string().min(1),
  projectId: z.string().min(1),
  projectKey: z.string().min(1),
  origin: widgetOriginSchema,
  requestId: z.string().min(1).optional(),
  signerId: z.string().min(1).optional(),
  documentId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).default({}),
  iat: z.number().int().positive(),
  exp: z.number().int().positive(),
});

export type WidgetConfigResponse = z.infer<typeof widgetConfigResponseSchema>;
export type WidgetArtifactUpload = z.infer<typeof widgetArtifactUploadSchema>;
export type WidgetArtifactResponse = z.infer<typeof widgetArtifactResponseSchema>;
export type WidgetSessionClaims = z.infer<typeof widgetSessionClaimsSchema>;
export type WidgetIdentity = z.infer<typeof widgetIdentitySchema>;
export type WidgetRuntimeContext = z.infer<typeof widgetRuntimeContextSchema>;
```

Modify `/Users/minjun/Documents/dropsign-cloud/packages/contracts/src/index.ts`:

```ts
export * from './widget.js';
```

If `index.ts` already exports Phase 01 modules, append `export * from './widget.js';` without deleting existing exports.

- [ ] **Step 4: Run contract tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/contracts/src/widget.test.ts
```

Expected: PASS for all 3 widget contract tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/contracts/src/widget.ts packages/contracts/src/index.ts packages/contracts/src/widget.test.ts
git commit -m "feat: add widget platform contracts"
```

## Task 2: Add API Widget Config Endpoint And Cache Headers

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.schema.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.repository.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`

- [ ] **Step 1: Write failing API tests for config and cache semantics**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { createApiAppForTest } from '../test/createApiAppForTest';
import { seedProjectWithWidgetConfig } from './widget.seed.test';

describe('widget public routes', () => {
  it('returns public config for an allowed origin and targeted page', async () => {
    const { app, db } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_allowed',
      allowedOrigins: ['https://acme.example'],
      targeting: {
        hosts: ['acme.example'],
        paths: ['/pricing', '/checkout/*'],
        query: [{ key: 'plan', equals: 'pro' }],
      },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/widget/config',
      query: {
        projectKey: 'pk_live_allowed',
        origin: 'https://acme.example',
        path: '/pricing',
        query: 'plan=pro',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.projectKey).toBe('pk_live_allowed');
    expect(body.assetVersion).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(body.assetUrl).toContain('/widget-assets/');
    expect(body.allowedOrigins).toEqual(['https://acme.example']);
    expect(response.headers['cache-control']).toBe('private, max-age=60');
  });

  it('rejects a config request from an unapproved origin', async () => {
    const { app, db } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_blocked',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });

    const response = await app.inject({
      method: 'GET',
      url: '/v1/widget/config',
      query: {
        projectKey: 'pk_live_blocked',
        origin: 'https://evil.example',
        path: '/',
        query: '',
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'origin_not_allowed',
        message: 'This origin is not allowed for the project widget.',
      },
    });
  });

  it('serves widget.js with no-store cache headers', async () => {
    const { app } = await createApiAppForTest();

    const response = await app.inject({ method: 'GET', url: '/widget.js' });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store, max-age=0');
    expect(response.headers['content-type']).toContain('application/javascript');
    expect(response.body).toContain('DropSign CDN bootstrap');
  });

  it('serves versioned widget assets with immutable cache headers', async () => {
    const { app } = await createApiAppForTest();

    const response = await app.inject({
      method: 'GET',
      url: '/widget-assets/v1.0.0/drop-sign-widget.iife.js',
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
    expect(response.headers['content-type']).toContain('application/javascript');
  });
});
```

- [ ] **Step 2: Run API tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/src/widget/widget.routes.test.ts
```

Expected: FAIL because `widget.routes.ts`, seed helpers, and mounted routes do not exist.

- [ ] **Step 3: Implement config schema, repository, and routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.schema.ts`:

```ts
import { widgetConfigResponseSchema } from '@dropsign/contracts';

export const publicWidgetConfigSchema = widgetConfigResponseSchema;

export function isOriginAllowed(origin: string, allowedOrigins: string[]): boolean {
  return allowedOrigins.includes(origin);
}

export function isTargetedPage(input: {
  origin: string;
  path: string;
  query: string;
  targeting: {
    hosts: string[];
    paths: string[];
    query: Array<{ key: string; equals: string }>;
  };
}): boolean {
  const host = new URL(input.origin).host;
  const params = new URLSearchParams(input.query);

  const hostMatches = input.targeting.hosts.length === 0 || input.targeting.hosts.includes(host);
  const pathMatches = input.targeting.paths.length === 0 || input.targeting.paths.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return input.path.startsWith(pattern.slice(0, -1));
    }
    return input.path === pattern;
  });
  const queryMatches = input.targeting.query.every((rule) => params.get(rule.key) === rule.equals);

  return hostMatches && pathMatches && queryMatches;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetConfig.repository.ts`:

```ts
import type { WidgetConfigResponse } from '@dropsign/contracts';

export type WidgetConfigRepository = {
  findPublicConfigByProjectKey(projectKey: string): Promise<WidgetConfigResponse | null>;
};

export function createWidgetConfigRepository(db: {
  project: {
    findUnique(args: unknown): Promise<{
      id: string;
      key: string;
      workspaceId: string;
      widgetConfig: {
        allowedOrigins: string[];
        targeting: WidgetConfigResponse['targeting'];
        button: WidgetConfigResponse['button'];
        triggers: WidgetConfigResponse['triggers'];
        workflows: WidgetConfigResponse['workflows'];
      } | null;
    } | null>;
  };
}, env: { CDN_BASE_URL: string; API_BASE_URL: string; WIDGET_ASSET_VERSION: string }): WidgetConfigRepository {
  return {
    async findPublicConfigByProjectKey(projectKey) {
      const project = await db.project.findUnique({
        where: { key: projectKey },
        include: { widgetConfig: true },
      });

      if (!project || !project.widgetConfig) {
        return null;
      }

      const assetVersion = env.WIDGET_ASSET_VERSION;
      return {
        projectId: project.id,
        projectKey: project.key,
        workspaceId: project.workspaceId,
        assetVersion,
        assetUrl: `${env.CDN_BASE_URL}/widget-assets/${assetVersion}/drop-sign-widget.iife.js`,
        apiBaseUrl: env.API_BASE_URL,
        allowedOrigins: project.widgetConfig.allowedOrigins,
        targeting: project.widgetConfig.targeting,
        button: project.widgetConfig.button,
        triggers: project.widgetConfig.triggers,
        workflows: project.widgetConfig.workflows,
      };
    },
  };
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts`:

```ts
import type { FastifyPluginAsync } from 'fastify';
import { isOriginAllowed, isTargetedPage } from './widgetConfig.schema';
import { publicWidgetConfigSchema } from './widgetConfig.schema';
import { createWidgetConfigRepository } from './widgetConfig.repository';

export type WidgetPluginDeps = {
  db: Parameters<typeof createWidgetConfigRepository>[0];
  env: { CDN_BASE_URL: string; API_BASE_URL: string; WIDGET_ASSET_VERSION: string };
  audit?: { record(event: { type: string; projectKey?: string; origin?: string }): Promise<void> };
};

export function createWidgetPlugin(deps: WidgetPluginDeps): FastifyPluginAsync {
  const configs = createWidgetConfigRepository(deps.db, deps.env);

  return async function widgetPlugin(app) {
    app.get('/widget.js', async (_request, reply) => {
      reply.header('Cache-Control', 'no-store, max-age=0');
      return reply.type('application/javascript').send(`/* DropSign CDN bootstrap */
(function(){var s=document.currentScript;var key=s&&s.getAttribute('data-project-key');if(!key){return;}var next=document.createElement('script');next.async=true;next.src='${deps.env.CDN_BASE_URL}/widget-assets/${deps.env.WIDGET_ASSET_VERSION}/drop-sign-widget.iife.js';next.setAttribute('data-project-key',key);next.setAttribute('data-api-base-url','${deps.env.API_BASE_URL}');document.head.appendChild(next);})();`);
    });

    app.get<{ Params: { version: string } }>('/widget-assets/:version/drop-sign-widget.iife.js', async (request, reply) => {
      if (request.params.version !== deps.env.WIDGET_ASSET_VERSION) {
        return reply.status(404).send({
          error: { code: 'asset_not_found', message: 'Widget asset version was not found.' },
        });
      }
      reply.header('Cache-Control', 'public, max-age=31536000, immutable');
      return reply.type('application/javascript').send('/* DropSign immutable widget asset test shim */ window.__DROPSIGN_WIDGET_ASSET_LOADED__=true;');
    });

    app.get<{ Querystring: { projectKey?: string; origin?: string; path?: string; query?: string } }>('/v1/widget/config', async (request, reply) => {
      const projectKey = String(request.query.projectKey ?? '');
      const origin = String(request.query.origin ?? '');
      const path = String(request.query.path ?? '/');
      const query = String(request.query.query ?? '');
      const config = await configs.findPublicConfigByProjectKey(projectKey);

      if (!config) {
        return reply.status(404).send({
          error: { code: 'project_not_found', message: 'Project widget config was not found.' },
        });
      }

      if (!isOriginAllowed(origin, config.allowedOrigins)) {
        await deps.audit?.record({ type: 'widget.config_rejected', projectKey, origin });
        return reply.status(403).send({
          error: {
            code: 'origin_not_allowed',
            message: 'This origin is not allowed for the project widget.',
          },
        });
      }

      if (!isTargetedPage({ origin, path, query, targeting: config.targeting })) {
        return reply.status(204).header('Cache-Control', 'private, max-age=60').send();
      }

      return reply.header('Cache-Control', 'private, max-age=60').send(publicWidgetConfigSchema.parse(config));
    });
  };
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts` by registering the widget plugin inside the existing Fastify app factory:

```ts
import { createWidgetPlugin } from './widget/widget.routes.js';

// Keep all existing Phase 01 route/plugin registrations above this line.
await app.register(createWidgetPlugin({
  db,
  env: {
    CDN_BASE_URL: env.CDN_BASE_URL,
    API_BASE_URL: env.API_BASE_URL,
    WIDGET_ASSET_VERSION: env.WIDGET_ASSET_VERSION ?? 'v1.0.0',
  },
  audit,
}));
```

- [ ] **Step 4: Add test seed helper**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.seed.test.ts`:

```ts
import type { WidgetConfigResponse } from '@dropsign/contracts';

export async function seedProjectWithWidgetConfig(db: {
  project: { create(args: unknown): Promise<unknown> };
}, input: {
  projectKey: string;
  allowedOrigins: string[];
  targeting: WidgetConfigResponse['targeting'];
}) {
  return db.project.create({
    data: {
      id: `proj_${input.projectKey}`,
      key: input.projectKey,
      workspaceId: `ws_${input.projectKey}`,
      widgetConfig: {
        create: {
          allowedOrigins: input.allowedOrigins,
          targeting: input.targeting,
          button: {
            enabled: true,
            label: 'Sign now',
            position: 'bottom-right',
            color: '#2563eb',
            mobilePosition: 'bottom-center',
          },
          triggers: [{ selector: '[data-dropsign-trigger]', mode: 'click' }],
          workflows: {
            freeformSignature: true,
            requestBoundSignature: true,
          },
        },
      },
    },
  });
}
```

- [ ] **Step 5: Run API tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/src/widget/widget.routes.test.ts
```

Expected: PASS for config, origin rejection, no-cache bootstrap, and immutable asset header tests.

- [ ] **Step 6: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/widget apps/api/src/app.ts
git commit -m "feat: expose widget config and CDN bootstrap routes"
```

## Task 3: Add WidgetSession Token Verification And Artifact Ingest

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetSession.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetArtifact.repository.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.test.ts`

- [ ] **Step 1: Add failing ingest security tests**

Append to `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.test.ts`:

```ts
import { signWidgetSession } from './widgetSession';

describe('widget artifact ingest', () => {
  it('rejects request-bound upload without WidgetSession token', async () => {
    const { app, db } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_ingest',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/widget/artifacts',
      headers: { 'Idempotency-Key': 'widget_missing_session' },
      payload: {
        projectKey: 'pk_live_ingest',
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { email: 'sam@example.com', metadata: {} },
        metadata: { source: 'test' },
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'widget_session_required',
        message: 'A WidgetSession token is required for request-bound widget signing.',
      },
    });
  });

  it('accepts upload with matching project, origin, and unexpired WidgetSession', async () => {
    const { app, db, env } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_session',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });
    const sessionToken = await signWidgetSession({
      secret: env.WIDGET_SESSION_SECRET,
      claims: {
        iss: 'dropsign-cloud',
        aud: 'dropsign-widget',
        sub: 'widget-session',
        jti: 'wgs_accept',
        workspaceId: 'ws_pk_live_session',
        projectId: 'proj_pk_live_session',
        projectKey: 'pk_live_session',
        origin: 'https://acme.example',
        requestId: 'sr_accept',
        signerId: 'signer_accept',
        documentId: 'doc_accept',
        metadata: { server: 'trusted' },
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/widget/artifacts',
      headers: { 'Idempotency-Key': 'widget_accept_session' },
      payload: {
        projectKey: 'pk_live_session',
        sessionToken,
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { userId: 'browser_user', email: 'sam@example.com', metadata: { crmId: 'lead_456' } },
        metadata: { source: 'pricing_page' },
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(response.statusCode).toBe(202);
    const body = response.json();
    expect(body.status).toBe('accepted');
    expect(body.artifactId).toMatch(/^sigart_/);
    expect(body.requestId).toBe('sr_accept');
    expect(body.documentId).toBe('doc_accept');
  });

  it('rejects upload when WidgetSession is expired', async () => {
    const { app, db, env } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_expired',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });
    const sessionToken = await signWidgetSession({
      secret: env.WIDGET_SESSION_SECRET,
      claims: {
        iss: 'dropsign-cloud',
        aud: 'dropsign-widget',
        sub: 'widget-session',
        jti: 'wgs_expired',
        workspaceId: 'ws_pk_live_expired',
        projectId: 'proj_pk_live_expired',
        projectKey: 'pk_live_expired',
        origin: 'https://acme.example',
        metadata: {},
        iat: Math.floor(Date.now() / 1000) - 7200,
        exp: Math.floor(Date.now() / 1000) - 3600,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/widget/artifacts',
      headers: { 'Idempotency-Key': 'widget_expired_session' },
      payload: {
        projectKey: 'pk_live_expired',
        sessionToken,
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { metadata: {} },
        metadata: {},
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({
      error: {
        code: 'widget_session_invalid',
        message: 'WidgetSession token is invalid or expired.',
      },
    });
  });

  it('rejects upload when WidgetSession projectKey does not match upload projectKey', async () => {
    const { app, db, env } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_upload_project',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });
    const sessionToken = await signWidgetSession({
      secret: env.WIDGET_SESSION_SECRET,
      claims: {
        iss: 'dropsign-cloud',
        aud: 'dropsign-widget',
        sub: 'widget-session',
        jti: 'wgs_project_mismatch',
        workspaceId: 'ws_pk_live_session_project',
        projectId: 'proj_pk_live_session_project',
        projectKey: 'pk_live_session_project',
        origin: 'https://acme.example',
        metadata: {},
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/widget/artifacts',
      headers: { 'Idempotency-Key': 'widget_project_mismatch' },
      payload: {
        projectKey: 'pk_live_upload_project',
        sessionToken,
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { metadata: {} },
        metadata: {},
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'widget_session_project_mismatch',
        message: 'WidgetSession project does not match upload project.',
      },
    });
  });

  it('rejects upload when WidgetSession origin does not match browser origin', async () => {
    const { app, db, env } = await createApiAppForTest();
    await seedProjectWithWidgetConfig(db, {
      projectKey: 'pk_live_mismatch',
      allowedOrigins: ['https://acme.example'],
      targeting: { hosts: [], paths: [], query: [] },
    });
    const sessionToken = await signWidgetSession({
      secret: env.WIDGET_SESSION_SECRET,
      claims: {
        iss: 'dropsign-cloud',
        aud: 'dropsign-widget',
        sub: 'widget-session',
        jti: 'wgs_mismatch',
        workspaceId: 'ws_pk_live_mismatch',
        projectId: 'proj_pk_live_mismatch',
        projectKey: 'pk_live_mismatch',
        origin: 'https://other.example',
        metadata: {},
        iat: Math.floor(Date.now() / 1000) - 60,
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/widget/artifacts',
      headers: { 'Idempotency-Key': 'widget_origin_mismatch' },
      payload: {
        projectKey: 'pk_live_mismatch',
        sessionToken,
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { metadata: {} },
        metadata: {},
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({
      error: {
        code: 'widget_session_origin_mismatch',
        message: 'WidgetSession origin does not match upload origin.',
      },
    });
  });
});
```

- [ ] **Step 2: Run ingest tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/src/widget/widget.routes.test.ts -t "widget artifact ingest"
```

Expected: FAIL because `signWidgetSession`, `POST /v1/widget/artifacts`, and artifact persistence are missing.

- [ ] **Step 3: Implement WidgetSession signing and verification**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetSession.ts`:

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';
import { widgetSessionClaimsSchema, type WidgetSessionClaims } from '@dropsign/contracts';

function base64UrlEncode(input: Buffer | string): string {
  return Buffer.from(input).toString('base64url');
}

function base64UrlJson(value: unknown): string {
  return base64UrlEncode(JSON.stringify(value));
}

function signParts(header: string, payload: string, secret: string): string {
  return createHmac('sha256', secret).update(`${header}.${payload}`).digest('base64url');
}

export async function signWidgetSession(input: {
  secret: string;
  claims: WidgetSessionClaims;
}): Promise<string> {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson(widgetSessionClaimsSchema.parse(input.claims));
  const signature = signParts(header, payload, input.secret);
  return `${header}.${payload}.${signature}`;
}

export async function verifyWidgetSession(input: {
  secret: string;
  token: string;
  nowSeconds?: number;
}): Promise<WidgetSessionClaims> {
  const [header, payload, signature] = input.token.split('.');
  if (!header || !payload || !signature) {
    throw new Error('widget_session_malformed');
  }

  const expected = signParts(header, payload, input.secret);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) {
    throw new Error('widget_session_invalid_signature');
  }

  const claims = widgetSessionClaimsSchema.parse(JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')));
  const now = input.nowSeconds ?? Math.floor(Date.now() / 1000);
  if (claims.exp <= now) {
    throw new Error('widget_session_expired');
  }
  return claims;
}
```

- [ ] **Step 4: Implement artifact repository and route**

Create `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widgetArtifact.repository.ts`:

```ts
import { randomUUID } from 'node:crypto';
import type { WidgetArtifactResponse, WidgetArtifactUpload, WidgetSessionClaims } from '@dropsign/contracts';

export type WidgetArtifactRepository = {
  createAcceptedArtifact(input: {
    upload: WidgetArtifactUpload;
    session: WidgetSessionClaims;
    idempotencyKey: string;
  }): Promise<WidgetArtifactResponse>;
};

export function createWidgetArtifactRepository(db: {
  signatureArtifact: {
    upsert(args: unknown): Promise<{ id: string; requestId: string | null; documentId: string | null }>;
  };
}): WidgetArtifactRepository {
  return {
    async createAcceptedArtifact({ upload, session, idempotencyKey }) {
      const artifact = await db.signatureArtifact.upsert({
        where: { idempotencyKey },
        create: {
          id: `sigart_${randomUUID().replaceAll('-', '')}`,
          idempotencyKey,
          workspaceId: session.workspaceId,
          projectId: session.projectId,
          requestId: session.requestId ?? null,
          signerId: session.signerId ?? null,
          documentId: session.documentId ?? null,
          origin: upload.origin,
          pageUrl: upload.url,
          identityHints: upload.identity,
          metadata: { ...session.metadata, ...upload.metadata },
          signatureMimeType: upload.signature.mimeType,
          signatureDataUrl: upload.signature.dataUrl,
          placement: upload.placement,
          sdk: upload.sdk,
          status: 'accepted',
        },
        update: {},
      });

      return {
        artifactId: artifact.id,
        requestId: artifact.requestId,
        documentId: artifact.documentId,
        status: 'accepted',
      };
    },
  };
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts` by adding imports and the POST route:

```ts
import { widgetArtifactUploadSchema } from '@dropsign/contracts';
import { createWidgetArtifactRepository } from './widgetArtifact.repository';
import { verifyWidgetSession } from './widgetSession';
```

Inside `createWidgetPlugin`, add artifact persistence next to the existing config repository and register the Fastify POST route inside the returned plugin function:

```ts
const artifacts = createWidgetArtifactRepository(deps.db);

app.post('/v1/widget/artifacts', async (request, reply) => {
  const idempotencyKey = request.headers['idempotency-key'];
  if (!idempotencyKey) {
    return reply.status(400).send({
      error: { code: 'idempotency_key_required', message: 'Idempotency-Key header is required.' },
    });
  }

  const upload = widgetArtifactUploadSchema.parse(request.body);
  const config = await configs.findPublicConfigByProjectKey(upload.projectKey);
  if (!config) {
    return reply.status(404).send({
      error: { code: 'project_not_found', message: 'Project widget config was not found.' },
    });
  }

  if (!upload.sessionToken) {
    await deps.audit?.record({ type: 'widget.artifact_rejected', projectKey: upload.projectKey, origin: upload.origin });
    return reply.status(401).send({
      error: { code: 'widget_session_required', message: 'A WidgetSession token is required for request-bound widget signing.' },
    });
  }

  let session;
  try {
    session = await verifyWidgetSession({ secret: deps.env.WIDGET_SESSION_SECRET, token: upload.sessionToken });
  } catch {
    return reply.status(401).send({
      error: { code: 'widget_session_invalid', message: 'WidgetSession token is invalid or expired.' },
    });
  }

  if (session.projectKey !== upload.projectKey) {
    return reply.status(403).send({
      error: { code: 'widget_session_project_mismatch', message: 'WidgetSession project does not match upload project.' },
    });
  }
  if (session.origin !== upload.origin) {
    return reply.status(403).send({
      error: { code: 'widget_session_origin_mismatch', message: 'WidgetSession origin does not match upload origin.' },
    });
  }

  const result = await artifacts.createAcceptedArtifact({ upload, session, idempotencyKey: String(idempotencyKey) });
  await deps.audit?.record({ type: 'signature.completed', projectKey: upload.projectKey, origin: upload.origin });
  return reply.status(202).send(result);
});
```

Update the router dependency type to include `WIDGET_SESSION_SECRET: string`.

- [ ] **Step 5: Run ingest tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run apps/api/src/widget/widget.routes.test.ts -t "widget artifact ingest"
```

Expected: PASS for missing token rejection, accepted matching token, expired token rejection, project key mismatch rejection, and origin mismatch rejection.

- [ ] **Step 6: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/widget apps/api/src/app.ts
git commit -m "feat: validate widget sessions for artifact ingest"
```

## Task 4: Scaffold Widget Vite App And Build Output

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/package.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/index.html`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/vite.config.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tsconfig.json`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/main.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/bootstrap.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/package.json`
- Modify: `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml`

- [ ] **Step 1: Add failing build expectation**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/main.ts`:

```ts
export function bootDropSignWidget(): void {
  window.__DROPSIGN_WIDGET_BOOTED__ = true;
}

bootDropSignWidget();
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/bootstrap.ts`:

```ts
export {};

(() => {
  console.info('DropSign CDN bootstrap');
})();
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts`:

```ts
import type {
  WidgetArtifactResponse,
  WidgetArtifactUpload,
  WidgetConfigResponse,
  WidgetIdentity,
  WidgetRuntimeContext,
} from '@dropsign/contracts';

export type WidgetConfig = WidgetConfigResponse;
export type WidgetUpload = WidgetArtifactUpload;
export type WidgetUploadResult = WidgetArtifactResponse;
export type DropSignIdentity = WidgetIdentity;
export type DropSignContext = WidgetRuntimeContext;

declare global {
  interface Window {
    __DROPSIGN_WIDGET_BOOTED__?: boolean;
  }
}
```

- [ ] **Step 2: Run build command and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget build
```

Expected: FAIL because `apps/widget/package.json` and Vite config do not exist.

- [ ] **Step 3: Add widget package and Vite config**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/package.json`:

```json
{
  "name": "@dropsign/widget",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0 --port 5174",
    "build": "vite build",
    "test": "vitest run",
    "test:browser": "playwright test apps/widget/tests"
  },
  "dependencies": {
    "@dropsign/contracts": "workspace:*",
    "drop-sign": "^0.1.0"
  },
  "devDependencies": {
    "@vitejs/plugin-legacy": "^5.4.3",
    "vite": "^5.4.19",
    "vitest": "^2.1.9"
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/vite.config.ts`:

```ts
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: '../../dist/widget-assets/v1.0.0',
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: 'src/main.ts',
      name: 'DropSignWidget',
      formats: ['iife'],
      fileName: () => 'drop-sign-widget.iife.js',
    },
  },
  test: {
    environment: 'happy-dom',
    include: [
      'src/__tests__/pageTargeting.test.ts',
      'src/__tests__/dropSignGlobal.test.ts',
      'src/__tests__/apiClient.test.ts',
    ],
  },
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "types": ["vitest/globals"]
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DropSign Widget Harness</title>
  </head>
  <body>
    <button data-dropsign-trigger>Open DropSign</button>
    <script type="module" src="/src/main.ts" data-project-key="pk_live_local"></script>
  </body>
</html>
```

Replace `/Users/minjun/Documents/dropsign-cloud/pnpm-workspace.yaml` with:

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Modify root `/Users/minjun/Documents/dropsign-cloud/package.json` scripts:

```json
{
  "scripts": {
    "widget:build": "pnpm --filter @dropsign/widget build",
    "widget:test": "pnpm --filter @dropsign/widget test",
    "widget:test:browser": "pnpm --filter @dropsign/widget test:browser"
  }
}
```

Preserve all existing scripts and add only the three widget scripts.

- [ ] **Step 4: Run widget build and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm install
pnpm --filter @dropsign/widget build
test -f dist/widget-assets/v1.0.0/drop-sign-widget.iife.js
```

Expected: `pnpm --filter @dropsign/widget build` exits 0 and `test -f` exits 0.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget package.json pnpm-workspace.yaml
git commit -m "feat: add widget Vite application"
```

## Task 5: Implement Browser Page Targeting And Script Discovery

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/pageTargeting.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/scriptDiscovery.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/pageTargeting.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts`

- [ ] **Step 1: Write failing widget unit tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/pageTargeting.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { discoverWidgetScript } from '../scriptDiscovery';
import { matchesPageTargeting } from '../pageTargeting';

describe('matchesPageTargeting', () => {
  it('allows empty targeting rules', () => {
    expect(matchesPageTargeting({
      location: new URL('https://acme.example/anything?plan=free'),
      targeting: { hosts: [], paths: [], query: [] },
    })).toBe(true);
  });

  it('matches host, exact path, wildcard path, and query rules', () => {
    expect(matchesPageTargeting({
      location: new URL('https://acme.example/checkout/step-1?plan=pro'),
      targeting: {
        hosts: ['acme.example'],
        paths: ['/pricing', '/checkout/*'],
        query: [{ key: 'plan', equals: 'pro' }],
      },
    })).toBe(true);
  });

  it('rejects when query rule does not match', () => {
    expect(matchesPageTargeting({
      location: new URL('https://acme.example/pricing?plan=free'),
      targeting: {
        hosts: ['acme.example'],
        paths: ['/pricing'],
        query: [{ key: 'plan', equals: 'pro' }],
      },
    })).toBe(false);
  });
});

describe('discoverWidgetScript', () => {
  it('reads project key and API base URL from the current script', () => {
    const script = document.createElement('script');
    script.setAttribute('src', 'https://cdn.dropsign.example/widget-assets/v1.0.0/drop-sign-widget.iife.js');
    script.setAttribute('data-project-key', 'pk_live_script');
    script.setAttribute('data-api-base-url', 'https://api.dropsign.example');
    document.body.appendChild(script);

    const discovered = discoverWidgetScript(script);

    expect(discovered).toEqual({
      projectKey: 'pk_live_script',
      apiBaseUrl: 'https://api.dropsign.example',
    });
  });
});
```

- [ ] **Step 2: Run widget tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/pageTargeting.test.ts
```

Expected: FAIL because `pageTargeting.ts` and `scriptDiscovery.ts` do not exist.

- [ ] **Step 3: Implement targeting and script discovery**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/pageTargeting.ts`:

```ts
import type { WidgetConfig } from './types';

export function matchesPageTargeting(input: {
  location: URL;
  targeting: WidgetConfig['targeting'];
}): boolean {
  const { location, targeting } = input;
  const hostMatches = targeting.hosts.length === 0 || targeting.hosts.includes(location.host);
  const pathMatches = targeting.paths.length === 0 || targeting.paths.some((pattern) => {
    if (pattern.endsWith('/*')) {
      return location.pathname.startsWith(pattern.slice(0, -1));
    }
    return location.pathname === pattern;
  });
  const queryMatches = targeting.query.every((rule) => location.searchParams.get(rule.key) === rule.equals);

  return hostMatches && pathMatches && queryMatches;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/scriptDiscovery.ts`:

```ts
export type DiscoveredWidgetScript = {
  projectKey: string;
  apiBaseUrl: string;
};

export function discoverWidgetScript(script: HTMLScriptElement | null = document.currentScript as HTMLScriptElement | null): DiscoveredWidgetScript {
  const projectKey = script?.getAttribute('data-project-key') ?? '';
  const apiBaseUrl = script?.getAttribute('data-api-base-url') ?? new URL(script?.src ?? window.location.href).origin;

  if (!projectKey) {
    throw new Error('dropsign_project_key_missing');
  }

  return { projectKey, apiBaseUrl };
}
```

- [ ] **Step 4: Run widget tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/pageTargeting.test.ts
```

Expected: PASS for all targeting and script discovery tests.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget/src/pageTargeting.ts apps/widget/src/scriptDiscovery.ts apps/widget/src/__tests__/pageTargeting.test.ts apps/widget/src/types.ts
git commit -m "feat: add widget page targeting"
```

## Task 6: Implement `window.DropSign` Runtime API

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/dropSignGlobal.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/dropSignGlobal.test.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts`

- [ ] **Step 1: Write failing global API tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/dropSignGlobal.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { createDropSignGlobal } from '../dropSignGlobal';

describe('createDropSignGlobal', () => {
  it('stores identity and context hints without treating them as trusted authorization', () => {
    const api = createDropSignGlobal();

    api.identify({
      userId: 'user_123',
      email: 'sam@example.com',
      name: 'Sam Example',
      metadata: { crmId: 'lead_456' },
    });
    api.setContext({
      sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
      metadata: { source: 'pricing_page' },
    });

    expect(api.getState().identity.email).toBe('sam@example.com');
    expect(api.getState().context.sessionToken).toContain('eyJ');
    expect(api.getState().context.metadata).toEqual({ source: 'pricing_page' });
  });

  it('queues callbacks and emits lifecycle events', () => {
    const api = createDropSignGlobal();
    const onReady = vi.fn();
    const onOpen = vi.fn();
    const onComplete = vi.fn();
    const onCancel = vi.fn();
    const onError = vi.fn();

    api.onReady(onReady);
    api.onOpen(onOpen);
    api.onComplete(onComplete);
    api.onCancel(onCancel);
    api.onError(onError);

    api.emitReady({ projectKey: 'pk_live_callbacks' });
    api.emitOpen();
    api.emitComplete({ artifactId: 'sigart_123', status: 'accepted' });
    api.emitCancel();
    api.emitError({ code: 'config_fetch_failed', message: 'Config fetch failed.' });

    expect(onReady).toHaveBeenCalledWith({ projectKey: 'pk_live_callbacks' });
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ artifactId: 'sigart_123', status: 'accepted' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith({ code: 'config_fetch_failed', message: 'Config fetch failed.' });
  });
});
```

- [ ] **Step 2: Run global API tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/dropSignGlobal.test.ts
```

Expected: FAIL because `dropSignGlobal.ts` does not exist.

- [ ] **Step 3: Implement global API**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts` to include:

```ts
export type DropSignReadyState = { projectKey: string };
export type DropSignCompleteState = { artifactId: string; status: 'accepted'; requestId?: string | null; documentId?: string | null };
export type DropSignError = { code: string; message: string };
export type DropSignGlobalApi = {
  identify(identity: DropSignIdentity): void;
  setContext(context: DropSignContext): void;
  onReady(callback: (state: DropSignReadyState) => void): void;
  onOpen(callback: () => void): void;
  onComplete(callback: (state: DropSignCompleteState) => void): void;
  onCancel(callback: () => void): void;
  onError(callback: (error: DropSignError) => void): void;
  open(): Promise<void>;
  getState(): { identity: DropSignIdentity; context: DropSignContext };
};

declare global {
  interface Window {
    DropSign?: DropSignGlobalApi;
  }
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/dropSignGlobal.ts`:

```ts
import type {
  DropSignCompleteState,
  DropSignContext,
  DropSignError,
  DropSignGlobalApi,
  DropSignIdentity,
  DropSignReadyState,
} from './types';

type InternalApi = DropSignGlobalApi & {
  setOpenHandler(handler: () => Promise<void>): void;
  emitReady(state: DropSignReadyState): void;
  emitOpen(): void;
  emitComplete(state: DropSignCompleteState): void;
  emitCancel(): void;
  emitError(error: DropSignError): void;
};

export function createDropSignGlobal(): InternalApi {
  let identity: DropSignIdentity = { metadata: {} };
  let context: DropSignContext = { metadata: {} };
  let openHandler: () => Promise<void> = async () => undefined;
  const readyCallbacks = new Set<(state: DropSignReadyState) => void>();
  const openCallbacks = new Set<() => void>();
  const completeCallbacks = new Set<(state: DropSignCompleteState) => void>();
  const cancelCallbacks = new Set<() => void>();
  const errorCallbacks = new Set<(error: DropSignError) => void>();

  return {
    identify(nextIdentity) {
      identity = { ...nextIdentity, metadata: nextIdentity.metadata ?? {} };
    },
    setContext(nextContext) {
      context = { ...nextContext, metadata: nextContext.metadata ?? {} };
    },
    onReady(callback) {
      readyCallbacks.add(callback);
    },
    onOpen(callback) {
      openCallbacks.add(callback);
    },
    onComplete(callback) {
      completeCallbacks.add(callback);
    },
    onCancel(callback) {
      cancelCallbacks.add(callback);
    },
    onError(callback) {
      errorCallbacks.add(callback);
    },
    async open() {
      await openHandler();
    },
    setOpenHandler(handler) {
      openHandler = handler;
    },
    getState() {
      return { identity, context };
    },
    emitReady(state) {
      readyCallbacks.forEach((callback) => callback(state));
    },
    emitOpen() {
      openCallbacks.forEach((callback) => callback());
    },
    emitComplete(state) {
      completeCallbacks.forEach((callback) => callback(state));
    },
    emitCancel() {
      cancelCallbacks.forEach((callback) => callback());
    },
    emitError(error) {
      errorCallbacks.forEach((callback) => callback(error));
    },
  };
}

export function installDropSignGlobal(): InternalApi {
  const existing = window.DropSign as InternalApi | undefined;
  if (existing?.setOpenHandler) {
    return existing;
  }
  const api = createDropSignGlobal();
  window.DropSign = api;
  return api;
}
```

- [ ] **Step 4: Run global API tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/dropSignGlobal.test.ts
```

Expected: PASS for identity/context storage and callback emission.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget/src/dropSignGlobal.ts apps/widget/src/__tests__/dropSignGlobal.test.ts apps/widget/src/types.ts
git commit -m "feat: expose widget runtime API"
```

## Task 7: Implement Widget API Client And SDK Boot

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/apiClient.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/sdkBoot.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/apiClient.test.ts`

- [ ] **Step 1: Write failing API client tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/__tests__/apiClient.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createWidgetApiClient } from '../apiClient';

describe('createWidgetApiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches config with project key, origin, path, and query', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        projectId: 'proj_123',
        projectKey: 'pk_live_fetch',
        workspaceId: 'ws_123',
        assetVersion: 'v1.0.0',
        assetUrl: 'https://cdn.dropsign.example/widget-assets/v1.0.0/drop-sign-widget.iife.js',
        apiBaseUrl: 'https://api.dropsign.example',
        allowedOrigins: ['https://acme.example'],
        targeting: { hosts: [], paths: [], query: [] },
        button: { enabled: true, label: 'Sign now', position: 'bottom-right', color: '#2563eb', mobilePosition: 'bottom-center' },
        triggers: [],
        workflows: { freeformSignature: true, requestBoundSignature: true },
      }),
    });
    const client = createWidgetApiClient({
      apiBaseUrl: 'https://api.dropsign.example',
      fetchImpl: fetchMock,
    });

    const config = await client.fetchConfig({
      projectKey: 'pk_live_fetch',
      location: new URL('https://acme.example/pricing?plan=pro'),
    });

    expect(config.projectKey).toBe('pk_live_fetch');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.dropsign.example/v1/widget/config?projectKey=pk_live_fetch&origin=https%3A%2F%2Facme.example&path=%2Fpricing&query=plan%3Dpro');
  });

  it('uploads artifact with idempotency key and runtime state', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 202,
      json: async () => ({
        artifactId: 'sigart_123',
        requestId: 'sr_123',
        documentId: 'doc_123',
        status: 'accepted',
      }),
    });
    const client = createWidgetApiClient({
      apiBaseUrl: 'https://api.dropsign.example',
      fetchImpl: fetchMock,
    });

    const result = await client.uploadArtifact({
      idempotencyKey: 'widget_upload_123',
      payload: {
        projectKey: 'pk_live_upload',
        sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.example',
        origin: 'https://acme.example',
        url: 'https://acme.example/pricing',
        identity: { email: 'sam@example.com', metadata: {} },
        metadata: { source: 'pricing_page' },
        signature: { mimeType: 'image/png', dataUrl: 'data:image/png;base64,abc' },
        placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
        sdk: { name: 'drop-sign', version: '0.1.0' },
      },
    });

    expect(result.artifactId).toBe('sigart_123');
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': 'widget_upload_123',
      },
    });
  });
});
```

- [ ] **Step 2: Run API client tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/apiClient.test.ts
```

Expected: FAIL because `apiClient.ts` does not exist.

- [ ] **Step 3: Implement API client and SDK boot wrapper**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/apiClient.ts`:

```ts
import { widgetArtifactResponseSchema, widgetConfigResponseSchema } from '@dropsign/contracts';
import type { WidgetUpload, WidgetUploadResult, WidgetConfig } from './types';

export function createWidgetApiClient(input: {
  apiBaseUrl: string;
  fetchImpl?: typeof fetch;
}) {
  const fetchImpl = input.fetchImpl ?? fetch.bind(window);
  const base = input.apiBaseUrl.replace(/\/$/, '');

  return {
    async fetchConfig(request: { projectKey: string; location: URL }): Promise<WidgetConfig> {
      const url = new URL(`${base}/v1/widget/config`);
      url.searchParams.set('projectKey', request.projectKey);
      url.searchParams.set('origin', request.location.origin);
      url.searchParams.set('path', request.location.pathname);
      url.searchParams.set('query', request.location.search.slice(1));

      const response = await fetchImpl(url.toString(), { credentials: 'omit' });
      if (response.status === 204) {
        throw Object.assign(new Error('page_not_targeted'), { code: 'page_not_targeted' });
      }
      if (!response.ok) {
        throw Object.assign(new Error('config_fetch_failed'), { code: 'config_fetch_failed' });
      }
      return widgetConfigResponseSchema.parse(await response.json());
    },

    async uploadArtifact(request: {
      idempotencyKey: string;
      payload: WidgetUpload;
    }): Promise<WidgetUploadResult> {
      const response = await fetchImpl(`${base}/v1/widget/artifacts`, {
        method: 'POST',
        credentials: 'omit',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': request.idempotencyKey,
        },
        body: JSON.stringify(request.payload),
      });

      if (!response.ok) {
        throw Object.assign(new Error('artifact_upload_failed'), { code: 'artifact_upload_failed' });
      }

      return widgetArtifactResponseSchema.parse(await response.json());
    },
  };
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/sdkBoot.ts`:

```ts
import { DropSign } from 'drop-sign';

export type SdkSignatureResult = {
  signatureDataUrl: string;
  placement: {
    page: number;
    x: number;
    y: number;
    width: number;
    height: number;
  };
};

export type WidgetSdk = {
  open(): Promise<SdkSignatureResult | null>;
};

export function createWidgetSdk(): WidgetSdk {
  return {
    async open() {
      const target = document.body;
      const trigger = document.createElement('button');
      trigger.type = 'button';
      trigger.hidden = true;
      document.body.appendChild(trigger);

      return new Promise<SdkSignatureResult | null>((resolve, reject) => {
        const widget = DropSign.init({
          target,
          trigger: { type: 'custom', element: trigger },
          onComplete(result) {
            widget.destroy();
            trigger.remove();
            resolve({
              signatureDataUrl: result.signatureDataUrl,
              placement: result.placement,
            });
          },
          onCancel() {
            widget.destroy();
            trigger.remove();
            resolve(null);
          },
          onError(error) {
            widget.destroy();
            trigger.remove();
            reject(error);
          },
        });

        trigger.click();
      });
    },
  };
}
```

- [ ] **Step 4: Run API client tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test -- src/__tests__/apiClient.test.ts
```

Expected: PASS for config URL construction and artifact upload headers.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget/src/apiClient.ts apps/widget/src/sdkBoot.ts apps/widget/src/__tests__/apiClient.test.ts
git commit -m "feat: add widget API client and SDK boot"
```

## Task 8: Implement Widget Orchestration, Button, Triggers, Upload, Retry, And Callbacks

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/widget.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/main.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/widget.browser.spec.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts`

- [ ] **Step 1: Write failing browser tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/widget.browser.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('boots widget, renders floating button, opens SDK, uploads artifact, and fires callbacks', async ({ page }) => {
  await page.route('**/v1/widget/config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'proj_browser',
        projectKey: 'pk_live_browser',
        workspaceId: 'ws_browser',
        assetVersion: 'v1.0.0',
        assetUrl: 'http://localhost:5174/src/main.ts',
        apiBaseUrl: 'https://api.dropsign.test',
        allowedOrigins: ['http://127.0.0.1:5174'],
        targeting: { hosts: [], paths: [], query: [] },
        button: { enabled: true, label: 'Sign now', position: 'bottom-right', color: '#2563eb', mobilePosition: 'bottom-center' },
        triggers: [{ selector: '[data-dropsign-trigger]', mode: 'click' }],
        workflows: { freeformSignature: true, requestBoundSignature: true },
      }),
    });
  });
  await page.route('**/v1/widget/artifacts', async (route) => {
    const request = route.request();
    expect(request.headers()['idempotency-key']).toMatch(/^widget_/);
    const body = request.postDataJSON();
    expect(body.projectKey).toBe('pk_live_browser');
    expect(body.identity.email).toBe('sam@example.com');
    expect(body.metadata.source).toBe('browser_test');
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        artifactId: 'sigart_browser',
        requestId: 'sr_browser',
        documentId: 'doc_browser',
        status: 'accepted',
      }),
    });
  });

  await page.addInitScript(() => {
    window.__dropsignEvents = [];
  });

  await page.goto('/?plan=pro');
  await page.evaluate(() => {
    window.DropSign.identify({ email: 'sam@example.com', metadata: {} });
    window.DropSign.setContext({
      sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.browser',
      metadata: { source: 'browser_test' },
    });
    window.DropSign.onReady((state) => window.__dropsignEvents.push(['ready', state.projectKey]));
    window.DropSign.onOpen(() => window.__dropsignEvents.push(['open']));
    window.DropSign.onComplete((state) => window.__dropsignEvents.push(['complete', state.artifactId]));
  });

  await expect(page.getByRole('button', { name: 'Sign now' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign now' }).click();

  await expect.poll(async () => page.evaluate(() => window.__dropsignEvents)).toEqual([
    ['ready', 'pk_live_browser'],
    ['open'],
    ['complete', 'sigart_browser'],
  ]);
});

test('stays hidden and calls onError when config fetch fails', async ({ page }) => {
  await page.route('**/v1/widget/config**', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'origin_not_allowed', message: 'Blocked' } }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    window.__dropsignErrors = [];
    window.DropSign.onError((error) => window.__dropsignErrors.push(error.code));
  });

  await expect(page.getByRole('button', { name: 'Sign now' })).toHaveCount(0);
  await expect.poll(async () => page.evaluate(() => window.__dropsignErrors)).toEqual(['config_fetch_failed']);
});

test('keeps failed upload state and exposes retry while page remains open', async ({ page }) => {
  let uploadAttempts = 0;
  await page.route('**/v1/widget/config**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        projectId: 'proj_retry',
        projectKey: 'pk_live_retry',
        workspaceId: 'ws_retry',
        assetVersion: 'v1.0.0',
        assetUrl: 'http://localhost:5174/src/main.ts',
        apiBaseUrl: 'https://api.dropsign.test',
        allowedOrigins: ['http://127.0.0.1:5174'],
        targeting: { hosts: [], paths: [], query: [] },
        button: { enabled: true, label: 'Sign now', position: 'bottom-right', color: '#2563eb', mobilePosition: 'bottom-center' },
        triggers: [],
        workflows: { freeformSignature: true, requestBoundSignature: true },
      }),
    });
  });
  await page.route('**/v1/widget/artifacts', async (route) => {
    uploadAttempts += 1;
    if (uploadAttempts === 1) {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: { code: 'artifact_upload_failed', message: 'Upload failed.' } }),
      });
      return;
    }
    await route.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({
        artifactId: 'sigart_retry',
        requestId: 'sr_retry',
        documentId: 'doc_retry',
        status: 'accepted',
      }),
    });
  });

  await page.goto('/');
  await page.evaluate(() => {
    window.__dropsignEvents = [];
    window.__dropsignErrors = [];
    window.DropSign.setContext({
      sessionToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.retry',
      metadata: { source: 'retry_test' },
    });
    window.DropSign.onError((error) => window.__dropsignErrors.push(error.code));
    window.DropSign.onComplete((state) => window.__dropsignEvents.push(['complete', state.artifactId]));
  });

  await page.getByRole('button', { name: 'Sign now' }).click();
  await expect.poll(async () => page.evaluate(() => window.__dropsignErrors)).toEqual(['artifact_upload_failed']);
  await page.getByRole('button', { name: 'Retry upload' }).click();

  await expect.poll(async () => page.evaluate(() => window.__dropsignEvents)).toEqual([
    ['complete', 'sigart_retry'],
  ]);
});
```

Add global test declarations in `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/types.ts`:

```ts
declare global {
  interface Window {
    __dropsignEvents?: unknown[];
    __dropsignErrors?: string[];
  }
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/playwright.config.ts` to include widget browser tests:

```ts
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.',
  testMatch: ['apps/widget/tests/**/*.spec.ts'],
  webServer: {
    command: 'pnpm --filter @dropsign/widget dev',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: true,
    timeout: 120_000,
  },
  use: {
    baseURL: 'http://127.0.0.1:5174',
  },
});
```

- [ ] **Step 2: Run browser tests and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/widget.browser.spec.ts
```

Expected: FAIL because widget orchestration and deterministic SDK test hook are missing.

- [ ] **Step 3: Implement orchestration**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/widget.ts`:

```ts
import { createWidgetApiClient } from './apiClient';
import { installDropSignGlobal } from './dropSignGlobal';
import { matchesPageTargeting } from './pageTargeting';
import { discoverWidgetScript } from './scriptDiscovery';
import { createWidgetSdk, type WidgetSdk } from './sdkBoot';
import type { WidgetConfig } from './types';

function createButton(config: WidgetConfig): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = config.button.label;
  button.setAttribute('data-dropsign-floating-button', 'true');
  button.style.position = 'fixed';
  button.style.zIndex = '2147483647';
  button.style.background = config.button.color;
  button.style.color = '#ffffff';
  button.style.border = '0';
  button.style.borderRadius = '8px';
  button.style.padding = '10px 14px';
  button.style.font = '14px system-ui, sans-serif';
  button.style.cursor = 'pointer';
  button.style.boxShadow = '0 8px 24px rgba(15, 23, 42, 0.18)';

  if (config.button.position.includes('bottom')) {
    button.style.bottom = '20px';
  } else {
    button.style.top = '20px';
  }
  if (config.button.position.includes('right')) {
    button.style.right = '20px';
  } else {
    button.style.left = '20px';
  }

  return button;
}

function createRetryButton(onRetry: () => Promise<void>): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Retry upload';
  button.setAttribute('data-dropsign-retry-button', 'true');
  button.style.position = 'fixed';
  button.style.right = '20px';
  button.style.bottom = '68px';
  button.style.zIndex = '2147483647';
  button.style.background = '#111827';
  button.style.color = '#ffffff';
  button.style.border = '0';
  button.style.borderRadius = '8px';
  button.style.padding = '10px 14px';
  button.style.font = '14px system-ui, sans-serif';
  button.style.cursor = 'pointer';
  button.addEventListener('click', () => void onRetry());
  return button;
}

function createIdempotencyKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return `widget_${Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

export async function bootWidget(input: {
  script?: HTMLScriptElement | null;
  sdk?: WidgetSdk;
  location?: URL;
} = {}): Promise<void> {
  const global = installDropSignGlobal();
  const discovered = discoverWidgetScript(input.script ?? document.currentScript as HTMLScriptElement | null);
  const location = input.location ?? new URL(window.location.href);
  const client = createWidgetApiClient({ apiBaseUrl: discovered.apiBaseUrl });
  const sdk = input.sdk ?? createWidgetSdk();
  let pendingUpload: Parameters<ReturnType<typeof createWidgetApiClient>['uploadArtifact']>[0] | null = null;
  let retryButton: HTMLButtonElement | null = null;

  const uploadPending = async () => {
    if (!pendingUpload) {
      return;
    }
    try {
      const upload = await client.uploadArtifact(pendingUpload);
      pendingUpload = null;
      retryButton?.remove();
      retryButton = null;
      global.emitComplete(upload);
    } catch {
      if (!retryButton) {
        retryButton = createRetryButton(uploadPending);
        document.body.appendChild(retryButton);
      }
      global.emitError({ code: 'artifact_upload_failed', message: 'Signature upload failed. Retry is available while this page remains open.' });
    }
  };

  try {
    const config = await client.fetchConfig({ projectKey: discovered.projectKey, location });
    if (!matchesPageTargeting({ location, targeting: config.targeting })) {
      return;
    }

    const openAndUpload = async () => {
      global.emitOpen();
      const result = await sdk.open();
      if (!result) {
        global.emitCancel();
        return;
      }
      const state = global.getState();
      pendingUpload = {
        idempotencyKey: createIdempotencyKey(),
        payload: {
          projectKey: config.projectKey,
          sessionToken: state.context.sessionToken,
          origin: location.origin,
          url: location.toString(),
          identity: state.identity,
          metadata: state.context.metadata,
          signature: {
            mimeType: 'image/png',
            dataUrl: result.signatureDataUrl,
          },
          placement: result.placement,
          sdk: {
            name: 'drop-sign',
            version: '0.1.0',
          },
        },
      };
      await uploadPending();
    };

    global.setOpenHandler(openAndUpload);
    config.triggers.forEach((trigger) => {
      document.querySelectorAll(trigger.selector).forEach((element) => {
        element.addEventListener('click', () => void openAndUpload());
      });
    });

    if (config.button.enabled) {
      const button = createButton(config);
      button.addEventListener('click', () => void openAndUpload());
      document.body.appendChild(button);
    }

    global.emitReady({ projectKey: config.projectKey });
  } catch {
    global.emitError({ code: 'config_fetch_failed', message: 'Widget config fetch failed.' });
  }
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/main.ts`:

```ts
import { bootWidget } from './widget';

void bootWidget({
  sdk: window.location.hostname === '127.0.0.1'
    ? {
        async open() {
          return {
            signatureDataUrl: 'data:image/png;base64,abc',
            placement: { page: 1, x: 0.1, y: 0.2, width: 0.3, height: 0.1 },
          };
        },
      }
    : undefined,
});
```

- [ ] **Step 4: Run browser tests and verify pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/widget.browser.spec.ts
```

Expected: PASS for boot/upload/callback behavior and config failure behavior.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget/src/widget.ts apps/widget/src/main.ts apps/widget/tests/widget.browser.spec.ts apps/widget/src/types.ts playwright.config.ts
git commit -m "feat: boot widget signing flow"
```

## Task 9: Replace Test Shim CDN Asset Serving With Built Immutable Assets

**Files:**
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/api/src/app.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/bootstrap-cache.spec.ts`

- [ ] **Step 1: Write failing bootstrap integration test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/widget/tests/bootstrap-cache.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('bootstrap loads immutable versioned widget asset from script tag project key', async ({ page }) => {
  await page.route('**/widget.js', async (route) => {
    await route.fulfill({
      status: 200,
      headers: {
        'cache-control': 'no-store, max-age=0',
        'content-type': 'application/javascript; charset=utf-8',
      },
      body: `
        /* DropSign CDN bootstrap */
        (function(){
          var s=document.currentScript;
          var key=s&&s.getAttribute('data-project-key');
          var next=document.createElement('script');
          next.async=true;
          next.src='http://127.0.0.1:5174/src/main.ts';
          next.setAttribute('data-project-key',key);
          next.setAttribute('data-api-base-url','https://api.dropsign.test');
          document.head.appendChild(next);
        })();
      `,
    });
  });
  await page.route('**/v1/widget/config**', async (route) => {
    await route.fulfill({
      status: 204,
      headers: { 'cache-control': 'private, max-age=60' },
    });
  });

  await page.setContent(`
    <script src="https://cdn.dropsign.test/widget.js" data-project-key="pk_live_bootstrap" async></script>
  `);

  await expect.poll(async () => page.locator('script[data-project-key="pk_live_bootstrap"][data-api-base-url="https://api.dropsign.test"]').count()).toBe(2);
});
```

- [ ] **Step 2: Run bootstrap browser test and verify failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/bootstrap-cache.spec.ts
```

Expected: FAIL if the bootstrap does not copy `data-project-key` or if the widget entry throws on 204 page-not-targeted.

- [ ] **Step 3: Serve built assets from disk with immutable headers**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/api/src/widget/widget.routes.ts` to replace the test shim route body with file serving:

```ts
import { readFile } from 'node:fs/promises';
import path from 'node:path';
```

Inside the `createWidgetPlugin` returned Fastify plugin function, replace the earlier inline asset test shim route:

```ts
const widgetAssetDir = path.resolve(process.cwd(), 'dist/widget-assets');

app.get<{ Params: { version: string; assetName: string } }>('/widget-assets/:version/:assetName', async (request, reply) => {
  if (request.params.version !== deps.env.WIDGET_ASSET_VERSION) {
    return reply.status(404).send({
      error: { code: 'asset_not_found', message: 'Widget asset version was not found.' },
    });
  }

  const assetPath = path.join(widgetAssetDir, request.params.version, request.params.assetName);
  const body = await readFile(assetPath, 'utf8');
  return reply
    .header('Cache-Control', 'public, max-age=31536000, immutable')
    .type('application/javascript')
    .send(body);
});
```

Delete the earlier inline `app.get('/widget-assets/:version/drop-sign-widget.iife.js', ...)` test shim route.

Modify `/Users/minjun/Documents/dropsign-cloud/apps/widget/src/widget.ts` so `page_not_targeted` does not emit error:

```ts
  } catch (error) {
    if ((error as { code?: string }).code === 'page_not_targeted') {
      return;
    }
    global.emitError({ code: 'config_fetch_failed', message: 'Widget config fetch failed.' });
  }
```

- [ ] **Step 4: Build widget and run cache tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/widget build
pnpm vitest run apps/api/src/widget/widget.routes.test.ts -t "immutable asset"
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/bootstrap-cache.spec.ts
```

Expected: widget build exits 0; API immutable asset test passes against disk asset; browser bootstrap test passes.

- [ ] **Step 5: Commit**

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/api/src/widget/widget.routes.ts apps/widget/src/widget.ts apps/widget/tests/bootstrap-cache.spec.ts
git commit -m "feat: serve immutable widget assets"
```

## Task 10: Final Contract, Browser, Lint, Typecheck, Build Verification

**Files:**
- Modify only files already touched in Tasks 1-9 if verification exposes a defect.

- [ ] **Step 1: Run focused widget and API tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/contracts/src/widget.test.ts apps/api/src/widget/widget.routes.test.ts
pnpm --filter @dropsign/widget test
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/widget.browser.spec.ts apps/widget/tests/bootstrap-cache.spec.ts
```

Expected: all tests pass. Expected focused coverage includes contract shape, allowed-origin rejection, page targeting, no-cache `widget.js`, immutable assets, WidgetSession mismatch rejection, successful artifact ingest, browser boot, callbacks, SDK open, upload, and config failure.

- [ ] **Step 2: Run repository quality gates**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected: all commands exit 0. If `pnpm build` creates generated files under `dist/`, do not commit generated `dist/` unless the cloud repository explicitly tracks deployment artifacts.

- [ ] **Step 3: Inspect changed files**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git status --short
git diff --stat
```

Expected: changed files are limited to the exact cloud paths listed in this plan plus lockfile updates from `pnpm install`. No files under `/Users/minjun/Documents/drop-sign` are changed.

- [ ] **Step 4: Commit verification fixes if any were required**

If Step 1 or Step 2 required corrections, commit the corrections:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/widget packages/contracts apps/api package.json pnpm-workspace.yaml pnpm-lock.yaml playwright.config.ts
git commit -m "test: verify widget platform contracts"
```

Expected: commit succeeds only when verification changes exist. If no verification fixes were required, skip this commit and keep the last commit from Task 9 as the phase endpoint.

## Final Verification Commands

Run these before marking Phase 02 complete:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm vitest run packages/contracts/src/widget.test.ts apps/api/src/widget/widget.routes.test.ts
pnpm --filter @dropsign/widget test
pnpm --filter @dropsign/widget build
pnpm --filter @dropsign/widget test:browser -- apps/widget/tests/widget.browser.spec.ts apps/widget/tests/bootstrap-cache.spec.ts
pnpm lint
pnpm typecheck
pnpm test
pnpm build
git status --short
```

Expected final state:

- Contract, widget unit, API, and browser tests pass.
- `widget.js` response uses `Cache-Control: no-store, max-age=0`.
- `/widget-assets/v1.0.0/drop-sign-widget.iife.js` response uses `Cache-Control: public, max-age=31536000, immutable`.
- Config endpoint rejects disallowed origins and records `widget.config_rejected`.
- Browser widget stays hidden on config failure and emits `onError`.
- Browser widget renders configured floating button and custom trigger listeners when origin and targeting match.
- `window.DropSign.identify` stores untrusted identity hints; it is never used by API authorization.
- `window.DropSign.setContext` stores WidgetSession token and metadata for upload.
- Artifact ingest rejects missing, invalid, expired, origin-mismatched, and project-mismatched WidgetSession tokens.
- Successful artifact ingest persists `SignatureArtifact`, records `signature.completed`, returns `status: accepted`, and remains idempotent for repeated `Idempotency-Key`.
- `git status --short` shows no modifications outside `/Users/minjun/Documents/dropsign-cloud`.

## Commit Boundaries

Use these commits while implementing the phase:

```bash
git commit -m "feat: add widget platform contracts"
git commit -m "feat: expose widget config and CDN bootstrap routes"
git commit -m "feat: validate widget sessions for artifact ingest"
git commit -m "feat: add widget Vite application"
git commit -m "feat: add widget page targeting"
git commit -m "feat: expose widget runtime API"
git commit -m "feat: add widget API client and SDK boot"
git commit -m "feat: boot widget signing flow"
git commit -m "feat: serve immutable widget assets"
git commit -m "test: verify widget platform contracts"
```
