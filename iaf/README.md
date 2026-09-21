# IAF ECC Control Plane

IAF-owned additive layer on top of official [Everything Claude Code](https://github.com/affaan-m/ECC).

Upstream-owned files stay mergeable. IAF behavior lives in `iaf/`.

```
affaan-m/ECC
        ↓  official upstream
Iaf-Software/ECC
        ↓  thin IAF extension (this directory)
official ECC adapters + IAF overlay
        ↓
software repositories
```

## Operator commands

```bash
node iaf/bin/iaf-ecc help
node iaf/bin/iaf-ecc fleet-status --json
node iaf/bin/iaf-ecc bootstrap --repo /path/to/repo --dry-run
node iaf/bin/iaf-ecc adapt --repo /path/to/repo --dry-run
node iaf/bin/iaf-ecc update --repo /path/to/repo --dry-run
node iaf/bin/iaf-ecc fleet-update --repo /path/to/checkout --dry-run
node iaf/bin/iaf-ecc fleet-status --inventory iaf/operator/fleet.inventory.json --json
node iaf/bin/iaf-ecc upstream-preview
node iaf/bin/iaf-ecc smoke-model --json
```

Mutation commands default to dry-run. Pass `--apply` only after reviewing the dry-run.

## Ownership

| Kind | Location |
| --- | --- |
| UPSTREAM-OWNED | Everything outside `iaf/` |
| IAF-OWNED | `iaf/**` plus generated overlay files listed in `.iaf-ecc-state.json` |
| GENERATED | Official ECC adapter copies and `ecc-install-state.json` |
| PROJECT-SPECIFIC | `AGENTS.md`, `docs/**`, unrelated IDE config |

## Tests

```bash
node --test iaf/tests/*.test.js
```
