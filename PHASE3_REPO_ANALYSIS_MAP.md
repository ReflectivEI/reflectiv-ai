# PHASE 3 REPOSITORY ANALYSIS MAP
**Date:** November 14, 2025  
**Status:** COMPREHENSIVE SYSTEM AUDIT COMPLETE

---

## EXECUTIVE SUMMARY

This document maps the complete ReflectivAI codebase focusing on enforcement points, format contracts, validation logic, and structural hazards that PHASE 3 will address through edge-case testing, validator expansion, and CI/CD hardening.

**Key Finding:** System is PHASE 2-hardened with single enforcement point at validateResponseContract(). PHASE 3 must test edge cases, expand validators to detect subtle violations, and add CI/CD guardrails.

---

## 1. CRITICAL ENFORCEMENT POINTS

### 1.1 Mode Routing & Selection

**Frontend (widget.js):**
- **Line 2888:** Mode whitelist validation before API call
  - Whitelist: `["emotional-assessment", "product-knowledge", "sales-coach", "role-play", "general-knowledge"]`
  - Enforces only valid modes reach Worker
  - **Hazard:** No fuzzy matching; hard rejection if mode invalid

- **Line 2392-2410:** Mode visibility manager (applyModeVisibility)
  - Switches UI context based on mode
  - Clears conversation state on mode switch
  - **Hazard:** If cleared improperly, cross-mode contamination possible

- **Line 54-60:** LC_TO_INTERNAL mapping
  - Maps UI labels ("Sales Coach") → internal keys ("sales-coach")
  - Single source of truth for mode names
  - **Hazard:** String case sensitivity; typos propagate

**Backend (worker.js):**
- **Line 1441-1451:** Mode-based system prompt selection
  - Branches to rolePlayPrompt, salesCoachPrompt, eiPrompt, pkPrompt, generalKnowledgePrompt
  - Each prompt has hard-coded format requirements
  - **Hazard:** Prompt injection possible if LLM ignores format instructions under extreme input

- **Line 1454-1459:** Mode-specific token allocation
  - sales-coach: 1600 max tokens
  - role-play: 1200 max tokens
  - emotional-assessment: 1400 max tokens
  - product-knowledge: 1500 max tokens
  - general-knowledge: 1200 max tokens
  - **Hazard:** Strict cutoff may truncate mid-sentence

---

### 1.2 validateResponseContract() - SINGLE GATEKEEPER

**Location:** worker.js lines 702-885

**Function Purpose:** ONLY place where responses are validated before returning to client

**Coverage by Mode:**

| Mode | Validation Rules | Status |
|------|------------------|--------|
| **sales-coach** | ALL 4 sections present; 3+ bullets; 10 EI metrics 1-5; coach block required | ✅ Implemented |
| **role-play** | NO coach blocks; NO coaching headers; HCP voice only | ✅ Implemented |
| **emotional-assessment** | 1+ Socratic questions; framework keywords present; 2-4 paragraphs | ✅ Implemented |
| **product-knowledge** | Citations present; off-label contextualized; NO coaching structure | ✅ Implemented |
| **general-knowledge** | Non-empty; NO coaching structure; NO coach blocks | ✅ Implemented |

**Repair Logic:**
- **Location:** worker.js lines 1761-1805
- **Trigger:** Contract validation fails with MISSING or INSUFFICIENT errors
- **Action:** ONE re-prompt with explicit format instruction
- **Scope:** sales-coach mode only (most structured)
- **Fallback:** Return safe error (HTTP 400) for critical modes if repair fails

**Hazards Detected:**
1. ❌ Paragraph collapse not detected
2. ❌ Double-spacing not checked
3. ❌ Truncated sections not caught
4. ❌ Duplicate metrics not rejected
5. ❌ Malformed citations not caught (PK mode)
6. ❌ "In my clinic..." leakage from RP → GK not caught

---

### 1.3 Response Rendering (Frontend Validation Before Display)

**Location:** widget.js lines 2136-2290

**Per-Mode Validators:**
- `validateSalesCoachResponse()` (line 1022-1070)
- `validateRolePlayResponse()` (line 1072-1090)
- `validateEIResponse()` (line 1092-1120)
- `validateProductKnowledgeResponse()` (line 1122-1150)
- `validateGeneralKnowledgeResponse()` (line 1152-1175)

**Function:** Catch violations BEFORE rendering; show error card if invalid

**Hazards:**
- ❌ Frontend validators may not match backend validateResponseContract() logic (drift)
- ❌ Error cards shown to user but no auto-retry
- ❌ Cached HTML may prevent re-validation on mode switch

---

### 1.4 Prompt Construction & Injection Points

**Worker Prompts (worker.js):**

| Mode | Prompt Lines | Injection Risk |
|------|--------------|-----------------|
| **sales-coach** | 1078-1165 | User `user` field at lines 1170+ interpolates into messages array |
| **role-play** | 1166-1200 | disease, persona, goal interpolated into prompt |
| **emotional-assessment** | 1201-1250 | eiContext may be injected if provided |
| **product-knowledge** | 1251-1330 | disease, persona, facts interpolated |
| **general-knowledge** | 1331-1425 | user field only; least risky |

**Injection Vectors:**
1. User message containing `<coach>` XML tags → could fake coach block
2. Persona field containing format headers → could inject structure
3. Disease name containing newlines → could break prompt instructions

**Current Protection:**
- sanitizeLLM() function strips dangerous patterns (lines 558-561)
- Limited to basic regex cleanup

---

## 2. FORMAT CONTRACT SPECIFICATIONS

### 2.1 Sales Coach Contract

**REQUIRED Structure:**
```
Challenge: [1-2 sentences, 15-25 words]

Rep Approach:
• [Bullet 1: 20-35 words, must include [FACT-ID] reference]
• [Bullet 2: 20-35 words, must include [FACT-ID] reference]
• [Bullet 3: 20-35 words, must include [FACT-ID] reference]

Impact: [1-2 sentences, 20-35 words]

Suggested Phrasing: "[25-40 words, professional tone]"

<coach>{
  "scores": {all 10 metrics: 1-5},
  "rationales": {all 10 metrics: text},
  "tips": [array],
  "worked": [array],
  "improve": [array],
  "feedback": "text",
  "rubric_version": "v2.0"
}</coach>
```

**Current Validation Rules (validateResponseContract):**
- ✅ All 4 sections present (regex test)
- ✅ 3+ bullets in Rep Approach
- ✅ Coach block exists and has 10 metrics
- ✅ All metrics numeric 1-5 range
- ❌ NOT validated: paragraph collapse, double-spacing, truncation mid-section
- ❌ NOT validated: duplicate metrics/sections
- ❌ NOT validated: bullets < 20 words

**Edge Cases:**
1. Section headers present but empty (e.g., "Challenge:\n\nRep Approach:")
2. Only 2 bullets when 3 required
3. Metrics outside 1-5 range (0, 6, null, "good", etc.)
4. Malformed coach block (unclosed JSON, extra braces)
5. Challenge + Rep Approach present but Impact missing
6. Multiple <coach> blocks in single response

---

### 2.2 Role Play Contract

**REQUIRED Structure:**
```
[Natural HCP first-person dialogue - 1-4 sentences or brief bullets]
[No headers, no coaching language, no meta-commentary]
[Clinical tone reflecting HCP persona]
```

**Current Validation Rules:**
- ✅ NO "Challenge:", "Rep Approach:", "Impact:", "Suggested Phrasing:" headers
- ✅ NO "<coach>" blocks
- ✅ NO coaching language ("You should have...", "Grade:", "Score:")
- ❌ NOT validated: HCP voice consistency throughout response
- ❌ NOT validated: First-person requirement (could be "The clinic...")
- ❌ NOT validated: Ultra-long monologue (>300 words)

**Edge Cases:**
1. Response is "Challenge: None" (has header keyword)
2. Subtle second-person: "What would you do?"
3. Mixed first/third person in same response
4. Coaching language in disguise: "Consider this approach..."
5. Multiple HCP statements (persona switch mid-response)
6. Coaching block hidden in footnote

---

### 2.3 Emotional Assessment Contract

**REQUIRED Structure:**
```
[2-4 paragraphs of reflective guidance]
[1-2 Socratic questions included]
[Framework concepts referenced: CASEL, Triple-Loop, metacognition, etc.]
[End with reflective question]
```

**Current Validation Rules:**
- ✅ 1+ Socratic questions (? count)
- ✅ Framework keywords present
- ✅ 2-4 paragraphs (split by \n\n)
- ❌ NOT validated: Quality of Socratic questions (could be "What?" only)
- ❌ NOT validated: Reflective ending question specifically
- ❌ NOT validated: Framework depth (keyword could appear once in title)

**Edge Cases:**
1. One question mark: "What?" - technically valid but low quality
2. Framework keyword appears in attribution only: "As discussed in CASEL..."
3. Response is 5 paragraphs (exceeds 4)
4. No final reflective question (ends with period)
5. Questions appear only in bullets (no natural integration)
6. Framework reference incomplete: "CSL" instead of "CASEL"

---

### 2.4 Product Knowledge Contract

**REQUIRED Structure:**
```
[Comprehensive answer with multiple sections/paragraphs]
[Citations present: [1], [2], [3] or [REF-CODE-123] format]
[If off-label mentioned, must contextualize with "explicitly stated", "not indicated", etc.]
[NO coaching structure]
[NO coach blocks]
```

**Current Validation Rules:**
- ✅ Citations present (regex test for [1], [REF-*] patterns)
- ✅ Off-label contextualized if mentioned
- ✅ NO coaching structure headers
- ❌ NOT validated: Citation count (could be just one [1])
- ❌ NOT validated: Citation format correctness (could be "[REF-]" empty)
- ❌ NOT validated: Response length (could be single sentence with one citation)

**Edge Cases:**
1. Citation exists but dangling: text ends with "[1]" but no reference section
2. Malformed citation: "[1a]", "[REF-]", "[HIV]"
3. Off-label word present but isolated: "off-label" in code snippet
4. Single citation when multiple facts claimed
5. Citation numbers non-sequential: [1], [3], [2]
6. Coach block hidden in collapsed section

---

### 2.5 General Knowledge Contract

**REQUIRED Structure:**
```
[Flexible natural answer]
[Multiple paragraphs if complex]
[Can include bullets, numbered lists]
[NO coaching structure]
[NO coach blocks]
[NOT empty]
```

**Current Validation Rules:**
- ✅ Non-empty reply
- ✅ NO coaching structure headers
- ✅ NO coach blocks
- ❌ NOT validated: Paragraph collapse (could be wall-of-text)
- ❌ NOT validated: Reasonable length bounds (could be 50 words or 5000)
- ❌ NOT validated: "In my clinic..." leakage from RP

**Edge Cases:**
1. Single character: "?"
2. 5000 words in single paragraph (no breaks)
3. Accidental RP leakage: "In my clinic, we..."
4. Coaching structure creep: starts with "Challenge: ..." (should be GK format)
5. Mostly whitespace/newlines
6. Copy-pasted JSON or code block

---

## 3. IDENTIFIED STRUCTURAL HAZARDS

### 3.1 Paragraph Collapse Vulnerability

**Hazard:** LLM outputs sections without blank lines between them

**Example:**
```
Challenge: Missing patient follow-up documentation
Rep Approach:
• Use EHR templates for consistent capture
• Train staff on documentation standards
• Monitor compliance metrics weekly
Impact: Improved chart quality and audit readiness
```

**Problem:** Regex `\n\n+` split fails if LLM uses single `\n` between sections

**Impact:** Validators that split by `\n\n` will fail to detect section boundaries

**Current Status:** NOT DETECTED by validateResponseContract()

**PHASE 3 Fix:** Add multi-level splitting logic

---

### 3.2 Missing Bullets Vulnerability

**Hazard:** Rep Approach section present but bullets missing or incomplete

**Example:**
```
Rep Approach:
Two key approaches: First, use EHR templates for consistent capture. Second, train staff on documentation standards.
```

**Problem:** Looks like valid section but contains NO bullet points; regex `•` count = 0

**Current Detection:** ✅ Detected (requires 3+ `•` marks)

**PHASE 3 Test:** Verify detection in all edge cases

---

### 3.3 Role Play Contamination Vulnerability

**Hazard:** Role Play mode returns coaching language or headers

**Examples:**
- "Challenge: Following up with busy PCPs requires..."
- "You should ask about patient adherence."
- "Rep Approach: Focus on clinical data."

**Current Detection:** ✅ Detected by regex for headers and second-person language

**PHASE 3 Test:** Test subtle variants

---

### 3.4 Product Knowledge Citation Gaps

**Hazard:** Claims made without citations

**Example:**
```
HIV PrEP is most effective when combined with behavioral interventions. [1]
Common side effects include nausea and headaches.
```

Second sentence has NO citation.

**Current Detection:** Partial - detects if NO citations at all, but not per-claim

**PHASE 3 Fix:** Add per-sentence citation validation

---

### 3.5 EI Socratic Question Gaps

**Hazard:** Response includes question mark but NOT reflective questions

**Example:**
```
Let's explore your approach. Here are some observations...

Questions to consider:
1. How does this connect to your values?
```

Only one actual Socratic question; rest is narrative.

**Current Detection:** Counts `?` marks; could be false positive (questions in quoted text)

**PHASE 3 Fix:** Better Socratic question detection (not just counting `?`)

---

### 3.6 General Knowledge Structural Leakage

**Hazard:** GK mode returns Sales Coach or Role Play structure

**Examples:**
- "Challenge: [text]" headers
- "In my clinic, we typically..." (RP voice)
- "<coach>" blocks

**Current Detection:** ✅ Detected for coach blocks and Challenge headers

**PHASE 3 Test:** Test subtle leakage (Rep Approach in middle of narrative)

---

### 3.7 Double-Spacing Collapse

**Hazard:** Multiple `\n\n` sequences get normalized by LLM or rendering layer

**Example:**
```
Challenge: Missing documentation

Rep Approach:

• Point 1
```

Becomes:
```
Challenge: Missing documentation
Rep Approach:
• Point 1
```

**Current Detection:** ❌ NOT detected

**PHASE 3 Fix:** Preserve and validate spacing requirements

---

### 3.8 Truncation Mid-Section

**Hazard:** Response cut off due to token limit; section incomplete

**Example:**
```
Challenge: Improving adherence documentation

Rep Approach:
• Use EHR templates to capture baseline adherence data

Imp[CUT OFF]
```

**Current Detection:** Partial - detects missing sections, but not that section is truncated

**PHASE 3 Fix:** Detect mid-word cutoff patterns

---

## 4. DATA FLOW & VALIDATION GATES

### 4.1 Request Flow

```
User Input (widget.js)
    ↓
[GATE 1] Mode whitelist check (line 2888)
    ↓
[GATE 2] Payload validation (disease, persona, goal per mode)
    ↓
HTTP POST /chat → Worker
    ↓
[GATE 3] Worker receives request
    ├─ Validate mode in VALID_MODES array
    ├─ Validate disease in VALID_DISEASES
    ├─ Extract and sanitize user message
    ↓
[GATE 4] Build system prompt (mode-based branching)
    ├─ Sales-Coach: salesCoachPrompt + salesContract
    ├─ Role-Play: rolePlayPrompt with HCP voice rules
    ├─ EI: eiPrompt with framework content
    ├─ PK: pkPrompt with citation requirements
    ├─ GK: generalKnowledgePrompt (flexible)
    ↓
[GATE 5] Call LLM (Groq) with retries
    ↓
[GATE 6] Post-process response
    ├─ Extract coach block
    ├─ Clean text
    ├─ Normalize headers
    ├─ Repair broken structures (sales-coach only)
    ↓
[GATE 7] ✅ CRITICAL: validateResponseContract() gatekeeper
    ├─ Check format contract per mode
    ├─ Return { valid: bool, errors: [...], warnings: [...] }
    ↓
    ├─ If invalid + repairable + sales-coach:
    │   └─ ONE repair re-prompt attempt
    │       └─ Re-validate
    │
    └─ If still invalid:
        ├─ Critical modes: Return HTTP 400 error
        └─ Flexible modes: Log warnings, allow response
    ↓
Return { reply, coach, _validation } to frontend
    ↓
Widget receives response
    ├─ Check HTTP status
    ├─ If 400: Show error card
    ├─ If 200: Proceed to rendering
    ↓
[GATE 8] Frontend validators check again
    ├─ validateSalesCoachResponse()
    ├─ validateRolePlayResponse()
    ├─ validateEIResponse()
    ├─ validateProductKnowledgeResponse()
    ├─ validateGeneralKnowledgeResponse()
    ↓
    ├─ If invalid: Show error card, no render
    ├─ If valid: Render with mode-specific formatting
    ↓
Display in modal
```

---

## 5. EDGE-CASE TEST MATRIX

### 5.1 Input Edge Cases (10 tests)

1. **Empty string** - User sends ""
2. **Spaces-only** - User sends "     "
3. **Very long message** - 5000+ character input
4. **Gibberish** - "asdfghjkl;qwerty"
5. **Non-English** - Mandarin, Arabic, etc.
6. **Emoji-only** - "😀😀😀"
7. **HTML/script injection** - "<script>alert('xss')</script>"
8. **Multi-line malformed** - "\n\n\n\ntext\n\n\n"
9. **Repetitive spam** - "test test test test..." (100x)
10. **Rapid mode switching** - 5 mode changes in <2s

### 5.2 Context Edge Cases (10 tests)

11. **Missing persona** - persona field blank/null
12. **Missing disease** - disease field blank/null
13. **Persona/disease mismatch** - persona not aligned with disease
14. **Sales-Coach no goal** - goal field missing
15. **Truncated history** - Only 1 message in conversation array
16. **Corrupted history** - Out-of-order role/content fields
17. **Duplicate user messages** - Two consecutive user messages
18. **Multiple user messages** - "message1\n\nmessage2"
19. **Thread reset mid-mode** - threadId changes between requests
20. **Role-Play no persona hints** - Persona fields empty

### 5.3 Structure Edge Cases (10 tests)

21. **Sales-Coach missing section** - Missing "Impact:" entirely
22. **Sales-Coach missing bullets** - Rep Approach with 0-2 bullets
23. **Role-Play produces advice** - Returns "Here's my advice for you..."
24. **EI missing Socratic** - Response has no questions
25. **EI missing final question** - Ends with period, not question
26. **PK missing citations** - Claim made without [1] reference
27. **PK malformed citations** - "[REF-]" or "[1a]" instead of "[1]"
28. **GK produces structure** - Starts with "Challenge:" headers
29. **Duplicate coach blocks** - Two <coach>...</coach> sections
30. **Paragraph collapse** - Sections run together without blank lines

---

## 6. FILES REQUIRING PHASE 3 MODIFICATIONS

| File | Lines | Changes | Priority |
|------|-------|---------|----------|
| worker.js | 702-885 | Expand validateResponseContract() | HIGH |
| worker.js | 1761-1805 | Enhanced repair logic | HIGH |
| widget.js | 1022-1175 | Frontend validators (parity check) | HIGH |
| tests/phase3_edge_cases/ | NEW | 30-test suite | CRITICAL |
| .github/workflows/ | NEW | CI/CD pipeline | HIGH |
| PHASE3_VALIDATOR_EXPANSION.md | NEW | Technical specs | MEDIUM |
| PHASE3_EDGE_CASE_CATALOG.md | NEW | Test documentation | MEDIUM |
| PHASE3_CICD_IMPLEMENTATION.md | NEW | CI/CD setup guide | MEDIUM |

---

## 7. EXECUTION PLAN

### PHASE 3 — PART 1 (COMPLETE)
✅ **Full Repository Analysis** - This document

### PHASE 3 — PART 2 (NEXT)
🔲 **30 Real Edge-Case Tests** - tests/phase3_edge_cases/

### PHASE 3 — PART 3 (NEXT)
🔲 **Backend Validator Expansion** - Enhanced detectio logic in worker.js

### PHASE 3 — PART 4 (NEXT)
🔲 **CI/CD Automation** - .github/workflows/reflectivai-ci.yml

### PHASE 3 — PART 5 (NEXT)
🔲 **UI Hardening** - widget.js formatting safeguards

### PHASE 3 — PART 6 (NEXT)
🔲 **Documentation** - Complete docs set

---

## 8. CRITICAL NOTES FOR PHASE 3 DEVELOPERS

1. **Real Tests Only:** ALL 30 edge-case tests MUST POST to live Worker endpoint. NO mocks, NO simulations.

2. **Personas & Diseases:** Use real data from persona.json and scenarios.merged.json. Do NOT invent test data.

3. **Backward Compatibility:** All changes MUST preserve existing functionality. No breaking changes to prompts, mode keys, or response structure.

4. **Graceful Degradation:** If new validators find edge cases, system MUST:
   - Log issue
   - Attempt repair if possible
   - Return safe error if uncorrectable
   - NEVER crash or leak malformed data

5. **Performance:** New validators MUST complete in <50ms on modern hardware.

---

**END OF PHASE 3 REPO ANALYSIS MAP**
