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
    emptySignatureHint: '서명을 입력해야 계속할 수 있습니다.',
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
| `emptySignatureHint` | `'Draw a signature to continue.'` |

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
