# Changesets

This repository uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs.

## Adding a changeset

```bash
pnpm changeset
```

Follow the prompts to describe your changes. This creates a markdown file in `.changeset/`.

## Releasing

Changesets are consumed on release. Open a PR created by the changeset bot and merge it to bump versions and publish.
