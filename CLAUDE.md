# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm build          # build ESM + CJS + types into dist/
pnpm dev            # watch mode build
pnpm test           # run all tests (vitest, happy-dom environment)
pnpm lint           # ESLint with zero warnings allowed
pnpm typecheck      # tsc --noEmit
pnpm format         # prettier src/ and examples/
pnpm demo           # run the example app (examples/basic via Vite)
```

Run a single test file:
```bash
pnpm exec vitest run src/DropSign.test.ts
```

## Architecture

DropSign is a zero-framework TypeScript SDK distributed as ESM + CJS. It adds a "Sign" button to any HTML element; the user draws a signature, drags/resizes a placement box over the target, and the SDK captures the signed area as a PNG.

### Module responsibilities

- **`DropSign.ts`** — the public `DropSign.init()` entry point. Orchestrates the full signing flow: inject styles → open signature modal → show placement overlay → capture & call `onComplete`.
- **`signature-pad.ts`** — wraps `signature_pad` in a modal (backdrop + canvas). Calls back with a PNG data URL when the user clicks "Use signature".
- **`overlay.ts`** — creates the `ds-placement-overlay` div (positioned absolutely inside `targetEl`) and manages global style injection/removal via a `<style data-drop-sign>` tag.
- **`placement.ts`** — renders the draggable/resizable `ds-sig-box` inside the overlay. Implements mouse-driven drag and four-corner resize entirely in vanilla JS (no interact.js; `interactjs` is listed as a dependency but unused in the current implementation). `getPlacement()` returns `SignaturePlacement` coordinates relative to `targetEl`.
- **`capture.ts`** — temporarily injects a `<img>` at placement coordinates into `targetEl`, calls `html-to-image`'s `toPng`, then cleans up. Returns `DropSignResult` with both the composite blob and the signature-only blob.
- **`styles.ts`** — all CSS as a template literal string; injected once per `DropSign.init()` call, removed on `destroy()`.
- **`types.ts`** — all public TypeScript types (`DropSignOptions`, `DropSignResult`, `SignaturePlacement`, `DropSignWidget`).
- **`index.ts`** — re-exports `DropSign` and all public types.

### Key design constraints

- **No framework, no bundler assumption.** Works as a vanilla script drop-in.
- **Capture timing:** the overlay must still be in the DOM when `captureResult` is called so layout context is correct. The overlay is destroyed only after `toPng` resolves.
- **Style singleton:** styles are injected once and ref-counted via a module-level flag. `removeStyles()` is idempotent.
- **`interactjs`** is listed as a dependency but the drag/resize logic in `placement.ts` is implemented manually. If switching to interact.js, update `placement.ts`.

### Build output

`tsup` produces `dist/index.js` (ESM), `dist/index.cjs` (CJS), and `dist/index.d.ts` / `dist/index.d.cts` type declarations with source maps.

### Tests

Tests run in `happy-dom` (not jsdom). `html-to-image` is vi-mocked at the module level. `fetch` is stubbed per-test for blob conversion. Tests live in `src/DropSign.test.ts` alongside the source.
