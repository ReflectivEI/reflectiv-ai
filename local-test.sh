#!/bin/bash

# ReflectivAI Local Testing Script
# Test the local worker at http://localhost:8787

BASE_URL="http://localhost:8787"
ORIGIN="http://localhost:3000"

echo "🔬 ReflectivAI Local Test Script"
echo "================================="
echo "Local Server: $BASE_URL"
echo ""

# Check if server is running
echo "Checking server status..."
if curl -s "$BASE_URL/health" -H "Origin: $ORIGIN" > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "❌ Server not responding"
    echo "Start with: wrangler dev --port 8787"
    exit 1
fi

echo ""

# Test functions
test_mode() {
    local mode=$1
    local message=$2
    local disease=${3:-""}

    echo "Testing $mode mode..."
    echo "Message: $message"
    if [ -n "$disease" ]; then
        echo "Disease: $disease"
    fi

    local payload="{\"mode\":\"$mode\",\"user\":\"$message\""
    if [ -n "$disease" ]; then
        payload="$payload,\"disease\":\"$disease\""
    fi
    payload="$payload}"

    response=$(curl -s -X POST "$BASE_URL/chat" \
        -H "Content-Type: application/json" \
        -H "Origin: $ORIGIN" \
        -d "$payload")

    echo "Response:"
    echo "$response" | jq '.' 2>/dev/null || echo "$response"
    echo ""
    echo "----------------------------------------"
    echo ""
}

# Run tests
echo "Running test cases..."
echo ""

test_mode "sales-coach" "How should I approach an HCP who is resistant to new treatments?" "HIV"

test_mode "role-play" "I'm concerned about the side effects of this medication."

test_mode "product-knowledge" "What are the contraindications for this drug?"

test_mode "emotional-assessment" "I'm feeling overwhelmed with all these treatment options."

test_mode "general-knowledge" "What are the latest guidelines for diabetes management?"

echo "✅ All tests completed!"
echo ""
echo "To run individual tests:"
echo "  ./local-test.sh sales-coach \"your message\" [disease]"
echo ""
echo "Or open local-test.html in your browser for GUI testing."