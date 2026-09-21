---
description: IAF autonomous ECC capability-routing contract. Discover installed capabilities; do not hard-code today's agent names into user prompts.
iaf_owned: true
---

# IAF Autonomous Orchestration Contract

This policy is IAF-owned. It does not replace upstream ECC agent, skill, or hook files.

Capability routing and model routing are separate concerns.

## Required behavior

For every non-trivial engineering task:

1. Discover the currently installed ECC capability catalog for the **current harness** first.
2. Select the smallest relevant set of available ECC skills.
3. Load/read relevant `SKILL.md` workflows before doing work governed by them.
4. For complex, multi-domain, high-risk, architecture, database, security, or major implementation tasks, delegate to installed specialist agents where the harness supports it.
5. Do not require the operator to name specialist agents, skills, hooks, or fallback models.
6. Do not invoke every specialist mechanically.
7. Maintain one clear implementation owner per bounded context.
8. Use independent specialist review where available for relevant code changes.
9. Use appropriate security review for security-sensitive or production changes.
10. Use appropriate verification before completion.
11. Never claim a skill, agent, or hook executed merely because it is installed.
12. Report real harness limitations.
13. Produce a concise ECC EXECUTION TRACE for serious engineering tasks.
14. If the harness cannot provide automatic specialist delegation, use the strongest supported workflow without pretending it did.
15. If a selected specialist's preferred model is unavailable, retry the **same specialist role** with a harness-compatible fallback. Do not abandon a valid specialist solely because of model-provider availability.

## Harness-aware path resolution

Start discovery from the current harness surfaces. Do not assume Claude paths first.

| Harness | Canonical surfaces |
| --- | --- |
| Cursor | `.cursor/skills`, `.cursor/agents`, `.cursor/rules`, `.cursor/commands`, `.cursor/hooks.json` |
| Claude Code | Claude/ECC plugin and project `.claude` surfaces |
| Codex | Codex/ECC plugin and `AGENTS.md` |
| Gemini | `.gemini` |
| Antigravity | `.agents` |

Cross-layout fallback is allowed only when the official ECC adapter requires it.

## Execution trace

Include when a serious engineering task completes:

- skills actually used
- specialist agents actually invoked
- preferred/actual models where observable
- applicable rules
- hooks observed where telemetry exists
- verification/review performed
- important relevant capabilities intentionally skipped and why
- model fallback used yes/no, reason, attempts

Do not log credentials, account IDs, or billing details.

## Model routing

See `iaf/policy/model-routing.json`. Changing model must not change specialist role, instructions, security constraints, or write ownership.
