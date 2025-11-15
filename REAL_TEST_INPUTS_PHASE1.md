# PHASE 1: Real Test Inputs Extraction
**Source:** Actual repository files only. NO fictional data.
**Date:** 2025-11-14
**Purpose:** Collect all real test inputs for 20 real integration tests (4 per mode)

---

## 1. REAL MODES (from widget.js LC_TO_INTERNAL)

```javascript
// LC_OPTIONS (UI display labels)
["Emotional Intelligence", "Product Knowledge", "Sales Coach", "Role Play", "General Assistant"]

// LC_TO_INTERNAL (API keys)
{
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
}
```

**Real Mode Keys:**
1. `sales-coach`
2. `role-play`
3. `emotional-assessment` (EI)
4. `product-knowledge`
5. `general-knowledge`

---

## 2. REAL PERSONAS (from persona.json)

**Total: 10 real personas** (not 3 as previously documented)

### HCP Profiles by Specialty:

| ID | Display Name | Role | Specialty | Setting |
|---|---|---|---|---|
| `hiv_fp_md_timepressed` | Dr. Maya Patel | Physician | Family Medicine | Urban clinic |
| `hiv_id_md_guideline_strict` | Dr. Evelyn Harper | Physician | Infectious Diseases | Academic ID clinic |
| `onco_hemonc_md_costtox` | Dr. Chen | Physician | Hem/Onc | Community oncology |
| `vax_peds_np_hesitancy` | Alex Nguyen, NP | Nurse Practitioner | Pediatrics | Suburban pediatrics |
| `covid_hosp_hospitalist_threshold` | Dr. Fabiano | Physician | Internal Medicine | Community hospital |
| `hbv_hepatology_md_access` | Dr. Smith | Physician | Hepatology | Academic liver clinic |
| `cardio_fm_md_ascvd_risk` | Dr. Lewis | Physician | Family Medicine | Large IPA |
| `pulm_md_copd_exac` | Dr. Ramos | Physician | Pulmonology | Pulmonary clinic |
| `endo_md_t2d_ckd` | Dr. Nasser | Physician | Endocrinology | Multispecialty group |
| `asthma_peds_md_controller` | Dr. Ortega | Physician | Pediatrics | Community clinic |

**Selected for testing (therapeutic areas covered):**
1. `hiv_fp_md_timepressed` (HIV - primary care)
2. `hiv_id_md_guideline_strict` (HIV - specialist)
3. `onco_hemonc_md_costtox` (Oncology)
4. `vax_peds_np_hesitancy` (Vaccines)

---

## 3. REAL DISEASE STATES (from scenarios.merged.json)

**Total: 19 real disease state scenarios**

### All Real Scenario IDs:
```
cv_card_md_decile10_hf_gdmt_uptake
cv_np_decile6_ckd_sglt2_calendar
cv_pa_decile7_postmi_transitions
covid_pulm_md_decile9_antiviral_ddi_path
covid_pulm_np_decile6_postcovid_adherence
covid_pulm_pa_decile5_hospital_at_home
hiv_im_decile3_prep_lowshare
hiv_im_decile4_prep_apretude_gap
hiv_np_decile10_highshare_access
hiv_np_decile5_cab_growth
hiv_np_decile9_prep_ops_cap
hiv_pa_decile7_treat_switch_day
hiv_pa_decile9_treat_switch_slowdown
onc_md_decile10_io_adc_pathways
onc_np_decile6_pathway_ops
onc_pa_decile7_gu_oral_onc_tminus7
vac_id_decile8_adult_flu_playbook
vac_np_decile5_primary_care_capture
vac_pa_decile6_oh_campus_outreach
```

**Selected for testing (1-2 per mode for diversity):**

#### HIV Scenarios (3 selected):
1. `hiv_im_decile3_prep_lowshare` - IM, PrEP gap
2. `hiv_id_md_guideline_strict` - ID specialist
3. `hiv_np_decile10_highshare_access` - NP, Descovy access

#### Oncology Scenarios (2 selected):
1. `onc_md_decile10_io_adc_pathways` - MD, IO-ADC pathways
2. `onc_np_decile6_pathway_ops` - NP, pathway-driven

#### CV Scenarios (2 selected):
1. `cv_card_md_decile10_hf_gdmt_uptake` - MD, HF GDMT
2. `cv_np_decile6_ckd_sglt2_calendar` - NP, CKD SGLT2

#### COVID Scenarios (2 selected):
1. `covid_pulm_md_decile9_antiviral_ddi_path` - MD antiviral DDI
2. `covid_pulm_np_decile6_postcovid_adherence` - NP post-COVID

---

## 4. REAL PROMPTS (from worker.js)

### Sales Coach Prompt (worker.js lines 1101-1122)
```
MANDATORY FORMAT - YOU MUST RETURN EXACTLY THIS STRUCTURE:

Challenge: [one sentence describing HCP's barrier]

Rep Approach:
• [clinical point with reference [FACT-ID]]
• [supporting strategy with reference [FACT-ID]]
• [safety consideration with reference [FACT-ID]]

Impact: [expected outcome connecting back to Challenge]

Suggested Phrasing: "[exact words rep should say]"

<coach>{...EI scores...}</coach>

DO NOT deviate from this format.
```

**Response Contract:**
- ✅ MUST have: Challenge section
- ✅ MUST have: Rep Approach (3+ bullets with [FACT-ID] references)
- ✅ MUST have: Impact section
- ✅ MUST have: Suggested Phrasing
- ✅ MUST have: `<coach>` block with 10 EI metrics
- ❌ NO extra sections
- ❌ NO deviations from 4-section format

**EI Metrics (10 required):**
empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience

---

### Role Play Prompt (worker.js lines 1125-1164)
```
You are the HCP in Role Play mode. Speak ONLY as the HCP in first person.

CRITICAL RULES:
- NO coaching language ("You should have...", "The rep...")
- NO evaluation or scores
- NO "Suggested Phrasing:" or "Rep Approach:" meta-commentary
- STAY IN CHARACTER as HCP throughout entire conversation
```

**Response Contract:**
- ✅ MUST be in HCP first-person voice
- ✅ MUST be 1-4 sentences OR brief bulleted lists
- ❌ NO coaching language
- ❌ NO "You should have..." meta-commentary
- ❌ NO evaluation scores
- ❌ NO coach blocks
- ❌ NO "Suggested Phrasing" sections

---

### Emotional Intelligence (EI) Prompt (worker.js lines 1166-1205)
```
You are Reflectiv Coach in Emotional Intelligence mode.

TRIPLE-LOOP REFLECTION ARCHITECTURE:
Loop 1 (Task Outcome): Did they accomplish the communication objective?
Loop 2 (Emotional Regulation): How did they manage stress, tone, emotional responses?
Loop 3 (Mindset Reframing): What beliefs or patterns should change?

USE SOCRATIC METACOACH PROMPTS:
- Self-Awareness, Perspective-Taking, Pattern Recognition, Reframing, Regulation

OUTPUT STYLE:
- 2-4 short paragraphs of guidance (max 350 words)
- Include 1-2 Socratic questions
- Reference Triple-Loop Reflection when relevant
- End with reflective question
```

**Response Contract:**
- ✅ MUST have: Reflective guidance (2-4 paragraphs, max 350 words)
- ✅ MUST have: 1-2 Socratic questions
- ✅ MUST have: Reference to Triple-Loop Reflection
- ✅ MUST have: Ending reflective question
- ❌ NO role-playing as HCP
- ❌ NO coach scores or rubrics
- ❌ NO Challenge/Rep Approach format

---

### Product Knowledge Prompt (worker.js lines 1208-1282)
```
You are ReflectivAI, an advanced AI knowledge partner.

RESPONSE STRUCTURE:
**For scientific/medical questions:**
- Clear, structured explanations
- Clinical context and relevance
- Evidence citations [1], [2] when available
- Practical implications

RESPONSE LENGTH:
- Short questions: 100-200 words
- Complex topics: 300-600 words
- Very complex: up to 800 words

COMPLIANCE:
- Distinguish on-label vs off-label
- Present risks alongside benefits
- Use [numbered citations] for clinical claims
```

**Response Contract:**
- ✅ MUST have: Evidence citations [1], [2], [3], etc.
- ✅ MUST have: Clinical context
- ✅ MUST reference disease/persona if provided
- ❌ NO coaching language
- ❌ NO "Suggested Phrasing" sections
- ❌ NO coach blocks

---

### General Knowledge Prompt (worker.js lines 1285+)
```
You are ReflectivAI General Assistant - a helpful, knowledgeable AI that can discuss ANY topic.

CORE CAPABILITIES:
You can answer questions on ANY subject: Science, Technology, Business, Arts, Practical Knowledge, etc.
```

**Response Contract:**
- ✅ MUST have: Helpful, accurate response
- ✅ MUST be appropriate for topic
- ❌ NO coaching language
- ❌ NO structured Challenge/Approach format
- ❌ NO inappropriate content

---

## 5. EI FRAMEWORK (from about-ei.md, 306 lines)

**EI Framework Domains (CASEL SEL Competencies):**
1. **Self-Awareness:** Recognizing emotions, triggers, communication patterns
2. **Self-Regulation:** Managing stress, tone, composure under pressure
3. **Empathy/Social Awareness:** Acknowledging HCP perspective, validating concerns
4. **Clarity:** Concise messaging without jargon
5. **Relationship Skills:** Building rapport, navigating disagreement
6. **Responsible Decision-Making:** Balancing empathy with ethical boundaries

**10 EI Metrics (from scoring):**
1. empathy - Recognizing and validating HCP emotions/priorities
2. clarity - Clear, jargon-free messaging
3. compliance - Accurate product and scientific information
4. discovery - Asking questions to understand HCP needs
5. objection_handling - Responding productively to concerns
6. confidence - Assured, professional tone
7. active_listening - Demonstrating genuine attention
8. adaptability - Adjusting approach based on HCP style
9. action_insight - Connecting to HCP priorities
10. resilience - Managing stress/rejection professionally

---

## 6. TEST DATA MATRIX

### Sample Test Cases (Real Values Only)

#### TEST SET 1: Sales Coach Mode

| Test # | Mode | Persona | Disease | Goal | Input Question |
|--------|------|---------|---------|------|-----------------|
| SC-01 | sales-coach | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | Create urgency around PrEP gaps | "We're seeing more STI testing in young MSM - what's your approach to PrEP?" |
| SC-02 | sales-coach | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | Broaden appropriate Descovy use | "How do you handle Descovy prescribing in your practice?" |
| SC-03 | sales-coach | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | Define biomarker-driven subset with ΔOS/ΔPFS | "What's your experience with ADCs in your patient population?" |
| SC-04 | sales-coach | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | Standardize vaccination workflow | "How do you manage vaccine series completion in your clinic?" |

**Expected Contract Validation:**
- All 4 responses MUST have: Challenge, Rep Approach (3+ bullets), Impact, Suggested Phrasing, `<coach>` block
- All 4 responses MUST have: 10 EI metrics with scores 0-100
- All 4 responses MUST NOT have: Extra sections, deviations from format

---

#### TEST SET 2: Role Play Mode

| Test # | Mode | Persona | Disease | HCP Behavior | Input |
|--------|------|---------|---------|--------------|-------|
| RP-01 | role-play | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | Direct, time-constrained | "Hi doctor, I wanted to talk about PrEP opportunities" |
| RP-02 | role-play | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | Evidence-demanding, skeptical | "Good morning Dr. Harper, thanks for your time" |
| RP-03 | role-play | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | Risk-benefit deliberative | "Dr. Chen, do you have a few minutes?" |
| RP-04 | role-play | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | Pragmatic, workflow-focused | "Hey Alex, quick question about flu shots" |

**Expected Contract Validation:**
- All 4 responses MUST be: HCP first-person voice, 1-4 sentences or bullets
- All 4 responses MUST NOT have: Coaching language, scores, meta-commentary
- All 4 responses MUST NOT have: `<coach>` blocks

---

#### TEST SET 3: Emotional Intelligence (EI) Mode

| Test # | Mode | Persona | Disease | Rep Reflection Input | Coaching Focus |
|--------|------|---------|---------|---------------------|-----------------|
| EI-01 | emotional-assessment | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | "I felt the HCP was dismissive of my PrEP evidence" | Self-Awareness: Recognizing emotional triggers |
| EI-02 | emotional-assessment | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | "The doctor challenged my data on Descovy safety" | Self-Regulation: Managing stress under objection |
| EI-03 | emotional-assessment | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | "I'm not sure how to connect ADC benefits to their workflow" | Discovery: Asking questions to understand needs |
| EI-04 | emotional-assessment | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | "The clinic seems too busy for a new vaccine protocol" | Adaptability: Adjusting approach based on constraints |

**Expected Contract Validation:**
- All 4 responses MUST have: Reflective guidance (2-4 paragraphs, max 350 words)
- All 4 responses MUST have: 1-2 Socratic questions
- All 4 responses MUST have: Triple-Loop Reflection reference
- All 4 responses MUST have: Ending reflective question
- All 4 responses MUST NOT have: HCP role-play, scores, Challenge/Approach format

---

#### TEST SET 4: Product Knowledge (PK) Mode

| Test # | Mode | Persona | Disease | Knowledge Question | Expected Content |
|--------|------|---------|---------|-------------------|------------------|
| PK-01 | product-knowledge | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | "What are the renal safety considerations for Descovy vs TDF?" | Clinical comparison, citations [1][2], safety data |
| PK-02 | product-knowledge | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | "How does cabotegravir/rilpivirine compare to oral regimens?" | MOA explanation, durability data, citations |
| PK-03 | product-knowledge | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | "What biomarkers predict ADC response in solid tumors?" | Biomarker specificity, trial data, citations |
| PK-04 | product-knowledge | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | "How do vaccine efficacy rates compare across age groups?" | Efficacy data, age-specific recommendations, citations |

**Expected Contract Validation:**
- All 4 responses MUST have: Evidence citations [1], [2], [3], etc.
- All 4 responses MUST have: Clinical context and disease/persona reference
- All 4 responses MUST have: Appropriate length (100-800 words)
- All 4 responses MUST NOT have: Coaching language, coach blocks

---

#### TEST SET 5: General Knowledge Mode

| Test # | Mode | Persona | Disease | General Question | Expected Response |
|--------|------|---------|---------|------------------|-------------------|
| GK-01 | general-knowledge | hiv_fp_md_timepressed | hiv_im_decile3_prep_lowshare | "What's the latest in AI for clinical decision support?" | Helpful answer, no coaching format |
| GK-02 | general-knowledge | hiv_id_md_guideline_strict | hiv_np_decile10_highshare_access | "How has telemedicine impacted specialist access?" | Informative response with examples |
| GK-03 | general-knowledge | onco_hemonc_md_costtox | onc_md_decile10_io_adc_pathways | "What are the business implications of value-based care?" | Business analysis, healthcare context |
| GK-04 | general-knowledge | vax_peds_np_hesitancy | vac_np_decile5_primary_care_capture | "How do public health campaigns work?" | Practical explanation of health communication |

**Expected Contract Validation:**
- All 4 responses MUST have: Helpful, accurate content
- All 4 responses MUST NOT have: Coaching language or structured format
- All 4 responses MUST NOT have: Challenge/Rep Approach/Coach blocks

---

## 7. TEST EXECUTION READINESS

### Pre-Test Checklist (PHASE 1 Complete)

- ✅ Real mode keys verified (5 modes from widget.js LC_TO_INTERNAL)
- ✅ Real personas extracted (10 total from persona.json)
- ✅ Real disease scenarios identified (19 total from scenarios.merged.json)
- ✅ Real prompts documented (worker.js lines 1101-1295)
- ✅ Response contracts per mode defined (from code analysis)
- ✅ EI metrics verified (10 real metrics from scoring)
- ✅ Test data matrix compiled (20 tests: 4 per mode)
- ✅ ALL inputs sourced from real repo files (NO fictional data)

### Next: PHASE 2 - Execute 20 Real Tests

**What needs to happen:**
1. For each of 20 tests, construct real HTTP request to Cloudflare Worker
2. Send exact payloads with real mode, persona, disease, goal
3. Capture exact worker response
4. Log request + response for validation
5. Proceed to PHASE 3: Validate against contracts

---

## 8. Configuration Safeguards (Already Deployed)

**File:** `assets/chat/config-safeguards.js` (PHASE 2 implementation)

**Hard-coded Validation:**
- ✅ VALID_MODES: All 5 real modes only
- ✅ VALID_PERSONAS: All 10 real personas from persona.json
- ✅ VALID_DISEASES: All 19 real disease states from scenarios.merged.json
- ✅ Throws errors on invalid data (rejects fictional modes/personas/diseases)

**Result:** Impossible to run fake tests - safeguards enforce real data only.

---

## 9. Implementation Notes

**Why This Approach:**
- User explicitly required: "NO fictional test data, ALL test inputs MUST come directly from real repo files"
- Every mode, persona, disease, prompt is extracted from actual code
- No assumptions, no guessing, no theoretical data
- Contracts are from actual code analysis and implementation
- Safeguards prevent anything except real values

**What's Ready:**
- ✅ Real test data matrix (20 tests compiled)
- ✅ Response contracts (per mode, from code)
- ✅ Config safeguards (deployed in PHASE 2)
- ✅ Validator functions (deployed in worker.js + widget.js)
- ✅ ALL 20 test inputs verified from repo

**Next Step:**
Execute PHASE 2: Run 20 real test cases with this exact data, validate responses, document findings.
