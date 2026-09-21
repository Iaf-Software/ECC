# Harness matrix

Values are official ECC 2.2.2 + IAF overlay. "Same as Claude" is never implied.

| Capability | Claude Code | Cursor | Codex | Gemini | Antigravity |
| --- | --- | --- | --- | --- | --- |
| Install method | Official plugin / `--target claude` or `claude-project` | Official `--target cursor` project adapter | Official Codex plugin (home). Do not stack legacy sync | Official `--target gemini` | Official `--target antigravity` |
| Project vs global | Plugin often global; project `.claude` optional | Project `.cursor` | Home/plugin + project `AGENTS.md` | Project `.gemini` | Project `.agents` |
| Skills | Official plugin/project skills | Copied into `.cursor/skills` | Plugin catalog | Instruction surface, not Claude skill runtime | `.agents/skills` |
| Automatic skill discovery | Native | Native Cursor skills + IAF rule | Native if plugin present | Instruction-following only | Adapter-dependent |
| Agents/subagents | Native ECC agents | `.cursor/agents` via Task | Not Claude-equivalent | Not Claude-equivalent | Adapter agents |
| Automatic delegation | Native | Parent Agent → Task (verified by OmniPOS reference) | NOT_OBSERVABLE without Codex CLI | NOT_SUPPORTED as Claude Task | NOT_OBSERVABLE here |
| Independent review | Native reviewers | Task specialists | Limited by harness | In-session only | Limited by harness |
| Preferred model semantics | Upstream aliases work | Claude aliases map to Other Models | Must stay on Codex models | Must stay on Gemini models | Backend-selected |
| Model availability discovery | Upstream | Session/account; IAF does not scrape billing | Codex-native | Gemini-native | Backend |
| Model fallback | Preserve upstream | IAF inherit + native family retry | IAF harness-default | IAF harness-default | IAF backend-default |
| Hooks | Official | Official + IAF path rewrite | Plugin trust model | None claimed | None claimed |
| MCP | Optional, default off | Optional, default off | Optional, default off | Optional, default off | Optional, default off |
| Memory | Official ECC | Official Cursor agent-data home | Official if present | Not claimed | Not claimed |
| Doctor | `scripts/doctor.js` | `scripts/doctor.js --target cursor` | Official Codex verification | `doctor.js --target gemini` | `doctor.js --target antigravity` |
| Managed update | Official + IAF update | Official + IAF overlay | Plugin lifecycle | Official + IAF overlay | Official + IAF overlay |
| Routing telemetry | Execution trace policy | Execution trace + sidecar | Execution trace policy | Execution trace policy | Execution trace policy |

## Model-routing matrix

| Harness | Specialist routing | Model discovery | Preferred | Fallback policy | Fallback test | Manual intervention |
| --- | --- | --- | --- | --- | --- | --- |
| Claude | Native | Upstream | Upstream aliases | Preserve upstream | Unit: preferred kept | None for fallback |
| Cursor | Parent → Task | Session-available; no billing scrape | Recorded; generated default `inherit` when Claude unusable | inherit then native families | Unit fixtures | Only if all configured models fail |
| Codex | Strongest supported | Codex-native | Ignore Claude IDs | harness-default | Unit | Install/trust Codex CLI if missing |
| Gemini | Instruction | Gemini-native | Ignore foreign IDs | harness-default | Unit | Install Gemini CLI if missing |
| Antigravity | Adapter | Backend | Do not inject | backend-default | Unit | Use Antigravity app |
