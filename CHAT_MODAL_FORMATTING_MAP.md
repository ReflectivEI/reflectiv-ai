# CHAT MODAL FORMATTING MAP

**Document:** Real code mapping for chat modal response formatting across all Learning Center modes  
**Date:** November 14, 2025  
**Status:** PHASE 1 - ANALYSIS ONLY (No code changes yet)  
**Accuracy:** Based on actual repo files, real mode definitions, and real config

---

## REAL MODES IN THE SYSTEM

From `widget.js` lines 54-60 (`LC_TO_INTERNAL` mapping):
```javascript
const LC_TO_INTERNAL = {
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "General Assistant": "general-knowledge"
};
```

**5 REAL MODES CONFIRMED:**
1. `sales-coach` (UI Label: "Sales Coach")
2. `role-play` (UI Label: "Role Play")
3. `emotional-assessment` (UI Label: "Emotional Intelligence")
4. `product-knowledge` (UI Label: "Product Knowledge")
5. `general-knowledge` (UI Label: "General Assistant")

---

## MODE-BY-MODE MAPPING

### MODE 1: SALES COACH (`sales-coach`)

#### Frontend Flow
- **UI Dropdown:** "Sales Coach" → mapped to internal key `"sales-coach"`
- **Mode Module:** `assets/chat/modes/salesCoach.js` (lines 1-50)
  - Minimal: just `chat({mode, messages, signal})` with fallback to generic modal
- **Widget request builder:** `widget.js` lines ~2750-2779 (callModel function)
  - Builds payload: `{mode: "sales-coach", messages: [...], disease, persona, ...}`
  - Includes EI context if mode is `"emotional-assessment"` (NOT sales-coach)
  - Payload sent to `/chat` endpoint

#### Backend (Worker) Flow
- **File:** `worker.js`
- **Entry point:** `postChat()` function (lines 750+)
- **Mode extraction:** Line 780 `mode = body.mode || "sales-coach"`
- **FSM definition:** Lines 182-184
  ```javascript
  "sales-coach": {
    states: { START: { capSentences: 30, next: "COACH" }, COACH: { capSentences: 30, next: "COACH" } },
    start: "START"
  }
  ```
- **System prompt selection:** Lines 1225-1227
  ```javascript
  } else if (mode === "sales-coach") {
    sys = salesCoachPrompt;
  }
  ```
- **Prompt definition:** Lines 935-958
  - Detailed 4-section contract: Challenge, Rep Approach (3 bullets), Impact, Suggested Phrasing
  - Includes EI scoring block: `<coach>{scores, rationales, tips, rubric_version}</coach>`

#### Response Structure (Contract)
```
Challenge: [ONE SENTENCE, 15-25 words]

Rep Approach:
• [BULLET 1: 20-35 words, must include [REF-CODE]]
• [BULLET 2: 20-35 words, must include [REF-CODE]]
• [BULLET 3: 20-35 words, must include [REF-CODE]]

Impact: [ONE SENTENCE, 20-35 words]

Suggested Phrasing: "[EXACT words for rep, 25-40 words]"

<coach>{
  "scores": {10 metrics: 0-5},
  "rationales": {10 metrics: text},
  "tips": [array],
  "rubric_version": "v2.0"
}</coach>
```

#### Frontend Response Processing
- **File:** `widget.js`
- **Detection:** Line 2015+ checks `m._mode === "sales-coach"`
- **Parsing:** `formatSalesCoachReply()` function (line 730+)
  - Extracts `<coach>` JSON block
  - Splits response into 4 sections (Challenge, Rep Approach, Impact, Suggested Phrasing)
  - Renders with HTML formatting

#### EI Panel Rendering (if present)
- **Function:** `renderEiPanel()` (widget.js lines 370-418)
- **Input:** Extracts `msg._coach` from parsed response
- **Output:** 10-metric card grid with scores/rationales
- **Files involved:**
  - `ei-context.js` — provides `EIContext.getSystemExtras()` (NOT used for sales-coach at request time)
  - Metrics: empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience

---

### MODE 2: ROLE PLAY (`role-play`)

#### Frontend Flow
- **UI Dropdown:** "Role Play" → `"role-play"`
- **Mode Module:** `assets/chat/modes/rolePlay.js` (same structure as salesCoach.js)
  - Simple modal with `chat({mode, messages, signal})`
  - NO EI context loading (rolePlay not in EI context check)
- **Widget request builder:** Same as sales-coach; EI context NOT included

#### Backend (Worker) Flow
- **Entry point:** `postChat()` (worker.js line 750+)
- **FSM definition:** Lines 186-188
  ```javascript
  "role-play": {
    states: { START: { capSentences: 12, next: "HCP" }, HCP: { capSentences: 12, next: "HCP" } },
    start: "START"
  }
  ```
- **Prompt selection:** Lines 1225-1226
  ```javascript
  if (mode === "role-play") {
    sys = rolePlayPrompt;
  }
  ```
- **Prompt definition:** Lines 959-998
  - HCP persona role-play script
  - Expects alternating User (Rep) ↔ HCP dialogue
  - NO coach block in response

#### Response Structure (Contract)
```
[HCP natural language response - conversational, no coaching]
[No <coach> block]
[No EI metrics]
```

#### Mode Drift Protection
- **Function:** `validateModeResponse()` (worker.js lines 564-605)
- **For role-play:** Lines 576-603
  ```javascript
  if (mode === "role-play") {
    // Strip any coaching from role-play responses
    if (body.coach) delete body.coach;
    // ... validate HCP-only format
  }
  ```

#### Frontend Response Processing
- **Detection:** Line 2015+ checks `m._mode === "role-play"`
- **Rendering:** Raw text display (NO coach panel, NO EI metrics)
- **HCP-only enforcement:** `enforceHcpOnly()` function (widget.js lines 669+) strips rep voice

---

### MODE 3: EMOTIONAL INTELLIGENCE / EI SCORING (`emotional-assessment`)

#### Frontend Flow
- **UI Dropdown:** "Emotional Intelligence" → `"emotional-assessment"`
- **Mode Module:** `assets/chat/modes/emotionalIntelligence.js` (same base structure)
- **Widget request builder:** `widget.js` lines 2764-2779 (SPECIAL HANDLING)
  - Detects `currentMode === "emotional-assessment"`
  - Calls `EIContext.getSystemExtras()` to load about-ei.md + rubric + persona
  - Injects into payload: `payload.eiContext = eiExtras.slice(0, 8000)`
  - Payload sent to `/chat` with EI context included

#### EI Context Loading
- **File:** `assets/chat/ei-context.js` (lines 1-50)
- **Function:** `EIContext.getSystemExtras()`
- **Loads:**
  - `assets/chat/about-ei.md` (EI framework definition, ~7000 chars)
  - `assets/chat/config.json` (EI rubric metadata)
  - `assets/chat/persona.json` (EI persona rails)
- **Returns:** Concatenated markdown string with all 3 resources (sliced to 7000 chars total)

#### Backend (Worker) Flow
- **Entry point:** `postChat()` (worker.js line 750+)
- **FSM definition:** Lines 190-192
  ```javascript
  "emotional-assessment": {
    states: { START: { capSentences: 20, next: "EI" }, EI: { capSentences: 20, next: "EI" } },
    start: "START"
  }
  ```
- **Prompt selection:** Lines 1229-1230
  ```javascript
  } else if (mode === "emotional-assessment") {
    sys = eiPrompt;
  }
  ```
- **Prompt definition:** Lines 1000-1041
  - References Triple-Loop Reflection framework
  - CASEL competencies (Self-Awareness, Self-Regulation, Empathy, Clarity, Relationship Skills, Compliance)
  - Socratic coaching questions
  - **CRITICAL:** Line 1041 appends `+ eiFrameworkContent`
    - Dynamic embedding of `body.eiContext` from client (lines 995-998)
    - If `body.eiContext` provided: appends actual about-ei.md content
    - If missing: uses empty string (fallback, still works but less grounded)

#### Response Structure (Contract)
```
[2-4 paragraphs of reflective coaching, max 350 words]
[1-2 Socratic questions]
[Reference to Triple-Loop Reflection framework]
[Reflective question building metacognition]

<coach>{
  "scores": {10 metrics: 0-5},
  "rationales": {10 metrics: text},
  "tips": [array of 1-3 tips],
  "rubric_version": "v2.0"
}</coach>
```

#### Frontend Response Processing
- **Detection:** `m._mode === "emotional-assessment"`
- **Parsing:** Extracts `<coach>` JSON block from response
- **Rendering:** 
  - Text guidance display
  - EI panel: `renderEiPanel()` (lines 370-418) showing 10-metric grid
  - Tooltips with rationales

---

### MODE 4: PRODUCT KNOWLEDGE (`product-knowledge`)

#### Frontend Flow
- **UI Dropdown:** "Product Knowledge" → `"product-knowledge"`
- **Mode Module:** `assets/chat/modes/productKnowledge.js` (same structure)
- **Widget request builder:** Standard, no EI context injection
- **Payload:** `{mode: "product-knowledge", messages, disease, persona, ...}`

#### Backend (Worker) Flow
- **Entry point:** `postChat()` (worker.js line 750+)
- **FSM definition:** Lines 194-196
  ```javascript
  "product-knowledge": {
    states: { START: { capSentences: 20, next: "PK" }, PK: { capSentences: 20, next: "PK" } },
    start: "START"
  }
  ```
- **Prompt selection:** Lines 1231-1232
  ```javascript
  } else if (mode === "product-knowledge") {
    sys = pkPrompt;
  }
  ```
- **Prompt definition:** Lines 1042-1117
  - General knowledge assistant for life sciences
  - Flexible response format (not rigid structure like sales-coach)
  - Encourages structured headers/bullets based on question
  - Can answer science, medicine, disease, drug mechanisms

#### Response Structure (Contract)
```
[Flexible: structured answer based on question type]
[Could be:]
  - Numbered list (key facts)
  - Bullet points (practical guidance)
  - Prose paragraphs (conceptual explanation)
  - Hybrid (headers + bullets + explanation)
[NO coach block]
[NO EI metrics]
```

#### Frontend Response Processing
- **Detection:** `m._mode === "product-knowledge"`
- **Rendering:** Raw text display with markdown-like formatting preserved
- **No EI panel, no coach blocks**

---

### MODE 5: GENERAL ASSISTANT (`general-knowledge`)

#### Frontend Flow
- **UI Dropdown:** "General Assistant" → `"general-knowledge"`
- **Mode Module:** (None explicitly, falls back to generic modal)
- **Widget request builder:** Standard payload, no EI context
- **Payload:** `{mode: "general-knowledge", messages, ...}`

#### Backend (Worker) Flow
- **Entry point:** `postChat()` (worker.js line 750+)
- **FSM definition:** Lines 198-200
  ```javascript
  "general-knowledge": {
    states: { START: { capSentences: 20, next: "GENERAL" }, GENERAL: { capSentences: 20, next: "GENERAL" } },
    start: "START"
  }
  ```
- **Prompt selection:** Lines 1233-1235 (fallback/else clause)
  ```javascript
  } else if (mode === "product-knowledge") {
    sys = pkPrompt;
  } else {
    sys = generalKnowledgePrompt; // default for unknown or general-knowledge
  }
  ```
- **Prompt definition:** Lines 1119-1180
  - Can answer ANY topic (not pharma-specific)
  - Helpful, knowledgeable assistant tone
  - Encourages structured, markdown-compliant formatting

#### Response Structure (Contract)
```
[Flexible: helper assistant response]
[No structured format requirement]
[NO coach block]
[NO EI metrics]
```

#### Frontend Response Processing
- **Detection:** `m._mode === "general-knowledge"`
- **Rendering:** Raw text display
- **No EI panel, no coach blocks**

---

## DATA FLOW DIAGRAM (Complete)

### Sales Coach Flow
```
UI Dropdown "Sales Coach"
  ↓
LC_TO_INTERNAL["Sales Coach"] = "sales-coach"
  ↓
widget.js: currentMode = "sales-coach"
  ↓
callModel() builds payload: {mode: "sales-coach", messages, disease, persona, ...}
  ↓
POST /chat to worker
  ↓
worker.js postChat():
  - Extract mode = "sales-coach"
  - Select salesCoachPrompt
  - Call LLM with system prompt + context
  - Parse <coach> block from response
  ↓
Response: {reply: "Challenge...\n\nRep Approach...\nImpact...\nSuggested Phrasing...", coach: {scores, rationales, tips}}
  ↓
widget.js renderMessages():
  - Detect _mode === "sales-coach"
  - Call formatSalesCoachReply()
  - Extract <coach> JSON
  - Render 4-section HTML + EI panel
  ↓
Modal displays: [Challenge] [Rep Approach bullets] [Impact] [Suggested Phrasing] + [EI metrics grid]
```

### EI / Emotional Assessment Flow
```
UI Dropdown "Emotional Intelligence"
  ↓
LC_TO_INTERNAL["Emotional Intelligence"] = "emotional-assessment"
  ↓
widget.js: currentMode = "emotional-assessment"
  ↓
callModel() detects: if (currentMode === "emotional-assessment")
  - Call EIContext.getSystemExtras()
  - Load about-ei.md + rubric + persona
  - Inject into payload: payload.eiContext = "### EI KNOWLEDGEBASE\n..."
  ↓
Build payload: {mode: "emotional-assessment", messages, eiContext, disease, persona, ...}
  ↓
POST /chat to worker
  ↓
worker.js postChat():
  - Extract mode = "emotional-assessment"
  - Extract eiContext from body
  - Select eiPrompt
  - Dynamically build: eiPrompt += eiFrameworkContent (which embeds body.eiContext)
  - Call LLM with framework-grounded system prompt
  - Parse <coach> block from response
  ↓
Response: {reply: "Reflective guidance...\n\nSocratic questions...", coach: {scores, rationales, tips}}
  ↓
widget.js renderMessages():
  - Detect _mode === "emotional-assessment"
  - Extract <coach> JSON
  - Render guidance text + EI panel with 10 metrics
  ↓
Modal displays: [Guidance] + [10-metric EI grid with rationales]
```

### Role Play Flow
```
UI Dropdown "Role Play"
  ↓
LC_TO_INTERNAL["Role Play"] = "role-play"
  ↓
currentMode = "role-play"
  ↓
callModel() builds payload: {mode: "role-play", messages, disease, persona, ...}
  ↓
POST /chat to worker
  ↓
worker.js postChat():
  - Extract mode = "role-play"
  - Select rolePlayPrompt
  - Call LLM
  - validateModeResponse() strips any coach block (if present)
  ↓
Response: {reply: "[HCP natural dialogue]", coach: undefined}
  ↓
widget.js renderMessages():
  - Detect _mode === "role-play"
  - enforceHcpOnly() validates HCP-only content
  - Render raw text (no coach panel)
  ↓
Modal displays: [HCP dialogue - no coaching overlay]
```

---

## CRITICAL OBSERVATIONS

### Issue 1: EI Context Loading - CORRECT (Post-Fix)
**Status:** ✅ FIXED (per recent commit)
- **Before:** EI mode had `eiPrompt` but no framework data; prompt said "use about-ei.md" without providing it
- **Now:** 
  - widget.js (lines 2764-2779) loads EI context only when `currentMode === "emotional-assessment"`
  - worker.js (lines 995-998) dynamically appends `body.eiContext` to eiPrompt if provided
  - Result: EI responses are now framework-grounded

### Issue 2: Mode Drift Protection - CORRECT
**Status:** ✅ IMPLEMENTED
- `validateModeResponse()` (worker.js lines 564-605) strips coaching from role-play
- Prevents role-play responses from including <coach> blocks
- Each mode gets its appropriate response structure

### Issue 3: FSM Configuration - CORRECT
**Status:** ✅ VERIFIED
- All 5 modes have distinct FSM definitions (lines 182-200)
- Each has mode-specific cap sentence limits (12-30 sentences)
- No cross-contamination

### Issue 4: Prompt Selection Logic - CORRECT
**Status:** ✅ VERIFIED
- Lines 1225-1235 clearly branch on mode
- If `mode === "role-play"`: use rolePlayPrompt
- Else if `mode === "sales-coach"`: use salesCoachPrompt
- Else if `mode === "product-knowledge"`: use pkPrompt
- Else if `mode === "emotional-assessment"`: use eiPrompt
- Else: use generalKnowledgePrompt (fallback)

### Issue 5: EI Metrics Presence - NEEDS VERIFICATION
**Status:** ⚠️ REQUIRES TEST
- **Question:** Do ALL sales-coach AND emotional-assessment responses include all 10 EI metrics?
- **Code expectation:** Both salesCoachPrompt and eiPrompt end with `<coach>{scores, rationales, tips}</coach>`
- **Potential gap:** What if LLM outputs incomplete JSON or truncates metrics?
- **Safeguard needed:** Runtime validation that coach.scores has exactly 10 keys before rendering

### Issue 6: About-EI Files - VERIFY EXISTENCE
**Status:** ⏭️ UNKNOWN (Not confirmed in codebase search)
- **Expected locations:**
  - `assets/chat/about-ei.md` — loaded by ei-context.js
  - `assets/chat/config.json` — assumed for rubric
  - `assets/chat/persona.json` — assumed for persona rails
- **Risk:** If about-ei.md missing, ei-context.js returns "EI knowledgebase not found" and EI mode degrades
- **Action:** Must verify these files exist and contain expected content

---

## CONTRACT VALIDATION REQUIREMENTS

For each mode, these checks MUST pass at runtime:

### Sales Coach Contract
- [ ] Response includes exactly 4 sections: Challenge, Rep Approach (3 bullets), Impact, Suggested Phrasing
- [ ] Each reference code matches `[XXX-###-###]` pattern
- [ ] <coach> block contains all 10 metrics with integer scores (0-5)
- [ ] No "accuracy" metric in scores object
- [ ] rationales object has same 10 keys as scores

### EI Contract
- [ ] Response includes reflective guidance (2-4 paragraphs)
- [ ] Includes 1-2 Socratic questions
- [ ] <coach> block contains all 10 metrics
- [ ] Tips array is 0-3 items
- [ ] Rationales tied to actual framework content (references CASEL, Triple-Loop, etc.)

### Role Play Contract
- [ ] Response contains ONLY HCP dialogue (no rep voice)
- [ ] NO <coach> block present
- [ ] NO EI metrics
- [ ] Conversational, realistic HCP language

### Product Knowledge Contract
- [ ] Response is accurate on-label information
- [ ] NO <coach> block
- [ ] NO EI metrics
- [ ] Can be flexible format (headers, bullets, prose)

### General Assistant Contract
- [ ] Response is helpful and accurate
- [ ] NO <coach> block
- [ ] NO EI metrics
- [ ] Can answer any topic

---

## FILES INVOLVED (SUMMARY)

**Frontend:**
- `widget.js` - Main chat interface, mode detection, response rendering (3547 lines)
- `assets/chat/modes/salesCoach.js` - Sales coach mode module
- `assets/chat/modes/emotionalIntelligence.js` - EI mode module
- `assets/chat/modes/rolePlay.js` - Role play mode module
- `assets/chat/modes/productKnowledge.js` - Product knowledge mode module
- `assets/chat/ei-context.js` - EI framework loader

**Backend:**
- `worker.js` - Cloudflare Worker, mode branching, prompt selection, response validation (1629 lines)

**Data:**
- `assets/chat/about-ei.md` - EI framework definition (NEEDS VERIFICATION)
- `assets/chat/config.json` - EI rubric (NEEDS VERIFICATION)
- `assets/chat/persona.json` - EI persona rails (NEEDS VERIFICATION)

---

**END PHASE 1 ANALYSIS**

Next: Create root cause report and test plan based on this mapping.
