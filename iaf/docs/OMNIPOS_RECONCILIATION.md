# OmniPOS PR #18 reconciliation

Prototype: https://github.com/Iaf-Software/iaf-omnipos/pull/18
Branch: `chore/ecc-cursor-autonomous-orchestration`
Commit: `a43a1be0ffd9f6784f9088e1376ce4573030fbc3`
Status: OPEN, not merged by this control-plane work.

## Classification

| Prototype change | Belongs |
| --- | --- |
| Official Cursor `hooks-runtime` | Official ECC installer (`--enable-hooks`) |
| Project alwaysApply orchestration rule | IAF overlay template (generic, not OmniPOS-branded) |
| `scripts/hooks` and `scripts/lib` repo-root symlinks | IAF generic hook-path rewrite; do **not** copy symlinks into every consumer |
| Secret-scanner allowlist of ECC detector regexes | IAF secret-scanner compatibility policy; project scanners keep their own files |
| Empty `.cursor/mcp.json` | IAF MCP policy (optional off) |
| OmniPOS-specific secret false positives (VARIANT_TOKEN_PATTERN, test PEMs) | OmniPOS project-specific; keep there |

## Generic fixes now in IAF ECC

- Cursor hook `require('../../scripts/...')` → `.cursor`-relative rewrite
- Cursor generated `model: sonnet` → `inherit` plus preferred sidecar
- Catalog-driven orchestration contract
- Harness-first skill paths

## Do not

- Merge PR 18 as the fleet template
- Create an OmniPOS live checkout on rive04
- Copy OmniPOS application memory into other repositories
