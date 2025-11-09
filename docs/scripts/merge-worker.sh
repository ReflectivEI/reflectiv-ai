#!/bin/bash
# merge-worker.sh
# Merges worker PR #33 and deploys to Cloudflare

set -e

REPO="ReflectivEI/reflectiv-ai"
PR_NUMBER=33
WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

echo "🚀 Merging Worker PR #${PR_NUMBER}"
echo "===================================="
echo ""

# Confirm merge
read -p "Are you sure you want to merge worker PR #${PR_NUMBER}? (yes/no): " CONFIRM
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
    --subject "fix: align EI schema with frontend legacy keys" \
    --body "Merged PR #${PR_NUMBER}: Worker schema alignment for EI payloads"

echo ""
echo "✅ Worker PR merged successfully"
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
    echo "$COMMIT_SHA" > /tmp/worker-merge-sha.txt
    echo "   Saved to: /tmp/worker-merge-sha.txt"
fi

echo ""
echo "📋 Phase 2: Deploy Worker to Cloudflare"
echo "----------------------------------------"
echo ""
echo "⚠️  MANUAL STEP REQUIRED:"
echo ""
echo "You need to deploy the worker using one of these methods:"
echo ""
echo "Method 1 - Wrangler CLI (if you have access):"
echo "  cd /path/to/reflectiv-ai"
echo "  wrangler publish"
echo ""
echo "Method 2 - GitHub Actions (if configured):"
echo "  gh workflow run deploy-worker --repo $REPO"
echo ""
echo "Method 3 - Cloudflare Dashboard:"
echo "  1. Login to Cloudflare dashboard"
echo "  2. Navigate to Workers & Pages"
echo "  3. Find: my-chat-agent-v2"
echo "  4. Deploy latest code"
echo ""

read -p "Have you deployed the worker? (yes/no): " DEPLOYED
if [ "$DEPLOYED" != "yes" ]; then
    echo ""
    echo "⚠️  Worker not deployed yet"
    echo "   Please deploy and then run:"
    echo "   bash docs/scripts/verify-worker.sh"
    exit 0
fi

echo ""
echo "Running worker verification..."
bash docs/scripts/verify-worker.sh
