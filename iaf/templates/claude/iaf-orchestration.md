# IAF Autonomous Orchestration (Claude Code)

Claude Code is the ECC reference harness.

Do not replace a working native ECC plugin with a manual duplicate.

For every non-trivial engineering task, use official ECC capability discovery, planning, specialists, hooks, and model fallback already provided by ECC. Preserve upstream preferred/fallback behavior.

This file only adds the IAF contract:

- capability routing must be catalog-driven, not a static prompt list
- specialist role is independent of model provider
- report real execution, not installation
- do not change operator authentication, MCP, or spending limits
