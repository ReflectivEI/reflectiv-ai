#!/bin/bash
# verify-pr-status.sh
# Checks CI status and diff for PRs before merging

set -e

REPO="ReflectivEI/reflectiv-ai"
FRONTEND_PR=34
WORKER_PR=33

echo "🔍 Coordinated Merge PR Verification"
echo "====================================="
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "   Install: https://cli.github.com/"
    exit 1
fi

echo "📋 Phase 1: Frontend PR #${FRONTEND_PR} Status"
echo "----------------------------------------------"

# Check CI status
echo "Checking CI status..."
if gh pr checks $FRONTEND_PR --repo $REPO | grep -q "fail"; then
    echo "❌ BLOCKER: Frontend PR has failing checks"
    gh pr checks $FRONTEND_PR --repo $REPO
    exit 1
else
    echo "✅ All CI checks passing for frontend PR"
fi

# Check files changed
echo ""
echo "Files changed in frontend PR:"
gh pr diff $FRONTEND_PR --repo $REPO --name-only

# Count lines changed
FRONTEND_STATS=$(gh pr view $FRONTEND_PR --repo $REPO --json additions,deletions --jq '{additions:.additions, deletions:.deletions}')
echo ""
echo "Change stats: $FRONTEND_STATS"
echo "Expected: ~190 additions, ~2 deletions"

echo ""
echo "📋 Phase 2: Worker PR #${WORKER_PR} Status"
echo "-------------------------------------------"

# Check CI status
echo "Checking CI status..."
if gh pr checks $WORKER_PR --repo $REPO | grep -q "fail"; then
    echo "❌ BLOCKER: Worker PR has failing checks"
    gh pr checks $WORKER_PR --repo $REPO
    exit 1
else
    echo "✅ All CI checks passing for worker PR"
fi

# Check files changed
echo ""
echo "Files changed in worker PR:"
gh pr diff $WORKER_PR --repo $REPO --name-only

# Count lines changed
WORKER_STATS=$(gh pr view $WORKER_PR --repo $REPO --json additions,deletions --jq '{additions:.additions, deletions:.deletions}')
echo ""
echo "Change stats: $WORKER_STATS"
echo "Expected: ~600 additions, ~1 deletion"

echo ""
echo "📋 Phase 3: Check for Merge Conflicts"
echo "--------------------------------------"

# Check if PRs are mergeable
FRONTEND_MERGEABLE=$(gh pr view $FRONTEND_PR --repo $REPO --json mergeable --jq .mergeable)
WORKER_MERGEABLE=$(gh pr view $WORKER_PR --repo $REPO --json mergeable --jq .mergeable)

if [ "$FRONTEND_MERGEABLE" != "MERGEABLE" ]; then
    echo "⚠️  WARNING: Frontend PR has merge conflicts"
    echo "   Status: $FRONTEND_MERGEABLE"
else
    echo "✅ Frontend PR is mergeable"
fi

if [ "$WORKER_MERGEABLE" != "MERGEABLE" ]; then
    echo "⚠️  WARNING: Worker PR has merge conflicts"
    echo "   Status: $WORKER_MERGEABLE"
else
    echo "✅ Worker PR is mergeable"
fi

echo ""
echo "📋 Summary"
echo "----------"
if [ "$FRONTEND_MERGEABLE" = "MERGEABLE" ] && [ "$WORKER_MERGEABLE" = "MERGEABLE" ]; then
    echo "✅ Both PRs are ready to merge"
    echo ""
    echo "Next steps:"
    echo "1. Run: bash docs/scripts/merge-frontend.sh"
    echo "2. Then: bash docs/scripts/verify-pages.sh"
    echo "3. Then: bash docs/scripts/merge-worker.sh"
    exit 0
else
    echo "❌ One or more PRs have blockers"
    echo "   Review the output above and resolve issues before merging"
    exit 1
fi
