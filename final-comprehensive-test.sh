#!/bin/bash

echo "=========================================="
echo "FINAL COMPREHENSIVE TEST"
echo "Testing all modes × therapeutic areas"
echo "=========================================="
echo ""

ENDPOINT="https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat"
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test function
test_mode_disease() {
  local mode=$1
  local disease=$2
  local test_name=$3
  local check_type=$4

  TOTAL_TESTS=$((TOTAL_TESTS + 1))

  echo "[$TOTAL_TESTS] Testing: $test_name"

  # Use appropriate test query based on mode
  local test_query="Test"
  if [ "$mode" = "product-knowledge" ]; then
    test_query="What are the key treatment options?"
  fi

  response=$(curl -s -X POST "$ENDPOINT" \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"$mode\",\"disease\":\"$disease\",\"messages\":[{\"role\":\"user\",\"content\":\"$test_query\"}]}")

  reply=$(echo "$response" | jq -r '.reply' 2>/dev/null)

  if [ -z "$reply" ] || [ "$reply" = "null" ]; then
    echo "   ❌ FAIL - No reply received"
    FAILED_TESTS=$((FAILED_TESTS + 1))
    return 1
  fi

  # Mode-specific checks
  case "$check_type" in
    "sales-coach-format")
      lines=$(echo "$reply" | wc -l | tr -d ' ')
      has_challenge=$(echo "$reply" | grep "^Challenge:" | wc -l | tr -d ' ')
      has_rep=$(echo "$reply" | grep "^Rep Approach:" | wc -l | tr -d ' ')
      has_impact=$(echo "$reply" | grep "^Impact:" | wc -l | tr -d ' ')
      has_suggested=$(echo "$reply" | grep "^Suggested Phrasing:" | wc -l | tr -d ' ')
      has_citation=$(echo "$reply" | grep -E "\[.*-.*-.*-[0-9]" | wc -l | tr -d ' ')

      if [[ $lines -ge 4 && $has_challenge -eq 1 && $has_rep -eq 1 && $has_impact -eq 1 && $has_suggested -eq 1 && $has_citation -ge 1 ]]; then
        echo "   ✅ PASS - Proper formatting ($lines lines, all sections, citations present)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
      else
        echo "   ❌ FAIL - Lines:$lines Challenge:$has_challenge Rep:$has_rep Impact:$has_impact Suggested:$has_suggested Citations:$has_citation"
        FAILED_TESTS=$((FAILED_TESTS + 1))
      fi
      ;;

    "role-play-natural")
      length=${#reply}
      has_coach_lang=$(echo "$reply" | grep -E "Rep Approach:|Challenge:|Suggested Phrasing:" | wc -l | tr -d ' ')

      if [[ $length -gt 50 && $has_coach_lang -eq 0 ]]; then
        echo "   ✅ PASS - Natural HCP voice ($length chars, no coaching language)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
      else
        echo "   ❌ FAIL - Length:$length CoachLanguage:$has_coach_lang"
        FAILED_TESTS=$((FAILED_TESTS + 1))
      fi
      ;;

    "product-knowledge-citations")
      has_content=$(echo "$reply" | wc -w | tr -d ' ')
      has_url=$(echo "$reply" | grep -o "http" | wc -l | tr -d ' ')

      if [[ $has_content -gt 100 && $has_url -ge 1 ]]; then
        echo "   ✅ PASS - Comprehensive answer with citations ($has_content words, URLs present)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
      else
        echo "   ❌ FAIL - Words:$has_content URLs:$has_url"
        FAILED_TESTS=$((FAILED_TESTS + 1))
      fi
      ;;

    "basic-response")
      length=${#reply}
      if [[ $length -gt 50 ]]; then
        echo "   ✅ PASS - Valid response ($length chars)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
      else
        echo "   ❌ FAIL - Response too short: $length chars"
        FAILED_TESTS=$((FAILED_TESTS + 1))
      fi
      ;;
  esac

  sleep 0.5  # Rate limiting
}

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SALES COACH MODE - All Therapeutic Areas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_mode_disease "sales-coach" "HIV" "Sales Coach × HIV" "sales-coach-format"
test_mode_disease "sales-coach" "Oncology" "Sales Coach × Oncology" "sales-coach-format"
test_mode_disease "sales-coach" "Cardiovascular" "Sales Coach × Cardiovascular" "sales-coach-format"
test_mode_disease "sales-coach" "COVID-19" "Sales Coach × COVID-19" "sales-coach-format"
test_mode_disease "sales-coach" "Vaccines" "Sales Coach × Vaccines" "sales-coach-format"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "ROLE PLAY MODE - All Therapeutic Areas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_mode_disease "role-play" "HIV" "Role Play × HIV" "role-play-natural"
test_mode_disease "role-play" "Oncology" "Role Play × Oncology" "role-play-natural"
test_mode_disease "role-play" "Cardiovascular" "Role Play × Cardiovascular" "role-play-natural"
test_mode_disease "role-play" "COVID-19" "Role Play × COVID-19" "role-play-natural"
test_mode_disease "role-play" "Vaccines" "Role Play × Vaccines" "role-play-natural"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "PRODUCT KNOWLEDGE MODE - All Therapeutic Areas"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_mode_disease "product-knowledge" "HIV" "Product Knowledge × HIV" "product-knowledge-citations"
test_mode_disease "product-knowledge" "Oncology" "Product Knowledge × Oncology" "product-knowledge-citations"
test_mode_disease "product-knowledge" "Cardiovascular" "Product Knowledge × CV" "product-knowledge-citations"
test_mode_disease "product-knowledge" "COVID-19" "Product Knowledge × COVID" "product-knowledge-citations"
test_mode_disease "product-knowledge" "Vaccines" "Product Knowledge × Vaccines" "product-knowledge-citations"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "EMOTIONAL ASSESSMENT MODE - Sample Tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
test_mode_disease "emotional-assessment" "HIV" "Emotional Assessment × HIV" "basic-response"
test_mode_disease "emotional-assessment" "Oncology" "Emotional Assessment × Oncology" "basic-response"

echo ""
echo "=========================================="
echo "TEST SUMMARY"
echo "=========================================="
echo "Total Tests:  $TOTAL_TESTS"
echo "Passed:       $PASSED_TESTS ✅"
echo "Failed:       $FAILED_TESTS ❌"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
  echo "🎉 ALL TESTS PASSED! System is production-ready."
  exit 0
else
  PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
  echo "⚠️  Pass Rate: ${PASS_RATE}%"
  exit 1
fi
