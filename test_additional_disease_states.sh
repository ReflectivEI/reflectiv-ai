#!/bin/bash

echo "🧪 Testing Sales Coach - Additional Disease States"
echo "================================================"
echo ""

# Test 1: Cardiovascular
echo "📋 Test 1: Cardiovascular - Heart Failure"
echo "-----------------------------------"
RESPONSE1=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {"role": "user", "content": "HCP: \"I am concerned about heart failure medication titration timelines in my cardiology practice.\""}
    ]
  }')

REPLY1=$(echo "$RESPONSE1" | jq -r '.reply // empty')
LEN1=${#REPLY1}
echo "Response length:     $LEN1 chars"
echo ""

echo "Checking for complete sections:"
CHALLENGE1=$(echo "$REPLY1" | grep -c "Challenge:")
REP1=$(echo "$REPLY1" | grep -c "Rep Approach:")
IMPACT1=$(echo "$REPLY1" | grep -c "Impact:")
SUGGESTED1=$(echo "$REPLY1" | grep -c "Suggested Phrasing:")

echo "✓ Challenge: $CHALLENGE1"
echo "✓ Rep Approach: $REP1"
echo "✓ Impact: $IMPACT1"
echo "✓ Suggested Phrasing: $SUGGESTED1"
echo ""

PHRASING_TEXT1=$(echo "$REPLY1" | sed -n '/Suggested Phrasing:/,$p')
PHRASING_LEN1=${#PHRASING_TEXT1}
PHRASING_PREVIEW1=$(echo "$PHRASING_TEXT1" | head -c 100)
echo "Suggested Phrasing length: $PHRASING_LEN1 chars"
echo "Suggested Phrasing preview: $PHRASING_PREVIEW1..."

if [ $SUGGESTED1 -gt 0 ] && [ $PHRASING_LEN1 -gt 50 ]; then
  echo "✅ Test 1 PASS: Suggested Phrasing appears complete (>50 chars)"
  TEST1_RESULT="PASS"
else
  echo "❌ Test 1 FAIL: Suggested Phrasing missing or incomplete"
  TEST1_RESULT="FAIL"
fi
echo ""
echo ""

# Test 2: COVID-19
echo "📋 Test 2: COVID-19 - Antiviral Timing"
echo "-------------------------------"
RESPONSE2=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {"role": "user", "content": "HCP: \"I need guidance on timing for COVID-19 antiviral treatment in high-risk patients.\""}
    ]
  }')

REPLY2=$(echo "$RESPONSE2" | jq -r '.reply // empty')
LEN2=${#REPLY2}
echo "Response length:     $LEN2 chars"
echo ""

echo "Checking for complete sections:"
CHALLENGE2=$(echo "$REPLY2" | grep -c "Challenge:")
REP2=$(echo "$REPLY2" | grep -c "Rep Approach:")
IMPACT2=$(echo "$REPLY2" | grep -c "Impact:")
SUGGESTED2=$(echo "$REPLY2" | grep -c "Suggested Phrasing:")

echo "✓ Challenge: $CHALLENGE2"
echo "✓ Rep Approach: $REP2"
echo "✓ Impact: $IMPACT2"
echo "✓ Suggested Phrasing: $SUGGESTED2"
echo ""

PHRASING_TEXT2=$(echo "$REPLY2" | sed -n '/Suggested Phrasing:/,$p')
PHRASING_LEN2=${#PHRASING_TEXT2}
PHRASING_PREVIEW2=$(echo "$PHRASING_TEXT2" | head -c 100)
echo "Suggested Phrasing length: $PHRASING_LEN2 chars"
echo "Suggested Phrasing preview: $PHRASING_PREVIEW2..."

if [ $SUGGESTED2 -gt 0 ] && [ $PHRASING_LEN2 -gt 50 ]; then
  echo "✅ Test 2 PASS: Suggested Phrasing appears complete (>50 chars)"
  TEST2_RESULT="PASS"
else
  echo "❌ Test 2 FAIL: Suggested Phrasing missing or incomplete"
  TEST2_RESULT="FAIL"
fi
echo ""
echo ""

# Summary
echo "========================================="
echo "📊 SUMMARY"
echo "========================================="
echo ""
echo "Test 1 (Cardiovascular): ✅ $TEST1_RESULT"
echo "Test 2 (COVID-19): ✅ $TEST2_RESULT"
echo ""

if [ "$TEST1_RESULT" == "PASS" ] && [ "$TEST2_RESULT" == "PASS" ]; then
  echo "🎉 ALL TESTS PASSED - Suggested Phrasing fix verified across disease states!"
  exit 0
else
  echo "❌ SOME TESTS FAILED - Review responses above"
  exit 1
fi
