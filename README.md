# DropSign

Drop signatures anywhere on the web.

DropSign is a lightweight embeddable TypeScript SDK that lets users draw a signature, drag it onto a target area, resize it, and export the signed area as an image with placement metadata.

[![CI](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml/badge.svg)](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/drop-sign)](https://www.npmjs.com/package/drop-sign)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is DropSign?

DropSign adds a trigger to any HTML element. When activated, users draw their signature on a canvas, then drag and resize it over the target area. Confirming captures the target element as a PNG and returns the signed image with placement metadata.

This is a **placement and capture SDK**, not a legal e-signature platform.

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
    console.log(result.imageBlob);     // PNG of the signed area
    console.log(result.signatureBlob); // PNG of the signature only
    console.log(result.placement);     // position metadata
  },
});

// Later:
widget.destroy();
```

---

## Trigger modes

### Floating (default)

A floating button is added to the target element. This is the default when no `trigger` option is given.

```ts
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'floating',
    positionAnchor: 'target', // default — button lives inside the target element
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    label: 'Sign',
    pressEffect: true,        // default true — scale-down animation on click
  },
  onComplete(result) { /* ... */ },
});
```

**Viewport-fixed** (chat-widget style — button stays in the corner of the browser window):

```ts
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'floating',
    positionAnchor: 'viewport',
    position: 'bottom-right',
  },
});
```

### Inline trigger

A button is created inside a container you specify.

```ts
// Button variant (default)
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'inline',
    container: '#signature-action',
    label: 'Sign document',
    variant: 'button',
  },
});

// Text variant — renders as an underlined text link
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'inline',
    container: '#signature-action',
    label: '(서명)',
    variant: 'text',
  },
});
```

### Custom trigger

Attach the signing flow to your own existing element. DropSign only adds a click listener — it never creates or removes the element.

```ts
DropSign.init({
  target: '#contract',
  trigger: {
    type: 'custom',
    element: '#my-sign-button',
    // Also accepts an HTMLElement directly
  },
});
```

You can also use a CSS attribute selector:

```ts
trigger: { type: 'custom', element: '[data-dropsign-trigger]' }
```

### Backward compatibility

`buttonText` continues to work as before:

```ts
DropSign.init({ target: '#contract', buttonText: 'Sign' });
```

**Label priority:** `trigger.label` → `buttonText` → `messages.sign` → `'Sign'`

---

## Signature style options

Configure the pen used in the signature canvas. Stroke thickness varies naturally with drawing velocity via `minWidth`/`maxWidth`.

```ts
DropSign.init({
  target: '#contract',
  signature: {
    penColor: '#1d4ed8',          // default: '#111827'
    minWidth: 0.8,                // default: 0.7
    maxWidth: 3,                  // default: 2.5
    velocityFilterWeight: 0.7,    // default: 0.7 — higher = smoother, less width variation
  },
});
```

---

## Messages / localization

Override any label shown in the UI:

```ts
DropSign.init({
  target: '#contract',
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

**Default messages (English):**

| Key | Default |
|-----|---------|
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

DropSign v0.2 includes mobile and touch improvements out of the box:

- Signature canvas has `touch-action: none` for reliable touch drawing.
- The placement box and resize handles use Pointer Events, working correctly on touch screens.
- Resize handles are larger on coarse-pointer (touch) devices.
- The signature modal is responsive and fills the screen on small viewports.
- All SDK-created buttons have touch-friendly minimum hit areas (44×44px).

No configuration required.

---

## API Reference

### `DropSign.init(options)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `target` | `string \| HTMLElement` | required | CSS selector or element to sign |
| `trigger` | `DropSignTrigger` | floating, target-relative | Trigger mode configuration |
| `messages` | `DropSignMessages` | English | UI label overrides |
| `signature` | `DropSignSignatureOptions` | — | Pen color and width options |
| `buttonText` | `string` | `'Sign'` | Legacy label (still works) |
| `capture.pixelRatio` | `number` | `devicePixelRatio` | Export resolution |
| `capture.backgroundColor` | `string` | `'#ffffff'` | PNG background color |
| `onComplete` | `(result: DropSignResult) => void` | — | Called after signing |
| `onCancel` | `() => void` | — | Called on cancel |
| `onError` | `(error: unknown) => void` | — | Called on errors |

### `DropSignWidget`

| Method | Description |
|--------|-------------|
| `destroy()` | Removes SDK-created DOM nodes and event listeners. Custom trigger elements are not removed. |

### `DropSignResult`

| Field | Type | Description |
|-------|------|-------------|
| `imageBlob` | `Blob` | PNG of the signed target area |
| `signatureBlob` | `Blob` | PNG of the signature only |
| `signatureDataUrl` | `string` | Data URL of the signature |
| `placement` | `SignaturePlacement` | Position and size metadata |

---

## Future: data attribute API

A future version will support selecting targets and triggers by data attributes:

```html
<div data-dropsign-target>
  <button data-dropsign-trigger>(서명)</button>
  <span data-dropsign-field="signature">(서명)</span>
  <span data-dropsign-field="date">(날짜)</span>
</div>
```

In v0.2, the `custom` trigger already supports CSS attribute selectors:

```ts
trigger: { type: 'custom', element: '[data-dropsign-trigger]' }
```

---

## Limitations

- DOM capture may not perfectly match browser screenshots.
- Cross-origin images, iframes, videos, canvas elements, and some shadow DOM content may not export correctly.
- PDF signing is not included.
- DropSign is not legal e-signature compliance software.
- Trackpad drawing requires pressing (clicking) while moving — hover-only drawing is not supported by default.

---

## Roadmap

- PDF mode (pdf-lib)
- Multiple signatures per document
- Text, date, and initial fields
- Audit metadata
- React wrapper
- Vue wrapper
- Upload adapter
- Field snapping with `data-dropsign-field`
- Optional trackpad freehand mode (draw without pressing)

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
