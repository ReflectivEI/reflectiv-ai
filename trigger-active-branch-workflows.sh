#!/bin/bash
# Script to trigger CI workflows on active branches

set -e

echo "==================================="
echo "Active Branch CI Trigger Script"
echo "==================================="
echo ""

# Define the branches to update
BRANCHES=(
  "copilot/diagnose-chat-issues"
  "copilot/refine-chat-widget-frontend"
  "copilot/implement-ei-first-upgrades"
  "copilot/upgrade-website-for-premium-feel"
)

# Get current branch to return to later
CURRENT_BRANCH=$(git branch --show-current)

echo "Current branch: $CURRENT_BRANCH"
echo ""

for BRANCH in "${BRANCHES[@]}"; do
  echo "-----------------------------------"
  echo "Processing: $BRANCH"
  echo "-----------------------------------"
  
  # Check if branch exists
  if git show-ref --verify --quiet "refs/heads/$BRANCH" || git show-ref --verify --quiet "refs/remotes/origin/$BRANCH"; then
    echo "✓ Branch exists"
    
    # Checkout the branch
    echo "Checking out branch..."
    git checkout "$BRANCH" 2>/dev/null || git checkout -b "$BRANCH" "origin/$BRANCH"
    
    # Pull latest changes
    echo "Pulling latest changes..."
    git pull origin "$BRANCH" --ff-only 2>/dev/null || echo "Already up to date"
    
    # Create an empty commit to trigger CI
    echo "Creating trigger commit..."
    git commit --allow-empty -m "chore: trigger CI workflow for deployment readiness"
    
    # Push to trigger workflow
    echo "Pushing to origin..."
    git push origin "$BRANCH"
    
    echo "✓ Workflow triggered for $BRANCH"
  else
    echo "✗ Branch not found: $BRANCH"
  fi
  
  echo ""
done

# Return to original branch
echo "-----------------------------------"
echo "Returning to original branch: $CURRENT_BRANCH"
git checkout "$CURRENT_BRANCH"

echo ""
echo "==================================="
echo "Summary"
echo "==================================="
echo "Triggered CI workflows for ${#BRANCHES[@]} branches"
echo ""
echo "Next steps:"
echo "1. Monitor workflow runs at: https://github.com/ReflectivEI/reflectiv-ai/actions"
echo "2. Wait for CI checks to complete"
echo "3. Review and merge PRs once CI passes"
echo "4. Deployment will happen automatically on merge to main"
echo ""
echo "✓ Script complete!"
