#!/bin/bash
# merge-frontend.sh
# Merges frontend PR #34 and captures commit SHA

set -e

REPO="ReflectivEI/reflectiv-ai"
PR_NUMBER=34

echo "🚀 Merging Frontend PR #${PR_NUMBER}"
echo "====================================="
echo ""

# Confirm merge
read -p "Are you sure you want to merge frontend PR #${PR_NUMBER}? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Merge cancelled"
    exit 0
fi

echo ""
echo "Merging with squash..."

# Merge PR
gh pr merge $PR_NUMBER \
    --repo $REPO \
    --squash \
    --delete-branch \
    --subject "feat: integrate Worker EI payload emission for sales-simulation" \
    --body "Merged PR #${PR_NUMBER}: Frontend integration for Worker EI payloads"

echo ""
echo "✅ Frontend PR merged successfully"
echo ""

# Get the merge commit SHA
sleep 2  # Wait for GitHub to process
COMMIT_SHA=$(gh pr view $PR_NUMBER --repo $REPO --json mergeCommit --jq .mergeCommit.oid)

if [ -z "$COMMIT_SHA" ]; then
    echo "⚠️  Could not retrieve commit SHA automatically"
    echo "   Check manually at: https://github.com/${REPO}/pull/${PR_NUMBER}"
else
    echo "📝 Merge Commit SHA: $COMMIT_SHA"
    
    # Save to file for later reference
    echo "$COMMIT_SHA" > /tmp/frontend-merge-sha.txt
    echo "   Saved to: /tmp/frontend-merge-sha.txt"
fi

echo ""
echo "📋 Next Steps:"
echo "1. Wait for GitHub Pages to deploy (2-5 minutes)"
echo "2. Run: bash docs/scripts/verify-pages.sh"
echo "3. Check deployment at: https://reflectivei.github.io/reflectiv-ai/"
echo ""
echo "Or monitor Pages deployment:"
echo "  gh run list --repo $REPO --workflow=pages-build-deployment --limit 1"
