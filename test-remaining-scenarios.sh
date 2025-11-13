#!/bin/bash

# Test remaining scenarios with longer delays
WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Testing remaining 7 scenarios with 3-second delays...${NC}"
echo ""

test_scenario() {
    local mode=$1
    local disease=$2
    local scenario_id=$3
    local test_message=$4

    echo -e "${BLUE}${mode} - ${disease} - ${scenario_id}${NC}"

    if [ "$mode" = "role-play" ]; then
        PAYLOAD=$(cat <<EOF
{
  "mode": "${mode}",
  "persona": "difficult",
  "scenario": "${scenario_id}",
  "messages": [
    {"role": "user", "content": "${test_message}"}
  ]
}
EOF
)
    else
        PAYLOAD=$(cat <<EOF
{
  "mode": "${mode}",
  "scenario": "${scenario_id}",
  "messages": [
    {"role": "user", "content": "${test_message}"}
  ]
}
EOF
)
    fi

    RESPONSE=$(curl -s -X POST "${WORKER_URL}/chat" \
        -H "Content-Type: application/json" \
        -H "Origin: https://reflectivei.github.io" \
        -d "${PAYLOAD}" 2>&1)

    if echo "$RESPONSE" | grep -q '"reply"' && echo "$RESPONSE" | grep -q '"coach"'; then
        OVERALL_SCORE=$(echo "$RESPONSE" | grep -o '"overall":[0-9]*' | head -1 | cut -d':' -f2)
        echo -e "  ${GREEN}✓ PASS${NC} - Coach feedback score: ${OVERALL_SCORE}"
    elif echo "$RESPONSE" | grep -q '"error"'; then
        ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo -e "  ${RED}✗ FAIL${NC} - ${ERROR_MSG}"
    else
        echo -e "  ${RED}✗ FAIL${NC} - No valid response"
    fi

    echo ""
    sleep 3
}

# Vaccines (3 tests)
echo -e "${YELLOW}VACCINES${NC}"
test_scenario "sales-coach" "Vaccines" "vac_id_decile8_adult_flu_playbook" \
    "Our adult flu program coverage dropped in the 65+ population. What can we do?"

test_scenario "role-play" "Vaccines" "vac_np_decile5_primary_care_capture" \
    "We miss VIS documentation due to staff rotation. How do we standardize this?"

test_scenario "sales-coach" "Vaccines" "vac_pa_decile6_oh_campus_outreach" \
    "Student uptake is low and inventory turns slow. What's your campus strategy?"

# COVID-19 (2 tests)
echo -e "${YELLOW}COVID-19${NC}"
test_scenario "role-play" "COVID-19" "covid_pulm_np_decile6_postcovid_adherence" \
    "Patients present day 4-5 and callbacks delay treatment start. What's your workflow?"

test_scenario "sales-coach" "COVID-19" "covid_pulm_pa_decile5_hospital_at_home" \
    "Discharged patients lack transport for IV remdesivir. How do we use home infusion?"

# Cardiovascular (2 tests)
echo -e "${YELLOW}CARDIOVASCULAR${NC}"
test_scenario "role-play" "Cardiovascular" "cv_np_decile6_ckd_sglt2_calendar" \
    "We're hesitant to use SGLT2 inhibitors in CKD stage 3. What's the safety profile?"

test_scenario "sales-coach" "Cardiovascular" "cv_pa_decile7_postmi_transitions" \
    "We defer SGLT2 initiation to PCP and have high readmissions. What's the discharge protocol?"

echo -e "${GREEN}Remaining tests complete!${NC}"
