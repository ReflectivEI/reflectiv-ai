#!/bin/bash
# ============================================================================
# PHASE 3 EMERGENCY ROLLBACK SCRIPT
# ============================================================================
# Purpose: Fast rollback of PHASE 3 deployment if critical issues detected
# Scope:   Reverts worker.js, widget.js, tests/phase3_edge_cases.js, CI yaml
# Safety:  Requires human approval before force-pushing
# Time:    ~10-15 minutes total
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}      PHASE 3 EMERGENCY ROLLBACK SCRIPT${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# ============================================================================
# STEP 1: PRE-FLIGHT CHECKS
# ============================================================================
echo -e "${GREEN}STEP 1: Pre-Flight Checks${NC}"
echo ""

cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai || {
  echo -e "${RED}ERROR: Could not cd to reflectiv-ai directory${NC}"
  exit 1
}

# Verify git is available
if ! command -v git &> /dev/null; then
  echo -e "${RED}ERROR: git is not installed or not in PATH${NC}"
  exit 1
fi

# Show current branch and status
echo "Current branch:"
git branch
echo ""
echo "Working tree status:"
git status --short
echo ""

# Confirm working tree is clean
if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}WARNING: Working tree is dirty. Uncommitted changes detected.${NC}"
  read -p "Do you want to continue anyway? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 1
  fi
fi

# ============================================================================
# STEP 2: IDENTIFY LAST KNOWN-GOOD COMMIT
# ============================================================================
echo -e "${GREEN}STEP 2: Identify Last Known-Good Commit${NC}"
echo ""
echo "Last 10 commits:"
git log --oneline -10
echo ""

echo -e "${YELLOW}⚠️  IMPORTANT: Identify the commit BEFORE 'Phase 3 format enforcement'${NC}"
echo "   The commit you want is typically the one immediately BEFORE the PHASE 3 deployment."
echo ""
read -p "Enter LAST_KNOWN_GOOD_COMMIT hash (e.g., 5ee72b4): " LAST_KNOWN_GOOD_COMMIT

if [ -z "$LAST_KNOWN_GOOD_COMMIT" ]; then
  echo -e "${RED}ERROR: No commit hash provided${NC}"
  exit 1
fi

# Verify the commit exists
if ! git rev-parse "$LAST_KNOWN_GOOD_COMMIT" > /dev/null 2>&1; then
  echo -e "${RED}ERROR: Commit $LAST_KNOWN_GOOD_COMMIT does not exist${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Commit verified: $LAST_KNOWN_GOOD_COMMIT${NC}"
echo ""

# ============================================================================
# STEP 3: SHOW WHAT WILL BE REVERTED
# ============================================================================
echo -e "${GREEN}STEP 3: Preview Rollback Changes${NC}"
echo ""
echo "Files that will be reverted:"
git diff --name-only "$LAST_KNOWN_GOOD_COMMIT"..HEAD | grep -E "worker\.js|widget\.js|tests/phase3|\.github/workflows"
echo ""

# ============================================================================
# STEP 4: HUMAN APPROVAL CHECKPOINT
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${RED}⚠️  CRITICAL: ROLLBACK WILL PROCEED NEXT ⚠️${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "This script will:"
echo "  1. Revert to commit: $LAST_KNOWN_GOOD_COMMIT"
echo "  2. Push to main branch (force-with-lease for safety)"
echo "  3. Trigger GitHub Actions CI/CD pipeline"
echo ""
echo -e "${RED}DO NOT PROCEED unless:${NC}"
echo "  □ You have confirmed with your team lead"
echo "  □ You have captured logs/error details for post-mortem"
echo "  □ You are authorized to execute emergency rollback"
echo ""

read -p "Type 'ROLLBACK' to proceed (or anything else to cancel): " APPROVAL
if [ "$APPROVAL" != "ROLLBACK" ]; then
  echo -e "${YELLOW}Rollback cancelled by user${NC}"
  exit 0
fi

echo ""

# ============================================================================
# STEP 5: CREATE ROLLBACK COMMIT
# ============================================================================
echo -e "${GREEN}STEP 5: Creating Rollback Commit${NC}"
echo ""

git reset --hard "$LAST_KNOWN_GOOD_COMMIT"
echo -e "${GREEN}✓ Reset to $LAST_KNOWN_GOOD_COMMIT${NC}"
echo ""

# ============================================================================
# STEP 6: PUSH ROLLBACK TO MAIN
# ============================================================================
echo -e "${GREEN}STEP 6: Pushing Rollback to Main${NC}"
echo ""
echo "Current HEAD:"
git log --oneline -1
echo ""

echo -e "${RED}Pushing with --force-with-lease (safest force option)...${NC}"
git push origin main --force-with-lease

echo -e "${GREEN}✓ Rollback commit pushed to main${NC}"
echo ""

# ============================================================================
# STEP 7: POST-ROLLBACK MONITORING
# ============================================================================
echo -e "${GREEN}STEP 7: Post-Rollback Monitoring${NC}"
echo ""

echo "GitHub Actions pipeline should auto-trigger. Monitor at:"
echo "  https://github.com/ReflectivEI/reflectiv-ai/actions"
echo ""

echo "Expected behavior (5-10 min):"
echo "  • lint job: GREEN ✓"
echo "  • phase3-edge-cases job: SKIPPED (file was reverted)"
echo "  • deploy job: GREEN ✓"
echo ""

echo "Check Cloudflare metrics at:"
echo "  https://dash.cloudflare.com → Workers → reflectiv-chat → Logs"
echo ""

echo "Verify post-rollback (should normalize within 5-10 min):"
echo "  • 429 rate: <5/hour"
echo "  • 5xx errors: <1%"
echo "  • Latency: 2-5s median"
echo ""

# ============================================================================
# COMPLETION
# ============================================================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}✓ ROLLBACK COMPLETE${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

echo "Next steps:"
echo "  1. Monitor GitHub Actions: https://github.com/ReflectivEI/reflectiv-ai/actions"
echo "  2. Verify deploy job succeeded"
echo "  3. Check Cloudflare logs for metric normalization"
echo "  4. Document root cause in GitHub issue"
echo "  5. DO NOT re-deploy PHASE 3 until root cause is fixed"
echo ""

echo "Questions? Contact: on-call SRE"
echo ""
