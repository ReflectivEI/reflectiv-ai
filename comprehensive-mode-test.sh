#!/bin/bash
# Comprehensive Mode Testing Script
# Tests all 5 modes with different scenarios and validates responses

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
ORIGIN="https://reflectivei.github.io"

echo "================================================"
echo "COMPREHENSIVE MODE TESTING"
echo "Worker: $WORKER_URL"
echo "================================================"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0

# Function to test a mode
test_mode() {
    local mode=$1
    local test_name=$2
    local message=$3
    local disease=${4:-""}
    local persona=${5:-""}

    echo -e "${YELLOW}Testing: $test_name${NC}"
    echo "  Mode: $mode"
    [ ! -z "$disease" ] && echo "  Disease: $disease"
    [ ! -z "$persona" ] && echo "  Persona: $persona"

    # Build payload
    local payload=$(cat <<EOF
{
  "mode": "$mode",
  "messages": [
    {"role": "user", "content": "$message"}
  ]
EOF
)

    # Add disease if provided
    if [ ! -z "$disease" ]; then
        payload="$payload,\"disease\": \"$disease\""
    fi

    # Add persona if provided
    if [ ! -z "$persona" ]; then
        payload="$payload,\"persona\": \"$persona\""
    fi

    payload="$payload}"

    # Make request
    response=$(curl -s -X POST "$WORKER_URL/chat" \
        -H "Content-Type: application/json" \
        -H "Origin: $ORIGIN" \
        -d "$payload" \
        --max-time 30)

    # Check for errors
    if echo "$response" | grep -q '"error"'; then
        echo -e "${RED}  ✗ FAILED - Error in response${NC}"
        echo "  Error: $(echo "$response" | grep -o '"message":"[^"]*"' | head -1)"
        ((FAILED++))
        return 1
    fi

    # Check for reply
    if echo "$response" | grep -q '"reply"'; then
        local reply_length=$(echo "$response" | grep -o '"reply":"[^"]*"' | wc -c)
        if [ $reply_length -lt 20 ]; then
            echo -e "${RED}  ✗ FAILED - Reply too short${NC}"
            ((FAILED++))
            return 1
        fi

        # Check for coach feedback if sales-coach or role-play
        if [ "$mode" = "sales-coach" ] || [ "$mode" = "role-play" ]; then
            if echo "$response" | grep -q '"coach"'; then
                echo -e "${GREEN}  ✓ PASSED - Reply received with coach feedback${NC}"
                ((PASSED++))
            else
                echo -e "${YELLOW}  ⚠ WARNING - No coach feedback found${NC}"
                ((PASSED++))
            fi
        else
            echo -e "${GREEN}  ✓ PASSED - Reply received${NC}"
            ((PASSED++))
        fi

        return 0
    else
        echo -e "${RED}  ✗ FAILED - No reply in response${NC}"
        ((FAILED++))
        return 1
    fi
}

echo "================================================"
echo "1. SALES-SIMULATION MODE TESTS"
echo "================================================"
echo ""

test_mode "sales-coach" \
    "Sales Coach - HIV/PrEP Opening" \
    "I'm meeting with Dr. Smith, a busy infectious disease specialist. How should I open the conversation about PrEP?" \
    "HIV" \
    "Dr. Amanda Smith"

echo ""

test_mode "sales-coach" \
    "Sales Coach - Diabetes Objection Handling" \
    "The doctor says they're happy with their current treatment. How do I respond?" \
    "Diabetes" \
    "Dr. Robert Chen"

echo ""
echo "================================================"
echo "2. ROLE-PLAY MODE TESTS"
echo "================================================"
echo ""

test_mode "role-play" \
    "Role Play - HCP Simulation HIV" \
    "Good morning, Doctor. I wanted to discuss PrEP options for your at-risk patients." \
    "HIV" \
    "Dr. Amanda Smith"

echo ""

test_mode "role-play" \
    "Role Play - HCP Simulation Cardiology" \
    "Hello, I'm here to share some updates on cholesterol management." \
    "Cardiovascular" \
    "Dr. Michael Torres"

echo ""
echo "================================================"
echo "3. EMOTIONAL-ASSESSMENT MODE TESTS"
echo "================================================"
echo ""

test_mode "emotional-assessment" \
    "EI Assessment - Stress Response" \
    "I'm feeling really stressed about my upcoming presentation to the regional team." \
    "" \
    ""

echo ""

test_mode "emotional-assessment" \
    "EI Assessment - Empathy Scenario" \
    "My colleague seems really upset after a difficult call with a doctor. How should I approach them?" \
    "" \
    ""

echo ""
echo "================================================"
echo "4. PRODUCT-KNOWLEDGE MODE TESTS"
echo "================================================"
echo ""

test_mode "product-knowledge" \
    "Product Knowledge - Mechanism of Action" \
    "Can you explain how PrEP works to prevent HIV infection?" \
    "HIV" \
    ""

echo ""

test_mode "product-knowledge" \
    "Product Knowledge - Safety Profile" \
    "What are the key safety considerations for PrEP?" \
    "HIV" \
    ""

echo ""
echo "================================================"
echo "5. GENERAL-KNOWLEDGE MODE TESTS"
echo "================================================"
echo ""

test_mode "general-knowledge" \
    "General Assistant - Strategy Question" \
    "What are the key elements of an effective sales call?" \
    "" \
    ""

echo ""

test_mode "general-knowledge" \
    "General Assistant - Best Practices" \
    "How can I build better relationships with healthcare providers?" \
    "" \
    ""

echo ""
echo "================================================"
echo "TEST SUMMARY"
echo "================================================"
echo ""
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

TOTAL=$((PASSED + FAILED))
if [ $TOTAL -gt 0 ]; then
    SUCCESS_RATE=$((PASSED * 100 / TOTAL))
    echo "Success Rate: ${SUCCESS_RATE}%"
else
    echo "No tests executed"
fi

echo ""
echo "================================================"

# Exit with error if any tests failed
if [ $FAILED -gt 0 ]; then
    exit 1
else
    exit 0
fi
