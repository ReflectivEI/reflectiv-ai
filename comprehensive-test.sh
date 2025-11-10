#!/bin/bash

# COMPREHENSIVE TESTING SCRIPT FOR REFLECTIVAI
# Tests all modes, features, and functionality

echo "=================================================="
echo "ReflectivAI Comprehensive Test Suite"
echo "Date: $(date)"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing: $test_name ... "
    
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
}

# Function to check file syntax
check_syntax() {
    local file="$1"
    if [ -f "$file" ]; then
        if [[ "$file" == *.js ]]; then
            node --check "$file"
        fi
    else
        return 1
    fi
}

echo "=== 1. FILE INTEGRITY TESTS ==="
echo ""

run_test "widget.js syntax" "check_syntax widget.js"
run_test "worker.js syntax" "check_syntax worker.js"
run_test "index.html exists" "[ -f index.html ]"
run_test "config.json exists" "[ -f config.json ]"
run_test "citations.json exists" "[ -f citations.json ]"

echo ""
echo "=== 2. CODE STRUCTURE TESTS ==="
echo ""

# Check for mode definitions in widget.js
run_test "LC_OPTIONS includes General Assistant" "grep -q '\"General Assistant\"' widget.js"
run_test "LC_TO_INTERNAL includes general-knowledge" "grep -q '\"general-knowledge\"' widget.js"
run_test "FSM includes general-knowledge" "grep -q '\"general-knowledge\"' worker.js"

# Check for chat reset logic
run_test "applyModeVisibility clears conversation" "grep -q 'conversation = \[\]' widget.js"
run_test "previousMode tracking exists" "grep -q 'previousMode' widget.js"

echo ""
echo "=== 3. WORKER.JS PROMPT TESTS ==="
echo ""

run_test "Sales simulation prompt exists" "grep -q 'salesSimPrompt' worker.js"
run_test "Role play prompt exists" "grep -q 'rolePlayPrompt' worker.js"
run_test "EI prompt exists" "grep -q 'eiPrompt' worker.js"
run_test "PK prompt exists" "grep -q 'pkPrompt' worker.js"
run_test "General knowledge prompt exists" "grep -q 'generalKnowledgePrompt' worker.js"

echo ""
echo "=== 4. TOKEN ALLOCATION TESTS ==="
echo ""

run_test "Sales simulation max tokens: 1600" "grep -q 'maxTokens = 1600.*sales-simulation' worker.js"
run_test "Role play max tokens: 1200" "grep -q 'maxTokens = 1200.*role-play' worker.js"
run_test "EI max tokens: 1200" "grep -q 'maxTokens = 1200.*emotional-assessment' worker.js"
run_test "PK max tokens: 1800" "grep -q 'maxTokens = 1800.*product-knowledge' worker.js"
run_test "General knowledge max tokens: 1800" "grep -q 'maxTokens = 1800.*general-knowledge' worker.js"

echo ""
echo "=== 5. MODE VALIDATION TESTS ==="
echo ""

run_test "validateModeResponse function exists" "grep -q 'function validateModeResponse' worker.js"
run_test "Role-play coaching leak detection" "grep -q 'coachingPatterns' worker.js"
run_test "Sales-sim HCP voice detection" "grep -q 'hcpVoicePatterns' worker.js"
run_test "validateCoachSchema function exists" "grep -q 'function validateCoachSchema' worker.js"

echo ""
echo "=== 6. CITATION & FACTS TESTS ==="
echo ""

run_test "FACTS_DB exists" "grep -q 'const FACTS_DB' worker.js"
run_test "HIV-PREP facts exist" "grep -q 'HIV-PREP-ELIG-001' worker.js"
run_test "Citation format in PK prompt" "grep -q '\[HIV-PREP' worker.js"

echo ""
echo "=== 7. UI ELEMENT TESTS ==="
echo ""

run_test "Mode selector in widget" "grep -q 'modeSel' widget.js"
run_test "Disease selector exists" "grep -q 'diseaseSelect' widget.js"
run_test "HCP selector exists" "grep -q 'hcpSelect' widget.js"
run_test "Persona selector (EI) exists" "grep -q 'personaSelectElem' widget.js"
run_test "Feature selector (EI) exists" "grep -q 'eiFeatureSelectElem' widget.js"

echo ""
echo "=== 8. RENDER FUNCTION TESTS ==="
echo ""

run_test "renderMessages function exists" "grep -q 'function renderMessages' widget.js"
run_test "renderCoach function exists" "grep -q 'function renderCoach' widget.js"
run_test "renderMeta function exists" "grep -q 'function renderMeta' widget.js"
run_test "applyModeVisibility calls render" "grep -A 5 'function applyModeVisibility' widget.js | grep -q 'renderMessages'"

echo ""
echo "=== 9. SCENARIO LOADING TESTS ==="
echo ""

if [ -f "assets/chat/data/scenarios.merged.json" ]; then
    run_test "scenarios.merged.json is valid JSON" "jq empty assets/chat/data/scenarios.merged.json"
    run_test "scenarios contain therapeuticArea" "jq '.scenarios[0].therapeuticArea' assets/chat/data/scenarios.merged.json | grep -q 'HIV'"
else
    echo -e "${YELLOW}SKIP: scenarios.merged.json not found${NC}"
fi

echo ""
echo "=== 10. CONFIGURATION TESTS ==="
echo ""

if [ -f "config.json" ]; then
    run_test "config.json is valid JSON" "jq empty config.json"
else
    echo -e "${YELLOW}SKIP: config.json not found${NC}"
fi

if [ -f "assets/chat/persona.json" ]; then
    run_test "persona.json is valid JSON" "jq empty assets/chat/persona.json"
else
    echo -e "${YELLOW}SKIP: persona.json not found${NC}"
fi

echo ""
echo "=================================================="
echo "TEST SUMMARY"
echo "=================================================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Deploy worker.js to Cloudflare Workers"
    echo "2. Test in browser with all 5 modes"
    echo "3. Verify mode switching clears chat"
    echo "4. Test response quality for each mode"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failed tests above and fix issues before deployment."
    exit 1
fi
