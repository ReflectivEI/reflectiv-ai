# PHASE 1: Learning Center Format Contracts & Architecture Mapping

**Date:** 2025-11-15  
**Status:** Architecture mapping complete (no code changes)  
**Scope:** All 5 Learning Center modes + format contract definitions

---

## 1. FRONTEND-TO-BACKEND WIRING ARCHITECTURE

### 1.1 Mode Mapping (widget.js lines 54-60)

```javascript
const LC_OPTIONS = [
  "Emotional Intelligence", "Product Knowledge", "Sales Coach", "Role Play", "General Assistant"
];

const LC_TO_INTERNAL = {
  "Emotional Intelligence" → "emotional-assessment",
  "Product Knowledge" → "product-knowledge", 
  "Sales Coach" → "sales-coach",
  "Role Play" → "role-play",
  "General Assistant" → "general-knowledge"
};
```

**Critical Observation:**  
- UI labels (LC_OPTIONS) are user-facing display strings
- Internal mode keys (LC_TO_INTERNAL values) are used for all backend logic
- All payload construction MUST use internal mode keys, NEVER UI labels
- "General Knowledge" has NO corresponding mode file in `assets/chat/modes/` (by design)

### 1.2 API Payload Construction (widget.js lines 2887-2960)

**Function:** `callModel(messages, scenarioContext = null)`

**Payload format:**
```javascript
const payload = {
  mode: currentMode,                          // From LC_TO_INTERNAL
  user: lastUserMsg?.content || "",           // Last message in messages array
  history: messages.filter(...).slice(0, -1), // Prior messages (excluding system, last user)
  disease: scenarioContext?.diseaseState || "",
  persona: scenarioContext?.label || "",
  goal: scenarioContext?.goal || "",
  session: "widget-" + randomId(),
  
  // EI-specific: Include framework content if available
  eiContext: (if mode === "emotional-assessment") ? loadedEIFramework : undefined
};
```

**Endpoint:** `POST ${WORKER_URL}/chat`

**Worker Base URL:** Set via `window.WORKER_URL` (currently: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`)

### 1.3 Mode-Specific Preprocessing (sendMessage function, widget.js)

**All modes:**
- Add system prompt (via `buildPreface()`)
- Include EI heuristics if `(mode === "sales-coach" || mode === "role-play") && eiHeuristics`
- For EI mode: Load and embed EI context via `EIContext.getSystemExtras()`

**Role-Play specific:**
- Prepend persona hint (`currentPersonaHint()`)
- Add disease/role/goal context in separate system message
- No coach block expected in response

**Other modes:**
- Standard system + user message structure

### 1.4 Worker Routing (worker.js lines 88-99)

```javascript
// Endpoint dispatch
POST /chat → postChat(req, env)
  └─ rateLimit check (`${IP}:chat`)
  └─ Parse body.mode, body.messages, body.disease, body.persona
  └─ Route to mode-specific handler based on mode value
  └─ Validate mode against VALID_MODES list (contract enforcement)
  └─ Return JSON response with reply text + optional coach block
```

---

## 2. FORMAT CONTRACTS BY MODE

### 2.1 SALES-COACH (mode key: `sales-coach`)

**Purpose:** Sales simulation with rep coaching feedback and EI metrics

**Frontend Files:**
- `assets/chat/modes/salesCoach.js` (mode controller)
- `widget.js` (payload construction, response rendering)

**Backend Logic:**
- `worker.js` lines 1110-1200: Sales Coach Prompt
- `worker.js` lines 700-780: Format validation
- Post-processing: Extract `<coach>` block, validate sections

**REQUIRED Response Format:**

```
Challenge: [ONE SENTENCE - HCP's barrier or knowledge gap - 15-25 words]

Rep Approach:
• [BULLET 1: Clinical point + reference [FACT-ID] - 20-35 words]
• [BULLET 2: Supporting strategy + reference [FACT-ID] - 20-35 words]
• [BULLET 3: Safety/monitoring + reference [FACT-ID] - 20-35 words]
[EXACTLY 3 BULLETS - no more, no less]

Impact: [ONE SENTENCE - expected outcome connecting to Challenge - 20-35 words]

Suggested Phrasing: "[EXACT words rep should say - 25-40 words - professional, conversational tone]"

<coach>{
  "scores": {
    "empathy": 1-5, "clarity": 1-5, "compliance": 1-5, "discovery": 1-5,
    "objection_handling": 1-5, "confidence": 1-5, "active_listening": 1-5,
    "adaptability": 1-5, "action_insight": 1-5, "resilience": 1-5
  },
  "worked": ["..."], "improve": ["..."], "phrasing": "...", "feedback": "...",
  "context": {"rep_question": "...", "hcp_reply": "..."}
}</coach>
```

**Contract Violations (Frontend MUST detect & reject):**
- ❌ Missing any section (Challenge, Rep Approach, Impact, Suggested Phrasing)
- ❌ Rep Approach has <3 bullets
- ❌ Bullets missing reference codes [FACT-ID]
- ❌ Missing `<coach>` block with all 10 EI metrics
- ❌ Any EI metric outside range 1-5 or non-numeric
- ❌ HCP impersonation ("I'm a busy doctor..." at start of response)

**Widget Rendering:**
- Display all 4 sections with clear visual separation (headers + spacing)
- Show coach block as structured panel with metric scores
- NO paragraph collapsing; preserve section structure exactly

---

### 2.2 ROLE-PLAY (mode key: `role-play`)

**Purpose:** HCP first-person conversational simulation without coaching

**Frontend Files:**
- `assets/chat/modes/rolePlay.js` (mode controller)
- `widget.js` (sanitizeRolePlayOnly(), enforceHcpOnly())

**Backend Logic:**
- `worker.js` lines 1142-1180: Role Play Prompt
- `worker.js` lines 565-610: Validation (detect and strip coaching language)

**REQUIRED Response Format:**

```
[Natural HCP conversation in first person - 1-4 sentences OR brief bulleted lists]
[No structure headers, no coaching language, no meta-commentary]
[Professional, clinical tone reflecting HCP persona's time pressure and priorities]

Example OK responses:
"From my perspective, we evaluate high-risk patients using history, behaviors, and adherence context."

"• I prioritize regular follow-up appointments to assess treatment efficacy
 • I also encourage patients to report any changes in symptoms or side effects
 • Additionally, I use digital tools to enhance patient engagement"

"I'm doing well, thanks. I have a few minutes before my next patient, what brings you by?"
```

**Contract Violations (Frontend MUST detect & reject):**
- ❌ Contains "Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:" headers
- ❌ Contains `<coach>` block (any JSON metadata)
- ❌ Second-person coaching language ("You should have...", "The rep...")
- ❌ Evaluation language ("This rep...", "Grade:", "Score:")
- ❌ NOT in first/second-person HCP voice (e.g., sounds like narrator/coach)
- ❌ Overly long monologues (>300 words without natural pauses)

**Widget Rendering:**
- Display as plain chat message (conversational turn)
- No coach panel or scoring display
- Preserve line breaks for bulleted lists when appropriate
- NO structure headers or formatting

---

### 2.3 EMOTIONAL-ASSESSMENT (mode key: `emotional-assessment`)

**Purpose:** Reflective coaching focused on EI competencies and Triple-Loop Reflection

**Frontend Files:**
- `assets/chat/modes/emotionalIntelligence.js` (mode controller)
- `ei-context.js` (framework content loader)
- `about-ei.md` (framework definitions)

**Backend Logic:**
- `worker.js` lines 1182-1250: EI Prompt with framework references
- `worker.js` lines 755-785: EI validation (check for Socratic questions)
- Request includes `body.eiContext` with about-ei.md content

**REQUIRED Response Format:**

```
[2-4 short paragraphs - reflective feedback focused on CASEL SEL competencies]
[~200-350 words total]

MUST include:
- Explicit references to emotional/reflective themes (self-awareness, regulation, empathy, etc.)
- Triple-Loop Reflection references (task outcome, emotional regulation, mindset reframing)
- 1-2 Socratic questions (metacoaching style)
- Ending with a reflective question that prompts deeper thinking

MUST NOT include:
- <coach> block (metrics are optional for EI)
- Challenge/Rep Approach/Impact structure
- Directive advice ("You should...")
- Sales coaching language
```

**Example OK Response:**
```
"What I notice is that you shifted your tone when the HCP pushed back about renal monitoring. 
That's a common pattern — clinicians often resist when they feel their judgment is being questioned. 
What emotion did you feel in that moment?

Looking at the exchange, you had good facts, but the delivery became a bit assertive. 
The HCP might have heard 'you're not following guidelines' instead of 'let me help you implement this safely.'

Here's a pattern worth exploring: When objections come up, they're often requests for clarity, not resistance. 
How would your next response differ if you reframed that objection as a question about safety rather than disagreement?

What assumption were you making about this HCP's willingness to prescribe?"
```

**Contract Violations (Frontend MUST detect & reject):**
- ❌ No Socratic questions (0 question marks)
- ❌ No reference to EI framework, Triple-Loop, or emotional themes
- ❌ Contains `<coach>` block with numeric scoring
- ❌ Sounds like sales coaching (Challenge/Rep Approach structure)
- ❌ Purely directive ("Do this...", "Try that...")
- ❌ Wall-of-text paragraph (>300 words without visual breaks)

**Widget Rendering:**
- Display as reflective text blocks with visual paragraph separation
- Optional: Highlight Socratic questions visually (italics or distinct styling)
- NO coach scoring panel (unlike Sales Coach)
- NO section headers

---

### 2.4 PRODUCT-KNOWLEDGE (mode key: `product-knowledge`)

**Purpose:** Clinical/scientific knowledge with proper citations and label-aligned information

**Frontend Files:**
- `assets/chat/modes/productKnowledge.js` (mode controller)
- `widget.js` (citation rendering)

**Backend Logic:**
- `worker.js` lines 1252-1310: Product Knowledge Prompt (enhanced citations)
- `worker.js` lines 638-670: Citation validation (ENFORCE citations)
- Post-processing: Convert `[FACT-ID]` codes to numbered `[1], [2], [3]` references

**REQUIRED Response Format:**

```
[Clinical/scientific explanation with disease & persona context]
[2-6 paragraphs + optional bullet lists]
[~300-500 words typical]

MUST include:
- Numbered citations [1], [2], [3] for ALL clinical/scientific claims
- References section at end mapping each number to source URL
- Label-aligned language when discussing on-label vs off-label uses
- Safety considerations clearly stated
- NO coaching language or structure

MUST NOT include:
- <coach> block (no EI scoring for PK mode)
- Sales coaching structure (Challenge/Rep/Impact)
- HCP persona voice (neutral, factual, clinician-to-clinician)
- Off-label claims without proper contextualization

Example OK response:
"Descovy (emtricitabine/tenofovir alafenamide) is indicated for HIV PrEP in at-risk adults 
weighing ≥35 kg, excluding individuals assigned female at birth at risk from receptive vaginal sex [1].

The DISCOVER trial demonstrated non-inferiority to Truvada with superior bone density and 
renal safety profiles [2]. Renal function monitoring is recommended every 3-6 months, with 
consideration of dose adjustment if eGFR <50 mL/min [3].

**References:**
1. FDA Label — Descovy for PrEP (https://...)
2. DISCOVER Trial — NEJM (https://...)
3. CDC PrEP Guidelines 2024 (https://...)"
```

**Contract Violations (Frontend MUST detect & reject):**
- ❌ Clinical/scientific claims WITHOUT [1]/[2] citations
- ❌ Contains `<coach>` block
- ❌ Sales coaching structure (Challenge/Rep/Impact headers)
- ❌ Off-label claims NOT contextualized with "not indicated for" or "outside label"
- ❌ NO references section mapping numbered citations to sources
- ❌ Sounds like HCP voice ("In my clinic...") instead of neutral clinician
- ❌ Missing safety/monitoring considerations for drugs/therapies

**Widget Rendering:**
- Display as clinical prose with markdown formatting for citations
- Show references section at bottom (numbered, with links)
- NO coach scoring panel
- NO structured headers like "Challenge/Rep Approach/Impact"

---

### 2.5 GENERAL-KNOWLEDGE (mode key: `general-knowledge`)

**Purpose:** Freeform assistant responses; flexible scope (NOT structured like Sales Coach)

**Frontend Files:**
- NO dedicated mode file (intentional; uses default chat behavior)
- `widget.js` (standard message rendering)

**Backend Logic:**
- `worker.js` lines 1312-1380: General Knowledge Prompt
- Light validation (must not be empty, no Sales Coach structure leakage)
- NO strict structure enforcement

**REQUIRED Response Format:**

```
[Freeform, helpful response - clear and conversational]
[1-4 paragraphs OR short bullet lists, depending on question]
[~200-400 words typical]

MUST include:
- Direct, clear answer to the user's question
- Neutral, professional tone (NOT HCP voice, NOT coach voice)
- Appropriate context or explanations
- NO Sales Coach structure (no Challenge/Rep/Impact)

MUST NOT include:
- <coach> block
- Sales coaching language or EI metrics
- HCP persona ("I'm a busy doctor...")
- Off-label medical advice without disclaimers
- Wall-of-text responses (>500 words without breaks)

Example OK responses:
"The cardiac effects of certain chemotherapy agents, particularly anthracyclines, can manifest 
as dilated cardiomyopathy months or years after treatment. Cardio-oncology specialists recommend 
baseline echocardiograms, periodic monitoring (EF assessment), and consideration of cardioprotective agents."

"Vaccine hesitancy often stems from:
• Perceived risk vs. benefit miscalculation
• Historical medical trauma or distrust
• Information gaps or conflicting social messaging
• Specific side effect concerns

Evidence-based approaches include shared decision-making, addressing specific concerns, and 
providing clear information about trial data and safety monitoring."
```

**Contract Violations (Frontend MUST detect & reject):**
- ❌ Contains `<coach>` block (any EI scoring)
- ❌ Sales Coach structure (Challenge/Rep/Impact headers)
- ❌ Role-Play HCP persona voice ("In my clinic...")
- ❌ Empty response (0 characters)
- ❌ Wall-of-text paragraph (>500 words, single block, no breaks)

**Widget Rendering:**
- Display as standard chat message (conversational)
- Preserve paragraphs and bullet formatting
- NO special coach panel or scoring display
- Light markdown formatting (bolds, lists) OK

---

## 3. VALIDATION FUNCTIONS (Worker-Side Guardrails)

### 3.1 Mode Validation

**Location:** `worker.js` lines 2897-2900 (widget.js callModel function)

**Current Implementation:**
```javascript
const validModes = ["emotional-assessment", "product-knowledge", "sales-coach", "role-play"];
if (!validModes.includes(currentMode)) {
  throw new Error("invalid_mode");
}
```

⚠️ **Issue:** Missing "general-knowledge" from the validation list!  
This means GK mode tests may fail validation before reaching backend.

### 3.2 Response Contract Validation

**Location:** `worker.js` lines 730-900 (validateResponseContract function)

**Current Coverage:**
- ✅ Sales-Coach: Checks for all 4 sections, bullet count, coach block structure
- ✅ Role-Play: Checks for NO coaching language, checks for HCP voice
- ✅ Emotional-Assessment: Checks for Socratic questions, framework references
- ✅ Product-Knowledge: Checks for citations, off-label contextualization
- ✅ General-Knowledge: Light validation (not empty)

**Status:** Function exists but NOT enforced in postChat() response flow

---

## 4. INCONSISTENCIES & ISSUES IDENTIFIED

### 4.1 General Knowledge Mode NOT in callModel validation

**File:** `widget.js` line 2897  
**Current:**
```javascript
const validModes = ["emotional-assessment", "product-knowledge", "sales-coach", "role-play"];
```

**Missing:** `"general-knowledge"`

**Impact:** GK mode requests fail at widget-level validation before reaching Worker

**Fix Required:** Add "general-knowledge" to validModes array

---

### 4.2 Response Contract Validation NOT Applied to All Responses

**Location:** `worker.js` line 1631 (postChat function)

**Current Code:**
```javascript
const validation = validateModeResponse(mode, reply, coachObj);
reply = validation.reply; // Use cleaned reply
```

**Issue:** Result validation is logged but response is ALWAYS sent regardless of validation result  
- Violations are not returned to frontend
- Frontend cannot know if response violated contract
- No rejection/retry mechanism

**Impact:** Bad responses slip through to UI without frontend knowing

---

### 4.3 Widget Response Rendering Assumes Fixed Structures

**Location:** Various mode controllers (`salesCoach.js`, `rolePlay.js`, etc.)

**Pattern:** Code assumes response format will match contract  
- No fallback if sections are missing
- No repair mechanism if structure corrupted
- UI crashes if expected elements absent

---

### 4.4 "General Knowledge" Mode File Does NOT Exist

**Expectation:** File `assets/chat/modes/general-knowledge.js` should exist  
**Reality:** No such file exists (confirmed via file listing)

**Assessment:** This is INTENTIONAL and CORRECT
- GK mode is designed to use default chat behavior
- No special preprocessing or post-processing needed
- Any mode file would be redundant

**Action:** Document this as intentional design decision (OK as-is)

---

### 4.5 Backwards Compatibility: Legacy "sales-simulation" Mode

**Observed in Backups:** Old widget versions reference `"sales-simulation"` as default  
**Current:** Uses `"sales-coach"` everywhere

**Status:** ✅ Properly migrated; no legacy references remain in active code

---

## 5. DATA FLOW DIAGRAMS

### Sales Coach Mode Flow

```
User Input (widget.js)
    ↓
buildPayload() with sales-coach mode key
    ↓
callModel() → POST /chat with messages + disease + persona + goal
    ↓
Worker postChat()
    ├─ Extract mode = "sales-coach"
    ├─ Load facts DB filtered by disease
    ├─ Build salesCoachPrompt (MANDATORY format enforcement)
    ├─ Call LLM (Groq)
    ├─ extractCoach() separates reply from <coach> block
    ├─ validateResponseContract(mode, reply, coach)
    └─ Return { reply, coach }
    ↓
Widget Response Handler
    ├─ Validate 4 sections present
    ├─ Validate 3+ bullets in Rep Approach
    ├─ Validate coach block has all 10 metrics
    ├─ Display with section separation
    └─ Render coach scoring panel

Expected Response Structure:
Challenge: ...
Rep Approach:
• ...
• ...
• ...
Impact: ...
Suggested Phrasing: "..."
<coach>{...10 metrics...}</coach>
```

### Role Play Mode Flow

```
User Input (widget.js)
    ↓
buildPayload() with role-play mode + persona context
    ↓
callModel() → POST /chat with messages + disease + persona
    ↓
Worker postChat()
    ├─ Extract mode = "role-play"
    ├─ Build rolePlayPrompt (HCP VOICE ONLY)
    ├─ Call LLM (Groq)
    ├─ extractCoach() finds NO coach block (OK for RP)
    ├─ validateResponseContract() rejects any coaching language
    └─ Return { reply: text-only, coach: null }
    ↓
Widget Response Handler
    ├─ Validate NO Challenge/Rep/Impact/Suggested Phrasing
    ├─ Validate NO <coach> block
    ├─ Validate HCP first-person voice
    ├─ enforceHcpOnly() strips any coach leakage
    ├─ Display as plain chat message
    └─ NO coach scoring panel

Expected Response Structure:
"[Natural HCP conversation - 1-4 sentences or bullets]"
```

### Product Knowledge Mode Flow

```
User Input (widget.js)
    ↓
buildPayload() with product-knowledge mode
    ↓
callModel() → POST /chat
    ↓
Worker postChat()
    ├─ Extract mode = "product-knowledge"
    ├─ Load facts DB (all therapeutic areas)
    ├─ Build pkPrompt (CITATIONS REQUIRED)
    ├─ Call LLM (Groq)
    ├─ extractCoach() finds NO coach block (OK for PK)
    ├─ validateResponseContract() enforces [1]/[2]/[3] citations
    └─ Return { reply: cited-text, coach: null }
    ↓
Widget Response Handler
    ├─ Validate citations [1], [2], [3] present
    ├─ Validate references section with URLs
    ├─ Validate NO coaching structure
    ├─ Display with markdown rendering
    └─ Show references section at bottom

Expected Response Structure:
"[Clinical explanation with [1] [2] [3] citations]"

**References:**
1. [Source] (URL)
2. [Source] (URL)
3. [Source] (URL)
```

---

## 6. FORMAT CONTRACT SUMMARY TABLE

| Aspect | Sales Coach | Role Play | EI Assessment | Product Knowledge | General Knowledge |
|--------|------------|-----------|--------------|-------------------|-------------------|
| **Required Sections** | 4 (Challenge, Rep, Impact, Phrasing) | None (natural HCP voice) | 2-4 paragraphs reflective | Multiple paragraphs + refs | Flexible (1-4 sections) |
| **Coach Block** | ✅ REQUIRED (10 EI metrics) | ❌ NOT allowed | ⚠️ Optional | ❌ NOT allowed | ❌ NOT allowed |
| **Citations** | [FACT-ID] in bullets | No citations needed | No citations | ✅ REQUIRED [1],[2] | Optional |
| **Voice** | Coach voice (rep training) | HCP voice (1st person) | Reflective coach (questions) | Clinician (neutral) | Assistant (neutral) |
| **Bullets** | 3+ in Rep Approach | Allowed if clinical | Minimal | Allowed | Allowed |
| **Socratic Questions** | Optional | No | ✅ REQUIRED (1-2) | No | Optional |
| **Word Count** | 300-400 | 100-250 | 200-350 | 300-500 | 200-400 |
| **Typical Rendering** | Section panels + score | Chat message | Reflective text | Prose + refs | Chat message |

---

## 7. TESTING REQUIREMENTS FOR PHASE 3

**Real Test Data Required:**

| Mode | Personas (from persona.json) | Diseases (from scenarios.merged.json) | Questions |
|------|-----|-----|-----|
| **sales-coach** | hiv_fp_md_timepressed, hiv_id_md_guideline_strict, onco_hemonc_md_costtox, vax_peds_np_hesitancy | hiv_im_decile3_prep_lowshare, hiv_np_decile10_highshare_access, onc_md_decile10_io_adc_pathways, vac_np_decile5_primary_care_capture | 4 real scenario-based questions |
| **role-play** | Same 4 personas | Same 4 diseases | 4 real HCP conversation starters |
| **emotional-assessment** | Same 4 personas | Same 4 diseases | 4 real reflective coaching questions |
| **product-knowledge** | Same 4 personas | Same 4 diseases | 4 real clinical knowledge questions |
| **general-knowledge** | Same 4 personas | Same 4 diseases | 4 real general questions |

**Total Tests Required:** 5 modes × 4 personas = 20 real HTTP calls

**Assertion Matrix:**
- Sales Coach: All 4 sections present, 3+ bullets, coach block with all 10 metrics
- Role Play: NO coaching language, NO coach block, HCP voice, 1-4 sentences
- EI Assessment: 2+ Socratic questions, EI framework references, NO coaching structure
- Product Knowledge: Citations [1]/[2]/[3] present, references section, NO coach block
- General Knowledge: Non-empty, NO Sales Coach structure, conversational tone

---

## 8. DOCUMENTATION LOCATION & REFERENCES

**Related Files in Repo:**
- `tests/lc_integration_tests.js` (lines 1-706): Test harness with 20 real tests
- `tests/lc_integration_summary_v2.md`: Previous test results
- `worker.js` (lines 1-1843): Worker with all mode prompts + validators
- `widget.js` (lines 1-3735): Frontend with callModel, sendMessage, response handling
- `assets/chat/modes/*.js`: Individual mode controllers
- `about-ei.md`, `ei-context.js`: EI framework content

**Key Helper Functions:**
- `validateResponseContract()`: worker.js line 730
- `validateModeResponse()`: worker.js line 568
- `extractCoach()`: worker.js line 285
- `sanitizeLLM()`, `sanitizeRolePlayOnly()`: worker.js + widget.js

---

## PHASE 1 CONCLUSION

✅ **Architecture mapping complete**

**Key Findings:**
1. All 5 modes properly wired front-to-back
2. Format contracts well-defined in code but not explicitly documented (NOW DONE)
3. Validation functions exist but coverage incomplete
4. One bug found: General Knowledge missing from callModel validation list
5. General Knowledge intentionally has no dedicated mode file (correct design)

**Ready for PHASE 2:** Format hardening and guardrail implementation

---

**Document Version:** 1.0  
**Created:** 2025-11-15  
**No code changes in PHASE 1 (mapping only)**
