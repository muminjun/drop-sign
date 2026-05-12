# DropSign Signing UX Polish Design

**Date:** 2026-05-12
**Status:** Draft for user review
**Scope:** Signature modal and placement interaction polish without public API changes

## Overview

The current signing flow works, but several details can feel broken or unclear:

- Pressing the primary action with an empty signature silently does nothing.
- The canvas uses a fixed backing size while CSS can shrink it, which can create pointer
  coordinate mismatch on small screens.
- Placement controls can move outside the viewport when the signature box is near the
  top edge.
- The placement stage gives little feedback about the coordinate reference target.

This change improves the runtime UX while keeping the v0.4 public API unchanged.

## Goals

- Make empty-signature state visible and actionable.
- Keep canvas drawing coordinates aligned with the displayed canvas size.
- Keep placement controls reachable when the signature box is near viewport edges.
- Preserve the existing trigger, modal, placement, and result data flow.
- Add focused tests for the new behavior.

## Non-Goals

- No new public API options.
- No PDF stamping, DOM capture, persistence, audit, or backend behavior.
- No field snapping or multi-field workflow.
- No redesign of the visual brand.
- No dependency changes unless a test requires a local mock.

## Existing Flow

The current flow is:

1. Trigger click opens the signature modal.
2. User draws on the canvas.
3. `Use signature` creates a PNG data URL.
4. The modal closes and a placement box is added to a viewport overlay.
5. User drags and resizes the placement box.
6. Confirm returns `signatureDataUrl`, `signatureBlob`, and `placement`.

The proposed changes keep this sequence intact.

## Component Design

### `signature-pad.ts`

`signature-pad.ts` owns the modal, signature pad instance, and action buttons.

It should track whether the pad currently contains a signature. The primary action
should start disabled or visibly unavailable when the pad is empty. Once a stroke is
completed, the action becomes enabled. When the user clears the pad, the action becomes
disabled again.

The implementation can use `signature_pad` events where available:

- `beginStroke` can clear an empty-state hint.
- `endStroke` can update `hasSignature` from `pad.isEmpty()`.
- Clear button resets state after `pad.clear()`.

If the user still activates the primary action while empty, the code should keep the
current safety check and return without creating a placement box.

### Canvas Sizing

The canvas should align its backing store with its displayed size. On modal open, after
the canvas is in the DOM:

1. Read the canvas bounding rectangle.
2. Multiply width and height by `window.devicePixelRatio || 1`.
3. Set `canvas.width` and `canvas.height` to those backing dimensions.
4. Scale the 2D context so `signature_pad` receives CSS-pixel coordinates.
5. Clear the pad after resizing.

The displayed CSS size should remain responsive. The default visual aspect ratio should
stay close to the current `480x200` canvas.

If the viewport changes while the modal is open, resizing can clear the current drawing.
For this scoped improvement, the modal should either:

- Resize only before the user draws, or
- Resize on window resize only when the pad is empty.

The recommended choice is to resize on open and on resize only while empty. This avoids
silently deleting a user's signature.

### `placement.ts`

`placement.ts` owns drag, resize, keyboard handling, placement calculation, and control
position decisions.

After initializing the box, after every drag move, and after every resize move, it should
update a CSS state that controls where the action toolbar is rendered:

- If there is enough space above the box, show controls above the box.
- If the box is near the top edge, show controls below the box.

This can be implemented with a class such as `ds-sig-box--controls-below`. The threshold
should be based on the toolbar height plus a small gap. The toolbar should not require a
new public option.

Keyboard behavior should remain:

- `Enter` confirms.
- `Escape` deletes/cancels placement.

### `styles.ts`

Styles should add state for:

- Disabled primary modal button.
- Optional empty-state hint text in the modal.
- Toolbar-below placement state.

The style changes should keep existing class names and add only narrowly scoped classes.

## Data Flow

The runtime data flow remains:

1. Modal opens and sizes the canvas.
2. `hasSignature` starts as false.
3. User draws; stroke completion sets `hasSignature` to true.
4. `Use signature` is enabled.
5. Clear resets `hasSignature` to false.
6. `Use signature` creates the PNG data URL only when `pad.isEmpty()` is false.
7. Placement box is created with the same data URL.
8. Drag and resize update box position and toolbar placement state.
9. Confirm reads normalized placement and calls `onComplete`.

No new data is added to `DropSignResult`.

## Error Handling

- Empty signature activation remains a no-op guard in code, but the UI should prevent the
  normal click path through disabled state.
- Canvas resize should not throw when layout dimensions are unavailable. If the measured
  width or height is zero, keep a reasonable fallback size.
- Window resize should not clear a non-empty signature.
- Placement toolbar positioning should be best-effort. If measurement is unavailable,
  default to controls above the box.
- Blob conversion failures should continue to call `onError` from `DropSign.ts`.
- Cancel and delete flows should continue to call `onCancel` exactly once per user
  cancellation.

## Accessibility and Interaction

- Disabled primary action should use the native `disabled` attribute.
- Buttons should remain real `<button type="button">` elements.
- Empty-state hint should be short and associated visually with the modal actions or
  canvas area.
- Toolbar controls must remain reachable by pointer on small screens.
- Existing keyboard shortcuts should remain unchanged.

## Testing

Focused Vitest coverage should be added or extended for:

- Modal opens with `Use signature` disabled when the pad is empty.
- Drawing a stroke enables `Use signature`.
- Clear disables `Use signature` again.
- Empty activation does not create a placement box.
- Canvas backing dimensions are resized from displayed dimensions and device pixel
  ratio.
- Window resize does not clear a non-empty signature.
- Placement box near the top applies toolbar-below state.
- Dragging or resizing updates toolbar state.
- Existing `onComplete`, `onCancel`, and `destroy()` cleanup behavior remains intact.

The final implementation should pass:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
```

If the example is touched, it should also pass:

```bash
pnpm --filter @drop-sign/example build
```

## Acceptance Criteria

- Users cannot click an apparently valid primary action while the signature is empty.
- Drawing coordinates remain aligned on narrow viewports and high-DPI screens.
- Confirm and Delete controls stay visible and reachable near the top edge.
- No public TypeScript API changes are introduced.
- Existing tests still pass, with new regression tests covering the polished behavior.
