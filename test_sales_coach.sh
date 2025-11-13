#!/bin/bash
# Test Sales Coach formatting across different disease states

echo "🧪 Testing Sales Coach - Suggested Phrasing Fix"
echo "================================================"
echo ""

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat"

# Test 1: Oncology
echo "📋 Test 1: Oncology - ADC Pathways"
echo "-----------------------------------"
RESPONSE1=$(curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "disease": "Oncology",
    "messages": [
      {"role": "user", "content": "How do I approach an oncologist about defining biomarker-driven subsets with AOS/APFS for ADC pathways?"}
    ]
  }')

echo "Response length: $(echo "$RESPONSE1" | wc -c) chars"
echo ""
echo "Checking for complete sections:"
HAS_CHALLENGE=$(echo "$RESPONSE1" | grep -c "Challenge:" || true)
HAS_REP=$(echo "$RESPONSE1" | grep -c "Rep Approach:" || true)
HAS_IMPACT=$(echo "$RESPONSE1" | grep -c "Impact:" || true)
HAS_PHRASING=$(echo "$RESPONSE1" | grep -c "Suggested Phrasing:" || true)

echo "✓ Challenge: $HAS_CHALLENGE"
echo "✓ Rep Approach: $HAS_REP"
echo "✓ Impact: $HAS_IMPACT"
echo "✓ Suggested Phrasing: $HAS_PHRASING"
echo ""

# Extract Suggested Phrasing
PHRASING1=$(echo "$RESPONSE1" | sed -n 's/.*Suggested Phrasing:\s*[""'\'']*\([^<]*\).*/\1/p' | head -1)
PHRASING_LEN=${#PHRASING1}
echo "Suggested Phrasing length: $PHRASING_LEN chars"
echo "Suggested Phrasing preview: ${PHRASING1:0:150}..."
echo ""

if [ $PHRASING_LEN -gt 50 ]; then
  echo "✅ Test 1 PASS: Suggested Phrasing appears complete (>50 chars)"
else
  echo "❌ Test 1 FAIL: Suggested Phrasing truncated (<50 chars)"
fi
echo ""
echo ""

# Test 2: HIV
echo "📋 Test 2: HIV - PrEP Adherence"
echo "-------------------------------"
RESPONSE2=$(curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "disease": "HIV",
    "messages": [
      {"role": "user", "content": "What should I say to an HCP who is concerned about PrEP adherence and wants to discuss monitoring strategies?"}
    ]
  }')

echo "Response length: $(echo "$RESPONSE2" | wc -c) chars"
echo ""
echo "Checking for complete sections:"
HAS_CHALLENGE2=$(echo "$RESPONSE2" | grep -c "Challenge:" || true)
HAS_REP2=$(echo "$RESPONSE2" | grep -c "Rep Approach:" || true)
HAS_IMPACT2=$(echo "$RESPONSE2" | grep -c "Impact:" || true)
HAS_PHRASING2=$(echo "$RESPONSE2" | grep -c "Suggested Phrasing:" || true)

echo "✓ Challenge: $HAS_CHALLENGE2"
echo "✓ Rep Approach: $HAS_REP2"
echo "✓ Impact: $HAS_IMPACT2"
echo "✓ Suggested Phrasing: $HAS_PHRASING2"
echo ""

# Extract Suggested Phrasing
PHRASING2=$(echo "$RESPONSE2" | sed -n 's/.*Suggested Phrasing:\s*[""'\'']*\([^<]*\).*/\1/p' | head -1)
PHRASING_LEN2=${#PHRASING2}
echo "Suggested Phrasing length: $PHRASING_LEN2 chars"
echo "Suggested Phrasing preview: ${PHRASING2:0:150}..."
echo ""

if [ $PHRASING_LEN2 -gt 50 ]; then
  echo "✅ Test 2 PASS: Suggested Phrasing appears complete (>50 chars)"
else
  echo "❌ Test 2 FAIL: Suggested Phrasing truncated (<50 chars)"
fi
echo ""
echo ""

# Summary
echo "========================================="
echo "📊 SUMMARY"
echo "========================================="
echo ""
echo "Test 1 (Oncology): $([ $PHRASING_LEN -gt 50 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo "Test 2 (HIV): $([ $PHRASING_LEN2 -gt 50 ] && echo '✅ PASS' || echo '❌ FAIL')"
echo ""

if [ $PHRASING_LEN -gt 50 ] && [ $PHRASING_LEN2 -gt 50 ]; then
  echo "🎉 ALL TESTS PASSED - Suggested Phrasing fix verified!"
  exit 0
else
  echo "⚠️  SOME TESTS FAILED - Review output above"
  exit 1
fi
