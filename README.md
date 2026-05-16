# DropSign

Let users draw and place their signature anywhere on the web — in three clicks.

DropSign is a lightweight TypeScript SDK that handles the signature UI, drag-to-place interaction, and normalized coordinate output. You keep control of what happens with the result.

[![CI](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml/badge.svg)](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/drop-sign)](https://www.npmjs.com/package/drop-sign)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## How it works

1. **Trigger** — a button (global or custom) opens the signature canvas.
2. **Draw** — the user signs with a mouse, trackpad, stylus, or finger.
3. **Place** — a draggable, resizable box lets the user position the signature on the page.
4. **Confirm** — `onComplete` fires with the signature image and normalized placement coordinates.

This is a **signature placement SDK**, not a legal e-signature platform. Use the returned data in your own PDF rendering, document storage, or signing pipeline.

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
    console.log(result.signatureBlob);    // Blob for upload
    console.log(result.placement);        // normalized x, y, width, height
  },
});

// Clean up when the component or page unmounts:
widget.destroy();
```

---

## Trigger modes

### Global trigger (default)

DropSign renders a fixed button in the viewport corner. No extra HTML needed.

```ts
DropSign.init({
  trigger: {
    type: 'global',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'
    label: 'Sign',
  },
  onComplete(result) { /* ... */ },
});
```

### Custom trigger

Use your own button or element. DropSign attaches a click listener and leaves the DOM untouched.

```ts
DropSign.init({
  trigger: {
    type: 'custom',
    element: '#my-sign-button', // CSS selector, HTMLElement, or attribute selector
  },
  onComplete(result) { /* ... */ },
});
```

---

## Placement model

The `placement` field contains normalized coordinates relative to `target` (or the viewport when `target` is omitted).

```ts
interface NormalizedPlacement {
  x: number;      // left edge as a fraction of target width
  y: number;      // top edge as a fraction of target height
  width: number;  // signature width as a fraction of target width
  height: number; // signature height as a fraction of target height
}
```

Values outside `0..1` mean the signature was placed beyond the target boundary. `width` and `height` are always positive.

**PDF example:**

```ts
const pdfX      = result.placement.x      * pageWidth;
const pdfY      = result.placement.y      * pageHeight;
const pdfWidth  = result.placement.width  * pageWidth;
const pdfHeight = result.placement.height * pageHeight;
```

---

## Signature style

Customize pen color and stroke width. Thickness varies naturally with drawing velocity.

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

## Localization

Every label in the SDK UI is overridable:

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
    emptySignatureHint: '서명을 입력해야 계속할 수 있습니다.',
  },
});
```

**Defaults:**

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
| `emptySignatureHint` | `'Draw a signature to continue.'` |

---

## Mobile and touch

DropSign works on touch screens out of the box:

- Signature canvas uses `touch-action: none` for reliable stylus and finger drawing.
- Placement box and resize handles use Pointer Events API.
- Resize handles are larger on coarse-pointer (touch) devices.
- Modal layout adapts to small viewports.
- All SDK-created interactive elements meet touch-friendly minimum hit areas.

---

## API reference

### `DropSign.init(options)`

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `string \| HTMLElement` | viewport | Element to normalize placement coordinates against |
| `trigger` | `DropSignTrigger` | global, bottom-right | How and where the signing flow is activated |
| `messages` | `DropSignMessages` | English | Label overrides for all SDK UI copy |
| `signature` | `DropSignSignatureOptions` | default pen | Pen color, min/max width, velocity weight |
| `onComplete` | `(result: DropSignResult) => void \| Promise<void>` | — | Called when the user confirms placement |
| `onCancel` | `() => void` | — | Called when the user cancels signing or placement |
| `onError` | `(error: unknown) => void` | — | Called on recoverable SDK errors instead of throwing |

### `DropSignTrigger`

```ts
type DropSignTrigger =
  | { type: 'global'; position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'; label?: string }
  | { type: 'custom'; element: string | HTMLElement };
```

### `DropSignResult`

| Field | Type | Description |
|---|---|---|
| `signatureDataUrl` | `string` | `data:image/png;base64,...` of the drawn signature |
| `signatureBlob` | `Blob` | PNG Blob, ready for `FormData` upload |
| `placement` | `NormalizedPlacement` | Position and size as fractions of the target |

### `DropSignWidget`

| Method | Description |
|---|---|
| `destroy()` | Removes all SDK-created DOM and event listeners. Does not remove custom trigger elements. |

### Error handling

Errors are routed to `onError` rather than thrown, so the host page stays stable:

- `target` selector matches nothing → `onError`, returns no-op widget.
- `trigger.element` doesn't resolve to an `HTMLElement` → `onError`, returns no-op widget.
- `signatureBlob` conversion fails → `onError`, `result.signatureBlob` is omitted.

---

## Limitations

- Does not generate PDFs or apply signatures to documents server-side.
- Not legal e-signature compliance software.
- Trackpad drawing requires pressing while moving (no hover-only strokes).
- Final document rendering and persistence are the host app's responsibility.

---

## Roadmap

- Multiple signatures per page
- Text, date, and initials fields
- React and Vue wrappers
- `data-dropsign-field` attribute API for declarative field binding
- Optional freehand trackpad mode

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT
