#!/bin/bash
# Test multi-turn Sales Coach conversation to reproduce parsing errors

echo "🧪 Testing Sales Coach - Multi-Turn Conversation"
echo "================================================"
echo ""

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat"

echo "📋 Turn 1: Initial Question"
echo "-----------------------------------"
TURN1=$(curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {"role": "user", "content": "HCP: I am concerned about renal monitoring for PrEP."}
    ]
  }')

REPLY1=$(echo "$TURN1" | jq -r '.reply // empty')
echo "✓ Turn 1 response length: ${#REPLY1} chars"
echo "✓ Has Challenge: $(echo "$REPLY1" | grep -c "Challenge:" || echo 0)"
echo "✓ Has Suggested Phrasing: $(echo "$REPLY1" | grep -c "Suggested Phrasing:" || echo 0)"
echo "✓ Has <coach> tags: $(echo "$REPLY1" | grep -c "<coach>" || echo 0)"
echo ""

echo "📋 Turn 2: Follow-up Question"
echo "-----------------------------------"
# Extract clean reply without <coach> tags for history
CLEAN1=$(echo "$REPLY1" | sed 's/<coach>.*<\/coach>//s')

TURN2=$(curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"sales-coach\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"HCP: I am concerned about renal monitoring for PrEP.\"},
      {\"role\": \"assistant\", \"content\": $(echo "$CLEAN1" | jq -Rs .)},
      {\"role\": \"user\", \"content\": \"HCP: What about patients with eGFR below 50?\"}
    ]
  }")

REPLY2=$(echo "$TURN2" | jq -r '.reply // empty')
echo "✓ Turn 2 response length: ${#REPLY2} chars"
echo "✓ Has Challenge: $(echo "$REPLY2" | grep -c "Challenge:" || echo 0)"
echo "✓ Has Suggested Phrasing: $(echo "$REPLY2" | grep -c "Suggested Phrasing:" || echo 0)"
echo "✓ Has <coach> tags: $(echo "$REPLY2" | grep -c "<coach>" || echo 0)"
echo ""

echo "📋 Turn 3: Third Follow-up (Critical Test)"
echo "-----------------------------------"
CLEAN2=$(echo "$REPLY2" | sed 's/<coach>.*<\/coach>//s')

TURN3=$(curl -s -X POST "$WORKER_URL" \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"sales-coach\",
    \"messages\": [
      {\"role\": \"user\", \"content\": \"HCP: I am concerned about renal monitoring for PrEP.\"},
      {\"role\": \"assistant\", \"content\": $(echo "$CLEAN1" | jq -Rs .)},
      {\"role\": \"user\", \"content\": \"HCP: What about patients with eGFR below 50?\"},
      {\"role\": \"assistant\", \"content\": $(echo "$CLEAN2" | jq -Rs .)},
      {\"role\": \"user\", \"content\": \"HCP: How often should I monitor renal function?\"}
    ]
  }")

REPLY3=$(echo "$TURN3" | jq -r '.reply // empty')
echo "✓ Turn 3 response length: ${#REPLY3} chars"
echo "✓ Has Challenge: $(echo "$REPLY3" | grep -c "Challenge:" || echo 0)"
echo "✓ Has Suggested Phrasing: $(echo "$REPLY3" | grep -c "Suggested Phrasing:" || echo 0)"
echo "✓ Has <coach> tags: $(echo "$REPLY3" | grep -c "<coach>" || echo 0)"
echo ""

# Extract and display full Turn 3 response
echo "========================================="
echo "📊 TURN 3 FULL RESPONSE"
echo "========================================="
echo "$REPLY3" | sed 's/<coach>.*//' | sed 's/^[[:space:]]*//'
echo ""

# Validate structure
HAS_CHALLENGE=$(echo "$REPLY3" | grep -c "Challenge:" || echo 0)
HAS_REP=$(echo "$REPLY3" | grep -c "Rep Approach:" || echo 0)
HAS_IMPACT=$(echo "$REPLY3" | grep -c "Impact:" || echo 0)
HAS_PHRASING=$(echo "$REPLY3" | grep -c "Suggested Phrasing:" || echo 0)
HAS_COACH=$(echo "$REPLY3" | grep -c "<coach>" || echo 0)

echo "========================================="
echo "📊 VALIDATION"
echo "========================================="
echo "Challenge present: $([ $HAS_CHALLENGE -gt 0 ] && echo '✅ YES' || echo '❌ NO')"
echo "Rep Approach present: $([ $HAS_REP -gt 0 ] && echo '✅ YES' || echo '❌ NO')"
echo "Impact present: $([ $HAS_IMPACT -gt 0 ] && echo '✅ YES' || echo '❌ NO')"
echo "Suggested Phrasing present: $([ $HAS_PHRASING -gt 0 ] && echo '✅ YES' || echo '❌ NO')"
echo "<coach> tags present: $([ $HAS_COACH -gt 0 ] && echo '✅ YES' || echo '❌ NO')"
echo ""

if [ $HAS_CHALLENGE -gt 0 ] && [ $HAS_REP -gt 0 ] && [ $HAS_IMPACT -gt 0 ] && [ $HAS_PHRASING -gt 0 ] && [ $HAS_COACH -gt 0 ]; then
  echo "🎉 PASS: All sections present in Turn 3"
  exit 0
else
  echo "❌ FAIL: Missing sections in Turn 3"
  exit 1
fi
