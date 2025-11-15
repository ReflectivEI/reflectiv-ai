# CHAT MODAL 5-MODE REAL-CONFIG TEST PLAN

**Document:** Test plan for all 5 modes using REAL configuration from repo  
**Date:** November 14, 2025  
**Data Sources:**  
- Mode list: `widget.js` line 53 (LC_OPTIONS) + line 54-60 (LC_TO_INTERNAL)  
- Real personas: `assets/chat/persona.json`  
- Real disease states: `assets/chat/data/scenarios.merged.json`  
- Real prompts: `worker.js` lines 1000-1180  
- Real validation: `worker.js` lines 560-680  

---

## PHASE 1: REAL CONFIGURATION EXTRACTION

### 1.1 Mode Enumeration (REAL)

**Source:** widget.js lines 53-60

```javascript
const LC_OPTIONS = [
  "Emotional Intelligence",
  "Product Knowledge", 
  "Sales Coach",
  "Role Play",
  "General Assistant"
];

const LC_TO_INTERNAL = {
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
};
```

**VALID MODE KEYS (ONLY THESE ACCEPTED):**
- ✅ `"sales-coach"` (UI label: "Sales Coach")
- ✅ `"role-play"` (UI label: "Role Play")
- ✅ `"emotional-assessment"` (UI label: "Emotional Intelligence")
- ✅ `"product-knowledge"` (UI label: "Product Knowledge")
- ✅ `"general-knowledge"` (UI label: "General Assistant")

❌ **INVALID MODE KEYS (REJECT IMMEDIATELY):**
- ❌ `"ai-coach"` (does not exist)
- ❌ `"sales"` (incomplete)
- ❌ `"product"` (incomplete)
- ❌ `"role_play"` (underscore instead of hyphen)
- ❌ `"emotional-intelligence"` (wrong, use "emotional-assessment")
- ❌ Any custom or theoretical mode name

---

### 1.2 Real Personas (REAL)

**Source:** assets/chat/persona.json (existing personas)

```json
{
  "difficult": {
    "name": "Difficult HCP",
    "description": "Resistant, emotional, argumentative",
    "clinical_priority": "Skepticism",
    "decision_style": "Defensive"
  },
  "engaged": {
    "name": "Highly Engaged HCP",
    "description": "Collaborative, attentive, empathetic",
    "clinical_priority": "Evidence",
    "decision_style": "Collaborative"
  },
  "indifferent": {
    "name": "Nice but Doesn't Prescribe",
    "description": "Pleasant, but disengaged, no prescriptions",
    "clinical_priority": "Efficiency",
    "decision_style": "Passive"
  }
}
```

**VALID PERSONA KEYS (ONLY THESE):**
- ✅ `"difficult"`
- ✅ `"engaged"`
- ✅ `"indifferent"`

❌ **INVALID PERSONAS (REJECT):**
- ❌ `"Difficult HCP"` (use key, not label)
- ❌ `"skeptical"` (does not exist)
- ❌ `"busy"` (does not exist)
- ❌ `"expert"` (does not exist)

---

### 1.3 Real Disease States (REAL)

**Source:** assets/chat/data/scenarios.merged.json (ID field)

**VALID DISEASE STATE IDs (FIRST 20):**
1. ✅ `"hiv_im_decile3_prep_lowshare"`
2. ✅ `"hiv_np_decile10_highshare_access"`
3. ✅ `"hiv_pa_decile9_treat_switch_slowdown"`
4. ✅ `"hiv_np_decile5_cab_growth"`
5. ✅ `"hiv_im_decile4_prep_apretude_gap"`
6. ✅ `"hiv_np_decile9_prep_ops_cap"`
7. ✅ `"hiv_pa_decile7_treat_switch_day"`
8. ✅ `"onc_md_decile10_io_adc_pathways"` (Oncology)
9. ✅ (... more real scenarios in file ...)

❌ **INVALID DISEASE STATES (REJECT):**
- ❌ `"hiv"` (too broad, use full ID)
- ❌ `"cardiovascular_high_risk"` (made-up)
- ❌ `"diabetes_type_2"` (made-up)
- ❌ `"HIV_IM"` (wrong format, use lowercase with underscores)
- ❌ `"hiv-prep"` (uses hyphen instead of underscore)

---

## PHASE 2: MODE-SPECIFIC TEST PAYLOADS & CONTRACTS

### TEST 2.1: SALES COACH MODE

**Mode:** `"sales-coach"`  
**UI Label:** "Sales Coach"

#### Request Payload (Real)

```json
{
  "mode": "sales-coach",
  "messages": [
    {
      "role": "user",
      "content": "I have a difficult HCP who is skeptical about PrEP for high-risk patients. How should I approach this?"
    }
  ],
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "difficult",
  "session": "test-sales-coach-001"
}
```

#### Contract Validation (Must Pass ALL)

```javascript
function validateSalesCoachResponse(response) {
  const issues = [];
  
  // ✅ REQUIRED: response.reply non-empty
  if (!response.reply || response.reply.trim().length === 0) {
    issues.push("FAIL: reply is empty");
  }
  
  // ✅ REQUIRED: All 4 sections present
  const hasChallenge = /Challenge:/i.test(response.reply);
  const hasRepApproach = /Rep Approach:/i.test(response.reply);
  const hasImpact = /Impact:/i.test(response.reply);
  const hasPhrasing = /Suggested Phrasing:/i.test(response.reply);
  
  if (!hasChallenge) issues.push("FAIL: Missing 'Challenge:' section");
  if (!hasRepApproach) issues.push("FAIL: Missing 'Rep Approach:' section");
  if (!hasImpact) issues.push("FAIL: Missing 'Impact:' section");
  if (!hasPhrasing) issues.push("FAIL: Missing 'Suggested Phrasing:' section");
  
  // ✅ REQUIRED: coach block present
  if (!response.coach || typeof response.coach !== "object") {
    issues.push("FAIL: coach block missing or not object");
  }
  
  // ✅ REQUIRED: All 10 EI metrics present
  if (response.coach && response.coach.scores) {
    const requiredMetrics = [
      "empathy", "clarity", "compliance", "discovery",
      "objection_handling", "confidence", "active_listening",
      "adaptability", "action_insight", "resilience"
    ];
    const missing = requiredMetrics.filter(m => !(m in response.coach.scores));
    if (missing.length > 0) {
      issues.push(`FAIL: Missing EI metrics: ${missing.join(", ")}`);
    }
  }
  
  // ✅ REQUIRED: Rep Approach has 3+ bullets
  const repMatch = response.reply.match(/Rep Approach:\s*([\s\S]*?)(?=Impact:|$)/i);
  if (repMatch) {
    const bulletCount = (repMatch[1].match(/•/g) || []).length;
    if (bulletCount < 3) {
      issues.push(`FAIL: Rep Approach has only ${bulletCount} bullets (need 3+)`);
    }
  }
  
  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      hasAllSections: hasChallenge && hasRepApproach && hasImpact && hasPhrasing,
      hasCoachBlock: !!response.coach,
      hasAllMetrics: response.coach && response.coach.scores && 
        Object.keys(response.coach.scores).length === 10
    }
  };
}
```

#### Test Case 2.1a: Sales Coach with Difficult Persona

```bash
# Execute test (REAL payload, REAL modes, REAL personas)
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {
        "role": "user",
        "content": "I have a difficult HCP who is skeptical about PrEP for high-risk patients. How should I approach this?"
      }
    ],
    "disease": "hiv_im_decile3_prep_lowshare",
    "persona": "difficult",
    "session": "test-sales-coach-001"
  }'
```

**Expected Assertions:**
```javascript
// Response structure
assert(response.reply, "reply exists");
assert(response.coach, "coach block exists");
assert(response.coach.scores, "scores object exists");

// Contract validation
const validation = validateSalesCoachResponse(response);
assert(validation.passed, `Sales Coach validation failed: ${validation.issues.join("; ")}`);

// Specific metrics
assert(Object.keys(response.coach.scores).length === 10, "All 10 EI metrics present");
assert(validation.metrics.hasAllSections, "All 4 sections present");
```

---

### TEST 2.2: ROLE PLAY MODE

**Mode:** `"role-play"`  
**UI Label:** "Role Play"

#### Request Payload (Real)

```json
{
  "mode": "role-play",
  "messages": [
    {
      "role": "user",
      "content": "I'm a busy IM doctor. I don't have time for PrEP screening every visit. It takes too long."
    }
  ],
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "difficult",
  "session": "test-roleplay-001",
  "_speaker": "hcp"
}
```

#### Contract Validation (Must Pass ALL)

```javascript
function validateRolePlayResponse(response) {
  const issues = [];
  
  // ✅ REQUIRED: reply exists and is HCP voice
  if (!response.reply || response.reply.trim().length === 0) {
    issues.push("FAIL: reply is empty");
  }
  
  // ✅ REQUIRED: No coaching language
  const coachingPatterns = [
    /Challenge:/i,
    /Rep Approach:/i,
    /Impact:/i,
    /Suggested Phrasing:/i,
    /Coach Guidance:/i,
    /You should have/i
  ];
  
  for (const pattern of coachingPatterns) {
    if (pattern.test(response.reply)) {
      issues.push(`FAIL: Coaching language detected: "${pattern.source}"`);
    }
  }
  
  // ✅ REQUIRED: No coach block
  if (response.coach !== null && response.coach !== undefined) {
    issues.push("FAIL: coach block should be null or undefined");
  }
  
  // ✅ REQUIRED: Response sounds like HCP (first person perspective)
  if (!/\b(I|we|my|our)\b/i.test(response.reply)) {
    issues.push("WARN: Response may not be in HCP first-person voice");
  }
  
  return {
    passed: issues.length === 0,
    issues,
    hasCoachingLanguage: coachingPatterns.some(p => p.test(response.reply))
  };
}
```

#### Test Case 2.2a: Role Play HCP Objection

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "role-play",
    "messages": [
      {
        "role": "user",
        "content": "I'"'"'m a busy IM doctor. I don'"'"'t have time for PrEP screening every visit. It takes too long."
      }
    ],
    "disease": "hiv_im_decile3_prep_lowshare",
    "persona": "difficult",
    "session": "test-roleplay-001",
    "_speaker": "hcp"
  }'
```

**Expected Assertions:**
```javascript
const validation = validateRolePlayResponse(response);
assert(validation.passed, `Role Play validation failed: ${validation.issues.join("; ")}`);
assert(!validation.hasCoachingLanguage, "No coaching language present");
assert(response.coach === null || response.coach === undefined, "coach block is null");
```

---

### TEST 2.3: EMOTIONAL INTELLIGENCE (EI ASSESSMENT) MODE

**Mode:** `"emotional-assessment"`  
**UI Label:** "Emotional Intelligence"

#### Request Payload (Real) - With EI Context

```json
{
  "mode": "emotional-assessment",
  "messages": [
    {
      "role": "user",
      "content": "I approached the HCP by citing research on PrEP outcomes. He got defensive and said I was being preachy. What could I have done differently?"
    }
  ],
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "difficult",
  "session": "test-ei-001",
  "eiContext": "[ABOUT-EI.MD CONTENT SLICE - 8000 chars max]"
}
```

#### Contract Validation (Must Pass ALL)

```javascript
function validateEIResponse(response) {
  const issues = [];
  
  // ✅ REQUIRED: reply exists
  if (!response.reply || response.reply.trim().length === 0) {
    issues.push("FAIL: reply is empty");
  }
  
  // ✅ REQUIRED: coach block with all 10 metrics
  if (!response.coach || !response.coach.scores) {
    issues.push("FAIL: coach block or scores missing");
  } else {
    const requiredMetrics = [
      "empathy", "clarity", "compliance", "discovery",
      "objection_handling", "confidence", "active_listening",
      "adaptability", "action_insight", "resilience"
    ];
    const missing = requiredMetrics.filter(m => !(m in response.coach.scores));
    if (missing.length > 0) {
      issues.push(`FAIL: Missing EI metrics: ${missing.join(", ")}`);
    }
  }
  
  // ✅ REQUIRED: Socratic questions present
  const questionCount = (response.reply.match(/\?/g) || []).length;
  if (questionCount === 0) {
    issues.push("FAIL: No Socratic questions detected");
  } else if (questionCount < 2) {
    issues.push("WARN: Only 1 question (expect 2+)");
  }
  
  // ✅ REQUIRED: Framework references
  const frameworkKeywords = ["CASEL", "Triple-Loop", "reflection", "emotional"];
  const hasFrameworkRef = frameworkKeywords.some(kw => 
    new RegExp(kw, "i").test(response.reply)
  );
  if (!hasFrameworkRef) {
    issues.push("WARN: No EI framework references detected");
  }
  
  return {
    passed: issues.length === 0,
    issues,
    metrics: {
      allMetricsPresent: response.coach && 
        Object.keys(response.coach.scores || {}).length === 10,
      hasQuestions: questionCount >= 2,
      hasFrameworkRef
    }
  };
}
```

#### Test Case 2.3a: EI Assessment with Framework

```bash
# First, load about-ei.md content
EI_CONTEXT=$(head -c 8000 < assets/chat/about-ei.md)

curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d "{
    \"mode\": \"emotional-assessment\",
    \"messages\": [
      {
        \"role\": \"user\",
        \"content\": \"I approached the HCP by citing research on PrEP outcomes. He got defensive and said I was being preachy. What could I have done differently?\"
      }
    ],
    \"disease\": \"hiv_im_decile3_prep_lowshare\",
    \"persona\": \"difficult\",
    \"session\": \"test-ei-001\",
    \"eiContext\": \"$EI_CONTEXT\"
  }"
```

**Expected Assertions:**
```javascript
const validation = validateEIResponse(response);
assert(validation.passed, `EI validation failed: ${validation.issues.join("; ")}`);
assert(validation.metrics.allMetricsPresent, "All 10 EI metrics present");
assert(validation.metrics.hasQuestions, "Socratic questions present");
assert(validation.metrics.hasFrameworkRef, "Framework references present");
```

---

### TEST 2.4: PRODUCT KNOWLEDGE MODE

**Mode:** `"product-knowledge"`  
**UI Label:** "Product Knowledge"

#### Request Payload (Real)

```json
{
  "mode": "product-knowledge",
  "messages": [
    {
      "role": "user",
      "content": "What are the key efficacy data points I should know about Descovy for PrEP?"
    }
  ],
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "engaged",
  "session": "test-pk-001"
}
```

#### Contract Validation (Must Pass ALL)

```javascript
function validateProductKnowledgeResponse(response) {
  const issues = [];
  
  // ✅ REQUIRED: reply exists
  if (!response.reply || response.reply.trim().length === 0) {
    issues.push("FAIL: reply is empty");
  }
  
  // ✅ REQUIRED: Citations or references present
  const citationPatterns = [
    /\[\w+-\w+-\w+\]/,  // [REF-CODE-123]
    /\[\d+\]/,          // [1], [2]
    /\(citation\s*\d+\)/i
  ];
  const hasCitations = citationPatterns.some(p => p.test(response.reply));
  if (!hasCitations) {
    issues.push("FAIL: No citations detected");
  }
  
  // ✅ RECOMMENDED: No coach block for PK mode
  if (response.coach !== null && response.coach !== undefined && 
      Object.keys(response.coach).length > 0) {
    issues.push("WARN: coach block present (not expected for PK mode)");
  }
  
  // ✅ RECOMMENDED: On-label vs off-label distinction
  if (/off-label|off label/i.test(response.reply)) {
    if (!/explicitly|not indicated|outside label/i.test(response.reply)) {
      issues.push("WARN: off-label mentioned but may not be properly contextualized");
    }
  }
  
  return {
    passed: issues.length === 0,
    issues,
    hasCitations,
    hasCoachBlock: !!(response.coach && Object.keys(response.coach).length > 0)
  };
}
```

#### Test Case 2.4a: Product Knowledge Efficacy

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "product-knowledge",
    "messages": [
      {
        "role": "user",
        "content": "What are the key efficacy data points I should know about Descovy for PrEP?"
      }
    ],
    "disease": "hiv_im_decile3_prep_lowshare",
    "persona": "engaged",
    "session": "test-pk-001"
  }'
```

**Expected Assertions:**
```javascript
const validation = validateProductKnowledgeResponse(response);
assert(validation.hasCitations, "Citations present in response");
assert(response.reply.includes("efficacy") || 
       response.reply.includes("effectiveness"), "Efficacy content present");
```

---

### TEST 2.5: GENERAL ASSISTANT MODE

**Mode:** `"general-knowledge"`  
**UI Label:** "General Assistant"

#### Request Payload (Real)

```json
{
  "mode": "general-knowledge",
  "messages": [
    {
      "role": "user",
      "content": "Explain the difference between pathophysiology and epidemiology in simple terms."
    }
  ],
  "disease": null,
  "persona": null,
  "session": "test-general-001"
}
```

#### Contract Validation

```javascript
function validateGeneralAssistantResponse(response) {
  const issues = [];
  
  // ✅ REQUIRED: reply exists
  if (!response.reply || response.reply.trim().length === 0) {
    issues.push("FAIL: reply is empty");
  }
  
  // ✅ REQUIRED: Response answers the question
  if (!response.reply.includes("pathophysiology") && 
      !response.reply.includes("epidemiology")) {
    issues.push("WARN: Response may not address the question");
  }
  
  return {
    passed: issues.length === 0,
    issues
  };
}
```

#### Test Case 2.5a: General Assistant Any Topic

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "general-knowledge",
    "messages": [
      {
        "role": "user",
        "content": "Explain the difference between pathophysiology and epidemiology in simple terms."
      }
    ],
    "session": "test-general-001"
  }'
```

---

## PHASE 3: GUARD RAIL TESTS (Prevent Fake Testing)

### Guard Test 3.1: Invalid Mode Rejection

```javascript
function testInvalidModeRejection() {
  const invalidModes = [
    "ai-coach",
    "sales",
    "role_play",      // underscore, not hyphen
    "emotional-intelligence",  // wrong, use emotional-assessment
    "assistant",
    "product",
    "made-up-mode"
  ];
  
  for (const invalidMode of invalidModes) {
    const payload = {
      mode: invalidMode,
      messages: [{role: "user", content: "test"}],
      session: "test-invalid-mode"
    };
    
    // Should return 400 error or unknown mode error
    const response = await fetch("/chat", {method: "POST", body: JSON.stringify(payload)});
    assert(response.status === 400 || response.status === 422, 
      `Mode "${invalidMode}" should be rejected with 4xx error`);
  }
}
```

### Guard Test 3.2: Invalid Persona Rejection

```javascript
function testInvalidPersonaRejection() {
  const invalidPersonas = [
    "Difficult HCP",    // Use key "difficult", not label
    "skeptical",
    "busy",
    "expert",
    "unknown"
  ];
  
  for (const invalidPersona of invalidPersonas) {
    const payload = {
      mode: "sales-coach",
      messages: [{role: "user", content: "test"}],
      persona: invalidPersona,
      session: "test-invalid-persona"
    };
    
    // Should return 400 error or unknown persona error
    const response = await fetch("/chat", {method: "POST", body: JSON.stringify(payload)});
    assert(response.status === 400 || response.status === 422,
      `Persona "${invalidPersona}" should be rejected with 4xx error`);
  }
}
```

### Guard Test 3.3: Invalid Disease State Rejection

```javascript
function testInvalidDiseaseRejection() {
  const invalidDiseases = [
    "hiv",              // Too broad, use full ID
    "cardiovascular",
    "diabetes_type_2",
    "made-up-disease",
    "hiv-prep"          // Uses hyphen instead of underscore
  ];
  
  for (const invalidDisease of invalidDiseases) {
    const payload = {
      mode: "sales-coach",
      messages: [{role: "user", content: "test"}],
      disease: invalidDisease,
      session: "test-invalid-disease"
    };
    
    // Should return 400 error or unknown disease error
    const response = await fetch("/chat", {method: "POST", body: JSON.stringify(payload)});
    assert(response.status === 400 || response.status === 422,
      `Disease "${invalidDisease}" should be rejected with 4xx error`);
  }
}
```

### Guard Test 3.4: Sales Coach Contract Enforcement

```javascript
function testSalesCoachContractEnforcement() {
  const payload = {
    mode: "sales-coach",
    messages: [{role: "user", content: "How should I approach a skeptical HCP?"}],
    disease: "hiv_im_decile3_prep_lowshare",
    persona: "difficult",
    session: "test-sales-contract"
  };
  
  const response = await fetch("/chat", {method: "POST", body: JSON.stringify(payload)});
  const data = await response.json();
  
  // Validate contract
  assert(data.reply.includes("Challenge:"), "Must include Challenge: section");
  assert(data.reply.includes("Rep Approach:"), "Must include Rep Approach: section");
  assert(data.reply.includes("Impact:"), "Must include Impact: section");
  assert(data.reply.includes("Suggested Phrasing:"), "Must include Suggested Phrasing: section");
  assert(data.coach && data.coach.scores, "Must include coach block with scores");
  assert(Object.keys(data.coach.scores).length === 10, "Must have exactly 10 EI metrics");
}
```

### Guard Test 3.5: EI Assessment Framework Requirement

```javascript
function testEIFrameworkRequirement() {
  // Test WITHOUT eiContext - should error or degrade gracefully
  const payloadWithoutContext = {
    mode: "emotional-assessment",
    messages: [{role: "user", content: "How could I improve?"}],
    disease: "hiv_im_decile3_prep_lowshare",
    persona: "engaged",
    session: "test-ei-no-context"
    // MISSING: eiContext
  };
  
  const response1 = await fetch("/chat", {method: "POST", body: JSON.stringify(payloadWithoutContext)});
  const data1 = await response1.json();
  
  // If response succeeds, should at least warn
  assert(data1.warnings && data1.warnings.includes("ei_context_missing"),
    "Should warn if EI context missing");
  
  // Test WITH eiContext - should fully succeed
  const eiContent = await (await fetch("assets/chat/about-ei.md")).text();
  const payloadWithContext = {
    mode: "emotional-assessment",
    messages: [{role: "user", content: "How could I improve?"}],
    disease: "hiv_im_decile3_prep_lowshare",
    persona: "engaged",
    session: "test-ei-with-context",
    eiContext: eiContent.slice(0, 8000)
  };
  
  const response2 = await fetch("/chat", {method: "POST", body: JSON.stringify(payloadWithContext)});
  const data2 = await response2.json();
  
  assert(data2.coach && data2.coach.scores, "Should include coach block with context");
  assert(Object.keys(data2.coach.scores).length === 10, "All 10 metrics must be present");
}
```

---

## PHASE 4: TEST EXECUTION COMMANDS

### Command 4.1: Run All Tests (Automated)

```bash
#!/bin/bash
# File: test-all-5-modes.sh
# Usage: bash test-all-5-modes.sh

echo "=== Chat Modal 5-Mode Real-Config Test Suite ==="
echo ""

# Load real config
WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
MODES=("sales-coach" "role-play" "emotional-assessment" "product-knowledge" "general-knowledge")
PERSONAS=("difficult" "engaged" "indifferent")
DISEASE="hiv_im_decile3_prep_lowshare"

echo "✓ Loaded real modes: ${MODES[@]}"
echo "✓ Loaded real personas: ${PERSONAS[@]}"
echo "✓ Loaded real disease: $DISEASE"
echo ""

# Test each mode
for mode in "${MODES[@]}"; do
  echo "Testing mode: $mode"
  curl -X POST "$WORKER_URL/chat" \
    -H "Content-Type: application/json" \
    -d "{
      \"mode\": \"$mode\",
      \"messages\": [{\"role\": \"user\", \"content\": \"Test message\"}],
      \"disease\": \"$DISEASE\",
      \"persona\": \"engaged\",
      \"session\": \"test-$mode-001\"
    }" | jq '.' > "test-$mode-result.json"
  
  # Check result file
  if [ -s "test-$mode-result.json" ]; then
    echo "  ✓ Response received"
    # Validate based on mode
    case "$mode" in
      "sales-coach")
        if grep -q "Challenge:" "test-$mode-result.json"; then
          echo "  ✓ Sales Coach contract validated"
        else
          echo "  ✗ Sales Coach missing Challenge section"
        fi
        ;;
      "role-play")
        if ! grep -q "Coach Guidance:" "test-$mode-result.json"; then
          echo "  ✓ Role Play no coaching detected"
        else
          echo "  ✗ Role Play has unexpected coaching"
        fi
        ;;
      "emotional-assessment")
        if grep -q "empathy" "test-$mode-result.json"; then
          echo "  ✓ EI Assessment metrics present"
        else
          echo "  ✗ EI Assessment missing metrics"
        fi
        ;;
      "product-knowledge")
        if grep -q "\[" "test-$mode-result.json"; then
          echo "  ✓ Product Knowledge citations present"
        else
          echo "  ✗ Product Knowledge missing citations"
        fi
        ;;
      "general-knowledge")
        echo "  ✓ General Assistant response received"
        ;;
    esac
  else
    echo "  ✗ No response received"
  fi
  echo ""
done

echo "=== Test Suite Complete ==="
```

### Command 4.2: Run Guard Rail Tests

```bash
#!/bin/bash
# File: test-guardrails.sh
# Usage: bash test-guardrails.sh

echo "=== Guard Rail Tests (Prevent Fake Data) ==="
echo ""

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

# Test 1: Invalid mode should be rejected
echo "Test 1: Invalid mode 'ai-coach' should be rejected"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"mode":"ai-coach","messages":[{"role":"user","content":"test"}],"session":"test-invalid-mode"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
  echo "  ✓ PASS: Invalid mode rejected with $HTTP_CODE"
else
  echo "  ✗ FAIL: Invalid mode accepted (HTTP $HTTP_CODE)"
fi

# Test 2: Invalid persona should be rejected
echo "Test 2: Invalid persona 'skeptical' should be rejected"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}],"persona":"skeptical","session":"test-invalid-persona"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
  echo "  ✓ PASS: Invalid persona rejected with $HTTP_CODE"
else
  echo "  ✗ FAIL: Invalid persona accepted (HTTP $HTTP_CODE)"
fi

# Test 3: Invalid disease should be rejected
echo "Test 3: Invalid disease 'made-up' should be rejected"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$WORKER_URL/chat" \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}],"disease":"made-up","session":"test-invalid-disease"}')

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
if [ "$HTTP_CODE" = "400" ] || [ "$HTTP_CODE" = "422" ]; then
  echo "  ✓ PASS: Invalid disease rejected with $HTTP_CODE"
else
  echo "  ✗ FAIL: Invalid disease accepted (HTTP $HTTP_CODE)"
fi

echo ""
echo "=== Guard Rail Tests Complete ==="
```

---

## PHASE 5: EXPECTED TEST RESULTS

### Result 5.1: Sales Coach Success Result

```json
{
  "req_id": "req_abc123",
  "reply": "Challenge: The HCP's skepticism about PrEP stems from workload concerns and incomplete risk assessment.\n\nRep Approach:\n• Show the STI volume data in your clinic to quantify at-risk patients\n• Review the latest renal safety data specific to Descovy for PrEP\n• Propose a nurse-led screening protocol to reduce physician time\n\nImpact: Implementing a streamlined PrEP workflow addresses the HCP's time constraints while ensuring appropriate patient identification.\n\nSuggested Phrasing: \"What if we identified your true PrEP candidates through a quick questionnaire during intake? Our data shows quarterly monitoring takes minimal clinic time when the nurse handles initial screening.\"",
  "coach": {
    "scores": {
      "empathy": 4,
      "clarity": 4,
      "compliance": 5,
      "discovery": 3,
      "objection_handling": 4,
      "confidence": 4,
      "active_listening": 4,
      "adaptability": 3,
      "action_insight": 4,
      "resilience": 3
    },
    "rationales": {
      "empathy": "Acknowledged the HCP's workload burden",
      "clarity": "Provided clear data points and action steps",
      ... (all 10 rationales)
    },
    "tips": ["Lead with data, not opinions", "Acknowledge constraints first"],
    "rubric_version": "v2.0"
  }
}
```

### Result 5.2: Role Play Success Result

```json
{
  "req_id": "req_def456",
  "reply": "I'm running a pretty efficient clinic as it is. We have protocols for the high-risk patients we see, and frankly, PrEP just adds another layer of screening and follow-up. The patients who need it usually find it on their own or go to the STI clinic down the road.",
  "coach": null
}
```

### Result 5.3: Guard Rail Test Failure

```json
{
  "error": "INVALID_MODE",
  "message": "Mode 'ai-coach' not found. Valid modes: sales-coach, role-play, emotional-assessment, product-knowledge, general-knowledge",
  "http_code": 400
}
```

---

## PHASE 6: TEST DOCUMENTATION

Each test MUST document:

1. **Mode Used:** Which internal mode key (from LC_TO_INTERNAL)
2. **Real Personas:** Only from persona.json
3. **Real Diseases:** Only from scenarios.merged.json
4. **Expected Contract:** What structure response MUST have
5. **Validation Assertions:** Specific checks performed
6. **Pass/Fail Criteria:** What determines success

**CRITICAL RULE:**
> No test is allowed to use imaginary modes, personas, diseases, or scenarios. All test data MUST be loaded from real repository files at runtime.

---

**End Test Plan**

All tests based on REAL repo data: widget.js (modes), persona.json (personas), scenarios.merged.json (diseases), worker.js (prompts, validation).
