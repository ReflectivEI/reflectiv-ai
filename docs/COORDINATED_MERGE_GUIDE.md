# Coordinated Merge and Production Verification Guide

## Overview

This guide provides step-by-step instructions for performing a coordinated merge and production verification of two related PRs:

- **Frontend PR #34**: `copilot/update-frontend-integration` → `main`
- **Worker PR #33**: `copilot/update-schema-alignment` → `main`

## Prerequisites

- GitHub account with write access to `ReflectivEI/reflectiv-ai`
- Cloudflare Workers access with wrangler CLI configured
- Browser with DevTools for testing
- Git command line tools

## Phase 1: Frontend Merge (PR #34)

### 1.1 Pre-Merge Verification

**Check CI Status:**
```bash
# View PR status
gh pr view 34 --repo ReflectivEI/reflectiv-ai

# Check if all checks passed
gh pr checks 34 --repo ReflectivEI/reflectiv-ai
```

**Expected Result:** All CI checks should be ✅ green.

**Verify Diff Limited to Expected Files:**
```bash
# Fetch the PR branch
git fetch origin copilot/update-frontend-integration:pr-34-frontend

# Check files changed
git diff main..pr-34-frontend --name-only

# Review actual changes
git diff main..pr-34-frontend
```

**Expected Changes:**
- `index.html`: Cache-bust update (`?v=202511021843` → `?v=emitEi`)
- `widget.js`: Addition of `?emitEi=true` query parameter logic
- Documentation: `PHASE_C_INTEGRATION.md` (optional)

**Total:** ~8 lines modified across 2-3 files

### 1.2 Merge Frontend PR

```bash
# Merge using squash (via GitHub UI or CLI)
gh pr merge 34 --repo ReflectivEI/reflectiv-ai --squash --delete-branch

# Or via GitHub UI:
# 1. Navigate to https://github.com/ReflectivEI/reflectiv-ai/pull/34
# 2. Click "Squash and merge"
# 3. Confirm merge
# 4. Note the commit SHA
```

### 1.3 Post-Merge Comment

Post a comment on PR #34 with:
```markdown
✅ **Frontend Merged**

- **Commit SHA**: `<commit-sha-from-merge>`
- **Pages Build**: Check https://github.com/ReflectivEI/reflectiv-ai/actions
- **Live URL**: https://reflectivei.github.io/reflectiv-ai/

**Verification:**
- Cache-bust active: `widget.js?v=emitEi`
- No CSP violations detected
```

### 1.4 Verify GitHub Pages Deployment

**Wait for Pages Build:**
```bash
# Monitor Pages deployment
gh run list --repo ReflectivEI/reflectiv-ai --workflow=pages-build-deployment --limit 1

# Get deployment URL
echo "Check: https://reflectivei.github.io/reflectiv-ai/"
```

**Browser Verification:**
1. Open: `https://reflectivei.github.io/reflectiv-ai/`
2. Open DevTools → Network tab
3. Verify `/widget.js?v=emitEi` loads with `200 OK`
4. Console tab: Confirm no CSP violations

**Expected:** Clean console, widget.js loads successfully

## Phase 2: Frontend Smoke Test (Pre-Worker Merge)

### 2.1 Test Sales Simulation

**Steps:**
1. Navigate to `https://reflectivei.github.io/reflectiv-ai/#simulations`
2. Open DevTools → Network tab
3. Select "Sales Simulation" mode
4. Send a test message: *"Tell me about the product"*

**Verification:**
```javascript
// In Network tab, find the request to Worker
// Filter by: my-chat-agent-v2.tonyabdelmalak.workers.dev

// Check Request URL includes:
?emitEi=true

// Check Request Headers include (optional):
X-Emit-EI: true
```

**Expected Behavior (Worker Not Yet Deployed):**
- Request includes `emitEi=true` parameter ✅
- Frontend functions normally ✅
- Shows legacy bullet-point coach feedback ✅
- Yellow EI panel NOT yet visible (worker doesn't return EI data yet) ✅

**Screenshot:** Capture Network tab showing `emitEi=true` in request

## Phase 3: Worker Merge + Publish (PR #33)

### 3.1 Pre-Merge Verification

**Note:** PR #33 is in the `reflectiv-ai` repo but modifies `worker.js`. This appears to be a monorepo or the worker code is co-located.

**Check CI Status:**
```bash
# View PR status
gh pr view 33 --repo ReflectivEI/reflectiv-ai

# Check if all checks passed
gh pr checks 33 --repo ReflectivEI/reflectiv-ai
```

**Verify Diff Shows EI Schema Alignment:**
```bash
# Fetch the PR branch
git fetch origin copilot/update-schema-alignment:pr-33-worker

# Check files changed
git diff main..pr-33-worker --name-only

# Review worker.js changes
git diff main..pr-33-worker -- worker.js
```

**Expected Changes:**
- `worker.js`: New `computeEIScores()` function with deterministic scoring
- Schema mapping: new dimensions → legacy keys
- Feature flag: `?emitEi=true` parameter handling
- Conditional EI emission for `sales-simulation` mode

**Total:** ~600 lines added (includes EI scoring logic)

### 3.2 Merge Worker PR

```bash
# Merge using squash
gh pr merge 33 --repo ReflectivEI/reflectiv-ai --squash --delete-branch

# Note the commit SHA
```

### 3.3 Publish Cloudflare Worker

**Option A: Using Wrangler CLI**
```bash
# Navigate to project directory
cd /path/to/reflectiv-ai

# Publish to production
wrangler publish

# Or with specific config
wrangler publish --config wrangler.toml

# Verify deployment
wrangler tail --format pretty
```

**Option B: Using GitHub Actions (if configured)**
```bash
# Trigger deployment workflow
gh workflow run deploy-worker --repo ReflectivEI/reflectiv-ai

# Monitor deployment
gh run watch
```

**Get Deployment URL:**
```bash
# Worker URL should be:
https://my-chat-agent-v2.tonyabdelmalak.workers.dev

# Test health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

### 3.4 Post-Merge Comment

Post a comment on PR #33 with:
```markdown
✅ **Worker Deployed**

- **Commit SHA**: `<commit-sha-from-merge>`
- **Deployment URL**: https://my-chat-agent-v2.tonyabdelmalak.workers.dev
- **Version**: worker-8h-v1
- **Features**: EI payload emission with deterministic scoring

**Test endpoint:**
\`\`\`bash
curl -X POST 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat?emitEi=true' \\
  -H 'Content-Type: application/json' \\
  -d '{"user":"Test message","mode":"sales-simulation"}'
\`\`\`

Expected response includes \`_coach.ei.scores\` with 5 dimensions.
```

## Phase 4: End-to-End Smoke Test (Production)

### 4.1 Full Production Test

**Steps:**
1. Clear browser cache (Ctrl+Shift+Del)
2. Navigate to `https://reflectivei.github.io/reflectiv-ai/#simulations`
3. Open DevTools → Network tab, Console tab
4. Select "Sales Simulation" mode
5. Send message: *"What are the key benefits?"*

**Verification Checklist:**

**Network Request:**
```javascript
// Request URL:
POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat?emitEi=true

// Response should include:
{
  "reply": "...",
  "coach": {
    "overall": 85,
    "worked": [...],
    "improve": [...]
  },
  "_coach": {
    "ei": {
      "scores": {
        "empathy": 4,
        "discovery": 5,
        "compliance": 5,
        "clarity": 5,
        "accuracy": 5
      },
      "rationales": { ... },
      "tips": [ ... ],
      "rubric_version": "v1.2"
    }
  }
}
```

**UI Verification:**
- ✅ Grey coach card renders (Challenge → Rep Approach → Impact)
- ✅ Yellow EI panel appears with 5 colored pills
- ✅ Pills show scores from `_coach.ei.scores`:
  - Empathy
  - Discovery
  - Compliance
  - Clarity
  - Accuracy
- ✅ Pills are color-coded (green 4-5, yellow 3, red 1-2)

**Console:**
- ✅ No JavaScript errors
- ✅ No CSP violations
- ✅ All assets return 200

**Screenshots Required:**
1. Network tab showing request with `emitEi=true` and response with `_coach.ei`
2. UI showing both grey coach card and yellow EI panel with pills
3. Console showing clean output (no errors)

### 4.2 Test Without ?eiShim=1

Confirm the production flow works without the development shim:

```bash
# URL should NOT include eiShim parameter
https://reflectivei.github.io/reflectiv-ai/#simulations
```

### 4.3 Performance Check

Record timestamps:
```javascript
// In browser console:
performance.getEntriesByType('navigation')[0].responseEnd
```

**Expected:** Page load < 2s, first response < 5s

## Phase 5: Tags + Rollback Documentation

### 5.1 Create Git Tags

```bash
# Fetch latest main
git fetch origin main
git checkout main
git pull origin main

# Get merge commit SHAs
FRONTEND_SHA=$(git log --oneline --grep="Frontend.*integration" -1 --format=%H)
WORKER_SHA=$(git log --oneline --grep="Worker.*schema" -1 --format=%H)

# Create tags
git tag -a frontend-8h-v1 $FRONTEND_SHA -m "Frontend: EI payload integration"
git tag -a worker-8h-v1 $WORKER_SHA -m "Worker: EI schema alignment"

# Push tags
git push origin frontend-8h-v1
git push origin worker-8h-v1

# Verify
git tag -l "*-8h-v1"
```

### 5.2 Final Summary Comment

Create a new issue or comment with:

```markdown
## 🎉 Coordinated Merge Complete

### Deployment Summary

**Frontend (PR #34):**
- Merge Commit: `<frontend-sha>`
- Tag: `frontend-8h-v1`
- Changes: Added `?emitEi=true` parameter for sales-simulation mode

**Worker (PR #33):**
- Merge Commit: `<worker-sha>`
- Tag: `worker-8h-v1`
- Changes: Deterministic EI scoring with schema mapping

### Verification Evidence

**Network Request:**
![Network tab showing emitEi=true and _coach.ei response](screenshot-network.png)

**UI Rendering:**
![EI panel with 5 populated pills from server data](screenshot-ui.png)

**Console:**
![Clean console with no errors](screenshot-console.png)

### Rollback Instructions

If issues arise, revert using:

\`\`\`bash
# Revert frontend
git revert <frontend-sha>
git push origin main

# Revert worker
git revert <worker-sha>
git push origin main

# Redeploy worker
wrangler publish

# Or use tags
git revert frontend-8h-v1
git revert worker-8h-v1
\`\`\`

**Cache Bust:** Update `index.html` to `?v=rollback` to force browser cache clear.

### Success Criteria

- [x] Frontend merged with squash
- [x] Worker merged with squash
- [x] Worker deployed to Cloudflare
- [x] End-to-end test passed
- [x] EI panel renders with server data
- [x] Console clean, assets 200
- [x] Tags created
- [x] Screenshots captured
- [x] Rollback documented
```

## Troubleshooting

### Issue: CI Checks Failing

**Symptoms:** PR shows red ❌ status

**Solution:**
```bash
# Check specific check logs
gh pr checks <pr-number> --repo ReflectivEI/reflectiv-ai

# If linting fails, run locally:
npm run lint

# If tests fail:
npm test

# Fix issues and push
```

**Blocker Criteria:** Do not merge if any required check fails. Request clarification from PR author.

### Issue: Pages Deployment Fails

**Symptoms:** GitHub Pages build fails after merge

**Solution:**
```bash
# Check Pages build logs
gh run list --repo ReflectivEI/reflectiv-ai --workflow=pages-build-deployment

# View specific run
gh run view <run-id> --log

# Common issues:
# - Large file sizes (>100MB)
# - Invalid HTML
# - Missing dependencies
```

### Issue: Worker Deployment Fails

**Symptoms:** `wrangler publish` returns error

**Solution:**
```bash
# Check wrangler config
cat wrangler.toml

# Verify authentication
wrangler whoami

# Check account limits
wrangler dev --local

# Deploy with verbose logging
wrangler publish --verbose
```

### Issue: EI Panel Not Rendering

**Symptoms:** Yellow panel doesn't appear after merge

**Debugging:**
1. Open DevTools → Network tab
2. Find POST request to worker
3. Check if request includes `?emitEi=true`
4. Check if response includes `_coach.ei.scores`
5. Check Console for JavaScript errors

**Common Causes:**
- Worker not deployed yet → Deploy worker
- Mode not `sales-simulation` → Switch to Sales Simulation
- Browser cache → Hard refresh (Ctrl+Shift+R)
- CSP blocking request → Check console for CSP errors

### Issue: CSP Violations

**Symptoms:** Console shows CSP errors

**Solution:**
```bash
# Check index.html CSP meta tag includes:
connect-src 'self' https://my-chat-agent-v2.tonyabdelmalak.workers.dev

# Update if needed:
# Edit index.html, add worker domain to connect-src
# Commit and push
```

## Verification Checklist

Use this checklist to track progress:

### Pre-Merge
- [ ] Frontend PR #34 CI green
- [ ] Frontend diff limited to expected files
- [ ] Worker PR #33 CI green
- [ ] Worker diff shows EI alignment and emit flag

### Frontend Merge
- [ ] Squash merge completed
- [ ] Commit SHA recorded
- [ ] Comment posted with SHA and Pages link
- [ ] Pages build successful
- [ ] widget.js?v=emitEi serves correctly
- [ ] No CSP violations

### Frontend Smoke (Pre-Worker)
- [ ] Opened /#simulations
- [ ] Switched to Sales Simulation
- [ ] Sent test message
- [ ] Confirmed request includes emitEi=true
- [ ] Frontend functions normally (legacy bullets)
- [ ] Screenshot captured

### Worker Merge + Publish
- [ ] Squash merge completed
- [ ] Commit SHA recorded
- [ ] Worker deployed via wrangler
- [ ] Deployment URL verified
- [ ] Comment posted with version

### End-to-End Smoke
- [ ] Repeated chat flow without ?eiShim=1
- [ ] Response contains _coach.ei.scores
- [ ] Yellow panel shows 5 pills from server
- [ ] Pills populated correctly (empathy, discovery, etc.)
- [ ] Console clean, no errors
- [ ] All assets return 200
- [ ] Screenshots captured (3 total)
- [ ] Timestamps recorded

### Tags + Rollback
- [ ] Frontend tag created: frontend-8h-v1
- [ ] Worker tag created: worker-8h-v1
- [ ] Tags pushed to origin
- [ ] Final comment posted with:
  - [ ] Links to merge commits
  - [ ] Screenshot of Network tab
  - [ ] Screenshot of UI
  - [ ] Rollback instructions

## Timeline Estimate

- **Phase 1 (Frontend Merge):** 15-20 minutes
- **Phase 2 (Frontend Smoke):** 10 minutes
- **Phase 3 (Worker Merge + Publish):** 20-25 minutes
- **Phase 4 (E2E Smoke):** 15-20 minutes
- **Phase 5 (Tags + Rollback Docs):** 10 minutes

**Total:** ~70-85 minutes

## Contact

If you encounter blockers or need clarification:
- Create an issue in the repository
- Tag @ReflectivEI in PR comments
- Reference this guide: `docs/COORDINATED_MERGE_GUIDE.md`
