# Quick Reference: Coordinated Merge

## TL;DR - Fast Track

```bash
cd /path/to/reflectiv-ai

# 1. Verify ready
bash docs/scripts/verify-pr-status.sh

# 2. Merge frontend → wait 3 min → verify pages
bash docs/scripts/merge-frontend.sh
bash docs/scripts/verify-pages.sh

# 3. Merge worker → deploy → verify
bash docs/scripts/merge-worker.sh
# MANUAL: Deploy via wrangler or Cloudflare dashboard
bash docs/scripts/verify-worker.sh

# 4. Test in browser (manual checklist)
bash docs/scripts/test-e2e.sh

# 5. Tag & document
bash docs/scripts/create-tags.sh
bash docs/scripts/create-summary.sh
```

## Manual Steps Required

### 1. Browser Testing
After running `test-e2e.sh`, complete these in browser:
- Open https://reflectivei.github.io/reflectiv-ai/#simulations
- Select Sales Simulation mode
- Send test message
- Verify Network tab shows `?emitEi=true`
- Verify UI shows yellow EI panel with 5 pills
- Take 3 screenshots (network, UI, console)

### 2. Worker Deployment
After merging worker PR, deploy via:
```bash
# Option 1: Wrangler CLI
wrangler publish

# Option 2: GitHub Actions
gh workflow run deploy-worker

# Option 3: Cloudflare Dashboard
# Login → Workers & Pages → my-chat-agent-v2 → Deploy
```

## Expected Timeline

| Phase | Duration | Task |
|-------|----------|------|
| 1 | 5 min | Verify PRs ready |
| 2 | 15 min | Merge frontend + Pages deploy |
| 3 | 10 min | Frontend browser test |
| 4 | 15 min | Merge worker + deploy |
| 5 | 5 min | Verify worker |
| 6 | 20 min | E2E browser testing |
| 7 | 5 min | Create tags |
| 8 | 5 min | Generate summary |
| **Total** | **~80 min** | |

## Success Indicators

### ✅ Frontend Merged
- [ ] PR #34 merged
- [ ] Pages build complete
- [ ] widget.js?v=emitEi returns 200
- [ ] Network request includes `?emitEi=true`

### ✅ Worker Merged
- [ ] PR #33 merged
- [ ] Worker deployed
- [ ] Response includes `_coach.ei.scores`
- [ ] All 5 keys present (empathy, discovery, compliance, clarity, accuracy)

### ✅ E2E Passed
- [ ] Yellow EI panel visible
- [ ] 5 pills populated from server
- [ ] Console clean (no errors)
- [ ] Screenshots captured

### ✅ Complete
- [ ] Tags created (frontend-8h-v1, worker-8h-v1)
- [ ] Summary generated
- [ ] Rollback docs ready

## Critical Checkpoints

**STOP and investigate if:**
- ❌ CI checks fail on either PR
- ❌ Merge conflicts exist
- ❌ Pages deployment fails
- ❌ Widget doesn't load with `?v=emitEi`
- ❌ Worker returns non-200 status
- ❌ Response missing `_coach.ei.scores`
- ❌ Console shows errors
- ❌ EI panel doesn't render

## Rollback Plan

If critical issues found:

```bash
# Quick rollback
git revert <frontend-sha>
git revert <worker-sha>
git push origin main

# Update cache
# Edit index.html: ?v=emitEi → ?v=rollback

# Redeploy worker
wrangler publish
```

## Key URLs

- **Live Site:** https://reflectivei.github.io/reflectiv-ai/
- **Simulations:** https://reflectivei.github.io/reflectiv-ai/#simulations
- **Worker:** https://my-chat-agent-v2.tonyabdelmalak.workers.dev
- **Actions:** https://github.com/ReflectivEI/reflectiv-ai/actions

## Key Files

- **Guide:** `docs/COORDINATED_MERGE_GUIDE.md`
- **Scripts:** `docs/scripts/*.sh`
- **Frontend PR:** #34
- **Worker PR:** #33

## Quick Troubleshooting

| Issue | Solution |
|-------|----------|
| CI failing | Wait or fix tests |
| Merge conflict | Resolve in GitHub UI |
| Pages pending | Wait 2-5 min, retry |
| Worker not deployed | Run wrangler publish |
| EI panel missing | Check response has `_coach.ei` |
| Console errors | Check CSP, CORS, 404s |

## Contact

Issues? Tag @ReflectivEI in PR or create an issue.

---

**Full Documentation:** See `docs/COORDINATED_MERGE_GUIDE.md` for complete details.
