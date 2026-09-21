# IAF Autonomous Orchestration (Gemini)

This IAF overlay does not claim Claude Code hook or subagent parity.

Gemini's strongest official ECC surface is project-local `.gemini` instruction. Use it.

For every non-trivial engineering task:

1. Discover capabilities from `.gemini` first, then repository `AGENTS.md`.
2. Select and follow the smallest relevant ECC workflows described there.
3. Do not require the operator to name ECC skills or specialists.
4. If Gemini cannot spawn independent ECC subagents, perform the strongest in-session specialist workflow and report the limitation.
5. Use only Gemini-supported models. Never pass Claude, Cursor, Codex, or Antigravity model identifiers.
6. Prefer Gemini native/default model routing. Fallback only through Gemini-compatible configured defaults.
7. Produce an ECC EXECUTION TRACE distinguishing INSTALLED / SELECTED / EXECUTED / VERIFIED.
