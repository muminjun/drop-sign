# DropSign v0.3 — Trackpad Fix & `afterConfirm` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix MacBook trackpad drawing in the signature canvas and add an `afterConfirm` option so the signed result can be persisted in the DOM, captured as PNG, or both.

**Architecture:** Two independent changes — a one-line CSS fix for trackpad, and a new `afterConfirm` branching system in `DropSign.ts` that calls either `persistResult()` (new), `captureResult()` (existing), or both, returning a discriminated union result type. Position lifecycle management (restoring `targetEl.style.position`) is moved from `destroy()` into `removePersisted()` when persist mode is active.

**Tech Stack:** TypeScript, Vitest (happy-dom), html-to-image (mocked in tests), signature_pad

---

## File Map

| File | Change |
|---|---|
| `src/signature-pad.ts` | Add `canvas.style.touchAction = 'none'` after class assignment |
| `src/types.ts` | Add `afterConfirm` to `DropSignOptions`; replace `DropSignResult` with discriminated union |
| `src/capture.ts` | Export `dataUrlToBlob`; add `persistResult()` |
| `src/DropSign.ts` | Read `afterConfirm`; branch confirm handler; fix `destroy()` lifecycle |
| `src/DropSign.test.ts` | Add `persistResult` unit tests; add `afterConfirm` mode tests |

---

## Task 1: Fix trackpad — inline `touch-action`

**Files:**
- Modify: `src/signature-pad.ts:33`

- [ ] **Step 1: Add inline style after canvas class assignment**

In `src/signature-pad.ts`, after `canvas.className = 'ds-canvas'` (line 33), add:

```ts
const canvas = document.createElement('canvas') as HTMLCanvasElement;
canvas.className = 'ds-canvas';
canvas.style.touchAction = 'none';   // ← add this line
canvas.width = 480;
canvas.height = 200;
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/signature-pad.ts
git commit -m "fix: set touch-action:none inline on canvas for trackpad support"
```

---

## Task 2: Update types — `afterConfirm` option + discriminated result union

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Replace `DropSignResult` and update `DropSignOptions`**

Open `src/types.ts`. Replace the existing `DropSignResult` interface and update `DropSignOptions` so the file reads:

```ts
export type DropSignTarget = string | HTMLElement;

export type DropSignTrigger =
  | {
      type?: 'floating';
      positionAnchor?: 'target' | 'viewport';
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
      label?: string;
      pressEffect?: boolean;
    }
  | {
      type: 'inline';
      container: string | HTMLElement;
      label?: string;
      variant?: 'button' | 'text';
      pressEffect?: boolean;
    }
  | {
      type: 'custom';
      element: string | HTMLElement;
    };

export interface DropSignMessages {
  sign?: string;
  clear?: string;
  cancel?: string;
  useSignature?: string;
  confirm?: string;
  delete?: string;
  signingTitle?: string;
  signingDescription?: string;
}

export interface DropSignSignatureOptions {
  penColor?: string;
  minWidth?: number;
  maxWidth?: number;
  velocityFilterWeight?: number;
}

export interface DropSignOptions {
  target: DropSignTarget;
  buttonText?: string;
  trigger?: DropSignTrigger;
  messages?: DropSignMessages;
  signature?: DropSignSignatureOptions;
  classNamePrefix?: string;
  afterConfirm?: 'persist' | 'capture' | 'both';
  capture?: {
    pixelRatio?: number;
    backgroundColor?: string;
  };
  onComplete?: (result: DropSignResult) => void | Promise<void>;
  onCancel?: () => void;
  onError?: (error: unknown) => void;
}

export interface SignaturePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  targetWidth: number;
  targetHeight: number;
  scrollX: number;
  scrollY: number;
}

interface DropSignResultBase {
  signatureBlob: Blob;
  signatureDataUrl: string;
  placement: SignaturePlacement;
}

export interface PersistResult extends DropSignResultBase {
  afterConfirm: 'persist';
  persistedEl: HTMLElement;
  removePersisted: () => void;
}

export interface CaptureResult extends DropSignResultBase {
  afterConfirm: 'capture';
  imageBlob: Blob;
}

export interface BothResult extends DropSignResultBase {
  afterConfirm: 'both';
  imageBlob: Blob;
  persistedEl: HTMLElement;
  removePersisted: () => void;
}

export type DropSignResult = PersistResult | CaptureResult | BothResult;

export interface DropSignWidget {
  destroy(): void;
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: errors in `src/DropSign.ts` and `src/capture.ts` because they still reference the old `DropSignResult` shape — that's fine, we fix those in Tasks 3 and 4.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat(types): add afterConfirm option and discriminated DropSignResult union"
```

---

## Task 3: Add `persistResult()` and export `dataUrlToBlob` in `capture.ts`

**Files:**
- Modify: `src/capture.ts`
- Test: `src/DropSign.test.ts`

- [ ] **Step 1: Write failing tests for `persistResult()`**

In `src/DropSign.test.ts`, add the following `describe` block after the existing `captureResult` describe block (before the final closing brace of the file):

```ts
describe('persistResult', () => {
  const fakeSigDataUrl = 'data:image/png;base64,signature';
  const placement = {
    x: 10,
    y: 20,
    width: 100,
    height: 50,
    targetWidth: 400,
    targetHeight: 300,
    scrollX: 0,
    scrollY: 0,
  };

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => ({
      blob: async () => new Blob(['fake']),
    })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('injects a permanent signature img into targetEl', () => {
    const targetEl = document.createElement('div');
    targetEl.style.position = 'relative';
    document.body.appendChild(targetEl);

    const { persistedEl } = persistResult(targetEl, fakeSigDataUrl, placement);

    expect(targetEl.contains(persistedEl)).toBe(true);
    expect((persistedEl as HTMLImageElement).src).toContain(fakeSigDataUrl);
    expect(persistedEl.style.position).toBe('absolute');
    expect(persistedEl.style.left).toBe('10px');
    expect(persistedEl.style.top).toBe('20px');
    expect(persistedEl.style.width).toBe('100px');
    expect(persistedEl.style.height).toBe('50px');

    targetEl.remove();
  });

  it('removePersisted() removes the img from the DOM', () => {
    const targetEl = document.createElement('div');
    targetEl.style.position = 'relative';
    document.body.appendChild(targetEl);

    const { removePersisted } = persistResult(targetEl, fakeSigDataUrl, placement);
    expect(targetEl.querySelectorAll('img').length).toBe(1);

    removePersisted();

    expect(targetEl.querySelectorAll('img').length).toBe(0);

    targetEl.remove();
  });
});
```

Also add `persistResult` to the import at the top of the test file:

```ts
import { captureResult, persistResult } from './capture.js';
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
pnpm exec vitest run src/DropSign.test.ts
```

Expected: `persistResult` tests FAIL with "persistResult is not a function" or import error.

- [ ] **Step 3: Implement `persistResult()` and export `dataUrlToBlob` in `capture.ts`**

Replace the full content of `src/capture.ts` with:

```ts
import { toPng } from 'html-to-image';
import type { SignaturePlacement } from './types.js';

export async function captureResult(
  targetEl: HTMLElement,
  signatureDataUrl: string,
  placement: SignaturePlacement,
  options?: { pixelRatio?: number; backgroundColor?: string },
): Promise<{ imageBlob: Blob; signatureBlob: Blob; signatureDataUrl: string; placement: SignaturePlacement }> {
  const pixelRatio = options?.pixelRatio ?? window.devicePixelRatio ?? 1;
  const backgroundColor = options?.backgroundColor ?? '#ffffff';

  const computedPos = window.getComputedStyle(targetEl).position;
  const prevInlinePos = targetEl.style.position;
  if (computedPos === 'static') {
    targetEl.style.position = 'relative';
  }

  const sigImg = document.createElement('img');
  sigImg.src = signatureDataUrl;
  sigImg.style.position = 'absolute';
  sigImg.style.left = `${placement.x}px`;
  sigImg.style.top = `${placement.y}px`;
  sigImg.style.width = `${placement.width}px`;
  sigImg.style.height = `${placement.height}px`;
  sigImg.style.pointerEvents = 'none';
  sigImg.style.zIndex = '9999';
  targetEl.appendChild(sigImg);

  let imageDataUrl: string;
  try {
    imageDataUrl = await toPng(targetEl, { pixelRatio, backgroundColor });
  } finally {
    sigImg.remove();
    targetEl.style.position = prevInlinePos;
  }

  const imageBlob = await dataUrlToBlob(imageDataUrl);
  const signatureBlob = await dataUrlToBlob(signatureDataUrl);

  return { imageBlob, signatureBlob, signatureDataUrl, placement };
}

export function persistResult(
  targetEl: HTMLElement,
  signatureDataUrl: string,
  placement: SignaturePlacement,
): { persistedEl: HTMLElement; removePersisted: () => void } {
  const sigImg = document.createElement('img');
  sigImg.src = signatureDataUrl;
  sigImg.style.position = 'absolute';
  sigImg.style.left = `${placement.x}px`;
  sigImg.style.top = `${placement.y}px`;
  sigImg.style.width = `${placement.width}px`;
  sigImg.style.height = `${placement.height}px`;
  sigImg.style.pointerEvents = 'none';
  sigImg.style.zIndex = '9999';
  targetEl.appendChild(sigImg);

  return {
    persistedEl: sigImg,
    removePersisted: () => sigImg.remove(),
  };
}

export async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}
```

Note: `captureResult` return type is now a plain object (not `DropSignResult`) because the discriminant field is added by `DropSign.ts`. The `DropSignResult` import is no longer needed — remove it from the import line.

- [ ] **Step 4: Run tests to confirm they pass**

```bash
pnpm exec vitest run src/DropSign.test.ts
```

Expected: all `persistResult` tests PASS. All existing `captureResult` tests still PASS.

- [ ] **Step 5: Commit**

```bash
git add src/capture.ts src/DropSign.test.ts
git commit -m "feat(capture): add persistResult() and export dataUrlToBlob"
```

---

## Task 4: Update `DropSign.ts` — `afterConfirm` branching and lifecycle fix

**Files:**
- Modify: `src/DropSign.ts`

- [ ] **Step 1: Rewrite `DropSign.ts`**

Replace the full content of `src/DropSign.ts` with:

```ts
import type {
  DropSignOptions,
  DropSignTarget,
  DropSignWidget,
  DropSignTrigger,
  DropSignMessages,
  PersistResult,
  CaptureResult,
  BothResult,
} from './types.js';
import { injectStyles, removeStyles, createOverlayContainer } from './overlay.js';
import { createSignaturePadModal } from './signature-pad.js';
import { createPlacementBox } from './placement.js';
import { captureResult, persistResult, dataUrlToBlob } from './capture.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';
import { createFloatingTrigger, createInlineTrigger, attachCustomTrigger } from './trigger.js';
import type { TriggerHandle } from './trigger.js';

function resolveTarget(target: DropSignTarget): HTMLElement {
  if (typeof target === 'string') {
    const el = document.querySelector(target);
    if (!el) throw new Error(`[drop-sign] Target element not found: "${target}"`);
    if (!(el instanceof HTMLElement))
      throw new Error(`[drop-sign] Target is not an HTMLElement: "${target}"`);
    return el;
  }
  return target;
}

function resolveTriggerLabel(
  trigger: DropSignTrigger | undefined,
  buttonText: string | undefined,
  msgs: Required<DropSignMessages>,
): string {
  if (trigger && 'label' in trigger && trigger.label) return trigger.label;
  if (buttonText !== undefined) return buttonText;
  return msgs.sign;
}

export class DropSign {
  static init(options: DropSignOptions): DropSignWidget {
    const {
      target,
      buttonText,
      trigger,
      messages,
      signature,
      onComplete,
      onCancel,
      onError,
      capture: captureOptions,
      afterConfirm = 'persist',
    } = options;

    let targetEl: HTMLElement;
    try {
      targetEl = resolveTarget(target);
    } catch (err) {
      onError?.(err);
      return { destroy: () => undefined };
    }

    injectStyles();

    const msgs = mergeMessages(messages);
    const sigOpts = mergeSignatureOptions(signature);
    const label = resolveTriggerLabel(trigger, buttonText, msgs);

    const existingPos = window.getComputedStyle(targetEl).position;
    const prevInlinePos = targetEl.style.position;
    if (existingPos === 'static') targetEl.style.position = 'relative';

    let overlayContainer: ReturnType<typeof createOverlayContainer> | null = null;
    let placementBox: ReturnType<typeof createPlacementBox> | null = null;
    let currentSigDataUrl = '';
    let persistedActive = false;

    const modal = createSignaturePadModal(
      (dataUrl) => {
        currentSigDataUrl = dataUrl;
        showPlacement(dataUrl);
      },
      () => {
        onCancel?.();
      },
      msgs,
      sigOpts,
    );

    let triggerHandle: TriggerHandle;
    try {
      if (!trigger || !trigger.type || trigger.type === 'floating') {
        triggerHandle = createFloatingTrigger(
          trigger ?? {},
          label,
          () => modal.open(),
          targetEl,
        );
      } else if (trigger.type === 'inline') {
        triggerHandle = createInlineTrigger(trigger, label, () => modal.open());
      } else if (trigger.type === 'custom') {
        triggerHandle = attachCustomTrigger(trigger, () => modal.open());
      } else {
        throw new Error(`[drop-sign] Unknown trigger type`);
      }
    } catch (err) {
      modal.destroy();
      removeStyles();
      if (existingPos === 'static') targetEl.style.position = prevInlinePos;
      onError?.(err);
      return { destroy: () => undefined };
    }

    function showPlacement(dataUrl: string) {
      overlayContainer?.destroy();
      overlayContainer = createOverlayContainer(targetEl);

      function cleanup() {
        placementBox?.destroy();
        placementBox = null;
        overlayContainer?.destroy();
        overlayContainer = null;
      }

      placementBox = createPlacementBox(
        dataUrl,
        targetEl,
        async () => {
          if (!placementBox) return;
          const placement = placementBox.getPlacement();
          if (overlayContainer) overlayContainer.el.style.display = 'none';
          try {
            if (afterConfirm === 'persist') {
              const { persistedEl, removePersisted: removeImg } = persistResult(
                targetEl,
                currentSigDataUrl,
                placement,
              );
              persistedActive = true;
              const signatureBlob = await dataUrlToBlob(currentSigDataUrl);
              const wrappedRemove = () => {
                removeImg();
                persistedActive = false;
                if (existingPos === 'static') targetEl.style.position = prevInlinePos;
              };
              cleanup();
              const result: PersistResult = {
                afterConfirm: 'persist',
                persistedEl,
                removePersisted: wrappedRemove,
                signatureBlob,
                signatureDataUrl: currentSigDataUrl,
                placement,
              };
              await onComplete?.(result);

            } else if (afterConfirm === 'capture') {
              const raw = await captureResult(
                targetEl,
                currentSigDataUrl,
                placement,
                captureOptions,
              );
              cleanup();
              const result: CaptureResult = {
                afterConfirm: 'capture',
                imageBlob: raw.imageBlob,
                signatureBlob: raw.signatureBlob,
                signatureDataUrl: raw.signatureDataUrl,
                placement: raw.placement,
              };
              await onComplete?.(result);

            } else {
              // 'both'
              const { persistedEl, removePersisted: removeImg } = persistResult(
                targetEl,
                currentSigDataUrl,
                placement,
              );
              persistedActive = true;
              const raw = await captureResult(
                targetEl,
                currentSigDataUrl,
                placement,
                captureOptions,
              );
              const wrappedRemove = () => {
                removeImg();
                persistedActive = false;
                if (existingPos === 'static') targetEl.style.position = prevInlinePos;
              };
              cleanup();
              const result: BothResult = {
                afterConfirm: 'both',
                persistedEl,
                removePersisted: wrappedRemove,
                imageBlob: raw.imageBlob,
                signatureBlob: raw.signatureBlob,
                signatureDataUrl: raw.signatureDataUrl,
                placement: raw.placement,
              };
              await onComplete?.(result);
            }
          } catch (err) {
            cleanup();
            onError?.(err);
          }
        },
        () => {
          placementBox = null;
          overlayContainer?.destroy();
          overlayContainer = null;
          onCancel?.();
        },
        { confirm: msgs.confirm, delete: msgs.delete },
      );

      overlayContainer.el.style.pointerEvents = 'all';
      overlayContainer.el.appendChild(placementBox.element);
    }

    function destroy() {
      triggerHandle.destroy();
      modal.destroy();
      placementBox?.destroy();
      overlayContainer?.destroy();
      // Only restore position if no persisted img is still in the DOM.
      // If persistedActive, removePersisted() will handle restoration.
      if (!persistedActive && existingPos === 'static') {
        targetEl.style.position = prevInlinePos;
      }
      removeStyles();
    }

    return { destroy };
  }
}
```

- [ ] **Step 2: Typecheck**

```bash
pnpm typecheck
```

Expected: no errors.

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Commit**

```bash
git add src/DropSign.ts
git commit -m "feat: implement afterConfirm option with persist/capture/both modes"
```

---

## Task 5: Tests for `afterConfirm` modes

**Files:**
- Modify: `src/DropSign.test.ts`

- [ ] **Step 1: Add `afterConfirm` mode tests to the `persistResult` describe block**

Append the following tests inside the existing `describe('persistResult', ...)` block (after the last `it(...)` inside it):

```ts
  it('removePersisted() is idempotent — calling twice does not throw', () => {
    const targetEl = document.createElement('div');
    targetEl.style.position = 'relative';
    document.body.appendChild(targetEl);

    const { removePersisted } = persistResult(targetEl, fakeSigDataUrl, placement);
    removePersisted();
    expect(() => removePersisted()).not.toThrow();

    targetEl.remove();
  });

  it('img has pointer-events:none so it does not block underlying content', () => {
    const targetEl = document.createElement('div');
    targetEl.style.position = 'relative';
    document.body.appendChild(targetEl);

    const { persistedEl } = persistResult(targetEl, fakeSigDataUrl, placement);
    expect(persistedEl.style.pointerEvents).toBe('none');

    targetEl.remove();
  });
```

- [ ] **Step 2: Add a `describe` block for `afterConfirm` modes via `dataUrlToBlob`**

Add the following after the `persistResult` describe block in `src/DropSign.test.ts`:

```ts
describe('dataUrlToBlob', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('converts a data URL to a Blob via fetch', async () => {
    const fakeBlob = new Blob(['hello']);
    vi.stubGlobal('fetch', vi.fn(async () => ({ blob: async () => fakeBlob })));

    const result = await dataUrlToBlob('data:text/plain;base64,aGVsbG8=');
    expect(result).toBe(fakeBlob);
  });
});
```

Also add `dataUrlToBlob` to the import at the top of the file:

```ts
import { captureResult, persistResult, dataUrlToBlob } from './capture.js';
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all tests PASS.

- [ ] **Step 4: Lint**

```bash
pnpm lint
```

Expected: no errors or warnings.

- [ ] **Step 5: Commit**

```bash
git add src/DropSign.test.ts
git commit -m "test: add persistResult and dataUrlToBlob unit tests"
```

---

## Task 6: Bump version and final check

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Bump version to 0.3.0**

In `package.json`, change `"version": "0.1.0"` to `"version": "0.3.0"`.

- [ ] **Step 2: Build**

```bash
pnpm build
```

Expected: `dist/` regenerated with no errors.

- [ ] **Step 3: Full test + typecheck + lint**

```bash
pnpm test && pnpm typecheck && pnpm lint
```

Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "chore: bump version to 0.3.0"
```
