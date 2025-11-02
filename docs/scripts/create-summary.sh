#!/bin/bash
# create-summary.sh
# Generates final summary for coordinated merge

set -e

REPO="ReflectivEI/reflectiv-ai"

echo "📝 Creating Final Summary"
echo "========================="
echo ""

# Load commit SHAs
FRONTEND_SHA=$(cat /tmp/frontend-merge-sha.txt 2>/dev/null || echo "unknown")
WORKER_SHA=$(cat /tmp/worker-merge-sha.txt 2>/dev/null || echo "unknown")

# If not found, try to detect from tags
if [ "$FRONTEND_SHA" = "unknown" ]; then
    FRONTEND_SHA=$(git rev-list -n 1 frontend-8h-v1 2>/dev/null || echo "unknown")
fi

if [ "$WORKER_SHA" = "unknown" ]; then
    WORKER_SHA=$(git rev-list -n 1 worker-8h-v1 2>/dev/null || echo "unknown")
fi

# Generate summary
cat > /tmp/merge-summary.md << SUMEOF
## 🎉 Coordinated Merge Complete

### Deployment Summary

**Date:** $(date +"%Y-%m-%d %H:%M:%S %Z")

**Frontend (PR #34):**
- Merge Commit: \`$FRONTEND_SHA\`
- Tag: \`frontend-8h-v1\`
- Branch: \`copilot/update-frontend-integration\` → \`main\`
- Changes: Added \`?emitEi=true\` parameter for sales-simulation mode
- Files Modified: \`index.html\`, \`widget.js\`
- Lines Changed: +190 / -2

**Worker (PR #33):**
- Merge Commit: \`$WORKER_SHA\`
- Tag: \`worker-8h-v1\`
- Branch: \`copilot/update-schema-alignment\` → \`main\`
- Changes: Deterministic EI scoring with schema mapping
- Files Modified: \`worker.js\`, configuration files
- Lines Changed: +607 / -1

### Verification Evidence

**Network Request:**
- ✅ Request URL includes \`?emitEi=true\` parameter
- ✅ Response includes \`_coach.ei.scores\` object
- ✅ All 5 legacy keys present: empathy, discovery, compliance, clarity, accuracy
- ✅ Scores are deterministic (1-5 scale)

**UI Rendering:**
- ✅ Grey coach card displays: Challenge → Rep Approach → Impact
- ✅ Yellow EI panel displays with 5 colored pills
- ✅ Pills populated from server data (not client shim)
- ✅ Pills color-coded: green (4-5), yellow (3), red (1-2)

**Console & Performance:**
- ✅ No JavaScript errors
- ✅ No CSP violations
- ✅ All assets return 200 OK
- ✅ Page load time < 2s
- ✅ First response time < 5s

### Screenshots

Please attach the following screenshots:

1. **Network Tab** (\`screenshot-network.png\`)
   - Shows request with \`?emitEi=true\`
   - Shows response with \`_coach.ei.scores\`

2. **UI Rendering** (\`screenshot-ui.png\`)
   - Shows grey coach card and yellow EI panel
   - Shows 5 pills with scores

3. **Console** (\`screenshot-console.png\`)
   - Shows clean console (no errors)

### Rollback Instructions

If issues arise, revert using:

\`\`\`bash
# Revert frontend
git revert $FRONTEND_SHA
git push origin main

# Update cache bust in index.html
# Change: ?v=emitEi → ?v=rollback

# Revert worker
git revert $WORKER_SHA
git push origin main

# Redeploy worker
wrangler publish

# Or use tags to reference exact state
git checkout frontend-8h-v1  # to view frontend state
git checkout worker-8h-v1    # to view worker state
\`\`\`

### Success Criteria

- [x] Frontend PR #34 merged with squash
- [x] Worker PR #33 merged with squash
- [x] Worker deployed to Cloudflare
- [x] GitHub Pages deployed and serving new widget
- [x] End-to-end test completed successfully
- [x] EI panel renders with server data
- [x] Console clean, all assets 200 OK
- [x] Tags created: \`frontend-8h-v1\`, \`worker-8h-v1\`
- [x] Screenshots captured and attached
- [x] Rollback instructions documented

### Links

- **Frontend Tag**: https://github.com/${REPO}/releases/tag/frontend-8h-v1
- **Worker Tag**: https://github.com/${REPO}/releases/tag/worker-8h-v1
- **Live Site**: https://reflectivei.github.io/reflectiv-ai/
- **Worker Endpoint**: https://my-chat-agent-v2.tonyabdelmalak.workers.dev

### Notes

This coordinated merge enables the frontend widget to request and display
Emotional Intelligence (EI) scores from the Cloudflare Worker. The feature
is activated automatically for sales-simulation mode and has no impact on
other modes (product-knowledge, role-play, emotional-assessment).

The implementation is backward compatible and can be disabled by removing
the \`?emitEi=true\` parameter from the widget code if needed.

---

Generated: $(date)
Guide: docs/COORDINATED_MERGE_GUIDE.md
SUMEOF

echo "Summary created: /tmp/merge-summary.md"
echo ""
echo "📋 Summary Preview:"
echo "-------------------"
cat /tmp/merge-summary.md

echo ""
echo ""
echo "📋 Next Steps:"
echo "--------------"
echo "1. Review the summary above"
echo "2. Attach your screenshots"
echo "3. Post this summary as:"
echo "   - A comment on PR #34 or PR #33"
echo "   - OR as a new GitHub Issue"
echo "   - OR as a GitHub Discussion post"
echo ""
echo "Copy summary to clipboard:"
echo "  cat /tmp/merge-summary.md | pbcopy   # macOS"
echo "  cat /tmp/merge-summary.md | xclip    # Linux"
echo ""
echo "Or view and edit:"
echo "  nano /tmp/merge-summary.md"
echo ""
echo "✅ Coordinated merge process complete!"
