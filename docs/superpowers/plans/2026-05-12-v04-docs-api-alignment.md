# DropSign v0.4 Docs and API Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the README and basic demo describe the current v0.4 placement-only SDK API accurately.

**Architecture:** This is a documentation and demo-copy update. `README.md` becomes the source of truth for current public types from `src/types.ts`, while `examples/basic` copy is adjusted to describe placement metadata rather than DOM capture. No SDK runtime behavior changes are included in this plan.

**Tech Stack:** Markdown, TypeScript demo code, Vite example build, pnpm scripts

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `README.md` | Modify | Current v0.4 product summary, quick start, trigger docs, placement model, API reference, limitations |
| `examples/basic/index.html` | Modify | Demo version label, subtitle, custom trigger placement and label |
| `examples/basic/src/main.ts` | Modify | Result card heading to describe placement output |

---

## Task 1: Replace README with the v0.4 API Contract

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Record current stale README terms**

Run:

```bash
rg "imageBlob|capture\.|floating|inline|buttonText|SignaturePlacement|signed area" README.md
```

Expected: the command prints matches from the current stale README. Those matches are the terms this task removes from the public quick-start and API reference.

- [ ] **Step 2: Replace `README.md`**

Replace the full contents of `README.md` with:

```md
# DropSign

Drop signatures anywhere on the web.

DropSign is a lightweight embeddable TypeScript SDK that lets users draw a signature, place it on a page or viewport, resize it, and receive the signature image with normalized placement metadata.

[![CI](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml/badge.svg)](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/drop-sign)](https://www.npmjs.com/package/drop-sign)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is DropSign?

DropSign adds a signing trigger to a page. When activated, users draw their signature on a canvas, then drag and resize it over the viewport. Confirming returns the signature PNG data plus normalized placement metadata.

This is a **signature placement SDK**, not a legal e-signature platform or final document renderer. Use the returned signature image and placement data in your own PDF, document, or persistence pipeline.

---

## Installation

```bash
npm install drop-sign
# or
pnpm add drop-sign
```

---

## Quick start

```ts
import { DropSign } from 'drop-sign';

const widget = DropSign.init({
  target: '#contract-area',
  onComplete(result) {
    console.log(result.signatureDataUrl); // data:image/png;base64,...
    console.log(result.signatureBlob);    // signature PNG only
    console.log(result.placement);        // normalized position and size
  },
});
```

Call `widget.destroy()` when the host page, route, or component unmounts:

```ts
widget.destroy();
```

---

## Trigger modes

### Global trigger

When no `trigger` option is provided, DropSign creates a fixed button in the browser viewport.

```ts
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'global',
    position: 'bottom-right',
    label: 'Sign',
  },
  onComplete(result) {
    console.log(result.placement);
  },
});
```

`position` supports `'bottom-right'`, `'bottom-left'`, `'top-right'`, and `'top-left'`.

### Custom trigger

Attach the signing flow to your own existing element. DropSign only adds a click listener. It does not create or remove the element.

```ts
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'custom',
    element: '#my-sign-button',
  },
});
```

You can also pass an `HTMLElement` or a CSS attribute selector:

```ts
DropSign.init({
  trigger: {
    type: 'custom',
    element: '[data-dropsign-trigger]',
  },
});
```

---

## Placement model

`placement` is normalized against the `target` element when `target` is provided. If `target` is omitted, placement is normalized against the viewport.

```ts
interface NormalizedPlacement {
  x: number;
  y: number;
  width: number;
  height: number;
}
```

- `x` and `y` are the top-left position.
- `width` and `height` are the placed signature size.
- Values can be outside `0..1` when the signature is placed outside the target.
- `width` and `height` are always positive.

Example conversion for a PDF page:

```ts
const pdfX = result.placement.x * pageWidth;
const pdfY = result.placement.y * pageHeight;
const pdfWidth = result.placement.width * pageWidth;
const pdfHeight = result.placement.height * pageHeight;
```

---

## Signature style options

Configure the pen used in the signature canvas. Stroke thickness varies naturally with drawing velocity via `minWidth` and `maxWidth`.

```ts
DropSign.init({
  signature: {
    penColor: '#1d4ed8',
    minWidth: 0.8,
    maxWidth: 3,
    velocityFilterWeight: 0.7,
  },
});
```

---

## Messages / localization

Override labels shown in the SDK UI:

```ts
DropSign.init({
  messages: {
    sign: '서명',
    clear: '지우기',
    cancel: '취소',
    useSignature: '서명 사용',
    confirm: '적용',
    delete: '삭제',
    signingTitle: '서명을 입력하세요',
    signingDescription: '마우스, 트랙패드, Apple Pencil 또는 손가락으로 서명하세요.',
  },
});
```

Default messages:

| Key | Default |
|---|---|
| `sign` | `'Sign'` |
| `clear` | `'Clear'` |
| `cancel` | `'Cancel'` |
| `useSignature` | `'Use signature'` |
| `confirm` | `'Confirm'` |
| `delete` | `'Delete'` |
| `signingTitle` | `'Draw your signature'` |
| `signingDescription` | `'Use your mouse, trackpad, Apple Pencil, or finger.'` |

---

## Mobile / touch

DropSign includes mobile and touch behavior out of the box:

- Signature canvas uses `touch-action: none` for reliable touch drawing.
- The placement box and resize handles use Pointer Events.
- Resize handles are larger on coarse-pointer devices.
- The signature modal is responsive on small viewports.
- SDK-created buttons use touch-friendly minimum hit areas.

---

## API Reference

### `DropSign.init(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `string \| HTMLElement` | viewport | Coordinate normalization reference |
| `trigger` | `DropSignTrigger` | global bottom-right | Trigger configuration |
| `messages` | `DropSignMessages` | English | UI label overrides |
| `signature` | `DropSignSignatureOptions` | default pen settings | Pen color and width options |
| `onComplete` | `(result: DropSignResult) => void \| Promise<void>` | - | Called after placement is confirmed |
| `onCancel` | `() => void` | - | Called when signing or placement is cancelled |
| `onError` | `(error: unknown) => void` | - | Called on recoverable SDK errors |

### Error handling

DropSign reports recoverable errors through `onError` without throwing to the host app:

- If `target` is a selector and no matching element is found, `onError` is called and
  `DropSign.init()` returns a no-op widget.
- If `trigger.type` is `custom` and `element` does not resolve to an `HTMLElement`,
  `onError` is called and `DropSign.init()` returns a no-op widget.
- If converting the signature data URL to `signatureBlob` fails, `onError` is called.

### `DropSignTrigger`

```ts
type DropSignTrigger =
  | {
      type: 'global';
      position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
      label?: string;
    }
  | {
      type: 'custom';
      element: string | HTMLElement;
    };
```

### `DropSignResult`

| Field | Type | Description |
|---|---|---|
| `signatureDataUrl` | `string` | Data URL of the signature PNG |
| `signatureBlob` | `Blob` | Signature PNG only |
| `placement` | `NormalizedPlacement` | Normalized position and size metadata |

### `DropSignWidget`

| Method | Description |
|---|---|
| `destroy()` | Removes SDK-created DOM nodes and event listeners. Custom trigger elements are not removed. |

---

## Future: data attribute API

A future version may support selecting targets, triggers, and fields by data attributes:

```html
<div data-dropsign-target>
  <button data-dropsign-trigger>Sign</button>
  <span data-dropsign-field="signature">Signature</span>
  <span data-dropsign-field="date">Date</span>
</div>
```

The current `custom` trigger already supports selector strings:

```ts
DropSign.init({
  trigger: { type: 'custom', element: '[data-dropsign-trigger]' },
});
```

---

## Limitations

- DropSign does not generate final signed PDFs or documents.
- Final rendering, storage, and server-side persistence are the host application's responsibility.
- PDF signing is not included.
- DropSign is not legal e-signature compliance software.
- Trackpad drawing requires pressing while moving.
- Browser pointer and canvas behavior can vary by device.

---

## Roadmap

- PDF mode
- Multiple signatures per document
- Text, date, and initial fields
- Audit metadata
- React wrapper
- Vue wrapper
- Upload adapter
- Field snapping with `data-dropsign-field`
- Optional trackpad freehand mode

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
```

- [ ] **Step 3: Verify stale README terms are gone**

Run:

```bash
rg "imageBlob|capture\.|floating|inline|buttonText|SignaturePlacement|signed area" README.md
```

Expected: no output and exit code 1.

- [ ] **Step 4: Commit README update**

```bash
git add README.md
git commit -m "docs: align README with v0.4 placement API"
```

---

## Task 2: Update Basic Demo Copy

**Files:**
- Modify: `examples/basic/index.html`
- Modify: `examples/basic/src/main.ts`

- [ ] **Step 1: Update demo HTML title and subtitle**

In `examples/basic/index.html`, change:

```html
<title>DropSign v0.2 Demo</title>
```

to:

```html
<title>DropSign v0.4 Demo</title>
```

Change the subtitle:

```html
<p class="subtitle">Viewport overlay · Global &amp; custom triggers · Normalized placement output</p>
```

to:

```html
<p class="subtitle">Draw a signature, place it on the viewport, and inspect normalized output</p>
```

- [ ] **Step 2: Move the custom trigger to the signature side**

In `examples/basic/index.html`, replace the full `.signature-section` block with:

```html
<div class="signature-section">
  <div>
    <div id="custom-trigger-area">
      <button id="custom-sign-btn">Sign here</button>
    </div>
    <div class="signature-line">Contractor Signature</div>
  </div>
  <div>
    <div class="signature-line">Date</div>
  </div>
</div>
```

- [ ] **Step 3: Update the result heading without `innerHTML`**

In `examples/basic/src/main.ts`, replace:

```ts
const header = document.createElement('div');
header.className = 'result-header';
header.innerHTML = '<h3>Signature captured</h3>';
```

with:

```ts
const header = document.createElement('div');
header.className = 'result-header';
const heading = document.createElement('h3');
heading.textContent = 'Signature placement captured';
header.appendChild(heading);
```

- [ ] **Step 4: Build the example**

Run:

```bash
pnpm --filter @drop-sign/example build
```

Expected: Vite build succeeds and prints `✓ built`.

- [ ] **Step 5: Commit demo copy update**

```bash
git add examples/basic/index.html examples/basic/src/main.ts
git commit -m "docs: update basic demo copy for placement output"
```

---

## Task 3: Run Final Verification

**Files:**
- Verify: `README.md`
- Verify: `examples/basic/index.html`
- Verify: `examples/basic/src/main.ts`

- [ ] **Step 1: Run repository checks**

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm --filter @drop-sign/example build
```

Expected:

- ESLint exits 0.
- TypeScript exits 0.
- Vitest reports all tests passing.
- tsup builds ESM, CJS, and DTS output.
- Vite example build succeeds.

- [ ] **Step 2: Confirm public docs and demo no longer expose removed public copy**

Run:

```bash
rg "imageBlob|capture\.|floating|inline|buttonText|SignaturePlacement|signed area" README.md
rg "v0\.2|Signature captured" examples/basic
```

Expected: no output and exit code 1.

- [ ] **Step 3: Inspect final diff**

Run:

```bash
git diff --stat HEAD
git diff -- README.md examples/basic/index.html examples/basic/src/main.ts
```

Expected: only README and basic demo copy/code changes from this plan are present.

- [ ] **Step 4: Commit any verification-only formatting changes**

If formatting changed files in this plan, commit them:

```bash
git add README.md examples/basic/index.html examples/basic/src/main.ts
git commit -m "chore: format v0.4 docs alignment changes"
```

Expected: if no formatting files changed, `git status --short` shows no unstaged changes for this plan.
