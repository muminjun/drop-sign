# DropSign

Drop signatures anywhere on the web.

DropSign is a lightweight embeddable TypeScript SDK that lets users draw a signature, drag it onto a target area, resize it like a slide object, and export the signed area as an image with placement metadata.

[![CI](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml/badge.svg)](https://github.com/muminjun/drop-sign/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/drop-sign)](https://www.npmjs.com/package/drop-sign)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## What is DropSign?

DropSign adds a floating **Sign** button to any HTML element. When clicked, users draw their signature on a canvas, then drag and resize it over the target area like a PowerPoint object. Confirming captures the target element as a PNG and returns the signed image with placement metadata.

This is a **placement and capture SDK**, not a legal e-signature platform.

---

## Installation

```bash
npm install drop-sign
# or
pnpm add drop-sign
# or
yarn add drop-sign
```

---

## Quick start

```ts
import { DropSign } from 'drop-sign';

const widget = DropSign.init({
  target: '#contract-area',
  buttonText: 'Sign',
  onComplete(result) {
    console.log(result.imageBlob);       // PNG of the signed area
    console.log(result.signatureBlob);   // PNG of the signature only
    console.log(result.placement);       // position metadata
  },
});

// Later, to clean up:
widget.destroy();
```

---

## API Reference

### `DropSign.init(options)`

Initializes a DropSign widget on a target element. Returns a `DropSignWidget`.

#### Options

| Option | Type | Default | Description |
|---|---|---|---|
| `target` | `string \| HTMLElement` | required | CSS selector or element to sign |
| `buttonText` | `string` | `'Sign'` | Label for the trigger button |
| `classNamePrefix` | `string` | `'ds-'` | CSS class prefix (reserved, not yet functional) |
| `capture.pixelRatio` | `number` | `devicePixelRatio` | Export resolution multiplier |
| `capture.backgroundColor` | `string` | `'#ffffff'` | Background color of captured PNG |
| `onComplete` | `(result: DropSignResult) => void` | — | Called after successful signing |
| `onCancel` | `() => void` | — | Called when user cancels |
| `onError` | `(error: unknown) => void` | — | Called on errors |

#### Returns: `DropSignWidget`

| Method | Description |
|---|---|
| `destroy()` | Removes all DOM nodes and event listeners |

### Types

```ts
interface DropSignResult {
  imageBlob: Blob;           // signed target area as PNG
  signatureBlob: Blob;       // signature only as PNG
  signatureDataUrl: string;  // data URL of signature
  placement: SignaturePlacement;
}

interface SignaturePlacement {
  x: number;           // left offset inside target (px)
  y: number;           // top offset inside target (px)
  width: number;       // signature box width (px)
  height: number;      // signature box height (px)
  targetWidth: number; // target element width at capture time
  targetHeight: number;
  scrollX: number;     // window.scrollX at capture time
  scrollY: number;
}
```

---

## Browser Support

Modern browsers with ES2020 support:

- Chrome 80+
- Firefox 75+
- Safari 13.1+
- Edge 80+

Touch events (iOS Safari, Android Chrome) are supported for signature drawing.

---

## Limitations

- DOM capture may not perfectly match browser screenshots.
- Cross-origin images, iframes, videos, canvas elements, and shadow DOM content may not export correctly due to browser security restrictions.
- PDF signing is not included in v0.1.
- This is not legal e-signature compliance software. It does not provide audit trails, identity verification, or comply with eIDAS, ESIGN, or UETA.

---

## Roadmap

- PDF mode using `pdf-lib`
- Multiple signatures per document
- Text / date / initials fields
- Audit metadata and timestamp embedding
- React wrapper (`@drop-sign/react`)
- Vue wrapper (`@drop-sign/vue`)
- S3 / cloud upload adapter
- PDF coordinate mapping

---

## Development

```bash
# Clone
git clone https://github.com/muminjun/drop-sign.git
cd drop-sign

# Install
pnpm install

# Build
pnpm build

# Test
pnpm test

# Lint + typecheck
pnpm lint
pnpm typecheck

# Run demo
pnpm demo
```

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

[MIT](LICENSE) © muminjun
