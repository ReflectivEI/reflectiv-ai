#!/bin/bash
# verify-pages.sh
# Verifies GitHub Pages deployment after frontend merge

set -e

PAGES_URL="https://reflectivei.github.io/reflectiv-ai"
WIDGET_URL="${PAGES_URL}/widget.js?v=emitEi"
REPO="ReflectivEI/reflectiv-ai"

echo "🔍 Verifying GitHub Pages Deployment"
echo "======================================"
echo ""

# Check if curl is available
if ! command -v curl &> /dev/null; then
    echo "❌ curl is not installed"
    exit 1
fi

echo "📋 Phase 1: Check Pages Build Status"
echo "-------------------------------------"
echo "Checking latest Pages deployment..."

# Get latest Pages workflow run
LATEST_RUN=$(gh run list --repo $REPO --workflow=pages-build-deployment --limit 1 --json status,conclusion --jq '.[0]')
STATUS=$(echo $LATEST_RUN | jq -r .status)
CONCLUSION=$(echo $LATEST_RUN | jq -r .conclusion)

echo "Status: $STATUS"
echo "Conclusion: $CONCLUSION"

if [ "$STATUS" = "completed" ] && [ "$CONCLUSION" = "success" ]; then
    echo "✅ Pages deployment successful"
elif [ "$STATUS" = "in_progress" ]; then
    echo "⏳ Pages deployment in progress..."
    echo "   Wait a few minutes and run this script again"
    exit 1
else
    echo "❌ Pages deployment failed or pending"
    echo "   Check: https://github.com/${REPO}/actions"
    exit 1
fi

echo ""
echo "📋 Phase 2: Verify Pages Content"
echo "---------------------------------"

# Check main page
echo "Checking main page: $PAGES_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $PAGES_URL)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Main page returns 200 OK"
else
    echo "❌ Main page returns $HTTP_CODE"
    exit 1
fi

# Check widget.js with cache bust
echo ""
echo "Checking widget with cache bust: $WIDGET_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $WIDGET_URL)
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Widget.js with ?v=emitEi returns 200 OK"
else
    echo "❌ Widget.js returns $HTTP_CODE"
    exit 1
fi

# Download widget and check for emitEi code
echo ""
echo "Verifying emitEi code in widget.js..."
WIDGET_CONTENT=$(curl -s $WIDGET_URL)
if echo "$WIDGET_CONTENT" | grep -q "emitEi"; then
    echo "✅ Found 'emitEi' in widget.js"
else
    echo "⚠️  WARNING: 'emitEi' not found in widget.js"
    echo "   This may indicate the old version is still cached"
fi

if echo "$WIDGET_CONTENT" | grep -q "sales-simulation"; then
    echo "✅ Found 'sales-simulation' mode in widget.js"
else
    echo "⚠️  WARNING: 'sales-simulation' not found in widget.js"
fi

echo ""
echo "📋 Phase 3: Manual Verification Steps"
echo "--------------------------------------"
echo "Please complete these manual checks in your browser:"
echo ""
echo "1. Open: $PAGES_URL"
echo "2. Open DevTools (F12) → Network tab"
echo "3. Hard refresh (Ctrl+Shift+R)"
echo "4. Verify widget.js URL includes: ?v=emitEi"
echo "5. Check Console tab for any errors"
echo "6. Navigate to: ${PAGES_URL}/#simulations"
echo "7. Select 'Sales Simulation' mode"
echo "8. Send a test message"
echo "9. In Network tab, find request to worker and verify:"
echo "   - URL includes: ?emitEi=true"
echo "10. Take screenshot of Network tab"
echo ""
echo "✅ Frontend verification complete"
echo ""
echo "📋 Next Steps:"
echo "1. Complete manual browser verification above"
echo "2. If all checks pass, proceed with worker merge:"
echo "   bash docs/scripts/merge-worker.sh"
