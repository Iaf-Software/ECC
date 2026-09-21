# OmniPOS PR #18 / #19 reconciliation

Prototype #18: https://github.com/Iaf-Software/iaf-omnipos/pull/18
Branch: `chore/ecc-cursor-autonomous-orchestration`
Commit: `a43a1be0ffd9f6784f9088e1376ce4573030fbc3`
Status: OPEN, **SUPERSEDED as fleet architecture**. Not merged.

Managed #19: https://github.com/Iaf-Software/iaf-omnipos/pull/19
Branch: `chore/iaf-ecc-overlay`
Status: OPEN, **READY_TO_MERGE after IAF ECC PR #1**. Not auto-merged.

## #18 classification

| Prototype change | Class |
| --- | --- |
| Official Cursor `hooks-runtime` | NOW_GENERIC_IN_IAF_ECC (official installer `--enable-hooks` + `--with baseline:hooks` when profile omits it) |
| Project alwaysApply orchestration rule | NOW_GENERIC_IN_IAF_ECC |
| `scripts/hooks` and `scripts/lib` repo-root symlinks | OBSOLETE / SUPERSEDED by IAF generated-copy path rewrite |
| Secret-scanner allowlist of ECC detector regexes | NOW_GENERIC_IN_IAF_ECC (classify, do not globally ignore `.cursor/`) |
| Empty `.cursor/mcp.json` | NOW_GENERIC_IN_IAF_ECC default policy (capability preserved) |
| OmniPOS-specific secret false positives (VARIANT_TOKEN_PATTERN, test PEMs) | STILL_OMNIPOS_SPECIFIC — keep in the consumer repo |
| Cursor autonomous orchestration copy that assumes Claude paths | SUPERSEDED |
| Mac-only live hook permission click-through | NEEDS_MANUAL_MAC_VALIDATION |

## #19 classification

| Change | Class |
| --- | --- |
| IAF overlay rules + provenance | GENERATED_PROJECT_CONFIG from IAF_GENERIC_CORE |
| Cursor agent `inherit` + `IAF_UPSTREAM_PREFERRED_MODEL` | GENERATED_PROJECT_CONFIG |
| Official install-state rebind/update + hooks-runtime | ECC_MANAGED |
| Application source | none |

## Plan

1. Review/merge Iaf-Software/ECC PR #1.
2. Review/merge OmniPOS #19 as the managed successor.
3. Leave #18 open until Francesco confirms no unique OmniPOS scanner/false-positive file is missing from `main` or #19, then close #18 as superseded.
4. Do not copy OmniPOS application memory into IAF ECC.
