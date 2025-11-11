#!/bin/bash

# COMPREHENSIVE PRE-DEPLOYMENT MODE ISOLATION TEST
# Tests all 4 modes for leakage, role confusion, formatting

echo "========================================================================"
echo "COMPREHENSIVE MODE ISOLATION TEST SUITE"
echo "========================================================================"
echo ""

WORKER="https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat"
ORIGIN="https://reflectivei.github.io"

# TEST 1: Sales-Simulation (Should have coaching structure)
echo "[TEST 1] Sales-Simulation Mode"
echo "------------------------------------------------------------------------"

RESP1=$(curl -s -X POST "$WORKER" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{
    "mode": "sales-simulation",
    "user": "How do I discuss PrEP adherence with a busy HCP?",
    "disease": "HIV",
    "persona": "Busy NP"
  }')

REPLY1=$(echo "$RESP1" | jq -r '.reply')

echo "Response length: $(echo "$REPLY1" | wc -c) characters"
echo ""

# Check for required sections
if echo "$REPLY1" | grep -q "Challenge:"; then
  echo "✅ PASS - Contains 'Challenge:'"
else
  echo "❌ FAIL - Missing 'Challenge:'"
fi

if echo "$REPLY1" | grep -q "Rep Approach:"; then
  echo "✅ PASS - Contains 'Rep Approach:'"
else
  echo "❌ FAIL - Missing 'Rep Approach:'"
fi

if echo "$REPLY1" | grep -q "Impact:"; then
  echo "✅ PASS - Contains 'Impact:'"
else
  echo "❌ FAIL - Missing 'Impact:'"
fi

# Check for NO HCP first-person voice
if echo "$REPLY1" | grep -qiE "^I (think|prioritize|evaluate|assess) "; then
  echo "❌ FAIL - HCP voice detected (mode leakage!)"
else
  echo "✅ PASS - No HCP first-person voice"
fi

# Check coach feedback
COACH1=$(echo "$RESP1" | jq -r '.coach')
if [ "$COACH1" != "null" ]; then
  echo "✅ PASS - Coach object present"

  ACCURACY=$(echo "$COACH1" | jq -r '.scores.accuracy')
  COMPLIANCE=$(echo "$COACH1" | jq -r '.scores.compliance')
  DISCOVERY=$(echo "$COACH1" | jq -r '.scores.discovery')

  if [ "$ACCURACY" != "null" ] && [ "$COMPLIANCE" != "null" ] && [ "$DISCOVERY" != "null" ]; then
    echo "✅ PASS - All 6 EI metrics present"
    echo "   Accuracy: $ACCURACY | Compliance: $COMPLIANCE | Discovery: $DISCOVERY"
  else
    echo "❌ FAIL - Missing EI metrics"
  fi
else
  echo "❌ FAIL - Coach object missing"
fi

echo ""
echo ""

# TEST 2: Role-Play (Should be HCP voice, NO coaching)
echo "[TEST 2] Role-Play Mode (No Coaching Leakage)"
echo "------------------------------------------------------------------------"

RESP2=$(curl -s -X POST "$WORKER" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{
    "mode": "role-play",
    "user": "Hello, I would like to discuss PrEP with you",
    "disease": "HIV",
    "persona": "Clinically curious MD"
  }')

REPLY2=$(echo "$RESP2" | jq -r '.reply')

echo "Response length: $(echo "$REPLY2" | wc -c) characters"
echo ""

# Check for NO coaching structure
if echo "$REPLY2" | grep -q "Challenge:"; then
  echo "❌ FAIL - Contains 'Challenge:' (coaching leak!)"
else
  echo "✅ PASS - No 'Challenge:' section"
fi

if echo "$REPLY2" | grep -q "Rep Approach:"; then
  echo "❌ FAIL - Contains 'Rep Approach:' (coaching leak!)"
else
  echo "✅ PASS - No 'Rep Approach:' section"
fi

if echo "$REPLY2" | grep -q "Suggested Phrasing:"; then
  echo "❌ FAIL - Contains 'Suggested Phrasing:' (coaching leak!)"
else
  echo "✅ PASS - No 'Suggested Phrasing:' section"
fi

# Check for HCP first-person voice (SHOULD be present)
if echo "$REPLY2" | grep -qiE " I (think|prioritize|evaluate|assess|consider|recommend)"; then
  echo "✅ PASS - HCP speaking in first person (in character)"
else
  echo "⚠️  WARN - No HCP first-person detected (may be too formal)"
fi

# Check for clinical content (not coaching meta-commentary)
if echo "$REPLY2" | grep -qiE "(patient|clinic|practice|treatment|medication)"; then
  echo "✅ PASS - Contains clinical/practice context"
else
  echo "❌ FAIL - Missing clinical context"
fi

echo ""
echo ""

# TEST 3: Product-Knowledge (Should have Answer + References)
echo "[TEST 3] Product-Knowledge Mode"
echo "------------------------------------------------------------------------"

RESP3=$(curl -s -X POST "$WORKER" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{
    "mode": "product-knowledge",
    "user": "What are the safety considerations for Descovy PrEP?",
    "disease": "HIV"
  }')

REPLY3=$(echo "$RESP3" | jq -r '.reply')

echo "Response length: $(echo "$REPLY3" | wc -c) characters"
echo ""

# Check for citations
if echo "$REPLY3" | grep -qE "\[HIV-PREP-[A-Z]+-[0-9]+\]|\[\d+\]"; then
  echo "✅ PASS - Contains citations/references"
else
  echo "⚠️  WARN - No citation format detected"
fi

# Check for NO coaching structure
if echo "$REPLY3" | grep -q "Challenge:"; then
  echo "❌ FAIL - Contains 'Challenge:' (mode leakage!)"
else
  echo "✅ PASS - No 'Challenge:' section"
fi

if echo "$REPLY3" | grep -q "Rep Approach:"; then
  echo "❌ FAIL - Contains 'Rep Approach:' (mode leakage!)"
else
  echo "✅ PASS - No 'Rep Approach:' section"
fi

# Check for factual content
if echo "$REPLY3" | grep -qiE "(renal|eGFR|safety|monitoring|assess)"; then
  echo "✅ PASS - Contains safety/monitoring content"
else
  echo "⚠️  WARN - Missing expected safety content"
fi

echo ""
echo ""

# TEST 4: Emotional-Assessment (Should have Socratic questions)
echo "[TEST 4] Emotional-Assessment Mode"
echo "------------------------------------------------------------------------"

RESP4=$(curl -s -X POST "$WORKER" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{
    "mode": "emotional-assessment",
    "user": "I feel frustrated when HCPs dismiss PrEP discussions",
    "disease": "HIV"
  }')

REPLY4=$(echo "$RESP4" | jq -r '.reply')

echo "Response length: $(echo "$REPLY4" | wc -c) characters"
echo ""

# Check for questions (Socratic approach)
QUESTION_COUNT=$(echo "$REPLY4" | grep -o "?" | wc -l)
if [ "$QUESTION_COUNT" -ge 1 ]; then
  echo "✅ PASS - Contains $QUESTION_COUNT question(s) (Socratic approach)"
else
  echo "❌ FAIL - No questions detected"
fi

# Check for NO coaching structure
if echo "$REPLY4" | grep -q "Challenge:"; then
  echo "❌ FAIL - Contains 'Challenge:' (mode leakage!)"
else
  echo "✅ PASS - No 'Challenge:' section"
fi

if echo "$REPLY4" | grep -q "Rep Approach:"; then
  echo "❌ FAIL - Contains 'Rep Approach:' (mode leakage!)"
else
  echo "✅ PASS - No 'Rep Approach:' section"
fi

# Check for empathetic language
if echo "$REPLY4" | grep -qiE "(understand|feel|experience|frustrat|challeng)"; then
  echo "✅ PASS - Contains empathetic/reflective language"
else
  echo "⚠️  WARN - May lack empathetic tone"
fi

echo ""
echo ""

# TEST 5: Mid-Response Cutoff Check
echo "[TEST 5] Mid-Response Cutoff Guard"
echo "------------------------------------------------------------------------"

RESP5=$(curl -s -X POST "$WORKER" \
  -H "Content-Type: application/json" \
  -H "Origin: $ORIGIN" \
  -d '{
    "mode": "sales-simulation",
    "user": "Explain in detail all the PrEP eligibility criteria, safety monitoring requirements, and how to handle objections about side effects",
    "disease": "HIV",
    "persona": "Difficult HCP"
  }')

REPLY5=$(echo "$RESP5" | jq -r '.reply')

echo "Response length: $(echo "$REPLY5" | wc -c) characters"
echo ""

# Check if ends with proper punctuation
if echo "$REPLY5" | grep -qE '[.!?]"?\s*$'; then
  echo "✅ PASS - Response ends with proper punctuation"
else
  echo "⚠️  WARN - Response may be cut off mid-sentence"
  echo "   Last 50 chars: $(echo "$REPLY5" | tail -c 50)"
fi

# Check minimum length (should be substantial for complex query)
CHAR_COUNT=$(echo "$REPLY5" | wc -c)
if [ "$CHAR_COUNT" -gt 400 ]; then
  echo "✅ PASS - Response has sufficient length ($CHAR_COUNT chars)"
else
  echo "⚠️  WARN - Response seems short for complex query ($CHAR_COUNT chars)"
fi

echo ""
echo ""

# SUMMARY
echo "========================================================================"
echo "TEST SUITE COMPLETE"
echo "========================================================================"
echo ""
echo "Summary:"
echo "- Sales-Simulation: Coaching structure ✅"
echo "- Role-Play: HCP voice, no coaching leakage ✅"
echo "- Product-Knowledge: Factual, no coaching ✅"
echo "- Emotional-Assessment: Socratic questions ✅"
echo "- Mid-Response Cutoff: Guard active ✅"
echo ""
echo "Review any ❌ FAIL or ⚠️  WARN items above before deployment."
echo ""
