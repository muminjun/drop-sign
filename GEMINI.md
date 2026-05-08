# DropSign - Project Instructions

## Project Overview
DropSign is a lightweight, embeddable TypeScript SDK that allows users to draw a signature, drag and resize it onto a target HTML element, and capture the result as an image with placement metadata. It is designed as a "placement and capture" tool, not a full legal e-signature platform.

### Core Technologies
- **TypeScript**: Main development language.
- **signature_pad**: Handles the signature drawing canvas.
- **interactjs**: Manages dragging and resizing of the signature overlay.
- **html-to-image**: Captures the target DOM element as a PNG.
- **tsup**: Fast TypeScript bundler for ESM and CJS outputs.
- **vitest**: Unit testing framework with `happy-dom` for browser environment simulation.

## Building and Running
The project uses `pnpm` as the package manager and includes a workspace for examples.

- **Install dependencies**: `pnpm install`
- **Build the SDK**: `pnpm build` (Uses `tsup`)
- **Run tests**: `pnpm test` (Uses `vitest`)
- **Development mode**: `pnpm dev` (Watch mode for `tsup`)
- **Linting**: `pnpm lint` (ESLint)
- **Formatting**: `pnpm format` (Prettier)
- **Typechecking**: `pnpm typecheck` (tsc)
- **Run Demo**: `pnpm demo` (Runs the example app)

## Codebase Structure
- `src/`: Main source code.
  - `DropSign.ts`: Main entry point and initialization logic.
  - `capture.ts`: DOM capture logic using `html-to-image`.
  - `overlay.ts`: Management of the UI overlay and signature dialog.
  - `placement.ts`: Drag-and-drop and resizing logic using `interactjs`.
  - `signature-pad.ts`: Integration with the `signature_pad` library.
  - `styles.ts`: Dynamic CSS injection for the widget.
  - `types.ts`: Public and internal TypeScript interfaces.
- `examples/`: Contains demonstration applications using the SDK.

## Development Conventions
- **Surgical Changes**: When modifying core logic, ensure minimal impact on the existing DOM manipulation patterns.
- **Test-Driven**: New features should be accompanied by tests in `src/DropSign.test.ts` or new `.test.ts` files.
- **DOM Cleanup**: Always ensure `destroy()` methods correctly remove added event listeners and DOM nodes to prevent memory leaks.
- **Styles**: CSS is managed programmatically in `styles.ts` to keep the SDK zero-config and dependency-free for styles.
