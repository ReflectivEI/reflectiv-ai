#!/bin/bash

# Post-Deployment Verification Script
# Run this after deploying the Cloudflare Worker to verify everything works

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
FRONTEND_URL="https://reflectivei.github.io/reflectiv-ai"

echo "=========================================="
echo "ReflectivAI Post-Deployment Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS=0
FAIL=0

# Test 1: Worker Health Check
echo "Test 1: Worker Health Check"
echo "  Testing: $WORKER_URL/health"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "$WORKER_URL/health" 2>&1)
HTTP_CODE=$(echo "$HEALTH_RESPONSE" | tail -n1)
BODY=$(echo "$HEALTH_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ] && [ "$BODY" = "ok" ]; then
    echo -e "  ${GREEN}✓ PASS${NC} - Worker is healthy (HTTP $HTTP_CODE, response: '$BODY')"
    ((PASS++))
else
    echo -e "  ${RED}✗ FAIL${NC} - Worker health check failed (HTTP $HTTP_CODE, response: '$BODY')"
    ((FAIL++))
fi
echo ""

# Test 2: Worker Version Check
echo "Test 2: Worker Version Check"
echo "  Testing: $WORKER_URL/version"
VERSION_RESPONSE=$(curl -s "$WORKER_URL/version" 2>&1)
if echo "$VERSION_RESPONSE" | grep -q "version"; then
    echo -e "  ${GREEN}✓ PASS${NC} - Version endpoint working"
    echo "  Response: $VERSION_RESPONSE"
    ((PASS++))
else
    echo -e "  ${RED}✗ FAIL${NC} - Version endpoint failed"
    echo "  Response: $VERSION_RESPONSE"
    ((FAIL++))
fi
echo ""

# Test 3: Chat Endpoint - Sales Coach Mode
echo "Test 3: Chat Endpoint - Sales Coach Mode"
echo "  Testing: POST $WORKER_URL/chat"
CHAT_RESPONSE=$(curl -s -w "\n%{http_code}" "$WORKER_URL/chat" \
    -X POST \
    -H "Content-Type: application/json" \
    -H "Origin: $FRONTEND_URL" \
    -d '{
        "mode": "sales-coach",
        "messages": [
            {"role": "user", "content": "How should I approach an HCP about PrEP?"}
        ]
    }' 2>&1)

HTTP_CODE=$(echo "$CHAT_RESPONSE" | tail -n1)
BODY=$(echo "$CHAT_RESPONSE" | head -n-1)

if [ "$HTTP_CODE" = "200" ]; then
    if echo "$BODY" | grep -q "reply\|message\|content"; then
        echo -e "  ${GREEN}✓ PASS${NC} - Chat endpoint working (HTTP $HTTP_CODE)"
        echo "  Response preview: $(echo "$BODY" | head -c 100)..."
        ((PASS++))
    else
        echo -e "  ${YELLOW}⚠ PARTIAL${NC} - Got 200 but response format unexpected"
        echo "  Response: $BODY"
        ((PASS++))
    fi
else
    echo -e "  ${RED}✗ FAIL${NC} - Chat endpoint failed (HTTP $HTTP_CODE)"
    echo "  Response: $BODY"
    ((FAIL++))
fi
echo ""

# Test 4: CORS Headers
echo "Test 4: CORS Headers"
echo "  Testing: CORS headers for $FRONTEND_URL"
CORS_RESPONSE=$(curl -s -I -X OPTIONS "$WORKER_URL/chat" \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: POST" 2>&1)

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    ALLOWED_ORIGIN=$(echo "$CORS_RESPONSE" | grep -i "access-control-allow-origin" | cut -d' ' -f2 | tr -d '\r\n')
    if [ "$ALLOWED_ORIGIN" = "$FRONTEND_URL" ] || [ "$ALLOWED_ORIGIN" = "*" ]; then
        echo -e "  ${GREEN}✓ PASS${NC} - CORS headers present (allows: $ALLOWED_ORIGIN)"
        ((PASS++))
    else
        echo -e "  ${YELLOW}⚠ PARTIAL${NC} - CORS allows: $ALLOWED_ORIGIN (expected: $FRONTEND_URL)"
        ((PASS++))
    fi
else
    echo -e "  ${RED}✗ FAIL${NC} - CORS headers missing"
    ((FAIL++))
fi
echo ""

# Test 5: Multiple Modes
echo "Test 5: Multiple Modes Support"
MODES=("role-play" "product-knowledge" "emotional-assessment")
MODE_PASS=0
MODE_FAIL=0

for mode in "${MODES[@]}"; do
    echo "  Testing mode: $mode"
    MODE_RESPONSE=$(curl -s -w "\n%{http_code}" "$WORKER_URL/chat" \
        -X POST \
        -H "Content-Type: application/json" \
        -d "{\"mode\":\"$mode\",\"messages\":[{\"role\":\"user\",\"content\":\"test\"}]}" 2>&1)
    
    HTTP_CODE=$(echo "$MODE_RESPONSE" | tail -n1)
    
    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "    ${GREEN}✓${NC} $mode mode works"
        ((MODE_PASS++))
    else
        echo -e "    ${RED}✗${NC} $mode mode failed (HTTP $HTTP_CODE)"
        ((MODE_FAIL++))
    fi
done

if [ $MODE_FAIL -eq 0 ]; then
    echo -e "  ${GREEN}✓ PASS${NC} - All modes working ($MODE_PASS/3)"
    ((PASS++))
else
    echo -e "  ${YELLOW}⚠ PARTIAL${NC} - Some modes failed ($MODE_PASS/3 working)"
    ((FAIL++))
fi
echo ""

# Summary
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo -e "Total Tests: $((PASS + FAIL))"
echo -e "${GREEN}Passed: $PASS${NC}"
echo -e "${RED}Failed: $FAIL${NC}"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Test widget at: $FRONTEND_URL"
    echo "2. Try sending messages in different modes"
    echo "3. Verify EI scoring appears in Sales Coach mode"
    echo "4. Check browser console for errors"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Verify PROVIDER_KEY secret is set: wrangler secret list"
    echo "2. Check worker logs: wrangler tail"
    echo "3. Verify CORS_ORIGINS in wrangler.toml includes: $FRONTEND_URL"
    echo "4. Ensure worker is deployed: wrangler deployments list"
    exit 1
fi
