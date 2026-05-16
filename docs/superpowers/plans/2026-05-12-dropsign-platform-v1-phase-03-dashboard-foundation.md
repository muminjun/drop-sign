# Dashboard Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Build the Phase 03 DropSign Cloud dashboard foundation: authenticated Next.js shell, workspace/project navigation, project settings, widget configuration, install snippet copy, signature records, webhook delivery previews, route guards, and browser/component test coverage.

**Architecture:** The dashboard is a Next.js app in `/Users/minjun/Documents/dropsign-cloud/apps/web` that talks to the Phase 01/02 API through a typed server/client API layer. Server components load authenticated workspace/project state and enforce route access before rendering client form islands for interactive settings and copy actions. Playwright covers user flows against mocked API responses, while component tests cover form behavior, permission-aware navigation, and data rendering.

**Tech Stack:** Next.js App Router, TypeScript, React, Tailwind CSS, shadcn/ui-style primitives, `next-auth` or the Phase 01 auth adapter, Zod, React Hook Form, Vitest, React Testing Library, MSW, Playwright.

---

## Scope And Boundaries

This plan only changes files under `/Users/minjun/Documents/dropsign-cloud/apps/web`, `/Users/minjun/Documents/dropsign-cloud/packages/api-client`, and repository-level test/config files in `/Users/minjun/Documents/dropsign-cloud`. It must not edit `/Users/minjun/Documents/drop-sign`, `tsup.config.ts`, generated build output, or any existing plan files.

Phase 03 depends on Phase 01 and Phase 02 API contracts already existing:

- `DASHBOARD_ME_PATH = '/v1/dashboard/me'`
- `DASHBOARD_WORKSPACES_PATH = '/v1/dashboard/workspaces'`
- `dashboardWorkspaceProjectsPath(workspaceId) = /v1/dashboard/workspaces/${workspaceId}/projects`
- `dashboardProjectPath(projectId) = /v1/dashboard/projects/${projectId}`
- `dashboardProjectWidgetConfigPath(projectId) = /v1/dashboard/projects/${projectId}/widget-config`
- `dashboardProjectSignatureRecordsPath(projectId) = /v1/dashboard/projects/${projectId}/signature-records`
- `dashboardProjectSignatureRecordDetailPath(projectId, recordId) = /v1/dashboard/projects/${projectId}/signature-records/${recordId}`
- `dashboardProjectWebhookDeliveriesPath(projectId) = /v1/dashboard/projects/${projectId}/webhook-deliveries`

Use these exact constants and path builders in `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.ts`. `PATCH` project updates use `dashboardProjectPath(projectId)`, and `PUT` widget config updates use `dashboardProjectWidgetConfigPath(projectId)`.

## File Map

- Create `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.ts`: typed dashboard API functions and Zod response schemas.
- Modify `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/index.ts`: export dashboard API functions.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/session.ts`: authenticated session loader wrapper used by server components and middleware.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/roles.ts`: role permission matrix and route checks.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.ts`: route guard for dashboard pages.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(auth)/sign-in/page.tsx`: sign-in UI.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/layout.tsx`: authenticated dashboard route group pass-through.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/layout.tsx`: dashboard app shell with workspace-scoped data.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/page.tsx`: project list page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/layout.tsx`: project-scoped layout.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/settings/page.tsx`: project settings page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/widget/page.tsx`: widget configuration page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/page.tsx`: signature records list page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/[recordId]/page.tsx`: signature record detail page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/webhooks/deliveries/page.tsx`: webhook deliveries read-only page.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/app-shell.tsx`: sidebar, workspace switcher, project switcher, account menu.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.tsx`: workspace and project selection controls.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.tsx`: project name/origin form.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.tsx`: visual settings and page targeting form.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.tsx`: copyable script tag.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.tsx`: signature list table.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.tsx`: signer, artifact, metadata, and audit event detail.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.tsx`: read-only webhook attempt preview.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/msw/dashboard-handlers.ts`: dashboard API mocks for component and Playwright tests.
- Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/setup.ts`: register MSW and Testing Library matchers.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.test.tsx`: workspace and project navigation component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.test.tsx`: install snippet copy component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.test.tsx`: project settings form component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.test.tsx`: widget configuration form component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.test.tsx`: signature records table component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.test.tsx`: signature detail component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.test.tsx`: webhook delivery preview component tests.
- Create `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/dashboard-foundation.spec.ts`: Playwright end-to-end tests.
- Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/playwright.config.ts`: include the dashboard e2e test and web server command.

## Shared Types And Contracts

Use these TypeScript shapes in the API client and component props. Keep names exact so tests and pages compose cleanly.

```ts
export type WorkspaceRole = 'owner' | 'admin' | 'developer' | 'member' | 'viewer' | 'support-admin';

export type DashboardWorkspace = {
  id: string;
  name: string;
  slug: string;
  role: WorkspaceRole;
};

export type DashboardProject = {
  id: string;
  workspaceId: string;
  name: string;
  environment: 'test' | 'live';
  publicKey: string;
  allowedOrigins: string[];
  createdAt: string;
  updatedAt: string;
};

export type WidgetConfig = {
  projectId: string;
  enabled: boolean;
  buttonLabel: string;
  buttonColor: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  mobilePosition: 'bottom' | 'top';
  triggerSelector: string;
  pageTargets: Array<{
    id: string;
    host: string;
    pathPattern: string;
    queryContains: string;
    enabled: boolean;
  }>;
};

export type SignatureRecord = {
  id: string;
  projectId: string;
  signerName: string;
  signerEmail: string;
  source: 'widget' | 'link' | 'api' | 'template';
  status: 'started' | 'completed' | 'cancelled' | 'failed';
  documentName: string;
  completedAt: string | null;
  createdAt: string;
};

export type SignatureRecordDetail = SignatureRecord & {
  artifact: {
    imageUrl: string;
    documentHash: string;
    placement: { page: number; x: number; y: number; width: number; height: number };
  } | null;
  metadata: Record<string, string>;
  auditEvents: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

export type WebhookDeliveryPreview = {
  id: string;
  endpointUrl: string;
  eventType: string;
  status: 'pending' | 'delivered' | 'failed' | 'retrying';
  responseStatus: number | null;
  responseExcerpt: string;
  attemptCount: number;
  nextAttemptAt: string | null;
  createdAt: string;
};
```

## Task 1: Dashboard API Client Contract

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/index.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.test.ts`

- [x] **Step 1: Write the failing API client tests**

Create `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getDashboardProject,
  getSignatureRecordDetail,
  updateWidgetConfig,
} from './dashboard';

describe('dashboard api client', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('loads a project with typed dashboard fields', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: 'proj_123',
        workspaceId: 'ws_123',
        name: 'Marketing Site',
        environment: 'live',
        publicKey: 'pk_live_123',
        allowedOrigins: ['https://example.com'],
        createdAt: '2026-05-12T00:00:00.000Z',
        updatedAt: '2026-05-12T01:00:00.000Z',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await expect(getDashboardProject('proj_123', 'token_123')).resolves.toMatchObject({
      id: 'proj_123',
      publicKey: 'pk_live_123',
      allowedOrigins: ['https://example.com'],
    });
    expect(fetchMock).toHaveBeenCalledWith('http://localhost:3001/v1/dashboard/projects/proj_123', {
      headers: { Authorization: 'Bearer token_123' },
      cache: 'no-store',
    });
  });

  it('sends the full widget config payload when saving settings', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        projectId: 'proj_123',
        enabled: true,
        buttonLabel: 'Sign here',
        buttonColor: '#14532d',
        position: 'bottom-right',
        mobilePosition: 'bottom',
        triggerSelector: '[data-dropsign-trigger]',
        pageTargets: [
          {
            id: 'target_home',
            host: 'example.com',
            pathPattern: '/pricing',
            queryContains: 'plan=pro',
            enabled: true,
          },
        ],
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const result = await updateWidgetConfig('proj_123', 'token_123', {
      enabled: true,
      buttonLabel: 'Sign here',
      buttonColor: '#14532d',
      position: 'bottom-right',
      mobilePosition: 'bottom',
      triggerSelector: '[data-dropsign-trigger]',
      pageTargets: [
        {
          id: 'target_home',
          host: 'example.com',
          pathPattern: '/pricing',
          queryContains: 'plan=pro',
          enabled: true,
        },
      ],
    });

    expect(result.buttonLabel).toBe('Sign here');
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3001/v1/dashboard/projects/proj_123/widget-config',
      {
        method: 'PUT',
        headers: {
          Authorization: 'Bearer token_123',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled: true,
          buttonLabel: 'Sign here',
          buttonColor: '#14532d',
          position: 'bottom-right',
          mobilePosition: 'bottom',
          triggerSelector: '[data-dropsign-trigger]',
          pageTargets: [
            {
              id: 'target_home',
              host: 'example.com',
              pathPattern: '/pricing',
              queryContains: 'plan=pro',
              enabled: true,
            },
          ],
        }),
      },
    );
  });

  it('rejects malformed signature record details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'sig_123', status: 'unknown_status' }),
      }),
    );

    await expect(getSignatureRecordDetail('proj_123', 'sig_123', 'token_123')).rejects.toThrow();
  });
});
```

- [x] **Step 2: Run the API client tests and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api-client test -- dashboard.test.ts
```

Expected: FAIL because `packages/api-client/src/dashboard.ts` does not exist or does not export `getDashboardProject`, `getSignatureRecordDetail`, and `updateWidgetConfig`.

- [x] **Step 3: Implement the dashboard API client**

Create `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/dashboard.ts`:

```ts
import { z } from 'zod';

const apiBaseUrl = process.env.DROPSIGN_API_URL ?? 'http://localhost:3001';
export const DASHBOARD_ME_PATH = '/v1/dashboard/me';
export const DASHBOARD_WORKSPACES_PATH = '/v1/dashboard/workspaces';
export const dashboardWorkspaceProjectsPath = (workspaceId: string) =>
  `/v1/dashboard/workspaces/${workspaceId}/projects`;
export const dashboardProjectPath = (projectId: string) => `/v1/dashboard/projects/${projectId}`;
export const dashboardProjectWidgetConfigPath = (projectId: string) =>
  `/v1/dashboard/projects/${projectId}/widget-config`;
export const dashboardProjectSignatureRecordsPath = (projectId: string) =>
  `/v1/dashboard/projects/${projectId}/signature-records`;
export const dashboardProjectSignatureRecordDetailPath = (projectId: string, recordId: string) =>
  `/v1/dashboard/projects/${projectId}/signature-records/${recordId}`;
export const dashboardProjectWebhookDeliveriesPath = (projectId: string) =>
  `/v1/dashboard/projects/${projectId}/webhook-deliveries`;

const workspaceRoleSchema = z.enum(['owner', 'admin', 'developer', 'member', 'viewer', 'support-admin']);

const workspaceSchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  role: workspaceRoleSchema,
});

const projectSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  name: z.string(),
  environment: z.enum(['test', 'live']),
  publicKey: z.string(),
  allowedOrigins: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const widgetConfigSchema = z.object({
  projectId: z.string(),
  enabled: z.boolean(),
  buttonLabel: z.string(),
  buttonColor: z.string(),
  position: z.enum(['bottom-right', 'bottom-left', 'top-right', 'top-left']),
  mobilePosition: z.enum(['bottom', 'top']),
  triggerSelector: z.string(),
  pageTargets: z.array(
    z.object({
      id: z.string(),
      host: z.string(),
      pathPattern: z.string(),
      queryContains: z.string(),
      enabled: z.boolean(),
    }),
  ),
});

const signatureRecordSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  signerName: z.string(),
  signerEmail: z.string().email(),
  source: z.enum(['widget', 'link', 'api', 'template']),
  status: z.enum(['started', 'completed', 'cancelled', 'failed']),
  documentName: z.string(),
  completedAt: z.string().nullable(),
  createdAt: z.string(),
});

const signatureRecordDetailSchema = signatureRecordSchema.extend({
  artifact: z
    .object({
      imageUrl: z.string(),
      documentHash: z.string(),
      placement: z.object({
        page: z.number(),
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
      }),
    })
    .nullable(),
  metadata: z.record(z.string(), z.string()),
  auditEvents: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      message: z.string(),
      createdAt: z.string(),
    }),
  ),
});

const webhookDeliveryPreviewSchema = z.object({
  id: z.string(),
  endpointUrl: z.string(),
  eventType: z.string(),
  status: z.enum(['pending', 'delivered', 'failed', 'retrying']),
  responseStatus: z.number().nullable(),
  responseExcerpt: z.string(),
  attemptCount: z.number(),
  nextAttemptAt: z.string().nullable(),
  createdAt: z.string(),
});

export type WorkspaceRole = z.infer<typeof workspaceRoleSchema>;
export type DashboardWorkspace = z.infer<typeof workspaceSchema>;
export type DashboardProject = z.infer<typeof projectSchema>;
export type WidgetConfig = z.infer<typeof widgetConfigSchema>;
export type SignatureRecord = z.infer<typeof signatureRecordSchema>;
export type SignatureRecordDetail = z.infer<typeof signatureRecordDetailSchema>;
export type WebhookDeliveryPreview = z.infer<typeof webhookDeliveryPreviewSchema>;

async function requestJson<T>(
  path: string,
  token: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
    cache: init.cache ?? 'no-store',
  });

  if (!response.ok) {
    throw new Error(`DropSign API request failed: ${response.status}`);
  }

  return schema.parse(await response.json());
}

export function getDashboardWorkspaces(token: string) {
  return requestJson(DASHBOARD_WORKSPACES_PATH, token, z.array(workspaceSchema));
}

export function getDashboardProjects(workspaceId: string, token: string) {
  return requestJson(
    dashboardWorkspaceProjectsPath(workspaceId),
    token,
    z.array(projectSchema),
  );
}

export function getDashboardProject(projectId: string, token: string) {
  return requestJson(dashboardProjectPath(projectId), token, projectSchema);
}

export function updateDashboardProject(
  projectId: string,
  token: string,
  input: Pick<DashboardProject, 'name' | 'allowedOrigins'>,
) {
  return requestJson(dashboardProjectPath(projectId), token, projectSchema, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function getWidgetConfig(projectId: string, token: string) {
  return requestJson(dashboardProjectWidgetConfigPath(projectId), token, widgetConfigSchema);
}

export function updateWidgetConfig(
  projectId: string,
  token: string,
  input: Omit<WidgetConfig, 'projectId'>,
) {
  return requestJson(dashboardProjectWidgetConfigPath(projectId), token, widgetConfigSchema, {
    method: 'PUT',
    body: JSON.stringify(input),
  });
}

export function getSignatureRecords(projectId: string, token: string) {
  return requestJson(
    dashboardProjectSignatureRecordsPath(projectId),
    token,
    z.array(signatureRecordSchema),
  );
}

export function getSignatureRecordDetail(projectId: string, recordId: string, token: string) {
  return requestJson(
    dashboardProjectSignatureRecordDetailPath(projectId, recordId),
    token,
    signatureRecordDetailSchema,
  );
}

export function getWebhookDeliveries(projectId: string, token: string) {
  return requestJson(
    dashboardProjectWebhookDeliveriesPath(projectId),
    token,
    z.array(webhookDeliveryPreviewSchema),
  );
}
```

Modify `/Users/minjun/Documents/dropsign-cloud/packages/api-client/src/index.ts`:

```ts
export * from './dashboard';
```

- [x] **Step 4: Run the API client tests and verify they pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/api-client test -- dashboard.test.ts
```

Expected: PASS with all three dashboard API client tests passing.

- [x] **Step 5: Commit the API client contract**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add packages/api-client/src/dashboard.ts packages/api-client/src/dashboard.test.ts packages/api-client/src/index.ts
git commit -m "feat: add dashboard api client"
```

Expected: commit succeeds and `git status --short` does not list these three files.

## Task 2: Auth Session And Role-Based Route Guards

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/session.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/roles.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/roles.test.ts`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.test.ts`

- [x] **Step 1: Write the failing role and middleware tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/roles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canAccessDashboardRoute } from './roles';

describe('canAccessDashboardRoute', () => {
  it.each(['owner', 'admin', 'developer'])(
    'allows %s to edit project and widget settings',
    (role) => {
      expect(canAccessDashboardRoute(role, '/workspaces/ws_123/projects/proj_123/settings')).toBe(true);
      expect(canAccessDashboardRoute(role, '/workspaces/ws_123/projects/proj_123/widget')).toBe(true);
    },
  );

  it('allows viewers to inspect signatures and webhook deliveries', () => {
    expect(canAccessDashboardRoute('viewer', '/workspaces/ws_123/projects/proj_123/signatures')).toBe(true);
    expect(canAccessDashboardRoute('viewer', '/workspaces/ws_123/projects/proj_123/webhooks/deliveries')).toBe(true);
  });

  it('blocks viewers from settings pages', () => {
    expect(canAccessDashboardRoute('viewer', '/workspaces/ws_123/projects/proj_123/settings')).toBe(false);
    expect(canAccessDashboardRoute('viewer', '/workspaces/ws_123/projects/proj_123/widget')).toBe(false);
  });
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.test.ts`:

```ts
import { NextRequest } from 'next/server';
import { describe, expect, it, vi } from 'vitest';
import { middleware } from './middleware';

vi.mock('./lib/auth/session', () => ({
  getMiddlewareSession: vi.fn(async () => null),
}));

describe('dashboard middleware', () => {
  it('redirects unauthenticated dashboard requests to sign in', async () => {
    const request = new NextRequest('http://localhost:3000/workspaces/ws_123/projects');

    const response = await middleware(request);

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe(
      'http://localhost:3000/sign-in?next=%2Fworkspaces%2Fws_123%2Fprojects',
    );
  });
});
```

- [x] **Step 2: Run tests and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/lib/auth/roles.test.ts src/middleware.test.ts
```

Expected: FAIL because `roles.ts`, `session.ts`, and `middleware.ts` are missing.

- [x] **Step 3: Implement session loading and route guards**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/session.ts`:

```ts
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { DashboardWorkspace, WorkspaceRole } from '@dropsign/api-client';

export type DashboardSession = {
  user: { id: string; name: string; email: string };
  accessToken: string;
  activeWorkspace: DashboardWorkspace;
};

export async function getDashboardSession(): Promise<DashboardSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get('dropsign_session')?.value;
  if (!raw) return null;
  return JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DashboardSession;
}

export async function requireDashboardSession(): Promise<DashboardSession> {
  const session = await getDashboardSession();
  if (!session) {
    throw new Error('Authenticated DropSign dashboard session required');
  }
  return session;
}

export async function getMiddlewareSession(request: NextRequest): Promise<{
  role: WorkspaceRole;
} | null> {
  const raw = request.cookies.get('dropsign_session')?.value;
  if (!raw) return null;
  const session = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as DashboardSession;
  return { role: session.activeWorkspace.role };
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/roles.ts`:

```ts
import type { WorkspaceRole } from '@dropsign/api-client';

const editableRoles = new Set<WorkspaceRole>(['owner', 'admin', 'developer', 'support-admin']);
const readableRoles = new Set<WorkspaceRole>([
  'owner',
  'admin',
  'developer',
  'member',
  'viewer',
  'support-admin',
]);

export function canAccessDashboardRoute(role: WorkspaceRole, pathname: string): boolean {
  if (pathname.includes('/settings') || pathname.includes('/widget')) {
    return editableRoles.has(role);
  }

  if (pathname.includes('/signatures') || pathname.includes('/webhooks/deliveries')) {
    return readableRoles.has(role);
  }

  return readableRoles.has(role);
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.ts`:

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { canAccessDashboardRoute } from './lib/auth/roles';
import { getMiddlewareSession } from './lib/auth/session';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/sign-in' || pathname.startsWith('/_next') || pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const session = await getMiddlewareSession(request);
  if (!session) {
    const signInUrl = new URL('/sign-in', request.url);
    signInUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (!canAccessDashboardRoute(session.role, pathname)) {
    return NextResponse.redirect(new URL('/workspaces', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/workspaces/:path*'],
};
```

- [x] **Step 4: Run tests and verify they pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/lib/auth/roles.test.ts src/middleware.test.ts
```

Expected: PASS for role and middleware tests.

- [x] **Step 5: Commit auth guards**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/src/lib/auth/session.ts apps/web/src/lib/auth/roles.ts apps/web/src/middleware.ts apps/web/src/lib/auth/roles.test.ts apps/web/src/middleware.test.ts
git commit -m "feat: guard dashboard routes by role"
```

Expected: commit succeeds.

## Task 3: Dashboard Shell, Auth UI, Workspace And Project Switcher

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(auth)/sign-in/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/layout.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/layout.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/app-shell.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.test.tsx`

- [x] **Step 1: Write the failing switcher component test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WorkspaceProjectSwitcher } from './workspace-project-switcher';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

describe('WorkspaceProjectSwitcher', () => {
  it('navigates to the selected project inside the selected workspace', async () => {
    render(
      <WorkspaceProjectSwitcher
        activeWorkspaceId="ws_123"
        activeProjectId="proj_123"
        workspaces={[
          { id: 'ws_123', name: 'Acme', slug: 'acme', role: 'admin' },
          { id: 'ws_456', name: 'Beta', slug: 'beta', role: 'viewer' },
        ]}
        projects={[
          {
            id: 'proj_123',
            workspaceId: 'ws_123',
            name: 'Marketing Site',
            environment: 'live',
            publicKey: 'pk_live_123',
            allowedOrigins: ['https://example.com'],
            createdAt: '2026-05-12T00:00:00.000Z',
            updatedAt: '2026-05-12T00:00:00.000Z',
          },
          {
            id: 'proj_456',
            workspaceId: 'ws_123',
            name: 'Docs Site',
            environment: 'test',
            publicKey: 'pk_test_456',
            allowedOrigins: ['https://docs.example.com'],
            createdAt: '2026-05-12T00:00:00.000Z',
            updatedAt: '2026-05-12T00:00:00.000Z',
          },
        ]}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Project'), 'proj_456');

    expect(push).toHaveBeenCalledWith('/workspaces/ws_123/projects/proj_456/settings');
  });
});
```

- [x] **Step 2: Run the component test and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/workspace-project-switcher.test.tsx
```

Expected: FAIL because the switcher component does not exist.

- [x] **Step 3: Implement shell and switcher components**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-project-switcher.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import type { DashboardProject, DashboardWorkspace } from '@dropsign/api-client';

type Props = {
  activeWorkspaceId: string;
  activeProjectId?: string;
  workspaces: DashboardWorkspace[];
  projects: DashboardProject[];
};

export function WorkspaceProjectSwitcher({
  activeWorkspaceId,
  activeProjectId,
  workspaces,
  projects,
}: Props) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-3">
      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Workspace
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          aria-label="Workspace"
          value={activeWorkspaceId}
          onChange={(event) => router.push(`/workspaces/${event.target.value}/projects`)}
        >
          {workspaces.map((workspace) => (
            <option key={workspace.id} value={workspace.id}>
              {workspace.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1 text-sm font-medium text-slate-700">
        Project
        <select
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          aria-label="Project"
          value={activeProjectId ?? ''}
          onChange={(event) =>
            router.push(`/workspaces/${activeWorkspaceId}/projects/${event.target.value}/settings`)
          }
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/app-shell.tsx`:

```tsx
import Link from 'next/link';
import type { DashboardProject, DashboardWorkspace } from '@dropsign/api-client';
import { WorkspaceProjectSwitcher } from './workspace-project-switcher';

type Props = {
  children: React.ReactNode;
  activeWorkspaceId: string;
  activeProjectId?: string;
  workspaces: DashboardWorkspace[];
  projects: DashboardProject[];
  userName: string;
};

export function AppShell({
  children,
  activeWorkspaceId,
  activeProjectId,
  workspaces,
  projects,
  userName,
}: Props) {
  const projectBase = activeProjectId
    ? `/workspaces/${activeWorkspaceId}/projects/${activeProjectId}`
    : `/workspaces/${activeWorkspaceId}/projects`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link className="text-lg font-semibold" href={`/workspaces/${activeWorkspaceId}/projects`}>
            DropSign
          </Link>
          <WorkspaceProjectSwitcher
            activeWorkspaceId={activeWorkspaceId}
            activeProjectId={activeProjectId}
            workspaces={workspaces}
            projects={projects}
          />
          <div className="text-sm text-slate-600">{userName}</div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-[220px_1fr] gap-6 px-6 py-6">
        <nav className="space-y-2 text-sm">
          <Link className="block rounded-md px-3 py-2 hover:bg-slate-100" href={`${projectBase}/settings`}>
            Project settings
          </Link>
          <Link className="block rounded-md px-3 py-2 hover:bg-slate-100" href={`${projectBase}/widget`}>
            Widget
          </Link>
          <Link className="block rounded-md px-3 py-2 hover:bg-slate-100" href={`${projectBase}/signatures`}>
            Signatures
          </Link>
          <Link
            className="block rounded-md px-3 py-2 hover:bg-slate-100"
            href={`${projectBase}/webhooks/deliveries`}
          >
            Webhook deliveries
          </Link>
        </nav>
        <main>{children}</main>
      </div>
    </div>
  );
}
```

- [x] **Step 4: Implement app routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(auth)/sign-in/page.tsx`:

```tsx
export default function SignInPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next = searchParams.next ?? '/workspaces';

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-950">Sign in to DropSign</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your workspace account to manage projects, widget settings, and signature records.
        </p>
        <form className="mt-6 grid gap-4" action="/api/auth/sign-in" method="post">
          <input type="hidden" name="next" value={next} />
          <label className="grid gap-1 text-sm font-medium">
            Email
            <input
              className="h-10 rounded-md border border-slate-300 px-3"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <button className="h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">
            Continue
          </button>
        </form>
      </section>
    </main>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/layout.tsx`:

```tsx
export default function DashboardRouteGroupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/layout.tsx`:

```tsx
import { redirect } from 'next/navigation';
import { getDashboardProjects, getDashboardWorkspaces } from '@dropsign/api-client';
import { AppShell } from '@/components/dashboard/app-shell';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function DashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { workspaceId: string };
}) {
  const session = await requireDashboardSession().catch(() => null);
  if (!session) redirect('/sign-in');

  const workspaces = await getDashboardWorkspaces(session.accessToken);
  const projects = await getDashboardProjects(params.workspaceId, session.accessToken);

  return (
    <AppShell
      activeWorkspaceId={params.workspaceId}
      workspaces={workspaces}
      projects={projects}
      userName={session.user.name}
    >
      {children}
    </AppShell>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/page.tsx`:

```tsx
import Link from 'next/link';
import { getDashboardProjects } from '@dropsign/api-client';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function ProjectsPage({ params }: { params: { workspaceId: string } }) {
  const session = await requireDashboardSession();
  const projects = await getDashboardProjects(params.workspaceId, session.accessToken);

  return (
    <section>
      <h1 className="text-2xl font-semibold">Projects</h1>
      <div className="mt-6 grid gap-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            className="rounded-lg border border-slate-200 bg-white p-4 hover:border-emerald-600"
            href={`/workspaces/${params.workspaceId}/projects/${project.id}/settings`}
          >
            <div className="font-medium">{project.name}</div>
            <div className="mt-1 text-sm text-slate-600">{project.publicKey}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
```

- [x] **Step 5: Run switcher test and verify it passes**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/workspace-project-switcher.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit dashboard shell**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add 'apps/web/src/app/(auth)/sign-in/page.tsx' 'apps/web/src/app/(dashboard)/layout.tsx' 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/layout.tsx' 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/page.tsx' apps/web/src/components/dashboard/app-shell.tsx apps/web/src/components/dashboard/workspace-project-switcher.tsx apps/web/src/components/dashboard/workspace-project-switcher.test.tsx
git commit -m "feat: add dashboard shell"
```

Expected: commit succeeds.

## Task 4: Project Settings And Install Snippet Copy

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/layout.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/settings/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.test.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.test.tsx`

- [x] **Step 1: Write failing tests for the install snippet and settings form**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstallSnippetCard } from './install-snippet-card';

describe('InstallSnippetCard', () => {
  it('copies the script tag with the project public key', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });

    render(<InstallSnippetCard publicKey="pk_live_123" cdnUrl="https://cdn.dropsign.com/widget.js" />);

    expect(screen.getByText(/data-project-key="pk_live_123"/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Copy install snippet' }));

    expect(writeText).toHaveBeenCalledWith(
      '<script src="https://cdn.dropsign.com/widget.js" data-project-key="pk_live_123" async></script>',
    );
    expect(screen.getByText('Copied')).toBeInTheDocument();
  });
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProjectSettingsForm } from './project-settings-form';

describe('ProjectSettingsForm', () => {
  it('submits project name and allowed origins as an array', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ProjectSettingsForm
        project={{
          id: 'proj_123',
          workspaceId: 'ws_123',
          name: 'Marketing Site',
          environment: 'live',
          publicKey: 'pk_live_123',
          allowedOrigins: ['https://example.com'],
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T00:00:00.000Z',
        }}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.clear(screen.getByLabelText('Project name'));
    await userEvent.type(screen.getByLabelText('Project name'), 'Checkout Flow');
    await userEvent.clear(screen.getByLabelText('Allowed origins'));
    await userEvent.type(screen.getByLabelText('Allowed origins'), 'https://example.com\\nhttps://app.example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Save project settings' }));

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Checkout Flow',
      allowedOrigins: ['https://example.com', 'https://app.example.com'],
    });
  });
});
```

- [x] **Step 2: Run tests and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/install-snippet-card.test.tsx src/components/dashboard/project-settings-form.test.tsx
```

Expected: FAIL because the components do not exist.

- [x] **Step 3: Implement settings form and install snippet**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet-card.tsx`:

```tsx
'use client';

import { useMemo, useState } from 'react';

type Props = {
  publicKey: string;
  cdnUrl: string;
};

export function InstallSnippetCard({ publicKey, cdnUrl }: Props) {
  const [copied, setCopied] = useState(false);
  const snippet = useMemo(
    () => `<script src="${cdnUrl}" data-project-key="${publicKey}" async></script>`,
    [cdnUrl, publicKey],
  );

  async function copySnippet() {
    await navigator.clipboard.writeText(snippet);
    setCopied(true);
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-base font-semibold">Install snippet</h2>
        <button
          className="h-9 rounded-md bg-slate-950 px-3 text-sm font-medium text-white"
          onClick={copySnippet}
          type="button"
        >
          Copy install snippet
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto rounded-md bg-slate-950 p-3 text-sm text-white">
        <code>{snippet}</code>
      </pre>
      {copied ? <p className="mt-2 text-sm font-medium text-emerald-700">Copied</p> : null}
    </section>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-settings-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { DashboardProject } from '@dropsign/api-client';

type Props = {
  project: DashboardProject;
  onSubmit: (input: { name: string; allowedOrigins: string[] }) => Promise<void>;
};

export function ProjectSettingsForm({ project, onSubmit }: Props) {
  const [name, setName] = useState(project.name);
  const [allowedOrigins, setAllowedOrigins] = useState(project.allowedOrigins.join('\n'));
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit({
      name,
      allowedOrigins: allowedOrigins
        .split('\n')
        .map((origin) => origin.trim())
        .filter(Boolean),
    });
    setSaved(true);
  }

  return (
    <form className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4" onSubmit={submit}>
      <label className="grid gap-1 text-sm font-medium">
        Project name
        <input
          className="h-10 rounded-md border border-slate-300 px-3"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      <label className="grid gap-1 text-sm font-medium">
        Allowed origins
        <textarea
          className="min-h-24 rounded-md border border-slate-300 p-3"
          value={allowedOrigins}
          onChange={(event) => setAllowedOrigins(event.target.value)}
        />
      </label>
      <button className="h-10 w-fit rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">
        Save project settings
      </button>
      {saved ? <p className="text-sm font-medium text-emerald-700">Project settings saved</p> : null}
    </form>
  );
}
```

- [x] **Step 4: Implement project settings routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/layout.tsx`:

```tsx
export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  return children;
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/settings/page.tsx`:

```tsx
import { getDashboardProject, updateDashboardProject } from '@dropsign/api-client';
import { InstallSnippetCard } from '@/components/dashboard/install-snippet-card';
import { ProjectSettingsForm } from '@/components/dashboard/project-settings-form';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function ProjectSettingsPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await requireDashboardSession();
  const project = await getDashboardProject(params.projectId, session.accessToken);

  async function saveProject(input: { name: string; allowedOrigins: string[] }) {
    'use server';
    const serverSession = await requireDashboardSession();
    await updateDashboardProject(params.projectId, serverSession.accessToken, input);
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Project settings</h1>
        <p className="mt-1 text-sm text-slate-600">Manage origins and installation details.</p>
      </div>
      <ProjectSettingsForm project={project} onSubmit={saveProject} />
      <InstallSnippetCard
        publicKey={project.publicKey}
        cdnUrl={process.env.NEXT_PUBLIC_DROPSIGN_WIDGET_CDN_URL ?? 'https://cdn.dropsign.com/widget.js'}
      />
    </section>
  );
}
```

- [x] **Step 5: Run tests and verify they pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/install-snippet-card.test.tsx src/components/dashboard/project-settings-form.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit project settings**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/layout.tsx' 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/settings/page.tsx' apps/web/src/components/dashboard/install-snippet-card.tsx apps/web/src/components/dashboard/project-settings-form.tsx apps/web/src/components/dashboard/install-snippet-card.test.tsx apps/web/src/components/dashboard/project-settings-form.test.tsx
git commit -m "feat: add project settings dashboard"
```

Expected: commit succeeds.

## Task 5: Widget Visual Settings And Page Targeting Forms

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/widget/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.test.tsx`

- [x] **Step 1: Write the failing widget form test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.test.tsx`:

```tsx
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { WidgetConfigForm } from './widget-config-form';

describe('WidgetConfigForm', () => {
  it('saves visual settings and page targeting rules', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <WidgetConfigForm
        config={{
          projectId: 'proj_123',
          enabled: true,
          buttonLabel: 'Sign document',
          buttonColor: '#14532d',
          position: 'bottom-right',
          mobilePosition: 'bottom',
          triggerSelector: '[data-dropsign-trigger]',
          pageTargets: [
            {
              id: 'target_123',
              host: 'example.com',
              pathPattern: '/pricing',
              queryContains: 'plan=pro',
              enabled: true,
            },
          ],
        }}
        onSubmit={onSubmit}
      />,
    );

    await userEvent.clear(screen.getByLabelText('Button label'));
    await userEvent.type(screen.getByLabelText('Button label'), 'Approve quote');
    await userEvent.selectOptions(screen.getByLabelText('Desktop position'), 'bottom-left');
    await userEvent.click(screen.getByRole('button', { name: 'Add page target' }));

    const rows = screen.getAllByRole('group', { name: /Page target/ });
    await userEvent.type(within(rows[1]).getByLabelText('Host'), 'app.example.com');
    await userEvent.type(within(rows[1]).getByLabelText('Path pattern'), '/checkout');
    await userEvent.type(within(rows[1]).getByLabelText('Query contains'), 'step=signature');
    await userEvent.click(screen.getByRole('button', { name: 'Save widget settings' }));

    expect(onSubmit).toHaveBeenCalledWith({
      enabled: true,
      buttonLabel: 'Approve quote',
      buttonColor: '#14532d',
      position: 'bottom-left',
      mobilePosition: 'bottom',
      triggerSelector: '[data-dropsign-trigger]',
      pageTargets: [
        {
          id: 'target_123',
          host: 'example.com',
          pathPattern: '/pricing',
          queryContains: 'plan=pro',
          enabled: true,
        },
        expect.objectContaining({
          host: 'app.example.com',
          pathPattern: '/checkout',
          queryContains: 'step=signature',
          enabled: true,
        }),
      ],
    });
  });
});
```

- [x] **Step 2: Run the widget form test and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/widget-config-form.test.tsx
```

Expected: FAIL because `WidgetConfigForm` does not exist.

- [x] **Step 3: Implement the widget configuration form**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-config-form.tsx`:

```tsx
'use client';

import { useState } from 'react';
import type { WidgetConfig } from '@dropsign/api-client';

type WidgetConfigInput = Omit<WidgetConfig, 'projectId'>;

type Props = {
  config: WidgetConfig;
  onSubmit: (input: WidgetConfigInput) => Promise<void>;
};

function createTarget() {
  return {
    id: `target_${crypto.randomUUID()}`,
    host: '',
    pathPattern: '',
    queryContains: '',
    enabled: true,
  };
}

export function WidgetConfigForm({ config, onSubmit }: Props) {
  const [form, setForm] = useState<WidgetConfigInput>({
    enabled: config.enabled,
    buttonLabel: config.buttonLabel,
    buttonColor: config.buttonColor,
    position: config.position,
    mobilePosition: config.mobilePosition,
    triggerSelector: config.triggerSelector,
    pageTargets: config.pageTargets,
  });
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await onSubmit(form);
    setSaved(true);
  }

  return (
    <form className="grid gap-5 rounded-lg border border-slate-200 bg-white p-4" onSubmit={submit}>
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          checked={form.enabled}
          onChange={(event) => setForm({ ...form, enabled: event.target.checked })}
          type="checkbox"
        />
        Widget enabled
      </label>
      <div className="grid grid-cols-2 gap-4">
        <label className="grid gap-1 text-sm font-medium">
          Button label
          <input
            className="h-10 rounded-md border border-slate-300 px-3"
            value={form.buttonLabel}
            onChange={(event) => setForm({ ...form, buttonLabel: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Button color
          <input
            className="h-10 rounded-md border border-slate-300 px-3"
            value={form.buttonColor}
            onChange={(event) => setForm({ ...form, buttonColor: event.target.value })}
          />
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Desktop position
          <select
            className="h-10 rounded-md border border-slate-300 px-3"
            value={form.position}
            onChange={(event) =>
              setForm({ ...form, position: event.target.value as WidgetConfigInput['position'] })
            }
          >
            <option value="bottom-right">Bottom right</option>
            <option value="bottom-left">Bottom left</option>
            <option value="top-right">Top right</option>
            <option value="top-left">Top left</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium">
          Mobile position
          <select
            className="h-10 rounded-md border border-slate-300 px-3"
            value={form.mobilePosition}
            onChange={(event) =>
              setForm({
                ...form,
                mobilePosition: event.target.value as WidgetConfigInput['mobilePosition'],
              })
            }
          >
            <option value="bottom">Bottom</option>
            <option value="top">Top</option>
          </select>
        </label>
      </div>
      <label className="grid gap-1 text-sm font-medium">
        Trigger selector
        <input
          className="h-10 rounded-md border border-slate-300 px-3"
          value={form.triggerSelector}
          onChange={(event) => setForm({ ...form, triggerSelector: event.target.value })}
        />
      </label>

      <section className="grid gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold">Page targeting</h2>
          <button
            className="h-9 rounded-md border border-slate-300 px-3 text-sm font-medium"
            onClick={() => setForm({ ...form, pageTargets: [...form.pageTargets, createTarget()] })}
            type="button"
          >
            Add page target
          </button>
        </div>
        {form.pageTargets.map((target, index) => (
          <fieldset
            aria-label={`Page target ${index + 1}`}
            className="grid grid-cols-4 gap-3 rounded-md border border-slate-200 p-3"
            key={target.id}
          >
            <label className="grid gap-1 text-sm font-medium">
              Host
              <input
                className="h-10 rounded-md border border-slate-300 px-3"
                value={target.host}
                onChange={(event) => {
                  const pageTargets = [...form.pageTargets];
                  pageTargets[index] = { ...target, host: event.target.value };
                  setForm({ ...form, pageTargets });
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Path pattern
              <input
                className="h-10 rounded-md border border-slate-300 px-3"
                value={target.pathPattern}
                onChange={(event) => {
                  const pageTargets = [...form.pageTargets];
                  pageTargets[index] = { ...target, pathPattern: event.target.value };
                  setForm({ ...form, pageTargets });
                }}
              />
            </label>
            <label className="grid gap-1 text-sm font-medium">
              Query contains
              <input
                className="h-10 rounded-md border border-slate-300 px-3"
                value={target.queryContains}
                onChange={(event) => {
                  const pageTargets = [...form.pageTargets];
                  pageTargets[index] = { ...target, queryContains: event.target.value };
                  setForm({ ...form, pageTargets });
                }}
              />
            </label>
            <label className="flex items-center gap-2 pt-6 text-sm font-medium">
              <input
                checked={target.enabled}
                onChange={(event) => {
                  const pageTargets = [...form.pageTargets];
                  pageTargets[index] = { ...target, enabled: event.target.checked };
                  setForm({ ...form, pageTargets });
                }}
                type="checkbox"
              />
              Enabled
            </label>
          </fieldset>
        ))}
      </section>

      <button className="h-10 w-fit rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white">
        Save widget settings
      </button>
      {saved ? <p className="text-sm font-medium text-emerald-700">Widget settings saved</p> : null}
    </form>
  );
}
```

- [x] **Step 4: Implement the widget settings page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/widget/page.tsx`:

```tsx
import { getWidgetConfig, updateWidgetConfig } from '@dropsign/api-client';
import { WidgetConfigForm } from '@/components/dashboard/widget-config-form';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function WidgetPage({ params }: { params: { projectId: string } }) {
  const session = await requireDashboardSession();
  const config = await getWidgetConfig(params.projectId, session.accessToken);

  async function saveWidgetConfig(input: Parameters<typeof updateWidgetConfig>[2]) {
    'use server';
    const serverSession = await requireDashboardSession();
    await updateWidgetConfig(params.projectId, serverSession.accessToken, input);
  }

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Widget settings</h1>
        <p className="mt-1 text-sm text-slate-600">
          Configure visual presentation, custom triggers, and page targeting.
        </p>
      </div>
      <WidgetConfigForm config={config} onSubmit={saveWidgetConfig} />
    </section>
  );
}
```

- [x] **Step 5: Run the widget form test and verify it passes**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/widget-config-form.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit widget settings**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/widget/page.tsx' apps/web/src/components/dashboard/widget-config-form.tsx apps/web/src/components/dashboard/widget-config-form.test.tsx
git commit -m "feat: add widget settings dashboard"
```

Expected: commit succeeds.

## Task 6: Signature Records List And Detail

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/[recordId]/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.test.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.test.tsx`

- [x] **Step 1: Write failing signature component tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignatureRecordsTable } from './signature-records-table';

describe('SignatureRecordsTable', () => {
  it('links each signature record to its detail page', () => {
    render(
      <SignatureRecordsTable
        workspaceId="ws_123"
        projectId="proj_123"
        records={[
          {
            id: 'sig_123',
            projectId: 'proj_123',
            signerName: 'Min Kim',
            signerEmail: 'min@example.com',
            source: 'widget',
            status: 'completed',
            documentName: 'Order Form.pdf',
            completedAt: '2026-05-12T03:00:00.000Z',
            createdAt: '2026-05-12T02:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByRole('link', { name: 'Open signature sig_123' })).toHaveAttribute(
      'href',
      '/workspaces/ws_123/projects/proj_123/signatures/sig_123',
    );
    expect(screen.getByText('Min Kim')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
  });
});
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { SignatureRecordDetailView } from './signature-record-detail';

describe('SignatureRecordDetailView', () => {
  it('shows artifact placement, document hash, metadata, and audit timeline', () => {
    render(
      <SignatureRecordDetailView
        record={{
          id: 'sig_123',
          projectId: 'proj_123',
          signerName: 'Min Kim',
          signerEmail: 'min@example.com',
          source: 'widget',
          status: 'completed',
          documentName: 'Order Form.pdf',
          completedAt: '2026-05-12T03:00:00.000Z',
          createdAt: '2026-05-12T02:00:00.000Z',
          artifact: {
            imageUrl: 'https://files.dropsign.com/sig_123.png',
            documentHash: 'sha256:abc123',
            placement: { page: 2, x: 0.12, y: 0.44, width: 0.3, height: 0.12 },
          },
          metadata: { plan: 'pro', externalUserId: 'user_789' },
          auditEvents: [
            {
              id: 'audit_123',
              type: 'signature.completed',
              message: 'Signer completed widget signature',
              createdAt: '2026-05-12T03:00:00.000Z',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('sha256:abc123')).toBeInTheDocument();
    expect(screen.getByText('Page 2')).toBeInTheDocument();
    expect(screen.getByText('plan')).toBeInTheDocument();
    expect(screen.getByText('pro')).toBeInTheDocument();
    expect(screen.getByText('Signer completed widget signature')).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run tests and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/signature-records-table.test.tsx src/components/dashboard/signature-record-detail.test.tsx
```

Expected: FAIL because the signature components do not exist.

- [x] **Step 3: Implement signature list and detail components**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.tsx`:

```tsx
import Link from 'next/link';
import type { SignatureRecord } from '@dropsign/api-client';

type Props = {
  workspaceId: string;
  projectId: string;
  records: SignatureRecord[];
};

export function SignatureRecordsTable({ workspaceId, projectId, records }: Props) {
  return (
    <table className="w-full border-collapse rounded-lg bg-white text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="p-3">Signer</th>
          <th className="p-3">Document</th>
          <th className="p-3">Source</th>
          <th className="p-3">Status</th>
          <th className="p-3">Completed</th>
          <th className="p-3">Open</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record) => (
          <tr className="border-b border-slate-100" key={record.id}>
            <td className="p-3">
              <div className="font-medium">{record.signerName}</div>
              <div className="text-slate-600">{record.signerEmail}</div>
            </td>
            <td className="p-3">{record.documentName}</td>
            <td className="p-3">{record.source}</td>
            <td className="p-3">{record.status}</td>
            <td className="p-3">{record.completedAt ?? 'Not completed'}</td>
            <td className="p-3">
              <Link
                className="font-medium text-emerald-700"
                href={`/workspaces/${workspaceId}/projects/${projectId}/signatures/${record.id}`}
              >
                Open signature {record.id}
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-record-detail.tsx`:

```tsx
import type { SignatureRecordDetail } from '@dropsign/api-client';

export function SignatureRecordDetailView({ record }: { record: SignatureRecordDetail }) {
  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">{record.documentName}</h2>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-600">Signer</dt>
            <dd className="font-medium">{record.signerName}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Email</dt>
            <dd className="font-medium">{record.signerEmail}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Status</dt>
            <dd className="font-medium">{record.status}</dd>
          </div>
          <div>
            <dt className="text-slate-600">Source</dt>
            <dd className="font-medium">{record.source}</dd>
          </div>
        </dl>
      </section>

      {record.artifact ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="text-lg font-semibold">Signature artifact</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-600">Document hash</dt>
              <dd className="font-medium">{record.artifact.documentHash}</dd>
            </div>
            <div>
              <dt className="text-slate-600">Placement</dt>
              <dd className="font-medium">
                Page {record.artifact.placement.page} at {record.artifact.placement.x},{' '}
                {record.artifact.placement.y}
              </dd>
            </div>
          </dl>
        </section>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Metadata</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          {Object.entries(record.metadata).map(([key, value]) => (
            <div className="grid grid-cols-[200px_1fr] gap-3" key={key}>
              <dt className="text-slate-600">{key}</dt>
              <dd className="font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-semibold">Audit timeline</h2>
        <ol className="mt-4 grid gap-3 text-sm">
          {record.auditEvents.map((event) => (
            <li className="rounded-md border border-slate-200 p-3" key={event.id}>
              <div className="font-medium">{event.message}</div>
              <div className="text-slate-600">{event.type}</div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
```

- [x] **Step 4: Implement signature routes**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/page.tsx`:

```tsx
import { getSignatureRecords } from '@dropsign/api-client';
import { SignatureRecordsTable } from '@/components/dashboard/signature-records-table';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function SignaturesPage({
  params,
}: {
  params: { workspaceId: string; projectId: string };
}) {
  const session = await requireDashboardSession();
  const records = await getSignatureRecords(params.projectId, session.accessToken);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Signature records</h1>
        <p className="mt-1 text-sm text-slate-600">
          Inspect widget, link, API, and template signature events.
        </p>
      </div>
      <SignatureRecordsTable
        workspaceId={params.workspaceId}
        projectId={params.projectId}
        records={records}
      />
    </section>
  );
}
```

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/[recordId]/page.tsx`:

```tsx
import { getSignatureRecordDetail } from '@dropsign/api-client';
import { SignatureRecordDetailView } from '@/components/dashboard/signature-record-detail';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function SignatureDetailPage({
  params,
}: {
  params: { projectId: string; recordId: string };
}) {
  const session = await requireDashboardSession();
  const record = await getSignatureRecordDetail(
    params.projectId,
    params.recordId,
    session.accessToken,
  );

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Signature {record.id}</h1>
        <p className="mt-1 text-sm text-slate-600">Record details, artifact data, and audit events.</p>
      </div>
      <SignatureRecordDetailView record={record} />
    </section>
  );
}
```

- [x] **Step 5: Run signature tests and verify they pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/signature-records-table.test.tsx src/components/dashboard/signature-record-detail.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit signature records UI**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/page.tsx' 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/signatures/[recordId]/page.tsx' apps/web/src/components/dashboard/signature-records-table.tsx apps/web/src/components/dashboard/signature-record-detail.tsx apps/web/src/components/dashboard/signature-records-table.test.tsx apps/web/src/components/dashboard/signature-record-detail.test.tsx
git commit -m "feat: add signature records dashboard"
```

Expected: commit succeeds.

## Task 7: Webhook Delivery Logs Read-Only Preview

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/webhooks/deliveries/page.tsx`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.tsx`
- Test: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.test.tsx`

- [x] **Step 1: Write the failing webhook delivery table test**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WebhookDeliveryTable } from './webhook-delivery-table';

describe('WebhookDeliveryTable', () => {
  it('shows read-only delivery status, response excerpt, attempts, and retry time', () => {
    render(
      <WebhookDeliveryTable
        deliveries={[
          {
            id: 'whd_123',
            endpointUrl: 'https://example.com/webhooks/dropsign',
            eventType: 'signature.completed',
            status: 'retrying',
            responseStatus: 500,
            responseExcerpt: 'Internal server error',
            attemptCount: 2,
            nextAttemptAt: '2026-05-12T04:00:00.000Z',
            createdAt: '2026-05-12T03:00:00.000Z',
          },
        ]}
      />,
    );

    expect(screen.getByText('signature.completed')).toBeInTheDocument();
    expect(screen.getByText('retrying')).toBeInTheDocument();
    expect(screen.getByText('500')).toBeInTheDocument();
    expect(screen.getByText('Internal server error')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /resend/i })).not.toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run the webhook delivery test and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/webhook-delivery-table.test.tsx
```

Expected: FAIL because the component does not exist.

- [x] **Step 3: Implement webhook delivery preview table**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-table.tsx`:

```tsx
import type { WebhookDeliveryPreview } from '@dropsign/api-client';

export function WebhookDeliveryTable({
  deliveries,
}: {
  deliveries: WebhookDeliveryPreview[];
}) {
  return (
    <table className="w-full border-collapse rounded-lg bg-white text-left text-sm">
      <thead>
        <tr className="border-b border-slate-200">
          <th className="p-3">Event</th>
          <th className="p-3">Endpoint</th>
          <th className="p-3">Status</th>
          <th className="p-3">Response</th>
          <th className="p-3">Attempts</th>
          <th className="p-3">Next attempt</th>
        </tr>
      </thead>
      <tbody>
        {deliveries.map((delivery) => (
          <tr className="border-b border-slate-100" key={delivery.id}>
            <td className="p-3">{delivery.eventType}</td>
            <td className="p-3">{delivery.endpointUrl}</td>
            <td className="p-3">{delivery.status}</td>
            <td className="p-3">
              <div>{delivery.responseStatus ?? 'No response'}</div>
              <div className="text-slate-600">{delivery.responseExcerpt}</div>
            </td>
            <td className="p-3">{delivery.attemptCount}</td>
            <td className="p-3">{delivery.nextAttemptAt ?? 'No retry scheduled'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [x] **Step 4: Implement webhook delivery page**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/webhooks/deliveries/page.tsx`:

```tsx
import { getWebhookDeliveries } from '@dropsign/api-client';
import { WebhookDeliveryTable } from '@/components/dashboard/webhook-delivery-table';
import { requireDashboardSession } from '@/lib/auth/session';

export default async function WebhookDeliveriesPage({
  params,
}: {
  params: { projectId: string };
}) {
  const session = await requireDashboardSession();
  const deliveries = await getWebhookDeliveries(params.projectId, session.accessToken);

  return (
    <section className="grid gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Webhook deliveries</h1>
        <p className="mt-1 text-sm text-slate-600">
          Read-only preview of event delivery attempts and response excerpts.
        </p>
      </div>
      <WebhookDeliveryTable deliveries={deliveries} />
    </section>
  );
}
```

- [x] **Step 5: Run webhook delivery test and verify it passes**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard/webhook-delivery-table.test.tsx
```

Expected: PASS.

- [x] **Step 6: Commit webhook delivery preview**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add 'apps/web/src/app/(dashboard)/workspaces/[workspaceId]/projects/[projectId]/webhooks/deliveries/page.tsx' apps/web/src/components/dashboard/webhook-delivery-table.tsx apps/web/src/components/dashboard/webhook-delivery-table.test.tsx
git commit -m "feat: add webhook delivery preview"
```

Expected: commit succeeds.

## Task 8: MSW Fixtures And Playwright Dashboard Flow

**Files:**
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/msw/dashboard-handlers.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/setup.ts`
- Create: `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/dashboard-foundation.spec.ts`
- Modify: `/Users/minjun/Documents/dropsign-cloud/apps/web/playwright.config.ts`

- [x] **Step 1: Add failing Playwright flow**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/dashboard-foundation.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

const session = Buffer.from(
  JSON.stringify({
    user: { id: 'user_123', name: 'Min Kim', email: 'min@example.com' },
    accessToken: 'token_123',
    activeWorkspace: { id: 'ws_123', name: 'Acme', slug: 'acme', role: 'admin' },
  }),
).toString('base64url');

test.beforeEach(async ({ context, page }) => {
  await context.addCookies([
    {
      name: 'dropsign_session',
      value: session,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);

  await page.route('http://localhost:3001/v1/dashboard/workspaces', async (route) => {
    await route.fulfill({
      json: [{ id: 'ws_123', name: 'Acme', slug: 'acme', role: 'admin' }],
    });
  });
  await page.route('http://localhost:3001/v1/dashboard/workspaces/ws_123/projects', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'proj_123',
          workspaceId: 'ws_123',
          name: 'Marketing Site',
          environment: 'live',
          publicKey: 'pk_live_123',
          allowedOrigins: ['https://example.com'],
          createdAt: '2026-05-12T00:00:00.000Z',
          updatedAt: '2026-05-12T01:00:00.000Z',
        },
      ],
    });
  });
  await page.route('http://localhost:3001/v1/dashboard/projects/proj_123', async (route) => {
    await route.fulfill({
      json: {
        id: 'proj_123',
        workspaceId: 'ws_123',
        name: 'Marketing Site',
        environment: 'live',
        publicKey: 'pk_live_123',
        allowedOrigins: ['https://example.com'],
        createdAt: '2026-05-12T00:00:00.000Z',
        updatedAt: '2026-05-12T01:00:00.000Z',
      },
    });
  });
  await page.route('http://localhost:3001/v1/dashboard/projects/proj_123/widget-config', async (route) => {
    if (route.request().method() === 'PUT') {
      await route.fulfill({
        json: {
          projectId: 'proj_123',
          enabled: true,
          buttonLabel: 'Approve quote',
          buttonColor: '#14532d',
          position: 'bottom-right',
          mobilePosition: 'bottom',
          triggerSelector: '[data-dropsign-trigger]',
          pageTargets: [],
        },
      });
      return;
    }
    await route.fulfill({
      json: {
        projectId: 'proj_123',
        enabled: true,
        buttonLabel: 'Sign document',
        buttonColor: '#14532d',
        position: 'bottom-right',
        mobilePosition: 'bottom',
        triggerSelector: '[data-dropsign-trigger]',
        pageTargets: [],
      },
    });
  });
  await page.route('http://localhost:3001/v1/dashboard/projects/proj_123/signature-records', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'sig_123',
          projectId: 'proj_123',
          signerName: 'Min Kim',
          signerEmail: 'min@example.com',
          source: 'widget',
          status: 'completed',
          documentName: 'Order Form.pdf',
          completedAt: '2026-05-12T03:00:00.000Z',
          createdAt: '2026-05-12T02:00:00.000Z',
        },
      ],
    });
  });
  await page.route('http://localhost:3001/v1/dashboard/projects/proj_123/webhook-deliveries', async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'whd_123',
          endpointUrl: 'https://example.com/webhooks/dropsign',
          eventType: 'signature.completed',
          status: 'delivered',
          responseStatus: 200,
          responseExcerpt: 'ok',
          attemptCount: 1,
          nextAttemptAt: null,
          createdAt: '2026-05-12T03:00:00.000Z',
        },
      ],
    });
  });
});

test('admin configures widget, copies install snippet, and inspects records', async ({ page }) => {
  await page.goto('/workspaces/ws_123/projects/proj_123/settings');

  await expect(page.getByRole('heading', { name: 'Project settings' })).toBeVisible();
  await expect(page.getByText('data-project-key="pk_live_123"')).toBeVisible();

  await page.getByRole('link', { name: 'Widget' }).click();
  await page.getByLabel('Button label').fill('Approve quote');
  await page.getByRole('button', { name: 'Save widget settings' }).click();
  await expect(page.getByText('Widget settings saved')).toBeVisible();

  await page.getByRole('link', { name: 'Signatures' }).click();
  await expect(page.getByText('Order Form.pdf')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Open signature sig_123' })).toBeVisible();

  await page.getByRole('link', { name: 'Webhook deliveries' }).click();
  await expect(page.getByText('signature.completed')).toBeVisible();
  await expect(page.getByText('https://example.com/webhooks/dropsign')).toBeVisible();
});
```

- [x] **Step 2: Run Playwright and verify the expected failure**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web exec playwright test e2e/dashboard-foundation.spec.ts
```

Expected: FAIL because dashboard routes, Playwright config, or app server wiring is incomplete before the preceding tasks are merged.

- [x] **Step 3: Add MSW dashboard handlers for component tests**

Create `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/msw/dashboard-handlers.ts`:

```ts
import { http, HttpResponse } from 'msw';

export const dashboardHandlers = [
  http.get('http://localhost:3001/v1/dashboard/workspaces', () =>
    HttpResponse.json([{ id: 'ws_123', name: 'Acme', slug: 'acme', role: 'admin' }]),
  ),
  http.get('http://localhost:3001/v1/dashboard/workspaces/ws_123/projects', () =>
    HttpResponse.json([
      {
        id: 'proj_123',
        workspaceId: 'ws_123',
        name: 'Marketing Site',
        environment: 'live',
        publicKey: 'pk_live_123',
        allowedOrigins: ['https://example.com'],
        createdAt: '2026-05-12T00:00:00.000Z',
        updatedAt: '2026-05-12T01:00:00.000Z',
      },
    ]),
  ),
];
```

Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import { setupServer } from 'msw/node';
import { dashboardHandlers } from './msw/dashboard-handlers';

export const server = setupServer(...dashboardHandlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

- [x] **Step 4: Configure Playwright web server**

Modify `/Users/minjun/Documents/dropsign-cloud/apps/web/playwright.config.ts` so it contains:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
```

- [x] **Step 5: Run component and Playwright tests and verify they pass**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web test -- src/components/dashboard src/lib/auth src/middleware.test.ts
pnpm --filter @dropsign/web exec playwright test e2e/dashboard-foundation.spec.ts
```

Expected: PASS for all dashboard component tests, auth tests, middleware test, and the dashboard Playwright flow.

- [x] **Step 6: Commit dashboard test harness**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git add apps/web/src/test/msw/dashboard-handlers.ts apps/web/src/test/setup.ts apps/web/e2e/dashboard-foundation.spec.ts apps/web/playwright.config.ts
git commit -m "test: cover dashboard foundation flow"
```

Expected: commit succeeds.

## Task 9: Final Verification And Phase Commit Boundaries

**Files:**
- Verify:
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/layout.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/projects/page.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/projects/[projectId]/settings/page.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/projects/[projectId]/signatures/page.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/app/(dashboard)/projects/[projectId]/signatures/[signatureId]/page.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/workspace-switcher.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/project-switcher.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/widget-settings-form.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/install-snippet.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/signature-records-table.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/components/dashboard/webhook-delivery-preview.tsx`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/api/dashboard.ts`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/lib/auth/require-role.ts`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/src/middleware.ts`
  - `/Users/minjun/Documents/dropsign-cloud/apps/web/e2e/dashboard-foundation.spec.ts`

- [x] **Step 1: Check formatting**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm format
```

Expected: command exits 0 and formats only files changed by this phase.

- [x] **Step 2: Run lint**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm lint
```

Expected: command exits 0 with no ESLint errors or warnings.

- [x] **Step 3: Run typecheck**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm typecheck
```

Expected: command exits 0 with no TypeScript errors.

- [x] **Step 4: Run unit and component tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm test
```

Expected: command exits 0 and includes passing tests for API client contracts, role guards, dashboard forms, signature records, and webhook delivery previews.

- [ ] **Step 5: Run dashboard Playwright tests**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm --filter @dropsign/web exec playwright test e2e/dashboard-foundation.spec.ts
```

Expected: command exits 0 with the `admin configures widget, copies install snippet, and inspects records` test passing in Chromium.

- [x] **Step 6: Build the web app**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
pnpm build
```

Expected: command exits 0 and Next.js builds the dashboard routes without server/client boundary errors.

- [x] **Step 7: Inspect git status**

Run:

```bash
cd /Users/minjun/Documents/dropsign-cloud
git status --short
```

Expected: no uncommitted files from Phase 03 remain. If formatting changed committed files, commit them:

```bash
git add apps/web packages/api-client
git commit -m "chore: format dashboard foundation"
```

- [x] **Step 8: Confirm commit boundaries**

Expected Phase 03 commits:

```text
feat: add dashboard api client
feat: guard dashboard routes by role
feat: add dashboard shell
feat: add project settings dashboard
feat: add widget settings dashboard
feat: add signature records dashboard
feat: add webhook delivery preview
test: cover dashboard foundation flow
```

If Step 7 produced a formatting commit, include:

```text
chore: format dashboard foundation
```

## Acceptance Checklist

- [x] Authenticated users can access the dashboard shell, and unauthenticated users are redirected to `/sign-in`.
- [x] Viewer role can inspect signature records and webhook deliveries, but cannot access project settings or widget settings.
- [x] Workspace and project switchers navigate to the correct workspace/project routes.
- [x] Project settings form saves project name and allowed origins.
- [x] Install snippet card displays and copies a script tag containing the project public key.
- [x] Widget form saves button label, color, desktop position, mobile position, trigger selector, and page targeting rules.
- [x] Signature records list renders source, status, signer, document, completion state, and detail links.
- [x] Signature detail renders artifact placement, document hash, metadata, and audit timeline.
- [x] Webhook delivery page renders read-only status, response excerpt, attempt count, and retry timestamp with no resend action.
- [ ] Component tests, API client tests, route guard tests, Playwright flow, lint, typecheck, and build pass.
