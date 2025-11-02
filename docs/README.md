# Coordinated Merge & Verification - Overview

## What This Is

This directory contains documentation and automation for performing a coordinated merge of two related PRs:

- **PR #34** (`copilot/update-frontend-integration` → `main`): Frontend changes to request EI payloads
- **PR #33** (`copilot/update-schema-alignment` → `main`): Worker changes to emit EI payloads

The merge must be coordinated because:
1. Frontend requests `?emitEi=true` parameter
2. Worker responds with `_coach.ei.scores` only when flag is present
3. UI renders yellow EI panel with server data
4. Both must be deployed for end-to-end functionality

## Files in This Directory

### Documentation
- **`COORDINATED_MERGE_GUIDE.md`** - Complete step-by-step guide (380+ lines)
  - All 5 phases explained in detail
  - Verification steps and expected results
  - Troubleshooting common issues
  - Rollback procedures

- **`QUICK_REFERENCE.md`** - Fast track guide
  - TL;DR command sequence
  - Timeline (~80 minutes)
  - Success indicators
  - Critical checkpoints

- **`scripts/README.md`** - Script documentation
  - Usage for each script
  - Prerequisites and requirements
  - Error handling guidance

### Automation Scripts (in `scripts/`)

| Script | Purpose | Phase |
|--------|---------|-------|
| `verify-pr-status.sh` | Check CI & readiness | Pre-merge |
| `merge-frontend.sh` | Merge frontend PR | Phase 1 |
| `verify-pages.sh` | Verify Pages deploy | Phase 1 |
| `merge-worker.sh` | Merge worker PR | Phase 3 |
| `verify-worker.sh` | Verify worker deploy | Phase 3 |
| `test-e2e.sh` | E2E testing checklist | Phase 4 |
| `create-tags.sh` | Create git tags | Phase 5 |
| `create-summary.sh` | Generate summary | Phase 5 |

## Getting Started

### Prerequisites

1. **GitHub CLI** - Authenticated with write access
   ```bash
   gh auth login
   gh auth status
   ```

2. **Standard tools** - curl, jq, git
   ```bash
   # macOS
   brew install curl jq
   
   # Ubuntu/Debian
   apt-get install curl jq
   ```

3. **Cloudflare access** - For worker deployment
   - Wrangler CLI configured, OR
   - Cloudflare dashboard access

4. **Browser** - Chrome/Firefox with DevTools for testing

### Quick Start

```bash
cd /path/to/reflectiv-ai

# Run scripts in order:
bash docs/scripts/verify-pr-status.sh      # 5 min
bash docs/scripts/merge-frontend.sh        # 2 min
bash docs/scripts/verify-pages.sh          # 5 min + wait 3 min
bash docs/scripts/merge-worker.sh          # 2 min

# MANUAL: Deploy worker via wrangler or dashboard

bash docs/scripts/verify-worker.sh         # 3 min
bash docs/scripts/test-e2e.sh              # 20 min (manual)
bash docs/scripts/create-tags.sh           # 3 min
bash docs/scripts/create-summary.sh        # 2 min
```

**Total time:** ~80 minutes including waits and manual steps

## The 5 Phases

### Phase 1: Frontend Merge
1. Verify CI green, diff limited
2. Merge with squash
3. Wait for GitHub Pages deployment
4. Verify widget.js?v=emitEi serves correctly

### Phase 2: Frontend Smoke Test (Pre-Worker)
1. Test sales-simulation mode
2. Confirm request includes emitEi=true
3. Verify frontend still functions (legacy mode)

### Phase 3: Worker Merge + Publish
1. Verify CI green, diff shows EI changes
2. Merge with squash
3. Deploy worker to Cloudflare
4. Verify worker returns EI payloads

### Phase 4: End-to-End Smoke Test
1. Full production test without shim
2. Verify response includes _coach.ei.scores
3. Verify yellow panel with 5 pills
4. Console clean, assets 200
5. Capture screenshots

### Phase 5: Tags + Rollback Documentation
1. Create tags: frontend-8h-v1, worker-8h-v1
2. Generate final summary
3. Document rollback procedures

## Success Criteria

All of these must be ✅ checked:

**Pre-Merge:**
- [ ] Frontend PR #34 CI green
- [ ] Worker PR #33 CI green
- [ ] No merge conflicts
- [ ] Diffs match expectations

**Post-Merge:**
- [ ] Both PRs merged successfully
- [ ] GitHub Pages serving new widget
- [ ] Worker deployed and responding
- [ ] Request includes ?emitEi=true
- [ ] Response includes _coach.ei.scores (5 keys)
- [ ] Yellow EI panel renders with pills
- [ ] Console clean (no errors)
- [ ] Screenshots captured
- [ ] Tags created and pushed

## Guardrails

**DO NOT:**
- Touch PRs #14, #22, #27 (per problem statement)
- Merge if any required check fails
- Proceed without confirmation prompts
- Skip manual verification steps

**DO:**
- Run scripts in order
- Wait for deployments to complete
- Capture screenshots for documentation
- Review rollback instructions before starting

## When Things Go Wrong

### CI Failing
**Stop.** Do not merge. Fix tests or wait for CI to pass.

### Merge Conflicts
**Stop.** Resolve conflicts in GitHub UI first.

### Pages Deployment Fails
**Stop.** Check Actions logs. May need to fix build issues.

### Worker Deployment Fails
**Stop.** Check wrangler logs or Cloudflare dashboard.

### EI Panel Not Rendering
**Debug.** Check Network tab, Console, response payload.

### Console Errors
**Stop.** Fix CSP violations, CORS issues, or 404s.

## Rollback

If critical issues discovered:

```bash
# Get merge SHAs from previous steps
FRONTEND_SHA=$(cat /tmp/frontend-merge-sha.txt)
WORKER_SHA=$(cat /tmp/worker-merge-sha.txt)

# Revert commits
git revert $FRONTEND_SHA
git revert $WORKER_SHA
git push origin main

# Update cache bust
# Edit index.html: ?v=emitEi → ?v=rollback

# Redeploy worker
wrangler publish
```

## Support Resources

- **Main Guide:** `COORDINATED_MERGE_GUIDE.md` - Read first
- **Quick Reference:** `QUICK_REFERENCE.md` - For execution
- **Script Docs:** `scripts/README.md` - For automation details
- **Frontend PR:** https://github.com/ReflectivEI/reflectiv-ai/pull/34
- **Worker PR:** https://github.com/ReflectivEI/reflectiv-ai/pull/33

## Questions?

- Review the complete guide first
- Check troubleshooting sections
- Tag @ReflectivEI in PR comments
- Create an issue with details

---

**Created:** 2025-11-02  
**Author:** Copilot Coding Agent  
**Purpose:** Enable manual execution of coordinated merge & verification  
**Status:** Ready for use
