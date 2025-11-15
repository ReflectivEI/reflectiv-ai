# Phase 3 Rollback Commands

## Git Commands to Execute (Copy & Paste)

```bash
# Step 1: Stash all local changes (tracked + untracked)
git stash push -u -m "WIP before Phase 3 rollback"

# Step 2: Checkout and sync local main to origin/main
git checkout main
git fetch origin
git reset --hard origin/main

# Step 3: Create safety branch at current HEAD
git branch phase3-pre-rollback-safety

# Step 4a: Revert the hotfix commit (7c1cbcf)
git revert --no-edit 7c1cbcf

# Step 4b: Revert the Phase 3 format enforcement commit (ff26860)
git revert --no-edit ff26860

# Step 5: Push revert commits to origin/main
git push origin main
```

## What Each Step Does

1. **Stash WIP Changes**: Safely saves all your uncommitted work (both tracked and untracked files) with a clear descriptive message. You can restore these later with `git stash pop`.

2. **Sync to origin/main**: Switches to the main branch and hard-resets it to match exactly what's on the remote (origin/main at 7c1cbcf), ensuring you're starting from a known state.

3. **Create Safety Branch**: Creates a branch pointer at the current HEAD before any reverts, giving you a recovery point if needed.

4. **Revert Phase 3 Commits**: Creates new revert commits (in reverse order - newest first, then older) that undo the Phase 3 changes while preserving all commit history. The rollback runbook commit b666add and everything older remain untouched.

5. **Push to Origin**: Uploads the new revert commits to the remote main branch, deploying the rollback to production.

## Production Verification Checklist

### GitHub Actions
- [ ] Check the latest workflow run at https://github.com/ReflectivEI/reflectiv-ai/actions
- [ ] Verify all CI checks pass (tests, linting, format validation)
- [ ] Confirm no Phase 3-specific test failures
- [ ] Look for successful deployment indicators

### Cloudflare Worker Logs
- [ ] Navigate to Cloudflare Dashboard → Workers & Pages → Your Worker
- [ ] Check "Logs" tab for recent activity
- [ ] Verify no 500/502 errors in worker responses
- [ ] Confirm worker is processing requests with Phase 2 logic:
  - No Phase 3 format enforcement errors
  - No Phase 3-specific metadata issues
  - EI scoring working as it did in Phase 2
  - Product knowledge references functioning correctly
- [ ] Test a live request through the production worker endpoint
- [ ] Confirm response format matches Phase 2 expectations

### Additional Verification
- [ ] Test main site at production URL
- [ ] Verify chat widget loads correctly
- [ ] Send test messages in each mode (Sales Coach, EI, Product Knowledge, Role Play)
- [ ] Confirm responses are formatted correctly without Phase 3 validation errors

## Recovery (If Needed)

If something goes wrong, you can:

1. **Restore your WIP changes**:
   ```bash
   git stash pop
   ```

2. **Return to pre-rollback state**:
   ```bash
   git reset --hard phase3-pre-rollback-safety
   ```

3. **Recover if you already pushed**:
   ```bash
   # Create new revert commits to undo the rollback
   git revert <commit-hash-of-first-revert>
   git revert <commit-hash-of-second-revert>
   git push origin main
   ```

## Notes

- Uses `git revert` (not `reset --hard`) to maintain full history
- No `--force` or `--force-with-lease` needed
- All original commits remain in git history
- WIP changes are safely preserved in stash
- Safety branch provides rollback point
