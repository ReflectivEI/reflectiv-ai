#!/bin/bash
# verify-worker.sh
# Verifies Cloudflare Worker deployment

set -e

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

echo "🔍 Verifying Worker Deployment"
echo "==============================="
echo ""

# Check if curl and jq are available
if ! command -v curl &> /dev/null; then
    echo "❌ curl is not installed"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo "❌ jq is not installed (needed for JSON parsing)"
    echo "   Install: https://stedolan.github.io/jq/"
    exit 1
fi

echo "📋 Phase 1: Basic Health Check"
echo "-------------------------------"

# Try health endpoint if it exists
echo "Checking worker URL: $WORKER_URL"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" $WORKER_URL)
echo "HTTP Status: $HTTP_CODE"

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "404" ]; then
    echo "✅ Worker is reachable"
else
    echo "❌ Worker returned unexpected status: $HTTP_CODE"
    exit 1
fi

echo ""
echo "📋 Phase 2: Test EI Payload Emission"
echo "-------------------------------------"

# Test request with emitEi parameter
echo "Sending test request with emitEi=true..."

RESPONSE=$(curl -s -X POST "${WORKER_URL}/chat?emitEi=true" \
    -H "Content-Type: application/json" \
    -d '{
        "user": "Tell me about the product benefits",
        "mode": "sales-simulation"
    }' || echo "{}")

# Check if response is valid JSON
if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "❌ Worker did not return valid JSON"
    echo "Response: $RESPONSE"
    exit 1
fi

echo "✅ Worker returned valid JSON"

# Check for _coach.ei in response
if echo "$RESPONSE" | jq -e '._coach.ei.scores' > /dev/null 2>&1; then
    echo "✅ Response includes _coach.ei.scores"
    
    # Extract and display scores
    SCORES=$(echo "$RESPONSE" | jq '._coach.ei.scores')
    echo ""
    echo "EI Scores:"
    echo "$SCORES" | jq .
    
    # Verify all 5 legacy keys exist
    for key in empathy discovery compliance clarity accuracy; do
        if echo "$SCORES" | jq -e ".${key}" > /dev/null 2>&1; then
            VALUE=$(echo "$SCORES" | jq -r ".${key}")
            echo "  ✅ $key: $VALUE"
        else
            echo "  ❌ Missing key: $key"
        fi
    done
else
    echo "⚠️  WARNING: Response does not include _coach.ei.scores"
    echo ""
    echo "This could mean:"
    echo "1. Worker code not deployed yet"
    echo "2. Worker doesn't support emitEi parameter yet"
    echo "3. Mode is not sales-simulation"
    echo ""
    echo "Response preview:"
    echo "$RESPONSE" | jq . || echo "$RESPONSE"
fi

echo ""
echo "📋 Phase 3: Test Without emitEi (Should Not Include EI)"
echo "--------------------------------------------------------"

RESPONSE_NO_FLAG=$(curl -s -X POST "${WORKER_URL}/chat" \
    -H "Content-Type: application/json" \
    -d '{
        "user": "Tell me about the product",
        "mode": "sales-simulation"
    }' || echo "{}")

if echo "$RESPONSE_NO_FLAG" | jq -e '._coach.ei' > /dev/null 2>&1; then
    echo "⚠️  WARNING: Response includes EI without emitEi flag"
    echo "   This may be unintended behavior"
else
    echo "✅ Response correctly excludes EI without emitEi flag"
fi

echo ""
echo "📋 Summary"
echo "----------"
echo "Worker deployment verification complete"
echo ""
echo "📋 Next Steps:"
echo "1. Run end-to-end test:"
echo "   bash docs/scripts/test-e2e.sh"
echo "2. Or manually test in browser:"
echo "   https://reflectivei.github.io/reflectiv-ai/#simulations"
