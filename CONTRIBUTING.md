# Contributing to DropSign

Thank you for your interest in contributing!

## Getting started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/<your-username>/drop-sign`
3. Install dependencies: `pnpm install`
4. Create a branch: `git checkout -b feat/your-feature`

## Development workflow

```bash
pnpm build      # build the package
pnpm test       # run tests
pnpm lint       # lint
pnpm typecheck  # type check
pnpm demo       # run the example app
```

## Submitting a PR

1. Run all checks locally: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
2. Add a changeset: `pnpm changeset`
3. Push and open a PR against `main`
4. Fill in the PR template

## Code style

- TypeScript strict mode
- Prettier for formatting
- ESLint for linting
- No React in the core package

## Reporting issues

Use the GitHub [issue tracker](https://github.com/muminjun/drop-sign/issues).
