#!/bin/bash
# create-tags.sh
# Creates git tags for the coordinated merge

set -e

REPO="ReflectivEI/reflectiv-ai"

echo "🏷️  Creating Git Tags for Coordinated Merge"
echo "==========================================="
echo ""

# Check if we're in a git repo
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo "❌ Not in a git repository"
    exit 1
fi

# Fetch latest from origin
echo "Fetching latest from origin..."
git fetch origin main
git checkout main
git pull origin main

echo ""
echo "📋 Finding Merge Commits"
echo "------------------------"

# Try to load SHAs from previous scripts
FRONTEND_SHA=""
WORKER_SHA=""

if [ -f /tmp/frontend-merge-sha.txt ]; then
    FRONTEND_SHA=$(cat /tmp/frontend-merge-sha.txt)
    echo "Frontend SHA from file: $FRONTEND_SHA"
else
    # Try to find from recent commits
    FRONTEND_SHA=$(git log --oneline --grep="Frontend.*integration\|emitEi" -1 --format=%H 2>/dev/null || echo "")
    if [ -z "$FRONTEND_SHA" ]; then
        echo "⚠️  Could not auto-detect frontend merge commit"
        read -p "Enter frontend merge commit SHA: " FRONTEND_SHA
    else
        echo "Auto-detected frontend SHA: $FRONTEND_SHA"
    fi
fi

if [ -f /tmp/worker-merge-sha.txt ]; then
    WORKER_SHA=$(cat /tmp/worker-merge-sha.txt)
    echo "Worker SHA from file: $WORKER_SHA"
else
    # Try to find from recent commits
    WORKER_SHA=$(git log --oneline --grep="Worker.*schema\|align.*EI" -1 --format=%H 2>/dev/null || echo "")
    if [ -z "$WORKER_SHA" ]; then
        echo "⚠️  Could not auto-detect worker merge commit"
        read -p "Enter worker merge commit SHA: " WORKER_SHA
    else
        echo "Auto-detected worker SHA: $WORKER_SHA"
    fi
fi

# Verify SHAs exist
if ! git cat-file -e "$FRONTEND_SHA" 2>/dev/null; then
    echo "❌ Frontend SHA is invalid: $FRONTEND_SHA"
    exit 1
fi

if ! git cat-file -e "$WORKER_SHA" 2>/dev/null; then
    echo "❌ Worker SHA is invalid: $WORKER_SHA"
    exit 1
fi

echo ""
echo "Commits to tag:"
echo "  Frontend: $FRONTEND_SHA"
echo "  $(git log --oneline -1 $FRONTEND_SHA)"
echo ""
echo "  Worker: $WORKER_SHA"
echo "  $(git log --oneline -1 $WORKER_SHA)"

echo ""
read -p "Create tags for these commits? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Tag creation cancelled"
    exit 0
fi

echo ""
echo "📋 Creating Tags"
echo "----------------"

# Create frontend tag
echo "Creating tag: frontend-8h-v1"
git tag -a frontend-8h-v1 $FRONTEND_SHA -m "Frontend: EI payload integration for sales-simulation mode

This tag marks the frontend changes that enable the widget to request
EI payloads from the Worker by appending ?emitEi=true to chat requests.

Changes:
- Modified widget.js to append ?emitEi=true for sales-simulation mode
- Updated cache bust to ?v=emitEi
- EI panel rendering ready for server data

PR: #34
Commit: $FRONTEND_SHA"

echo "✅ Created frontend-8h-v1"

# Create worker tag
echo "Creating tag: worker-8h-v1"
git tag -a worker-8h-v1 $WORKER_SHA -m "Worker: EI schema alignment with deterministic scoring

This tag marks the worker changes that emit EI payloads when requested
via ?emitEi=true parameter in sales-simulation mode.

Changes:
- New computeEIScores() function with deterministic heuristics
- Schema mapping: new dimensions → legacy keys
- Feature flag support via ?emitEi query parameter
- Conditional EI emission for sales-simulation only

PR: #33
Commit: $WORKER_SHA"

echo "✅ Created worker-8h-v1"

echo ""
echo "📋 Pushing Tags to Remote"
echo "-------------------------"

# Push tags
git push origin frontend-8h-v1
echo "✅ Pushed frontend-8h-v1"

git push origin worker-8h-v1
echo "✅ Pushed worker-8h-v1"

echo ""
echo "📋 Verify Tags"
echo "--------------"
git tag -l "*-8h-v1"

echo ""
echo "✅ Tags created and pushed successfully!"
echo ""
echo "View tags on GitHub:"
echo "  Frontend: https://github.com/${REPO}/releases/tag/frontend-8h-v1"
echo "  Worker: https://github.com/${REPO}/releases/tag/worker-8h-v1"
echo ""
echo "📋 Next Step: Create final summary"
echo "   bash docs/scripts/create-summary.sh"
