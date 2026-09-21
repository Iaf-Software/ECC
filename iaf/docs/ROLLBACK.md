# Rollback

- IAF overlay only: delete `.iaf-ecc-state.json` and IAF-owned rule files listed in provenance; re-run official `doctor.js`.
- Failed official install: use official `scripts/repair.js` / `scripts/uninstall.js` for that target. Do not `git reset --hard`.
- Failed upstream merge: `git merge --abort`, or `git revert -m 1 <merge-commit>` if already published.
- Never force-push, never `git clean -fdx`, never restore production databases to “fix” harness files.

# Troubleshooting

- Cursor specialist fails with Other Models spending: expected without IAF overlay. After overlay, generated agents should `inherit`. If a live Task still sends `sonnet`, confirm `.cursor/agents/*.md` was transformed and the session reloaded.
- Hook `Cannot find module '../../scripts/lib/...'`: IAF rewrite not applied, or an old symlink layout is present. Re-run `adapt` and prefer rewrite over new repo-root symlinks.
- Doctor `drifted-managed-files` on `.cursor/mcp.json`: often intentional optional MCP filter. Do not authenticate chrome-devtools to make doctor green.
- Dirty ECC `yarn.lock`: installer `npm install` from `install.sh` can convert Yarn 4 format. IAF calls `install-apply.js` directly. Leave unexplained lockfile dirt uncommitted.
