# DropSign v0.4 Docs and API Alignment Design

**Date:** 2026-05-12
**Status:** Draft for user review
**Scope:** README and basic demo copy alignment with the current v0.4 SDK API

## Overview

The current SDK implementation has moved to a placement-only model. It returns the
signature image and normalized placement metadata, and no longer captures the target
element as a PNG. The public documentation still describes older capture and trigger
APIs, which makes the first-use path misleading.

This change aligns the public README and basic demo text with the actual exported
types in `src/types.ts` and runtime behavior in `src/DropSign.ts`.

## Goals

- Make README examples compile against the current public types.
- Explain DropSign as a signature placement SDK, not a DOM capture SDK.
- Document only the current trigger modes: `global` and `custom`.
- Explain that `target` is optional and acts as the coordinate normalization reference.
- Replace stale result fields with `signatureDataUrl`, `signatureBlob`, and `placement`.
- Update demo copy so users understand that the output is placement metadata plus the
  signature image.

## Non-Goals

- No runtime SDK behavior changes.
- No compatibility layer for removed v0.2 or v0.3 API shapes.
- No reintroduction of DOM capture, `imageBlob`, `capture`, `buttonText`, `floating`,
  or `inline`.
- No changes to package versioning or publishing metadata in this design.

## Current Mismatches

The README currently describes older concepts:

- `imageBlob` and signed-area PNG capture.
- `capture.pixelRatio` and `capture.backgroundColor`.
- `floating` and `inline` trigger modes.
- `buttonText` backward compatibility.
- `target` as a required element to sign.
- `SignaturePlacement` instead of `NormalizedPlacement`.

The current implementation exposes:

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

interface DropSignResult {
  signatureDataUrl: string;
  signatureBlob: Blob;
  placement: NormalizedPlacement;
}
```

`target` is optional. When present, placement coordinates are normalized against the
target element. When omitted, placement coordinates are normalized against the viewport.

## Documentation Architecture

The README should be organized around the actual user path:

1. Install the package.
2. Initialize a global trigger or attach a custom trigger.
3. Let the user draw a signature.
4. Let the user place and resize the signature.
5. Receive signature image data and normalized placement metadata.
6. Render, persist, or stamp the signature in the host application.

The README should avoid implying that DropSign produces a final signed document. It
should say that DropSign gives the host application enough data to create one.

## README Sections

### Product Summary

Replace capture-centric language with placement-centric language:

- DropSign helps users draw a signature and place it on a page or viewport.
- It returns the signature image plus normalized placement coordinates.
- It is not a legal e-signature platform and does not generate final signed PDFs by
  itself.

### Quick Start

Show the smallest working v0.4 example:

```ts
import { DropSign } from 'drop-sign';

const widget = DropSign.init({
  target: '#contract-area',
  onComplete(result) {
    console.log(result.signatureDataUrl);
    console.log(result.signatureBlob);
    console.log(result.placement);
  },
});
```

The example should not mention `imageBlob`. It also should not call `widget.destroy()`
inside the minimal quick start because doing so immediately removes the SDK-created
trigger and prevents the user from opening the signing flow. Cleanup can be shown later
as lifecycle guidance, such as calling `widget.destroy()` when a page, route, or host
component unmounts.

### Trigger Modes

Document two modes:

- `global`: SDK-created fixed button, default when `trigger` is omitted.
- `custom`: host-provided element; SDK only attaches and removes a click listener.

The older `floating` and `inline` sections should be removed. If inline behavior is
needed, the docs should show it as a custom trigger attached to a host-created button or
link.

### Placement Model

Add a short section explaining `NormalizedPlacement`:

- `x` and `y` are the top-left position.
- `width` and `height` are the placed signature size.
- Values are relative to `target` if provided, otherwise to the viewport.
- Values can be outside the `0..1` range when the box is placed outside the target.
- Width and height should remain positive.

### API Reference

The API table should match `src/types.ts`:

- `target?: string | HTMLElement`
- `trigger?: DropSignTrigger`
- `messages?: DropSignMessages`
- `signature?: DropSignSignatureOptions`
- `onComplete?: (result: DropSignResult) => void | Promise<void>`
- `onCancel?: () => void`
- `onError?: (error: unknown) => void`

Removed options should not appear in the main API reference.

### Limitations

Remove DOM capture limitations that no longer apply. Keep limitations around:

- PDF signing is not included.
- Final document rendering is the host application's responsibility.
- Legal compliance is not provided.
- Trackpad drawing requires pressing while moving.
- Cross-browser pointer and canvas behavior can still vary.

## Demo Copy

The basic demo should use one version label consistently. The page title and visible
heading should both use v0.4 language.

Recommended copy direction:

- Page title: `DropSign v0.4 Demo`
- Heading: `DropSign v0.4`
- Subtitle: `Draw a signature, place it on the viewport, and inspect normalized output`
- Result heading: `Signature placement captured`

The custom trigger area should read as a user-provided trigger for the signature line.
It should not imply that DropSign fills the date field.

## Error Handling

Documentation should describe the existing error path without inventing new API:

- Missing `target` selector calls `onError` and returns a no-op widget.
- Missing custom trigger element calls `onError` and returns a no-op widget.
- Errors while converting the signature data URL to a blob call `onError`.
- `destroy()` removes SDK-created DOM and custom trigger listeners, but does not remove
  host-owned custom trigger elements.

## Testing and Verification

This is a docs and demo-copy change, so the implementation plan should include:

- Check README examples against the current `DropSignOptions` and `DropSignResult`
  types.
- Search for stale public API terms in README and demo text:
  `imageBlob`, `capture`, `floating`, `inline`, `buttonText`, `SignaturePlacement`.
- Run formatting if docs or demo files are changed in a way that affects formatted
  source.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Run `pnpm --filter @drop-sign/example build` if demo files are changed.

## Acceptance Criteria

- README no longer instructs users to call removed APIs.
- Quick start compiles conceptually against current exported types.
- API reference exactly matches current public options and result shape.
- Demo version labels are consistent.
- Demo result wording reflects placement metadata, not DOM capture.
- No SDK runtime files need to change for this track.
