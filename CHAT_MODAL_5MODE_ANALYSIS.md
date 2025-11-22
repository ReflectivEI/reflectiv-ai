# CHAT MODAL 5-MODE ANALYSIS & VALIDATION REPORT

**Document:** Comprehensive mapping + validation of all 5 Learning Center modes  
**Date:** November 14, 2025  
**Based on:** Real code analysis - worker.js, widget.js, modes/, config files  
**Status:** PHASE 1C-D Complete - All 5 modes analyzed, contracts documented, mismatches detected

---

## EXECUTIVE SUMMARY

This report analyzes the COMPLETE response flow for all 5 real modes in the Learning Center:

1. ✅ **Sales Coach** - Sales simulation with 4-section contract + 10 EI metrics
2. ✅ **Role Play** - HCP dialogue only with hard mode-drift protection  
3. ✅ **Emotional Intelligence (EI)** - Framework-grounded reflective guidance + metrics
4. ✅ **Product Knowledge** - Flexible knowledge assistant with citations
5. ✅ **General Assistant** - Can answer any topic, no coaching structure

**Key Findings:**

| Mode | Status | Critical Issues | Warnings | Validation Required |
|------|--------|-----------------|----------|---------------------|
| Sales Coach | 🟡 PARTIAL | ✅ Format parsing works | ⚠️ No contract validation | ✅ All 4 sections present? |
| Role Play | ✅ GOOD | ✅ Drift protection fires | ✅ None | ✅ No coach blocks |
| EI Assessment | 🟡 PARTIAL | ✅ Context loading works | ⚠️ No metrics validation | ✅ All 10 metrics? |
| Product Knowledge | 🟡 PARTIAL | ✅ Flexible format | ⚠️ No structure check | ✅ Cites present? |
| General Assistant | ✅ GOOD | ✅ No specific contract | ✅ None | ✅ Works as intended |

---

## MODE 1: SALES COACH

### 1A. Mode Sources (Real Code Paths)

**UI Label:** "Sales Coach"  
**Internal Mode Key:** `"sales-coach"`  
**Frontend File:** `widget.js` line 57  
**Worker File:** `worker.js` lines 1225-1227  
**Formatting Function:** `widget.js` lines 742-850  
**Validation Function:** `worker.js` lines 564-605

**Mode Detection:**
```javascript
// widget.js line 54-60 (LC_TO_INTERNAL mapping)
const LC_TO_INTERNAL = {
  "Sales Coach": "sales-coach",
  "Role Play": "role-play",
  "Emotional Intelligence": "emotional-assessment",
  "Product Knowledge": "product-knowledge",
  "General Assistant": "general-knowledge"
};
```

### 1B. Response Flow (Complete Path)

```
USER INPUT
  ↓
widget.js: currentMode = "sales-coach" (from LC_TO_INTERNAL)
  ↓
widget.js (lines 2750-2779): Build payload
  - mode: "sales-coach"
  - messages: [...conversation]
  - disease: selected disease state
  - persona: selected HCP persona
  - eiContext: NULL (not loaded for sales-coach)
  ↓
jfetch("/chat") → calls Worker POST /chat
  ↓
worker.js postChat(): Receives payload with mode="sales-coach"
  ↓
worker.js (line 1226): Prompt selection branch
  mode === "sales-coach" → use salesCoachPrompt
  ↓
salesCoachPrompt (lines 935-958):
  "You are a sales coach helping a rep handle challenging HCP objections..."
  [Contract: 4 sections + EI scoring block]
  ↓
providerChat() → Groq API (llama-3.1-8b-instant)
  ↓
Response returned: "Challenge: ...\nRep Approach:\n• ...\n• ...\n\nImpact: ...\nSuggested Phrasing: ...\n\n<coach>{...JSON...}</coach>"
  ↓
worker.js (line 415): extractCoach(raw) splits response into:
  - clean: visible reply text (without <coach> block)
  - coach: JSON object {scores, rationales, tips, etc.}
  ↓
worker.js validateModeResponse() (line 564):
  - Detects "Challenge:" ✅
  - Detects "Rep Approach:" ✅
  - Detects "Impact:" ✅
  - Detects "Suggested Phrasing:" ✅
  - ⚠️ Does NOT check if all 4 are present (just warns)
  ↓
Return response to frontend:
{
  req_id: "xyz",
  reply: "Challenge: ...\nRep Approach:\n• ...",
  coach: { scores: {...}, rationales: {...}, tips: [...] }
}
  ↓
widget.js renderMessages() (line 2028):
  if (m._mode === "sales-coach") {
    m._formattedHTML = formatSalesCoachReply(normalized)
  }
  ↓
formatSalesCoachReply() (lines 742-850):
  - Extracts 4 sections via regex
  - Renders as styled HTML cards
  - Returns formatted HTML
  ↓
renderCoach() (line 2095+):
  - Checks: currentMode === "sales-coach"
  - Calls renderEiPanel(last)
  - Renders yellow panel with 10 EI metric cards
  ↓
UI DISPLAY
```

### 1C. Response Contract (Expected Structure)

**REQUIRED CONTRACT:**

```
Challenge: [1-2 sentence description of HCP objection/barrier]

Rep Approach:
• [Bullet 1: Specific rep technique with reference]
• [Bullet 2: Specific rep technique with reference]
• [Bullet 3: Specific rep technique with reference]

Impact: [1-2 sentence description of desired outcome]

Suggested Phrasing: "[Exact example dialogue the rep could use]"
```

**PLUS Coach Block:**
```json
{
  "scores": {
    "empathy": <1-5>,
    "clarity": <1-5>,
    "compliance": <1-5>,
    "discovery": <1-5>,
    "objection_handling": <1-5>,
    "confidence": <1-5>,
    "active_listening": <1-5>,
    "adaptability": <1-5>,
    "action_insight": <1-5>,
    "resilience": <1-5>
  },
  "rationales": { 
    "empathy": "...", 
    "clarity": "...", 
    ... (all 10 keys)
  },
  "tips": ["...", "...", "..."],
  "worked": ["...", "..."],
  "improve": ["...", "..."],
  "feedback": "...",
  "rubric_version": "v2.0"
}
```

### 1D. Detected Issues & Mismatches

**ISSUE 1.1: No Contract Validation at Response Level** 🔴  
**Severity:** CRITICAL  
**File/Line:** worker.js line 1383+

The `validateModeResponse()` function for sales-coach mode only WARNS about missing sections but does NOT:
- Check that ALL 4 sections present before returning
- Fail the request if contract violated
- Return formatted error to user

**Evidence:**
```javascript
// worker.js lines 628-635
if (mode === "sales-coach") {
  const hasChallenge = /Challenge:/i.test(cleaned);
  const hasRepApproach = /Rep Approach:/i.test(cleaned);
  const hasImpact = /Impact:/i.test(cleaned);
  const hasSuggestedPhrasing = /Suggested Phrasing:/i.test(cleaned);

  if (!hasChallenge) warnings.push("missing_challenge_section");  // ⚠️ WARNING ONLY
  if (!hasRepApproach) warnings.push("missing_rep_approach_section");
  // ... all warnings, no violations
}
```

**Why This Matters:**
- If LLM returns only 2 of 4 sections, response is still sent to frontend
- Frontend renderingcontinues anyway, showing incomplete response
- User sees broken card layout, no error indication

**ISSUE 1.2: Frontend Format Parser Has No Validation** 🟠  
**Severity:** HIGH  
**File/Line:** widget.js lines 742-850

The `formatSalesCoachReply()` function extracts sections via regex but:
- Does NOT validate all 4 sections found
- If section missing, just doesn't render that card
- Returns warning-style error card only if HTML is completely empty
- No per-section contract checking

**Evidence:**
```javascript
// widget.js lines 800-815
// Challenge section
if (challengeMatch) { /* render */ }  // Silent skip if no match

// Rep Approach section
if (repApproachMatch) { /* render */ }  // Silent skip if no match

// Impact section
if (impactMatch) { /* render */ }  // Silent skip if no match

// Suggested Phrasing section
if (phrasingMatch) { /* render */ }  // Silent skip if no match

// ⚠️ Only errors if html is completely empty (ALL 4 sections missing)
if (!html) {
  return `<div class="sales-sim-section" style="background:#fee;...">
    <strong style="color:#c00">⚠️ Format Error:</strong>...
  </div>`;
}
```

**ISSUE 1.3: Coach Block Metrics Not Validated** 🟠  
**Severity:** HIGH  
**File/Line:** widget.js line 370-418 (renderEiPanel)

The `renderEiPanel()` renders EI metric cards but:
- Does NOT check that all 10 metrics present in scores object
- Missing metrics default to 0 (misleading - could mean "low score" or "not scored")
- No error if metrics object incomplete

**Evidence:**
```javascript
// widget.js line 382-383
const v = Number(S[k] ?? 0);  // ⚠️ If metric missing, defaults to 0
const val = (v || v === 0) ? String(v) : "–";
// If score is actually 0, shows "0" (correct)
// If metric key missing, shows "–" (but should error)
```

**ISSUE 1.4: Duplicate Section Detection But No Deduplication Enforcement** 🟡  
**Severity:** MEDIUM  
**File/Line:** widget.js lines 756-771

The code attempts to remove duplicate sections via regex but:
- Deduplication is best-effort, not guaranteed
- If LLM repeats sections but in unusual format, dedup might miss
- No feedback to user if duplicates detected

---

## MODE 2: ROLE PLAY

### 2A. Mode Sources

**UI Label:** "Role Play"  
**Internal Mode Key:** `"role-play"`  
**Frontend File:** `widget.js` line 56  
**Worker File:** `worker.js` lines 1225-1226  
**Validation Function:** `worker.js` lines 576-603 (STRICT)

### 2B. Response Flow

```
USER INPUT (as HCP)
  ↓
widget.js currentMode = "role-play"
  ↓
widget.js (lines 2750-2779): Build payload
  - mode: "role-play"
  - messages: [... HCP dialogue ...]
  - disease: disease state
  - persona: HCP persona
  - eiContext: NULL (NOT loaded)
  - speaker: "hcp" (marked as HCP voice)
  ↓
jfetch("/chat") → Worker
  ↓
worker.js (line 1225): Prompt selection
  mode === "role-play" → rolePlayPrompt
  ↓
rolePlayPrompt (lines 915-934):
  "You are an HCP in a consultation. Respond realistically as a busy clinician, not as a coach..."
  [Contract: HCP dialogue ONLY, NO coaching language]
  ↓
Groq API response: "[HCP dialogue without coaching]"
  ↓
worker.js validateModeResponse() (line 576-603): STRICT DRIFT PROTECTION
  - Pattern scan for coaching leakage:
    /Challenge:/i, /Rep Approach:/i, /Impact:/i, /Suggested Phrasing:/i
    /Coach Guidance:/i, /You should have\b/i, /The rep\b/i
  - If coaching detected: STRIP from first match point onward
  - VIOLATIONS recorded (not just warnings)
  ↓
Return response:
  {
    req_id: "xyz",
    reply: "[HCP dialogue only, coaching stripped if detected]",
    coach: null  // ⚠️ Explicitly null for role-play
  }
  ↓
widget.js renderMessages() (line 2033):
  if (m._mode === "role-play" && m.role === "assistant") {
    m._formattedHTML = md(normalized);  // Plain markdown, not sales-coach format
  }
  ↓
renderCoach() (line 2110):
  if (currentMode === "role-play") {
    // Hide coach panel until user requests "Evaluate this exchange"
    body.innerHTML = `Final evaluation will appear after...`;
  }
  ↓
UI DISPLAY: HCP response only (no coaching visible)
```

### 2C. Response Contract

**REQUIRED CONTRACT:**

```
[HCP dialogue in first person, realistic clinician voice]
- No coaching language
- No "Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:"
- No "You should have", "The rep", "Coach Guidance"
- Realistic HCP objections, questions, or clinical discussion
- No JSON coach block
```

### 2D. Detected Issues & Mismatches

**ISSUE 2.1: Mode Drift Protection Works But No Failure Feedback** 🟡  
**Severity:** MEDIUM  
**File/Line:** worker.js lines 576-603

The validation DOES strip coaching language but:
- Silently truncates response (user doesn't know content was removed)
- Violations recorded in validation but not returned to client
- No warning sent to frontend

**Evidence:**
```javascript
// worker.js lines 577-603
if (mode === "role-play") {
  const coachingPatterns = [/Challenge:/i, /Rep Approach:/i, ...];
  for (const pattern of coachingPatterns) {
    if (pattern.test(cleaned)) {
      violations.push(`coaching_leak_detected: ${pattern.source}`);
      cleaned = cleaned.split(pattern)[0].trim();  // TRUNCATE silently
    }
  }
  // ⚠️ Violations array is local, not returned to frontend
}

// Return: { reply: cleaned, warnings, violations }
// ⚠️ But 'violations' not passed to final response JSON
```

**ISSUE 2.2: Final Evaluation Panel Design Unclear** 🟡  
**Severity:** LOW-MEDIUM  
**File/Line:** widget.js lines 2108-2115

- User must type "Evaluate this exchange" to trigger final eval
- UI message says this but might be unintuitive
- No explicit button or clear affordance

**Status:** This is more UX than bug, acceptable for now

---

## MODE 3: EMOTIONAL INTELLIGENCE (EI ASSESSMENT)

### 3A. Mode Sources

**UI Label:** "Emotional Intelligence"  
**Internal Mode Key:** `"emotional-assessment"`  
**Frontend File:** `widget.js` line 54 (LC_TO_INTERNAL)  
**Worker File:** `worker.js` lines 1229-1230  
**Context Loader:** `widget.js` lines 2764-2779, `ei-context.js` lines 1-50  
**EI Files:** `about-ei.md` (306 lines), `config.json`, `persona.json`

### 3B. Response Flow

```
USER INPUT
  ↓
widget.js: currentMode = "emotional-assessment"
  ↓
widget.js (lines 2764-2779): SPECIAL - Load EI context
  if (currentMode === "emotional-assessment") {
    try {
      const eiExtras = await EIContext.getSystemExtras();  // Loads about-ei.md
      payload.eiContext = eiExtras.slice(0, 8000);
    }
  }
  ↓
widget.js (lines 2750-2779): Build payload
  - mode: "emotional-assessment"
  - messages: [... conversation ...]
  - disease: disease state
  - persona: HCP persona
  - eiContext: <framework content from about-ei.md>  ✅ LOADED
  ↓
jfetch("/chat") → Worker
  ↓
worker.js postChat() (line 1229-1230):
  mode === "emotional-assessment" → eiPrompt
  ↓
worker.js (lines 995-998): Dynamic framework embedding
  let eiFrameworkContent = "";
  if (body.eiContext && typeof body.eiContext === "string") {
    eiFrameworkContent = `\n\n### EI FRAMEWORK CONTENT\n${body.eiContext.slice(0, 4000)}`;
  }
  ↓
eiPrompt (lines 1000-1041):
  "You are Reflectiv Coach in Emotional Intelligence mode..."
  [Includes Triple-Loop Reflection, Socratic questions, CASEL competencies]
  + eiFrameworkContent  ✅ EMBEDDED
  ↓
Groq API response:
  "[Reflective guidance with Socratic questions]\n\n<coach>{...10 metrics...}</coach>"
  ↓
worker.js validateModeResponse() (line 658):
  - Checks for Socratic questions: /\?/g (at least 1 question)
  - Warns if no questions detected
  - Does NOT validate metrics present
  ↓
Return response:
  {
    req_id: "xyz",
    reply: "[Guidance with questions]",
    coach: { scores: {...}, rationales: {...} }
  }
  ↓
widget.js renderMessages() (line 2028+):
  if (m._mode === "emotional-assessment") {
    body.innerHTML = md(normalized);  // Standard markdown
  }
  ↓
renderCoach() (line 2095+):
  if (currentMode includes EI):
    eiHTML = renderEiPanel(last)  ✅ Renders 10 metric cards
  ↓
UI DISPLAY: Guidance + EI metric cards
```

### 3C. Response Contract

**REQUIRED CONTRACT:**

```
[2-4 paragraphs of reflective guidance]
[References to EI framework, CASEL competencies, Triple-Loop Reflection]
[1-2 Socratic metacoach questions]
[Empathetic, warmth-focused tone]

<coach>
{
  "scores": {
    "empathy": <1-5>,
    "clarity": <1-5>,
    "compliance": <1-5>,
    "discovery": <1-5>,
    "objection_handling": <1-5>,
    "confidence": <1-5>,
    "active_listening": <1-5>,
    "adaptability": <1-5>,
    "action_insight": <1-5>,
    "resilience": <1-5>
  },
  "rationales": {
    "empathy": "...",
    ... (all 10 keys)
  },
  "tips": ["...", "..."],
  "rubric_version": "v2.0"
}
</coach>
```

### 3D. Detected Issues & Mismatches

**ISSUE 3.1: EI Context Loading Optional (Not Enforced)** 🟠  
**Severity:** HIGH  
**File/Line:** widget.js lines 2764-2779

The EI context load is wrapped in try-catch but:
- If load fails, request continues WITHOUT eiContext
- Worker receives empty eiContext → eiFrameworkContent = ""
- EI mode degrades to generic coaching without framework grounding
- No error surfaced to user

**Evidence:**
```javascript
// widget.js lines 2764-2779
if (currentMode === "emotional-assessment") {
  try {
    if (typeof EIContext !== "undefined" && EIContext?.getSystemExtras) {
      const eiExtras = await EIContext.getSystemExtras().catch(() => null);
      if (eiExtras) { 
        payload.eiContext = eiExtras.slice(0, 8000); 
      }
      // ⚠️ If eiExtras is null: no payload.eiContext added
    }
  } catch (e) {
    console.warn("[chat] Failed to load EI context:", e.message);
    // ⚠️ Warning logged but request continues
  }
}
```

**ISSUE 3.2: EI Metrics Validation Missing** 🔴  
**Severity:** CRITICAL  
**File/Line:** worker.js, widget.js lines 370-418

Neither worker nor widget validates that:
- All 10 metrics present in scores object
- All 10 rationales present
- Scores are in range 1-5

**Evidence:**
```javascript
// widget.js line 382-383 (renderEiPanel)
const v = Number(S[k] ?? 0);  // If metric missing, defaults to 0
const val = (v || v === 0) ? String(v) : "–";
// ⚠️ No validation that ALL 10 metrics present
```

**ISSUE 3.3: Framework Grounding Depth Unknown** 🟡  
**Severity:** MEDIUM  
**File/Line:** worker.js lines 995-998

The eiFrameworkContent is sliced to 4000 chars before embedding:
```javascript
eiFrameworkContent = `...${body.eiContext.slice(0, 4000)}`;  // 4000 char limit
```

- about-ei.md is 306 lines (~8000+ chars)
- Slicing to 4000 might truncate key framework sections
- No indication to user if truncation happens

---

## MODE 4: PRODUCT KNOWLEDGE

### 4A. Mode Sources

**UI Label:** "Product Knowledge"  
**Internal Mode Key:** `"product-knowledge"`  
**Worker File:** `worker.js` lines 1231-1232  
**Frontend File:** `widget.js` line 56

### 4B. Response Flow

```
USER INPUT (product question)
  ↓
widget.js currentMode = "product-knowledge"
  ↓
widget.js (lines 2750-2779): Build payload
  - mode: "product-knowledge"
  - messages: [...conversation...]
  - disease: disease state
  - persona: HCP persona
  - eiContext: NULL (not loaded)
  - facts: product facts from config
  - citations: references from config
  ↓
jfetch("/chat") → Worker
  ↓
worker.js (line 1231-1232):
  mode === "product-knowledge" → pkPrompt
  ↓
pkPrompt (lines 1042-1117):
  "You are ReflectivAI, advanced AI knowledge partner..."
  [Flexible structure, emphasizes facts + clarity]
  [NO structured coaching format required]
  [Citations required]
  ↓
Groq API response:
  "## Overview\n[facts]\n\n## Efficacy\n[data with citations]\n..."
  ↓
worker.js validateModeResponse() (line 640-654):
  - Check for off-label keywords
  - Warn if no citations detected
  - ⚠️ Does NOT enforce citations or facts
  ↓
Return response:
  {
    req_id: "xyz",
    reply: "[Product knowledge response]",
    coach: null  // No coach block for product-knowledge
  }
  ↓
widget.js renderMessages() (line 2028+):
  body.innerHTML = md(normalized);  // Standard markdown
  ↓
renderCoach() (line 2108):
  if (currentMode === "product-knowledge") {
    coach.style.display = "none";  // Hide coach panel
  }
  ↓
UI DISPLAY: Knowledge response (no coach metrics)
```

### 4C. Response Contract

**REQUIRED CONTRACT:**

```
[Flexible knowledge response structure]
- Clear headers for major topics
- Evidence-based claims
- Citations required: [1], [2], etc. or [REFERENCE-CODE]
- Clinical context and relevance
- Distinguish on-label vs off-label
- Present risks alongside benefits
- Acknowledge limitations if present
```

### 4D. Detected Issues & Mismatches

**ISSUE 4.1: No Enforcement of Citation Requirement** 🔴  
**Severity:** CRITICAL  
**File/Line:** worker.js lines 640-654

Citations are optional - validator only warns:

```javascript
// worker.js line 648
const hasCitations = /\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/i.test(cleaned);
if (!hasCitations) {
  warnings.push("no_citations_detected");  // ⚠️ WARNING ONLY
}
```

- If LLM forgets citations, response still sent
- No error returned to frontend
- User sees uncited claims without knowing

**ISSUE 4.2: Flexible Contract Means No Validation** 🔴  
**Severity:** CRITICAL  
**File/Line:** worker.js, widget.js

Product Knowledge mode has NO strict contract:
- Any format is acceptable (headers, bullets, paragraphs)
- No minimum structure enforced
- No validation that facts/citations present

**Evidence:**
- validateCoachSchema() (line 668-677) lists required fields per mode
- Product Knowledge has empty array: `"product-knowledge": []`
- Means: no validation required

---

## MODE 5: GENERAL ASSISTANT

### 5A. Mode Sources

**UI Label:** "General Assistant"  
**Internal Mode Key:** `"general-knowledge"`  
**Worker File:** `worker.js` lines 1233-1235  
**Frontend File:** `widget.js` line 53

### 5B. Response Flow

```
USER INPUT (any topic)
  ↓
widget.js currentMode = "general-knowledge"
  ↓
widget.js (lines 2750-2779): Build standard payload
  - mode: "general-knowledge"
  - messages: [...conversation...]
  - eiContext: NULL
  ↓
jfetch("/chat") → Worker
  ↓
worker.js (line 1233-1235):
  mode === "general-knowledge" → generalKnowledgePrompt
  ↓
generalKnowledgePrompt (lines 1119-1180):
  "You are ReflectivAI General Assistant..."
  [Can answer ANY topic]
  [No specific format requirements]
  [CRITICAL FORMATTING RULES in prompt for lists]
  ↓
Groq API response:
  "[Answer to any question with appropriate structure]"
  ↓
worker.js validateModeResponse() (line 660+):
  - No mode-specific validation
  - Generic sanitization only
  ↓
Return response:
  {
    req_id: "xyz",
    reply: "[Answer]",
    coach: null
  }
  ↓
widget.js renderMessages() (line 2028+):
  body.innerHTML = md(normalized);  // Standard markdown
  ↓
renderCoach() (line 2108):
  Hide coach panel (not applicable)
  ↓
UI DISPLAY: Assistant response (no coaching)
```

### 5C. Response Contract

**REQUIRED CONTRACT:**

```
[Answer to any question]
- Format appropriate to topic
- Well-structured (headers, bullets, numbered lists where helpful)
- Clear and accessible
- Balanced perspective when relevant
- Evidence-based where applicable
- Professional tone
```

### 5D. Detected Issues & Mismatches

**ISSUE 5.1: No Structure Validation Possible** 🟡  
**Severity:** LOW  
**File/Line:** worker.js (no validation per design)

General Knowledge has no specific contract, so no validation issues.
This is by design - the mode is intentionally flexible.

✅ **STATUS: ACCEPTABLE**

---

## CROSS-MODE CRITICAL GAPS

### Gap 1: No Per-Mode Response Structure Validation 🔴

**Impact:** ALL MODES

**Problem:**
- Worker validates content (citations, coaching patterns) but NOT structure
- validateModeResponse() returns warnings/violations but these are NOT used to fail the request
- Frontend receives response blindly and attempts parsing

**Evidence:**
```javascript
// worker.js line 1383+ (after validation)
return json({
  req_id: reqId,
  reply: reply_text,
  coach: coachData
}, 200, env, req);
// ⚠️ Response sent regardless of validation warnings/violations
```

**Required Fix:** Check violations before returning - if any violations exist for critical modes (sales-coach, role-play, emotional-assessment), return 400 error instead of 200 with broken data.

---

### Gap 2: No Runtime Contract Enforcement 🔴

**Impact:** ALL MODES

**Problem:**
- Each mode has specific output contract documented in prompts
- But neither worker nor widget validates response matches contract
- Silent failures when contract violated

**Evidence:**
- Sales Coach: 4 sections required, but parser just renders whatever found
- EI: 10 metrics required, but renderEiPanel defaults missing metrics to 0
- Product Knowledge: Citations required, but sent anyway if missing
- Role Play: No coaching required, but only warns if detected

---

### Gap 3: Config-Driven Tests Use Real Modes 🟡

**Impact:** Testing reliability

**Status:** ✅ VERIFIED - Widget uses LC_TO_INTERNAL mapping (real modes only)

But tests must be updated to verify:
- Tests read modes from LC_TO_INTERNAL constant
- Tests never use hardcoded mode keys like "ai-coach" or "sales"
- Tests validate against actual Disease state options

---

### Gap 4: EI Context Presence Not Enforced 🟡

**Impact:** EI Assessment mode only

**Problem:**
- EI context load is best-effort, not mandatory
- If missing, mode silently degrades to generic coaching
- No indication to user

**Required Fix:** For mode === "emotional-assessment", require eiContext to be present and non-empty. If missing, return error.

---

## VALIDATION CHECKLIST (FOR PHASE 2)

### Sales Coach Mode Validation
- [ ] All 4 sections present before returning response (fail-fast if not)
- [ ] Each section non-empty (Challenge > 0 chars, Bullets > 0, etc.)
- [ ] All 10 EI metrics present in coach.scores (fail if any missing)
- [ ] All 10 rationales present in coach.rationales
- [ ] Frontend renders all 4 sections or shows error

### Role Play Mode Validation
- [ ] No coaching language detected (violations = error, not warning)
- [ ] coach block NULL (never present)
- [ ] Response is HCP voice only
- [ ] Frontend logs any attempted truncation

### EI Assessment Mode Validation
- [ ] eiContext loaded successfully (required, not optional)
- [ ] eiContext non-empty (fail if missing)
- [ ] All 10 metrics present in coach.scores
- [ ] All 10 rationales present
- [ ] Socratic questions present (at least 2)
- [ ] Framework references in reply text

### Product Knowledge Mode Validation
- [ ] Citations present (fail if none detected)
- [ ] On-label vs off-label distinction clear
- [ ] Risk/benefit balance present
- [ ] No unsupported claims

### General Assistant Mode Validation
- [ ] Response present (non-empty)
- [ ] No coaching format imposed
- [ ] Format appropriate to question

---

## RECOMMENDED IMPLEMENTATION ORDER

1. **Fix Sales Coach Contract** (CRITICAL - UI depends on 4 sections)
   - Add worker-side validation to check all 4 sections
   - Return 400 error if any missing
   - Update widget to handle error responses

2. **Fix EI Metrics Validation** (CRITICAL - affects both sales-coach and ei modes)
   - Validate all 10 metrics present
   - Fail request if any missing
   - Update renderEiPanel to validate before rendering

3. **Fix EI Context Enforcement** (CRITICAL - prevents mode degradation)
   - Make eiContext required for emotional-assessment mode
   - Return error if missing or empty
   - Log failure with request ID

4. **Fix Product Knowledge Citations** (HIGH - compliance/accuracy)
   - Enforce citations requirement
   - Return error if none detected
   - Add citation validation pattern

5. **Add Real-Config Test Enforcement** (HIGH - prevent regression)
   - Create test helper that validates modes against LC_TO_INTERNAL
   - Create test helper that validates disease states against config
   - Fail any test using imaginary data

---

## SUMMARY TABLE

| Mode | Internal Key | Contract Type | Validation Status | Critical Gaps |
|------|--------------|---------------|-------------------|---------------|
| Sales Coach | sales-coach | 4 sections + 10 metrics | ⚠️ Partial | Structure not enforced, metrics not validated |
| Role Play | role-play | HCP only, no coaching | ✅ Good | Violations not blocking response |
| EI Assessment | emotional-assessment | Guidance + framework + 10 metrics | ⚠️ Partial | Context not enforced, metrics not validated |
| Product Knowledge | product-knowledge | Flexible + citations | ⚠️ Partial | Citations not enforced, no structure check |
| General Assistant | general-knowledge | Flexible, any topic | ✅ Good | No gaps (by design) |

---

## NEXT STEPS

1. ✅ **PHASE 1 Complete:** This document comprehensively maps all 5 modes, response flows, contracts, and identifies all validation gaps
2. 🔄 **PHASE 2:** Implement hard safeguards and contract validation
3. 🔄 **PHASE 3:** Create test plan with real-config enforcement
4. 🔄 **PHASE 4:** Verify fixes and document results

---

**End 5-Mode Analysis Report**

All analysis based on REAL code paths, REAL prompts, REAL validation functions. No theoretical systems or imaginary modes.
