# Architecture

## Purpose

Provide Francesco a repeatable IAF ECC distribution that:

- stays updateable from `affaan-m/ECC`
- does not duplicate the upstream catalog
- routes capabilities from the installed catalog rather than a static prompt list
- treats specialist role and model provider as separate concerns
- adapts Cursor/Codex/Gemini/Antigravity without breaking Claude Code

## Ownership boundaries

IAF code and policy live only under `iaf/`. Official installers remain the mutation engine for harness adapters. IAF wraps them, then applies a small overlay:

1. Call `scripts/install-apply.js` (not a reimplemented installer; not `install.sh`, so a missing `node_modules` cannot rewrite `yarn.lock`).
2. Rewrite generated Cursor hook wrappers so `require('../../scripts/...')` becomes `.cursor`-relative.
3. Transform generated Cursor agent frontmatter `model:` to `inherit` when the preferred Claude alias is not known usable, recording `IAF_PREFERRED_MODEL`.
4. Install IAF orchestration/model-routing rules using each harness's official instruction surface.
5. Write `.iaf-ecc-state.json` provenance without modifying official install-state schema.

## Why upstream ECC alone is insufficient

| IAF module | Purpose | Why upstream is insufficient | Owner | Update impact | Test | Rollback |
| --- | --- | --- | --- | --- | --- | --- |
| `lib/model-routing.js` | Harness-aware fallback | Cursor Task fails on `model: sonnet` Other Models spending limits; Codex/Gemini/Antigravity cannot consume Claude aliases | IAF | Overlay only | `iaf/tests/model-routing.test.js` | Remove overlay; generated agents return to upstream copies on reinstall |
| `lib/hook-compat.js` | Cursor hook path rewrite | Generated `.cursor/hooks` still require repo-root `scripts/` | IAF | Generated copies | `iaf/tests/hook-compat.test.js` | Stop rewrite; do not add consumer symlinks |
| `lib/skill-paths.js` | Harness-first discovery | OmniPOS showed Claude-path-first skill lookup | IAF | Policy/rules | `iaf/tests/skill-paths.test.js` | Remove rule text |
| `lib/secret-scanner-compat.js` | Narrow detector allowlisting | ECC regex/examples trip project scanners | IAF | Policy | `iaf/tests/safety.test.js` | Do not globally ignore `.cursor/` |
| `lib/adapt.js` | Bootstrap/adapt/update | Official installer has no IAF overlay, fleet, or provenance | IAF | CLI | `iaf/tests/workflows.test.js` | Dry-run default; no `--apply` |
| `lib/upstream-sync.js` | Merge workflow | Fork must preview IAF overlap and retire redundant workarounds | IAF | Docs/CLI | overlap detector | `git merge --abort` / revert merge commit |

## Cursor plugin vs official adapter

Official ECC 2.2.2 ships a project-local Cursor adapter (`.cursor/`) with doctor/install-state. A Cursor marketplace plugin is not the official ECC distribution path. IAF keeps the official adapter so update/repair/doctor remain compatible, including SSH checkouts.

## Claude Code

Prefer the native ECC plugin. Do not copy the plugin into every repository. This host currently has Claude Code disabled by operator policy; IAF must not re-enable it.
