# MANUAL ACTIONS REQUIRED

Do not put credentials in this file. Do not raise paid-model spending merely because an ECC agent prefers Claude on Cursor.

| Harness | Machine | Why | Exact action | When | How to verify | Blocking |
| --- | --- | --- | --- | --- | --- | --- |
| Claude Code | rive04 | Operator disabled Claude Code to block automatic consumption | Restore only from `~/.disabled-claude-code-*/claude.original` if you intentionally want Claude Code on the server | Optional | `claude --version` | NON-BLOCKING for Cursor/Gemini/Antigravity project adapters |
| Codex CLI | rive04 | `codex` binary is not installed; `~/.codex` exists from the app | Install/enable Codex CLI only if you want Codex live tests; do not stack legacy ECC sync | Optional | `command -v codex` | NON-BLOCKING for the control plane; Codex live routing remains NOT_TESTABLE here |
| Gemini CLI | rive04 | `gemini` binary is not installed | Install Gemini CLI if you want live Gemini routing tests | Optional | `command -v gemini` | NON-BLOCKING |
| Cursor | operator Mac / SSH remote | Hook permission prompts and model picker are user-level | Accept Cursor hook permissions if prompted; do not enable Other Models spend to satisfy `model: sonnet` | On first hooked session | Hook probe exits 2 on unsafe shell; specialists run on inherit/native | NON-BLOCKING if IAF inherit overlay is applied |
| Cursor | operator account | Preferred Claude path may still exist as Other Models | Leave spending limits unchanged; IAF retries inherit/native | Normal work | Execution trace shows fallback | NON-BLOCKING |
| Codex plugin | operator Codex app | Native plugin trust prompt | Accept official ECC Codex plugin if you use Codex | When using Codex | Official ECC Codex doctor/plugin cache | NON-BLOCKING |
| MCP | any | Optional connectors need auth | Do not authenticate chrome-devtools or other optional MCP unless a project requires it | Never by default | `.cursor/mcp.json` empty or filtered | NON-BLOCKING |
| OmniPOS PR 18 | Mac canonical worktree | Prototype, not a fleet template | Do not merge blindly; reconcile through IAF update after this control plane is on `Iaf-Software/ECC` | After IAF PR review | Compare generated overlay vs PR 18 | NON-BLOCKING |
