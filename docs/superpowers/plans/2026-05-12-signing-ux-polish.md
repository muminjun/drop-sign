# DropSign Signing UX Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve the signing modal and placement box UX without changing the public DropSign API.

**Architecture:** `src/signature-pad.ts` owns empty-signature state, primary button state, and canvas sizing. `src/placement.ts` owns placement toolbar positioning state. `src/styles.ts` contains the visual states. Tests are split between a focused new `src/signature-pad.test.ts` and existing placement tests in `src/DropSign.test.ts`.

**Tech Stack:** TypeScript, `signature_pad`, DOM APIs, Vitest + happy-dom, pnpm scripts

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/signature-pad.ts` | Modify | Empty-signature state, disabled primary action, responsive canvas backing store |
| `src/signature-pad.test.ts` | Create | Modal behavior tests with a mocked `signature_pad` |
| `src/placement.ts` | Modify | Toolbar above/below state updates on init, drag, and resize |
| `src/DropSign.test.ts` | Modify | Placement toolbar regression tests |
| `src/styles.ts` | Modify | Disabled action, empty hint, toolbar-below styles |

---

## Task 1: Add Signature Modal Tests

**Files:**
- Create: `src/signature-pad.test.ts`

- [ ] **Step 1: Create `src/signature-pad.test.ts` with failing tests**

Create `src/signature-pad.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSignaturePadModal } from './signature-pad.js';
import { mergeMessages, mergeSignatureOptions } from './messages.js';

interface MockSignaturePadInstance {
  canvas: HTMLCanvasElement;
  clear: ReturnType<typeof vi.fn>;
  off: ReturnType<typeof vi.fn>;
  isEmpty: ReturnType<typeof vi.fn>;
  toDataURL: ReturnType<typeof vi.fn>;
  addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void;
  emit(type: string): void;
  setEmpty(empty: boolean): void;
}

const signaturePadMock = vi.hoisted(() => ({
  instances: [] as MockSignaturePadInstance[],
}));

vi.mock('signature_pad', () => {
  class MockSignaturePad implements MockSignaturePadInstance {
    canvas: HTMLCanvasElement;
    clear = vi.fn(() => {
      this.empty = true;
    });
    off = vi.fn();
    isEmpty = vi.fn(() => this.empty);
    toDataURL = vi.fn(() => 'data:image/png;base64,signature');
    private empty = true;
    private listeners = new Map<string, EventListenerOrEventListenerObject[]>();

    constructor(canvas: HTMLCanvasElement) {
      this.canvas = canvas;
      signaturePadMock.instances.push(this);
    }

    addEventListener(type: string, listener: EventListenerOrEventListenerObject | null): void {
      if (!listener) return;
      const listeners = this.listeners.get(type) ?? [];
      listeners.push(listener);
      this.listeners.set(type, listeners);
    }

    emit(type: string): void {
      const event = new Event(type);
      for (const listener of this.listeners.get(type) ?? []) {
        if (typeof listener === 'function') {
          listener(event);
        } else {
          listener.handleEvent(event);
        }
      }
    }

    setEmpty(empty: boolean): void {
      this.empty = empty;
    }
  }

  return { default: MockSignaturePad };
});

function rect(width: number, height: number): DOMRect {
  return {
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: width,
    bottom: height,
    width,
    height,
    toJSON: () => ({}),
  } as DOMRect;
}

function openModal() {
  const onUse = vi.fn();
  const onCancel = vi.fn();
  const modal = createSignaturePadModal(
    onUse,
    onCancel,
    mergeMessages(),
    mergeSignatureOptions(),
  );

  modal.open();

  const pad = signaturePadMock.instances[signaturePadMock.instances.length - 1]!;
  const useBtn = document.querySelector<HTMLButtonElement>('.ds-btn-use')!;
  const clearBtn = document.querySelector<HTMLButtonElement>('.ds-btn-clear')!;
  const canvas = document.querySelector<HTMLCanvasElement>('.ds-canvas')!;

  return { modal, onUse, onCancel, pad, useBtn, clearBtn, canvas };
}

beforeEach(() => {
  document.body.innerHTML = '';
  signaturePadMock.instances.length = 0;
  vi.restoreAllMocks();
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(300, 125));
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    scale: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  Object.defineProperty(window, 'devicePixelRatio', { value: 2, configurable: true });
});

describe('createSignaturePadModal', () => {
  it('opens with Use signature disabled while the pad is empty', () => {
    const { modal, useBtn } = openModal();

    expect(useBtn.disabled).toBe(true);
    expect(document.querySelector('.ds-empty-hint')?.textContent).toBe('Draw a signature to continue.');

    modal.destroy();
  });

  it('enables Use signature after a stroke ends', () => {
    const { modal, pad, useBtn } = openModal();

    pad.setEmpty(false);
    pad.emit('endStroke');

    expect(useBtn.disabled).toBe(false);
    expect(document.querySelector<HTMLElement>('.ds-empty-hint')?.hidden).toBe(true);

    modal.destroy();
  });

  it('disables Use signature again after clearing', () => {
    const { modal, pad, useBtn, clearBtn } = openModal();
    pad.setEmpty(false);
    pad.emit('endStroke');
    expect(useBtn.disabled).toBe(false);

    clearBtn.click();

    expect(pad.clear).toHaveBeenCalled();
    expect(useBtn.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.ds-empty-hint')?.hidden).toBe(false);

    modal.destroy();
  });

  it('does not call onUse when the pad is empty', () => {
    const { modal, onUse, useBtn } = openModal();

    useBtn.disabled = false;
    useBtn.click();

    expect(onUse).not.toHaveBeenCalled();

    modal.destroy();
  });

  it('sizes the canvas backing store from displayed dimensions and device pixel ratio', () => {
    const { modal, canvas } = openModal();

    expect(canvas.width).toBe(600);
    expect(canvas.height).toBe(250);

    modal.destroy();
  });

  it('does not clear a non-empty signature on window resize', () => {
    const { modal, pad } = openModal();
    pad.clear.mockClear();
    pad.setEmpty(false);

    window.dispatchEvent(new Event('resize'));

    expect(pad.clear).not.toHaveBeenCalled();

    modal.destroy();
  });
});
```

- [ ] **Step 2: Run the new tests and verify failure**

Run:

```bash
pnpm test -- src/signature-pad.test.ts
```

Expected: tests fail because `.ds-btn-use` is not disabled, `.ds-empty-hint` does not exist, and the canvas is not resized from `getBoundingClientRect()`.

- [ ] **Step 3: Commit the failing tests**

```bash
git add src/signature-pad.test.ts
git commit -m "test: cover signature modal empty state and canvas sizing"
```

---

## Task 2: Implement Signature Modal UX

**Files:**
- Modify: `src/signature-pad.ts`
- Modify: `src/styles.ts`
- Test: `src/signature-pad.test.ts`

- [ ] **Step 1: Add modal state helpers in `src/signature-pad.ts`**

Inside `createSignaturePadModal`, add these helpers before `open()`:

```ts
const FALLBACK_CANVAS_WIDTH = 480;
const FALLBACK_CANVAS_HEIGHT = 200;
let resizeHandler: (() => void) | null = null;

function resizeCanvas(canvas: HTMLCanvasElement, currentPad: SignaturePad | null): void {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const displayWidth = rect.width || FALLBACK_CANVAS_WIDTH;
  const displayHeight = rect.height || FALLBACK_CANVAS_HEIGHT;
  canvas.width = Math.round(displayWidth * ratio);
  canvas.height = Math.round(displayHeight * ratio);
  canvas.getContext('2d')?.scale(ratio, ratio);
  currentPad?.clear();
}
```

- [ ] **Step 2: Update modal creation and button state**

In `open()`, after creating `useBtn`, add:

```ts
const emptyHint = document.createElement('p');
emptyHint.className = 'ds-empty-hint';
emptyHint.textContent = 'Draw a signature to continue.';

let hasSignature = false;

function setHasSignature(next: boolean): void {
  hasSignature = next;
  useBtn.disabled = !hasSignature;
  emptyHint.hidden = hasSignature;
}

setHasSignature(false);
```

Change:

```ts
modal.append(title, description, canvas, actions);
```

to:

```ts
modal.append(title, description, canvas, emptyHint, actions);
```

- [ ] **Step 3: Wire `signature_pad` events and safe resize behavior**

After constructing `pad = new SignaturePad(...)`, add:

```ts
resizeCanvas(canvas, pad);

pad.addEventListener('beginStroke', () => {
  emptyHint.hidden = true;
});

pad.addEventListener('endStroke', () => {
  setHasSignature(Boolean(pad && !pad.isEmpty()));
});

resizeHandler = () => {
  if (!pad || !pad.isEmpty()) return;
  resizeCanvas(canvas, pad);
  setHasSignature(false);
};
window.addEventListener('resize', resizeHandler);
```

Update the clear handler from:

```ts
clearBtn.addEventListener('click', () => pad?.clear());
```

to:

```ts
clearBtn.addEventListener('click', () => {
  pad?.clear();
  setHasSignature(false);
});
```

Keep the existing empty guard in the use handler:

```ts
if (!pad || pad.isEmpty()) return;
```

- [ ] **Step 4: Remove resize listener during destroy**

In `destroy()`, before `pad?.off();`, add:

```ts
if (resizeHandler) {
  window.removeEventListener('resize', resizeHandler);
  resizeHandler = null;
}
```

- [ ] **Step 5: Add styles for disabled use button and empty hint**

In `src/styles.ts`, after `.ds-btn-use:hover`, add:

```css
  .ds-btn-use:disabled {
    background: #94a3b8;
    color: #f8fafc;
    cursor: not-allowed;
  }

  .ds-empty-hint {
    margin: -8px 0 0;
    color: #64748b;
    font-size: 12px;
    font-family: system-ui, -apple-system, sans-serif;
  }
```

- [ ] **Step 6: Run the modal tests**

Run:

```bash
pnpm test -- src/signature-pad.test.ts
```

Expected: all tests in `src/signature-pad.test.ts` pass.

- [ ] **Step 7: Commit modal implementation**

```bash
git add src/signature-pad.ts src/styles.ts src/signature-pad.test.ts
git commit -m "fix: improve signature modal empty state and canvas sizing"
```

---

## Task 3: Add Placement Toolbar Tests

**Files:**
- Modify: `src/DropSign.test.ts`

- [ ] **Step 1: Add pointer event helper to `src/DropSign.test.ts`**

After the top-level `beforeEach`, add:

```ts
function pointerEvent(type: string, clientX: number, clientY: number): PointerEvent {
  const event = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent;
  Object.defineProperties(event, {
    clientX: { value: clientX },
    clientY: { value: clientY },
    pointerId: { value: 1 },
  });
  return event;
}
```

Inside the `describe('createPlacementBox — getPlacement', ...)` `beforeEach`, add:

```ts
Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
  configurable: true,
  value: vi.fn(),
});
```

- [ ] **Step 2: Add toolbar-below drag test**

Inside `describe('createPlacementBox — getPlacement', ...)`, add:

```ts
it('moves placement controls below the box near the top edge after dragging', () => {
  const box = createPlacementBox(
    'data:image/png;base64,sig',
    undefined,
    () => {},
    () => {},
    { confirm: 'Confirm', delete: 'Delete' },
  );

  box.element.dispatchEvent(pointerEvent('pointerdown', 512, 384));
  box.element.dispatchEvent(pointerEvent('pointermove', 512, -1000));

  expect(box.element.classList.contains('ds-sig-box--controls-below')).toBe(true);

  box.destroy();
});
```

- [ ] **Step 3: Add toolbar-above resize test**

Inside the same describe block, add:

```ts
it('keeps placement controls above the box when there is top space after resizing', () => {
  const box = createPlacementBox(
    'data:image/png;base64,sig',
    undefined,
    () => {},
    () => {},
    { confirm: 'Confirm', delete: 'Delete' },
  );
  const resizeHandle = box.element.querySelector<HTMLElement>('.ds-resize-se')!;

  box.element.style.top = '120px';
  resizeHandle.dispatchEvent(pointerEvent('pointerdown', 560, 424));
  resizeHandle.dispatchEvent(pointerEvent('pointermove', 620, 464));

  expect(box.element.classList.contains('ds-sig-box--controls-below')).toBe(false);

  box.destroy();
});
```

- [ ] **Step 4: Run placement tests and verify failure**

Run:

```bash
pnpm test -- src/DropSign.test.ts
```

Expected: new toolbar tests fail because `ds-sig-box--controls-below` is not applied.

- [ ] **Step 5: Commit failing placement tests**

```bash
git add src/DropSign.test.ts
git commit -m "test: cover placement toolbar edge positioning"
```

---

## Task 4: Implement Placement Toolbar Positioning

**Files:**
- Modify: `src/placement.ts`
- Modify: `src/styles.ts`
- Test: `src/DropSign.test.ts`

- [ ] **Step 1: Add toolbar state in `src/placement.ts`**

In `createPlacementBox`, after setting initial `left`, `top`, `width`, and `height`, add:

```ts
function updateControlPlacement() {
  const top = parseFloat(box.style.top) || 0;
  const controlsHeight = controls.offsetHeight || 40;
  const gap = 8;
  box.classList.toggle('ds-sig-box--controls-below', top < controlsHeight + gap);
}
```

Change:

```ts
setupDrag(box, signal);
setupResize(box, seHandle, 1, 1, signal);
setupResize(box, swHandle, -1, 1, signal);
setupResize(box, neHandle, 1, -1, signal);
setupResize(box, nwHandle, -1, -1, signal);
```

to:

```ts
setupDrag(box, signal, updateControlPlacement);
setupResize(box, seHandle, 1, 1, signal, updateControlPlacement);
setupResize(box, swHandle, -1, 1, signal, updateControlPlacement);
setupResize(box, neHandle, 1, -1, signal, updateControlPlacement);
setupResize(box, nwHandle, -1, -1, signal, updateControlPlacement);
updateControlPlacement();
```

- [ ] **Step 2: Update drag helper signature and callback**

Change:

```ts
function setupDrag(box: HTMLElement, signal: AbortSignal) {
```

to:

```ts
function setupDrag(box: HTMLElement, signal: AbortSignal, onMove: () => void) {
```

Inside the `pointermove` handler, after:

```ts
box.style.top  = `${newTop}px`;
```

add:

```ts
onMove();
```

- [ ] **Step 3: Update resize helper signature and callback**

Change:

```ts
function setupResize(
  box: HTMLElement,
  handle: HTMLElement,
  dirX: number,
  dirY: number,
  signal: AbortSignal,
) {
```

to:

```ts
function setupResize(
  box: HTMLElement,
  handle: HTMLElement,
  dirX: number,
  dirY: number,
  signal: AbortSignal,
  onMove: () => void,
) {
```

Inside the `pointermove` handler, after:

```ts
box.style.top    = `${newTop}px`;
```

add:

```ts
onMove();
```

- [ ] **Step 4: Add toolbar-below CSS**

In `src/styles.ts`, after the `.ds-sig-controls` block, add:

```css
  .ds-sig-box--controls-below .ds-sig-controls {
    top: auto;
    bottom: -40px;
  }
```

- [ ] **Step 5: Run placement tests**

Run:

```bash
pnpm test -- src/DropSign.test.ts
```

Expected: all tests in `src/DropSign.test.ts` pass.

- [ ] **Step 6: Commit placement implementation**

```bash
git add src/placement.ts src/styles.ts src/DropSign.test.ts
git commit -m "fix: keep placement controls reachable near viewport edges"
```

---

## Task 5: Run Final Verification

**Files:**
- Verify: `src/signature-pad.ts`
- Verify: `src/signature-pad.test.ts`
- Verify: `src/placement.ts`
- Verify: `src/DropSign.test.ts`
- Verify: `src/styles.ts`

- [ ] **Step 1: Run focused tests**

Run:

```bash
pnpm test -- src/signature-pad.test.ts src/DropSign.test.ts
```

Expected: all modal and placement tests pass.

- [ ] **Step 2: Run full package checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

Expected:

- ESLint exits 0.
- TypeScript exits 0.
- Vitest reports all tests passing.
- tsup builds ESM, CJS, and DTS output.

- [ ] **Step 3: Inspect public API diff**

Run:

```bash
git diff -- src/types.ts src/index.ts
```

Expected: no output. This UX plan must not change public TypeScript API exports.

- [ ] **Step 4: Inspect final source diff**

Run:

```bash
git diff --stat HEAD
git diff -- src/signature-pad.ts src/signature-pad.test.ts src/placement.ts src/DropSign.test.ts src/styles.ts
```

Expected: only files from this plan are changed.

- [ ] **Step 5: Commit verification fixes if needed**

If lint or formatting required small corrections, commit only files from this plan:

```bash
git add src/signature-pad.ts src/signature-pad.test.ts src/placement.ts src/DropSign.test.ts src/styles.ts
git commit -m "chore: finalize signing UX polish"
```

Expected: if no corrections were needed, `git status --short` shows no unstaged changes for this plan.
