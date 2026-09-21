# IAF Autonomous Orchestration (Codex)

Use exactly one ECC Codex installation method: the official native plugin lifecycle when supported. Do not stack native plugin + legacy sync.

Project repositories should keep `AGENTS.md` as project context.

For every non-trivial engineering task:

1. Discover ECC capabilities from the Codex plugin/catalog and `AGENTS.md`.
2. Select relevant workflows without requiring the operator to name them.
3. If Codex cannot provide Claude-equivalent subagent delegation, use the strongest supported Codex workflow and report the limitation.
4. Use only models supported by the current OpenAI Codex environment. Never send Claude, Cursor, Gemini, or Antigravity model identifiers.
5. Prefer Codex native/default model routing when that is the official mechanism.
6. Produce an ECC EXECUTION TRACE distinguishing installed vs executed.
