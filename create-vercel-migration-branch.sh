#!/bin/bash
# Create vercel-migration branch script
# This script creates the vercel-migration branch from main and pushes it to remote

set -e

echo "Creating vercel-migration branch..."

# Ensure we're in the repository root
cd "$(dirname "$0")"

# Fetch latest from origin
git fetch origin

# Create/reset vercel-migration branch from origin/main
git checkout -B vercel-migration origin/main

echo "✅ vercel-migration branch created from origin/main"
echo "Branch commit: $(git log --oneline -1)"

# Note: Pushing requires authentication
# Repository owner should run: git push -u origin vercel-migration

echo ""
echo "Next step for repository owner:"
echo "  git checkout vercel-migration"
echo "  git push -u origin vercel-migration"
