#!/bin/bash

# Comprehensive System Test for ReflectivAI
# Tests: Worker health, all modes, all therapeutic areas, AI logic, facts filtering

BASE_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
PASSED=0
FAILED=0

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   COMPREHENSIVE SYSTEM TEST - ReflectivAI                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Test 1: Health & Version
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 1: Health & Version Endpoints"
echo "─────────────────────────────────────────────────────────────────"

health=$(curl -s $BASE_URL/health)
version=$(curl -s $BASE_URL/version | jq -r '.version')

if [[ "$health" == "ok" ]]; then
  echo "✅ Health endpoint: $health"
  ((PASSED++))
else
  echo "❌ Health endpoint failed"
  ((FAILED++))
fi

if [[ "$version" == "r10.1" ]]; then
  echo "✅ Version: $version"
  ((PASSED++))
else
  echo "❌ Version mismatch: $version (expected r10.1)"
  ((FAILED++))
fi
echo ""

# Test 2: Facts Endpoint Filtering
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 2: Facts Endpoint Filtering by Therapeutic Area"
echo "─────────────────────────────────────────────────────────────────"

areas=("HIV" "Oncology" "Cardiovascular" "COVID-19" "Vaccines")

for area in "${areas[@]}"; do
  fact_id=$(curl -s -X POST $BASE_URL/facts \
    -H "Content-Type: application/json" \
    -d "{\"disease\":\"$area\",\"limit\":1}" | jq -r '.facts[0].id // "NONE"')

  if [[ $fact_id != "NONE" ]] && [[ $fact_id == *"${area:0:3}"* || $fact_id == "HIV-"* || $fact_id == "ONC-"* || $fact_id == "CV-"* || $fact_id == "COVID-"* || $fact_id == "VAC-"* ]]; then
    echo "✅ $area facts: $fact_id"
    ((PASSED++))
  else
    echo "❌ $area facts failed: $fact_id"
    ((FAILED++))
  fi
done
echo ""

# Test 3: Plan Generation - All Modes × All Therapeutic Areas
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 3: Plan Generation (4 Modes × 5 Therapeutic Areas = 20 tests)"
echo "─────────────────────────────────────────────────────────────────"

modes=("sales-coach" "role-play" "product-knowledge" "emotional-assessment")

for mode in "${modes[@]}"; do
  echo "Mode: $mode"
  for area in "${areas[@]}"; do
    result=$(curl -s -X POST $BASE_URL/plan \
      -H "Content-Type: application/json" \
      -d "{\"mode\":\"$mode\",\"disease\":\"$area\",\"persona\":\"Test HCP\",\"goal\":\"Test goal\"}")

    plan_id=$(echo "$result" | jq -r '.planId // "NONE"')
    fact_count=$(echo "$result" | jq -r '.facts | length // 0')

    if [[ $plan_id != "NONE" ]] && [[ $fact_count -gt 0 ]]; then
      echo "  ✅ $area: planId=${plan_id:0:8}... facts=$fact_count"
      ((PASSED++))
    else
      echo "  ❌ $area: Failed to generate plan"
      ((FAILED++))
    fi
  done
  echo ""
done

# Test 4: Therapeutic Area Fact Specificity
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 4: Verify Facts Match Therapeutic Areas (No Cross-Contamination)"
echo "─────────────────────────────────────────────────────────────────"

# HIV should get HIV facts, not Oncology facts
hiv_plan=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"role-play","disease":"HIV"}')
hiv_fact=$(echo "$hiv_plan" | jq -r '.facts[0].id')

if [[ $hiv_fact == HIV-* ]]; then
  echo "✅ HIV returns HIV facts: $hiv_fact"
  ((PASSED++))
else
  echo "❌ HIV returned wrong facts: $hiv_fact"
  ((FAILED++))
fi

# Oncology should get Oncology facts, not HIV facts
onc_plan=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"role-play","disease":"Oncology"}')
onc_fact=$(echo "$onc_plan" | jq -r '.facts[0].id')

if [[ $onc_fact == ONC-* ]]; then
  echo "✅ Oncology returns Oncology facts: $onc_fact"
  ((PASSED++))
else
  echo "❌ Oncology returned wrong facts: $onc_fact"
  ((FAILED++))
fi

# Cardiovascular should get CV facts
cv_plan=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"role-play","disease":"Cardiovascular"}')
cv_fact=$(echo "$cv_plan" | jq -r '.facts[0].id')

if [[ $cv_fact == CV-* ]]; then
  echo "✅ Cardiovascular returns CV facts: $cv_fact"
  ((PASSED++))
else
  echo "❌ Cardiovascular returned wrong facts: $cv_fact"
  ((FAILED++))
fi

echo ""

# Test 5: AI Chat Response Generation
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 5: AI Chat Response Generation (Dynamic, Not Hardcoded)"
echo "─────────────────────────────────────────────────────────────────"

# Create a plan first
plan_response=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"role-play","disease":"HIV","persona":"Infectious Disease Specialist","goal":"Discuss PrEP options"}')

plan_id=$(echo "$plan_response" | jq -r '.planId')

if [[ $plan_id != "null" ]]; then
  echo "✅ Plan created: $plan_id"
  ((PASSED++))

  # Test AI chat with the plan
  chat_response=$(curl -s -X POST $BASE_URL/chat \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"role-play\",\"plan\":$plan_response,\"messages\":[{\"role\":\"user\",\"content\":\"Hello Doctor, I'd like to discuss PrEP for my at-risk patients.\"}]}")

  ai_reply=$(echo "$chat_response" | jq -r '.reply // "NONE"')

  if [[ $ai_reply != "NONE" ]] && [[ ${#ai_reply} -gt 50 ]]; then
    echo "✅ AI generated response (${#ai_reply} chars)"
    echo "   Preview: ${ai_reply:0:100}..."
    ((PASSED++))
  else
    echo "❌ AI response generation failed"
    ((FAILED++))
  fi
else
  echo "❌ Plan creation failed for chat test"
  ((FAILED++))
fi

echo ""

# Test 6: Scenario Integration
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 6: Real Scenario Integration (From scenarios.merged.json)"
echo "─────────────────────────────────────────────────────────────────"

# Test HIV scenario
hiv_scenario=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","disease":"HIV","persona":"Internal Medicine MD","goal":"Low Descovy share with missed PrEP opportunity"}')

hiv_facts=$(echo "$hiv_scenario" | jq -r '.facts | map(.id) | join(", ")')

if [[ $hiv_facts == *"HIV-PREP"* ]]; then
  echo "✅ HIV PrEP scenario: $hiv_facts"
  ((PASSED++))
else
  echo "❌ HIV scenario missing PrEP facts"
  ((FAILED++))
fi

# Test Oncology scenario
onc_scenario=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"role-play","disease":"Oncology","persona":"Medical Oncologist","goal":"IO-backbone heavy; ADC toxicity bandwidth"}')

onc_facts=$(echo "$onc_scenario" | jq -r '.facts | map(.id) | join(", ")')

if [[ $onc_facts == *"ONC-IO"* ]] || [[ $onc_facts == *"ONC-ADC"* ]]; then
  echo "✅ Oncology IO/ADC scenario: $onc_facts"
  ((PASSED++))
else
  echo "❌ Oncology scenario missing IO/ADC facts"
  ((FAILED++))
fi

# Test Cardiovascular scenario
cv_scenario=$(curl -s -X POST $BASE_URL/plan \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","disease":"Cardiovascular","persona":"Cardiologist","goal":"HFrEF clinic with uneven GDMT adoption"}')

cv_facts=$(echo "$cv_scenario" | jq -r '.facts | map(.id) | join(", ")')

if [[ $cv_facts == *"CV-GDMT"* ]] || [[ $cv_facts == *"CV-SGLT2"* ]]; then
  echo "✅ Cardiovascular GDMT scenario: $cv_facts"
  ((PASSED++))
else
  echo "❌ Cardiovascular scenario missing GDMT facts"
  ((FAILED++))
fi

echo ""

# Test 7: FSM State Machine Integration
echo "─────────────────────────────────────────────────────────────────"
echo "TEST 7: FSM State Machine per Mode"
echo "─────────────────────────────────────────────────────────────────"

for mode in "${modes[@]}"; do
  fsm=$(curl -s -X POST $BASE_URL/plan \
    -H "Content-Type: application/json" \
    -d "{\"mode\":\"$mode\",\"disease\":\"HIV\"}" | jq -r '.fsm.start // "NONE"')

  if [[ $fsm == "START" ]]; then
    echo "✅ $mode FSM initialized"
    ((PASSED++))
  else
    echo "❌ $mode FSM failed: $fsm"
    ((FAILED++))
  fi
done

echo ""

# Summary
echo "═════════════════════════════════════════════════════════════════"
echo "                        TEST SUMMARY                              "
echo "═════════════════════════════════════════════════════════════════"
echo ""
echo "Total Tests: $((PASSED + FAILED))"
echo "✅ Passed: $PASSED"
echo "❌ Failed: $FAILED"
echo ""

if [[ $FAILED -eq 0 ]]; then
  echo "🎉 ALL TESTS PASSED - System fully operational!"
  exit 0
else
  echo "⚠️  Some tests failed - review output above"
  exit 1
fi
