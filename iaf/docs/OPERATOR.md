# Bootstrap, adapt, update, fleet

All commands default to dry-run unless `--apply`.

## New repository

```bash
node iaf/bin/iaf-ecc bootstrap --repo /path/to/repo --harness cursor,claude-project,gemini,antigravity
node iaf/bin/iaf-ecc bootstrap --repo /path/to/repo --apply
```

Works for a local folder or an SSH-opened checkout. It does not deploy the application.

## Existing repository

```bash
node iaf/bin/iaf-ecc inventory --repo /path/to/repo
node iaf/bin/iaf-ecc adapt --repo /path/to/repo
node iaf/bin/iaf-ecc adapt --repo /path/to/repo --apply
```

Preserves `AGENTS.md`, `CLAUDE.md`, and `docs/**`. Classifies dirty files. Does not delete unexplained owner work.

## Managed update

```bash
node iaf/bin/iaf-ecc update --repo /path/to/repo
```

Re-runs official installers for selected targets, reapplies the IAF overlay, refreshes provenance.

## Fleet

```bash
node iaf/bin/iaf-ecc fleet-status --json
node iaf/bin/iaf-ecc fleet-update --repo /path/to/checkout
```

`fleet-status` is read-only. `fleet-update` mutates one id at a time and refuses `--all`.
