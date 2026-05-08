# Repository Guidelines

## Project Structure & Module Organization

DropSign is a TypeScript SDK. Core source lives in `src/`, with the public entry point in `src/index.ts` and the main SDK implementation in `src/DropSign.ts`. Supporting modules cover overlay behavior, signature capture, placement, styles, and shared types. Tests are colocated with source as `src/**/*.test.ts`. The runnable demo app lives in `examples/basic/`. Build output is generated in `dist/` and should not be edited directly.

## Build, Test, and Development Commands

Use `pnpm install` to install workspace dependencies.

- `pnpm dev`: runs `tsup --watch` for package development.
- `pnpm build`: builds ESM, CJS, declarations, and sourcemaps into `dist/`.
- `pnpm test`: runs Vitest once against `src/**/*.test.ts`.
- `pnpm lint`: runs ESLint on `src` with zero warnings allowed.
- `pnpm typecheck`: runs `tsc --noEmit` using strict compiler settings.
- `pnpm format`: formats `src` and `examples` with Prettier.
- `pnpm demo`: starts the basic Vite example app.

Before submitting changes, run `pnpm lint && pnpm typecheck && pnpm test && pnpm build`.

## Coding Style & Naming Conventions

Write TypeScript in strict mode. Use 2-space indentation, semicolons, single quotes, trailing commas, and a 100-character print width; these are enforced by Prettier. ESLint disallows `any` and unused variables, except unused arguments prefixed with `_`. Keep the core package framework-free; `CONTRIBUTING.md` explicitly notes no React in `src/`. Use PascalCase for exported classes and types, camelCase for functions and variables, and descriptive file names matching their module purpose.

## Testing Guidelines

Vitest runs in the `happy-dom` environment, so DOM behavior can be tested without a browser. Add tests next to the code they cover using the `*.test.ts` pattern. Mock browser or third-party APIs explicitly, as in `src/DropSign.test.ts` for `html-to-image`. Coverage is configured with the V8 provider and text/lcov reporters; add coverage for new public behavior and regression-prone DOM cleanup paths.

## Commit & Pull Request Guidelines

History uses short, imperative commits, including Conventional Commit style such as `feat: initial DropSign SDK v0.1.0`. Prefer `feat:`, `fix:`, `docs:`, `test:`, or `chore:` prefixes when applicable. Pull requests should target `main`, describe the user-facing change, link related issues, and include screenshots or recordings for demo/UI behavior. Confirm local checks passed and add a changeset when the package behavior or public API changes.

## Security & Configuration Tips

Do not commit generated `dist/`, local environment files, or secrets. Report vulnerabilities through the process in `SECURITY.md` rather than public issues.
