# MANUAL ACTIONS REQUIRED

Do not put credentials in this file. Do not raise paid-model spending merely because an ECC agent prefers Claude on Cursor.

| Harness | Machine | Why | Exact action | When | How to verify | Blocking |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | this SSH host | Operator disabled Claude Code to block automatic consumption | Restore only from `~/.disabled-claude-code-*/claude.original` if you intentionally want live Claude Code | Optional | `claude --version` | NON-BLOCKING. Official Claude tests fail here for this reason on both pristine upstream and IAF. |
| Codex CLI | this SSH host | `codex` binary is not installed; `~/.codex` exists from the app | Install/enable Codex CLI only if you want Codex live tests; do not stack legacy ECC sync | Optional | `command -v codex` | NON-BLOCKING |
| Gemini CLI | this SSH host | `gemini` binary is not installed | Install Gemini CLI if you want live Gemini routing tests | Optional | `command -v gemini` | NON-BLOCKING |
| Antigravity | operator workstation | No Antigravity app on this host | Live Antigravity routing/default-model check on a machine that has the app | Optional | Antigravity loads `.agents` overlay | NON-BLOCKING |
| Cursor | operator UI | Task model-availability is not a programmable repository API | Reload window so IAF alwaysApply rules load. Do not name Grok/Composer. Do not raise Other Models spend. | After overlay merge/reload | Parent Agent retries same specialist on inherit after a MODEL_* failure | NON-BLOCKING for implementation; live fallback remains UI-session evidence |
| Cursor hooks | operator UI | Hook permission prompts are user-level | Accept Cursor hook permissions if prompted | First hooked session | `git commit --no-verify` probe exits 2 | NON-BLOCKING |
| Codex plugin | operator Codex app | Native plugin trust prompt | Accept official ECC Codex plugin if you use Codex | When using Codex | Official ECC Codex doctor | NON-BLOCKING |
| MCP | any | Optional connectors need auth | Do not authenticate chrome-devtools or other optional MCP unless a project requires it | Never by default | `.cursor/mcp.json` empty or filtered | NON-BLOCKING |
| OmniPOS PR 18 | Mac canonical worktree | Prototype, superseded as fleet template by IAF + PR 19 | Do not merge #18 as the fleet architecture. Keep OmniPOS-specific scanner/false-positive files. Reconcile remaining unique files on the Mac worktree against #19. | After IAF ECC PR review | Semantic diff #18 vs #19 vs generated overlay | NON-BLOCKING |
| Application overlay PRs | GitHub | Review required; do not auto-merge | Review/merge `chore/iaf-ecc-overlay` PRs after Iaf-Software/ECC PR #1 | After IAF PR review | Application source delta remains 0 | NON-BLOCKING for implementation |
| Original ECC checkout yarn.lock | `/home/innovedge/repositories/ECC` | Accidental `npm install` converted Yarn 4 lockfile metadata to Yarn 1 | Do not commit. Safe cleanup is `git checkout -- yarn.lock` in that checkout only, after confirming no owner yarn work. Isolated tests already used clean clones. | Optional cleanup | `git status` clean yarn.lock | NON-BLOCKING |
