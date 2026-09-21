# Install-state portability

Official ECC install-state stores **absolute** `target.root`, `target.installStatePath`, and operation `destinationPath` values.

IAF does not replace that ledger. When a checkout moves (worktree → live path, or any other path change) official `install-apply` refuses:

`install-state target does not match the current plan`

## Command

```
node iaf/bin/iaf-ecc repair-install-state --repo <path> --dry-run
node iaf/bin/iaf-ecc repair-install-state --repo <path> --apply
```

## Behavior

1. Verify the current path is a git repository.
2. Read each adapter install-state file.
3. If recorded root already matches, report `HEALTHY`.
4. If the stale root still exists and belongs to a **different** GitHub remote, refuse.
5. Compare managed files at current relative destinations with recorded `contentSha256`.
6. Allow `MATCH` and `IAF_TRANSFORM` (generated Cursor `inherit` + hook path rewrite).
7. Refuse `MISSING` and unexplained `DIVERGED` files.
8. Dry-run prints the rebound state. Apply writes a sibling backup then the rebound JSON.
9. `adapt --apply` then retries official install. Overlay-only remains `TEMPORARY_DEGRADED`, not the target architecture.

Source paths are left as historical provenance. Official repair/reinstall resolves `sourceRelativePath` against the current ECC repository.
