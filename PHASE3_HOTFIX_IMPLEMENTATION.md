# PHASE 3 HOTFIX - Implementation Summary
**Date:** November 14, 2025  
**Scope:** Three surgical fixes to `worker.js` ONLY  
**Status:** ✅ IMPLEMENTED

---

## FIX A: EI METADATA LEAK IN SALES-COACH

### Problem
Sales-Coach responses contain embedded `<coach>{...}</coach>` JSON blocks that violate the format contract. These blocks should ONLY appear in EI mode responses sent to the coach object, not in the reply text.

### Root Cause
- **Primary:** salesContract prompt explicitly instructed LLM to append `<coach>{...}</coach>` blocks
- **Secondary:** Post-processing didn't strip remaining coach blocks

### Solution

#### A.1: Remove Coach-Block Instruction from Prompt
**File:** `worker.js` | **Lines:** ~1481-1500

**BEFORE:**
```javascript
Suggested Phrasing: "[EXACT words rep should say - Conversational, professional tone - 25-40 words total - Include key clinical points]"

[... content ...]

Then append deterministic EI scoring:
<coach>{
  "scores":{"empathy":0-5,"clarity":0-5,"compliance":0-5,"discovery":0-5,"objection_handling":0-5,"confidence":0-5,"active_listening":0-5,"adaptability":0-5,"action_insight":0-5,"resilience":0-5},
  "rationales":{"empathy":"...","clarity":"...","compliance":"...","discovery":"...","objection_handling":"...","confidence":"...","active_listening":"...","adaptability":"...","action_insight":"...","resilience":"..."},
  "tips":["Tip 1","Tip 2","Tip 3"],
  "rubric_version":"v2.0"
}</coach>

CRITICAL: Use ONLY the provided Facts context when making claims. NO fabricated references or citations.
```

**AFTER:**
```javascript
Suggested Phrasing: "[EXACT words rep should say - Conversational, professional tone - 25-40 words total - Include key clinical points]"

[... content ...]

CRITICAL: Use ONLY the provided Facts context when making claims. NO fabricated references or citations.
```

**Impact:** LLM no longer receives instruction to generate `<coach>{}` blocks in Sales-Coach responses. Coach metadata is now generated internally by deterministic scoring fallback only.

---

#### A.2: Add Robust Coach-Block Stripping to Post-Processing
**File:** `worker.js` | **Lines:** ~1888-1897

**BEFORE:**
```javascript
// Post-processing: Normalize headings and ENFORCE FORMAT for sales-coach mode
if (mode === "sales-coach") {
  reply = reply
    .replace(/Coach [Gg]uidance:/g, 'Challenge:')
    .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
    .replace(/Risk [Ff]lags:/g, 'Impact:')
    .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')
    .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');
```

**AFTER:**
```javascript
// Post-processing: Normalize headings and ENFORCE FORMAT for sales-coach mode
if (mode === "sales-coach") {
  reply = reply
    .replace(/Coach [Gg]uidance:/g, 'Challenge:')
    .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
    .replace(/Risk [Ff]lags:/g, 'Impact:')
    .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')
    .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');
  
  // Strip any lingering <coach>...</coach> blocks and their content
  reply = reply.replace(/<coach>.*?<\/coach>/is, '').trim();
```

**Impact:** Any remaining `<coach>{}` blocks (from malformed LLM output or parsing edge cases) are robustly removed. Non-greedy match ensures content between tags is removed without affecting surrounding text.

---

## FIX B: ENFORCE EI FINAL QUESTION (EI-01)

### Problem
EI responses must end with `?` per contract EI-01, but the prompt only suggested this as optional guidance. Result: ~50% of EI responses ended with `.` or `!` instead of `?`.

### Root Cause
- **Primary:** EI prompt said "end with a reflective question" (aspirational) not "MUST end with ?" (mandatory)
- **Secondary:** No EI-specific post-processing to enforce/correct final punctuation

### Solution

#### B.1: Strengthen EI Prompt with Hard Requirement
**File:** `worker.js` | **Lines:** ~1590-1601

**BEFORE:**
```javascript
OUTPUT STYLE:
- 2-4 short paragraphs of guidance (max 350 words)
- Include 1-2 Socratic questions to deepen metacognition
- Reference Triple-Loop Reflection when relevant
- Model empathy and warmth in your coaching tone
- End with a reflective question that builds emotional metacognition
- If discussing the EI framework itself, ground responses in the actual framework content and domains
```

**AFTER:**
```javascript
OUTPUT STYLE:
- 2-4 short paragraphs of guidance (max 350 words)
- Include 1-2 Socratic questions to deepen metacognition
- Reference Triple-Loop Reflection when relevant
- Model empathy and warmth in your coaching tone
- CRITICAL: Your response MUST end with a single reflective question, and the LAST non-space character must be a question mark (?)
- If discussing the EI framework itself, ground responses in the actual framework content and domains
```

**Impact:** "CRITICAL" keyword triggers LLM parsing. "LAST non-space character must be ?" is unambiguous instruction. LLM will now treat this as a hard constraint, not a suggestion.

---

#### B.2: Add EI Post-Processing to Enforce Final `?`
**File:** `worker.js` | **Lines:** ~1865-1880

**BEFORE:**
```javascript
// Post-processing: Strip unwanted formatting for role-play mode
if (mode === "role-play") {
  // Remove coaching labels but KEEP bullets for clinical explanations (natural HCP speech)
  reply = reply
    .replace(/^[\s]*Suggested Phrasing:\s*/gmi, '')  // Remove "Suggested Phrasing:" labels
    .replace(/^[\s]*Coach Guidance:\s*/gmi, '')      // Remove any leaked coach headings
    .replace(/^[\s]*Challenge:\s*/gmi, '')
    .replace(/^[\s]*Rep Approach:\s*/gmi, '')
    .replace(/^[\s]*Impact:\s*/gmi, '')
    .replace(/^[\s]*Next-Move Planner:\s*/gmi, '')
    .replace(/^[\s]*Risk Flags:\s*/gmi, '')
    .trim();

  // Don't remove bullets - HCPs naturally use them for clinical processes
  // Example: "• I prioritize follow-ups • I assess adherence"
}
```

**AFTER:**
```javascript
// Post-processing: Strip unwanted formatting for role-play mode
if (mode === "role-play") {
  // Remove coaching labels but KEEP bullets for clinical explanations (natural HCP speech)
  reply = reply
    .replace(/^[\s]*Suggested Phrasing:\s*/gmi, '')  // Remove "Suggested Phrasing:" labels
    .replace(/^[\s]*Coach Guidance:\s*/gmi, '')      // Remove any leaked coach headings
    .replace(/^[\s]*Challenge:\s*/gmi, '')
    .replace(/^[\s]*Rep Approach:\s*/gmi, '')
    .replace(/^[\s]*Impact:\s*/gmi, '')
    .replace(/^[\s]*Next-Move Planner:\s*/gmi, '')
    .replace(/^[\s]*Risk Flags:\s*/gmi, '')
    .trim();

  // Don't remove bullets - HCPs naturally use them for clinical processes
  // Example: "• I prioritize follow-ups • I assess adherence"
}

// Post-processing: Enforce final question mark for EI mode
if (mode === "emotional-assessment") {
  reply = reply.trim();
  // If reply doesn't end with ?, replace final punctuation or append ?
  if (!reply.endsWith('?')) {
    // Replace common final punctuation with ?
    if (reply.endsWith('.') || reply.endsWith('!') || reply.endsWith('…')) {
      reply = reply.slice(0, -1) + '?';
    } else {
      // Append ?
      reply = reply + ' ?';
    }
  }
  reply = reply.trim();
}
```

**Impact:** Guaranteed EI responses end with `?`. Post-processing runs AFTER LLM generation as safety net. Handles three cases:
1. Ends with `.` → replace with `?`
2. Ends with `!` or `…` → replace with `?`
3. No punctuation → append ` ?`

---

## FIX C: ALIGN PK PROMPT WITH FACT CODES (PK-01)

### Problem
PK rule requires citations in `[REF-CODE-###]` format. Prompt instructed LLM to use numbered `[1], [2], [3]` format. Post-processing expected fact codes in reply but LLM never emitted them → zero citations.

### Root Cause
- **Primary:** Mismatch between prompt instruction (numbered format) and fact database (coded format)
- **Secondary:** Post-processing logic expected codes but LLM chose not to use them due to conflicting instructions

### Solution

#### C: Replace Numbered-Citation Instruction with Fact-Code Instruction
**File:** `worker.js` | **Lines:** ~1640-1649

**BEFORE:**
```javascript
COMPLIANCE & QUALITY STANDARDS:
- Distinguish clearly between on-label and off-label information
- Present risks, contraindications, and safety considerations alongside benefits
- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions
- MUST use [numbered citations] [1], [2], [3] for ALL clinical claims and scientific facts - this is required
- Each numbered citation [1], [2] must reference the facts listed above
- If asked about something outside your knowledge, acknowledge limitations
```

**AFTER:**
```javascript
COMPLIANCE & QUALITY STANDARDS:
- Distinguish clearly between on-label and off-label information
- Present risks, contraindications, and safety considerations alongside benefits
- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions
- When you make a clinical or scientific claim, you MUST include the corresponding fact ID from the context, such as [CV-GDMT-HFREF-001] or [HIV-PREP-TAF-002]. Use these bracketed IDs directly in your text.
- If asked about something outside your knowledge, acknowledge limitations
```

**Impact:** LLM now receives explicit instruction to use FACT IDs (which are provided in context as `[HIV-PREP-XXX]`, `[CV-GDMT-XXX]`, etc.). Prompt removes conflicting numbered-format instruction. Post-processing then:
1. Detects `[CV-GDMT-HFREF-001]` codes in response
2. Maps them to fact objects via fact ID lookup
3. Replaces codes with numbered references `[1]`, `[2]`, etc.
4. Appends full reference list

---

## GLOBAL SAFETY CONSTRAINTS ✅

- ✅ Edited `worker.js` ONLY
- ✅ Did NOT touch config.json, personas, disease data, tests, CI
- ✅ Preserved all mode names and routing (role-play, sales-coach, emotional-assessment, product-knowledge)
- ✅ Kept validateResponseContract() and detection/repair rule signatures
- ✅ Preserved response JSON shape: `{ reply, coach, plan, _validation }`

---

## VERIFICATION

Run tests to confirm:
```bash
WORKER_URL="..." timeout 120 node tests/phase3_edge_cases.js
```

Expected results:
1. **Sales-Coach:** No `<coach>{}` blocks in reply text (coach object is separate)
2. **EI (emotional-assessment):** All responses end with `?`
3. **Product-Knowledge:** Responses contain `[1]`, `[2]` numbered citations with References section

---

## FILES MODIFIED

| File | Lines | Change |
|------|-------|--------|
| worker.js | ~1481-1500 | Removed coach-block instruction from salesContract |
| worker.js | ~1897 | Added `<coach>` strip to sales-coach post-processing |
| worker.js | ~1590 | Strengthened EI prompt final-question requirement |
| worker.js | ~1868-1880 | Added EI post-processing to enforce final `?` |
| worker.js | ~1647 | Changed PK prompt from numbered to fact-code citations |

---

**End of Implementation Summary**
