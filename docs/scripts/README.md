# Coordinated Merge Scripts

This directory contains automation scripts to help with the coordinated merge and verification process for PRs #34 (frontend) and #33 (worker).

## Quick Start

Run scripts in this order:

```bash
# 1. Verify PRs are ready
bash docs/scripts/verify-pr-status.sh

# 2. Merge frontend PR
bash docs/scripts/merge-frontend.sh

# 3. Verify GitHub Pages deployment
bash docs/scripts/verify-pages.sh

# 4. Merge worker PR
bash docs/scripts/merge-worker.sh

# 5. Verify worker deployment
bash docs/scripts/verify-worker.sh

# 6. Run end-to-end tests (manual checklist)
bash docs/scripts/test-e2e.sh

# 7. Create git tags
bash docs/scripts/create-tags.sh

# 8. Generate final summary
bash docs/scripts/create-summary.sh
```

## Script Descriptions

### verify-pr-status.sh
Checks CI status, file changes, and merge readiness for both PRs. Run this first to ensure both PRs are ready to merge.

**Usage:**
```bash
bash docs/scripts/verify-pr-status.sh
```

**What it checks:**
- CI passing for both PRs
- File changes match expectations
- No merge conflicts
- PRs are mergeable

### merge-frontend.sh
Merges frontend PR #34 using squash merge and captures the commit SHA.

**Usage:**
```bash
bash docs/scripts/merge-frontend.sh
```

**What it does:**
- Prompts for confirmation
- Merges PR with squash
- Deletes branch
- Captures merge commit SHA
- Saves SHA to `/tmp/frontend-merge-sha.txt`

### verify-pages.sh
Verifies GitHub Pages deployment after frontend merge.

**Usage:**
```bash
bash docs/scripts/verify-pages.sh
```

**What it checks:**
- Pages build status
- Main page returns 200
- Widget.js with cache bust returns 200
- Presence of emitEi code in widget

**Note:** Includes manual verification steps for browser testing.

### merge-worker.sh
Merges worker PR #33 and provides instructions for Cloudflare deployment.

**Usage:**
```bash
bash docs/scripts/merge-worker.sh
```

**What it does:**
- Prompts for confirmation
- Merges PR with squash
- Deletes branch
- Captures merge commit SHA
- Saves SHA to `/tmp/worker-merge-sha.txt`
- Provides deployment instructions

**Note:** Worker deployment must be done manually via wrangler or Cloudflare dashboard.

### verify-worker.sh
Verifies Cloudflare Worker deployment and EI payload emission.

**Usage:**
```bash
bash docs/scripts/verify-worker.sh
```

**What it checks:**
- Worker is reachable
- EI payload emission with `?emitEi=true`
- Response includes all 5 legacy keys
- EI not emitted without flag

**Requirements:**
- `curl` installed
- `jq` installed (for JSON parsing)

### test-e2e.sh
Provides comprehensive checklist for end-to-end browser testing.

**Usage:**
```bash
bash docs/scripts/test-e2e.sh
```

**What it covers:**
- Opening site and DevTools
- Selecting sales simulation mode
- Sending test messages
- Verifying network requests
- Checking UI rendering (coach card + EI panel)
- Console verification
- Performance checks
- Screenshot requirements

**Note:** This is a manual checklist - browser automation is not included.

### create-tags.sh
Creates and pushes git tags for both frontend and worker merges.

**Usage:**
```bash
bash docs/scripts/create-tags.sh
```

**What it does:**
- Fetches latest main branch
- Auto-detects or prompts for merge commit SHAs
- Creates annotated tags:
  - `frontend-8h-v1`
  - `worker-8h-v1`
- Pushes tags to origin

### create-summary.sh
Generates final summary markdown for documentation.

**Usage:**
```bash
bash docs/scripts/create-summary.sh
```

**What it generates:**
- Complete deployment summary
- Commit SHAs and tags
- Verification checklist
- Rollback instructions
- Links to resources

**Output:** `/tmp/merge-summary.md`

## Prerequisites

### Required Tools

- `bash` (shell)
- `git` (version control)
- `gh` (GitHub CLI) - [Install](https://cli.github.com/)
- `curl` (HTTP client)
- `jq` (JSON processor) - [Install](https://stedolan.github.io/jq/)

### GitHub CLI Authentication

Ensure you're authenticated with GitHub CLI:

```bash
gh auth login
gh auth status
```

### Cloudflare Access

For worker deployment, you need:
- Cloudflare account access
- Wrangler CLI configured
- Or access to Cloudflare dashboard

## Environment Variables

No environment variables required. Scripts use hardcoded values:

- `REPO="ReflectivEI/reflectiv-ai"`
- `FRONTEND_PR=34`
- `WORKER_PR=33`

## Temporary Files

Scripts create temporary files in `/tmp`:

- `/tmp/frontend-merge-sha.txt` - Frontend merge commit SHA
- `/tmp/worker-merge-sha.txt` - Worker merge commit SHA
- `/tmp/merge-summary.md` - Final summary document

## Error Handling

All scripts use `set -e` to exit on errors. If a script fails:

1. Read the error message
2. Check the specific verification that failed
3. Resolve the issue
4. Re-run the script

Common issues:

- **CI checks failing:** Wait for CI to complete or fix failing tests
- **Merge conflicts:** Resolve conflicts in GitHub UI before merging
- **Pages deployment pending:** Wait 2-5 minutes and retry
- **Worker not reachable:** Ensure worker is deployed

## Rollback

If issues are discovered after merging:

```bash
# Revert commits
git revert <frontend-sha>
git revert <worker-sha>
git push origin main

# Update cache bust
# Edit index.html: ?v=emitEi → ?v=rollback

# Redeploy worker
wrangler publish
```

Or use tags:

```bash
# View tagged state
git checkout frontend-8h-v1
git checkout worker-8h-v1
```

## Support

For issues or questions:
- Review the main guide: `docs/COORDINATED_MERGE_GUIDE.md`
- Check script comments for details
- Tag @ReflectivEI in PR comments

## License

These scripts are part of the ReflectivEI project and follow the same license.
