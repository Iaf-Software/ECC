# Upstream update

Remotes (when consistent with the checkout):

- `origin` → `Iaf-Software/ECC`
- `upstream` → `affaan-m/ECC`

Routine strategy is **merge**, not rebase, so published owner history is not rewritten.

## Dry run

```bash
node iaf/bin/iaf-ecc upstream-preview
```

This fetches `upstream/main`, prints commits and diffstat, checks whether upstream touched `iaf/`, and reports whether IAF workarounds look redundant.

## Apply

```bash
node iaf/bin/iaf-ecc upstream-apply --dry-run
node iaf/bin/iaf-ecc upstream-apply --apply
```

Apply is a normal `git merge --no-ff upstream/main`. It refuses if upstream modifies `iaf/`.

Then:

1. Run official ECC tests.
2. Run `node --test iaf/tests/*.test.js`.
3. Run `node iaf/bin/iaf-ecc retire-check`.
4. If upstream now provides equivalent hook-path or model-fallback behavior, retire the IAF module listed in `iaf/policy/equivalent-upstream-features.json`.
5. Commit and push normally. Never force-push.

## Rollback

- During merge: `git merge --abort`
- After a published merge: `git revert -m 1 <merge-commit>`
- Do not `reset --hard` published history

## Pin vs latest

Observed provenance belongs in install metadata, not in update conditionals. `upstream-preview` discovers local HEAD vs `upstream/main` at runtime. Do not roll an upstream merge into every application repository automatically. Use `iaf-ecc update --repo /path` one project at a time after the fork merge is verified.
