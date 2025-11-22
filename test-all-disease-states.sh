#!/bin/bash

# Comprehensive Disease State Testing
# Tests sales-coach and role-play modes across all available therapeutic areas
# Based on scenarios.merged.json: HIV, Oncology, Vaccines, COVID-19, Cardiovascular

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
TOTAL_TESTS=0
PASSED_TESTS=0

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  COMPREHENSIVE DISEASE STATE TESTING  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Testing across 5 therapeutic areas:"
echo "  1. HIV"
echo "  2. Oncology"
echo "  3. Vaccines"
echo "  4. COVID-19"
echo "  5. Cardiovascular"
echo ""
echo "Modes being tested:"
echo "  - sales-coach (Sales Coach)"
echo "  - role-play (Role Play)"
echo ""
echo -e "${YELLOW}Note: Diabetes scenarios NOT found in scenarios.merged.json${NC}"
echo ""

# Function to test a mode with specific scenario
test_scenario() {
    local mode=$1
    local disease=$2
    local scenario_id=$3
    local hcp_profile=$4
    local test_message=$5

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -e "${BLUE}Test #${TOTAL_TESTS}: ${mode} - ${disease} - ${scenario_id}${NC}"
    echo "  HCP Profile: ${hcp_profile}"

    # Build JSON payload based on mode
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

    # Make request
    RESPONSE=$(curl -s -X POST "${WORKER_URL}/chat" \
        -H "Content-Type: application/json" \
        -H "Origin: https://reflectivei.github.io" \
        -d "${PAYLOAD}" 2>&1)

    # Check for response
    if echo "$RESPONSE" | grep -q '"reply"' && echo "$RESPONSE" | grep -q '"coach"'; then
        # Extract coach score if available
        OVERALL_SCORE=$(echo "$RESPONSE" | grep -o '"overall":[0-9]*' | head -1 | cut -d':' -f2)
        if [ -n "$OVERALL_SCORE" ]; then
            echo -e "  ${GREEN}✓ PASS${NC} - Reply received with coach feedback (score: ${OVERALL_SCORE})"
        else
            echo -e "  ${GREEN}✓ PASS${NC} - Reply received with coach feedback"
        fi
        PASSED_TESTS=$((PASSED_TESTS + 1))
    elif echo "$RESPONSE" | grep -q '"error"'; then
        ERROR_MSG=$(echo "$RESPONSE" | grep -o '"error":"[^"]*"' | head -1 | cut -d'"' -f4)
        echo -e "  ${RED}✗ FAIL${NC} - Error: ${ERROR_MSG}"
    else
        echo -e "  ${RED}✗ FAIL${NC} - No valid response received"
        echo "  Response preview: $(echo "$RESPONSE" | head -c 200)"
    fi

    echo ""
    sleep 1  # Rate limiting courtesy
}

# ===========================================
# HIV TESTING (7 scenarios)
# ===========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  THERAPEUTIC AREA: HIV                 ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_scenario "sales-coach" "HIV" "hiv_im_decile3_prep_lowshare" \
    "Internal Medicine MD" \
    "I'd like to discuss our PrEP program and identify patients who could benefit from Descovy."

test_scenario "role-play" "HIV" "hiv_np_decile10_highshare_access" \
    "Nurse Practitioner" \
    "I'm concerned about the prior authorization burden for Descovy prescriptions."

test_scenario "sales-coach" "HIV" "hiv_pa_decile9_treat_switch_slowdown" \
    "Physician Assistant" \
    "We've been hesitant to switch stable patients to Biktarvy. Can you explain the benefits?"

# ===========================================
# ONCOLOGY TESTING (3 scenarios)
# ===========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  THERAPEUTIC AREA: ONCOLOGY            ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_scenario "sales-coach" "Oncology" "onc_md_decile10_io_adc_pathways" \
    "Medical Oncologist" \
    "Our P&T committee is evaluating ADC therapies. What's your biomarker-driven approach?"

test_scenario "role-play" "Oncology" "onc_np_decile6_pathway_ops" \
    "Oncology NP" \
    "We're short-staffed for AE management. How can we standardize our toxicity protocols?"

test_scenario "sales-coach" "Oncology" "onc_pa_decile7_gu_oral_onc_tminus7" \
    "Oncology PA (GU)" \
    "We have issues with hub enrollment timing. What's the T-7 onboarding process?"

# ===========================================
# VACCINES TESTING (3 scenarios)
# ===========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  THERAPEUTIC AREA: VACCINES            ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_scenario "sales-coach" "Vaccines" "vac_id_decile8_adult_flu_playbook" \
    "Infectious Disease Specialist" \
    "Our adult flu program coverage dropped in the 65+ population. What can we do?"

test_scenario "role-play" "Vaccines" "vac_np_decile5_primary_care_capture" \
    "Family Medicine NP" \
    "We miss VIS documentation due to staff rotation. How do we standardize this?"

test_scenario "sales-coach" "Vaccines" "vac_pa_decile6_oh_campus_outreach" \
    "Physician Assistant (Occupational Health)" \
    "Student uptake is low and inventory turns slow. What's your campus strategy?"

# ===========================================
# COVID-19 TESTING (3 scenarios)
# ===========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  THERAPEUTIC AREA: COVID-19            ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_scenario "sales-coach" "COVID-19" "covid_pulm_md_decile9_antiviral_ddi_path" \
    "Pulmonologist" \
    "DDI screening slows our Paxlovid prescribing in high-risk COPD patients. What's your protocol?"

test_scenario "role-play" "COVID-19" "covid_pulm_np_decile6_postcovid_adherence" \
    "Pulmonary NP" \
    "Patients present day 4-5 and callbacks delay treatment start. What's your workflow?"

test_scenario "sales-coach" "COVID-19" "covid_pulm_pa_decile5_hospital_at_home" \
    "Pulmonary PA" \
    "Discharged patients lack transport for IV remdesivir. How do we use home infusion?"

# ===========================================
# CARDIOVASCULAR TESTING (3 scenarios)
# ===========================================
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}  THERAPEUTIC AREA: CARDIOVASCULAR      ${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

test_scenario "sales-coach" "Cardiovascular" "cv_card_md_decile10_hf_gdmt_uptake" \
    "Cardiologist" \
    "Our HFrEF clinic has 62% Entresto and only 38% SGLT2 uptake. How do we improve?"

test_scenario "role-play" "Cardiovascular" "cv_np_decile6_ckd_sglt2_calendar" \
    "Cardiology NP" \
    "We're hesitant to use SGLT2 inhibitors in CKD stage 3. What's the safety profile?"

test_scenario "sales-coach" "Cardiovascular" "cv_pa_decile7_postmi_transitions" \
    "Cardiology PA" \
    "We defer SGLT2 initiation to PCP and have high readmissions. What's the discharge protocol?"

# ===========================================
# SUMMARY
# ===========================================
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  TEST RESULTS SUMMARY                  ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "Total Tests Run: ${TOTAL_TESTS}"
echo -e "Tests Passed: ${GREEN}${PASSED_TESTS}${NC}"
echo -e "Tests Failed: ${RED}$((TOTAL_TESTS - PASSED_TESTS))${NC}"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ]; then
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  ✓ ALL TESTS PASSED!                   ${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 0
else
    PASS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}  Pass Rate: ${PASS_RATE}%                      ${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    exit 1
fi
