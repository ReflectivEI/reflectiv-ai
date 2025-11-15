# PHASE 3 DEBUG: ROOT CAUSE ANALYSIS
**Diagnostic Report - No Code Changes**  
**Date:** November 14, 2025  
**Analysis Level:** File-by-file code audit

---

## EXECUTIVE SUMMARY

Three critical anomalies identified in live smoke tests:

1. **EI Metadata Leak into Sales-Coach Responses** (CRITICAL)
2. **EI Final Question Rule Not Enforced** (MEDIUM)
3. **Product Knowledge Citations Missing** (MEDIUM)

All root causes identified. Zero code changes made per request.

---

---

# SECTION A: EI METADATA LEAK ROOT CAUSE

## The Problem
Sales-Coach responses contain embedded `<coach>{...scores, rationales, tips...}</coach>` JSON blocks that should NOT appear outside EI mode. This violates format contract isolation.

**Evidence from smoke tests:**
```
Sales-Coach response ended with:
<coach>{ "scores":{"empathy":4,"clarity":5,"compliance":5,"discovery":4,...}, 
"rationales":{...}, "tips":[...], "rubric_version":"v2.0" }</coach>
```

## Root Cause Analysis

### Location 1: Sales-Coach Prompt Template (worker.js, lines 1424-1505)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1424-1505

**Problem:**
The `salesContract` variable (lines 1424-1505) explicitly instructs the LLM to APPEND the coach metadata:

```javascript
const salesContract = `
...
Then append deterministic EI scoring:
<coach>{
  "scores":{"empathy":0-5,"clarity":0-5,...},
  "rationales":{...},
  "tips":["Tip 1","Tip 2","Tip 3"],
  "rubric_version":"v2.0"
}</coach>
...
`.trim();
```

**This is the root cause.** The prompt TELLS the LLM to include `<coach>{}</coach>` blocks in Sales-Coach mode. The contract was designed to have the LLM generate deterministic EI scoring, but this breaks the PHASE 3 format contract which requires Sales-Coach responses to be CLEAN (no metadata).

**Critical Line:** Line ~1480:  
```javascript
Then append deterministic EI scoring:
<coach>{ ... }</coach>
```

### Location 2: extractCoach() Function (worker.js, lines 396-419)
**File:** `worker.js`  
**Function:** `extractCoach(raw)`  
**Lines:** 396-419

**Secondary Issue:**
The `extractCoach()` function extracts the coach metadata from the response BUT returns it separately:

```javascript
function extractCoach(raw) {
  const s = String(raw || "");
  const open = s.indexOf("<coach>");
  if (open < 0) return { coach: null, clean: sanitizeLLM(s) };
  const head = s.slice(0, open);
  // ... JSON parsing logic ...
  return { coach, clean: sanitizeLLM((head + " " + after).trim()) };
}
```

**The function works correctly** — it extracts coach metadata and returns BOTH:
- `coach`: The parsed JSON object
- `clean`: The text WITHOUT the `<coach>{}` tags

**However**, the problem is upstream: the PROMPT is telling the LLM to INCLUDE coach blocks in Sales-Coach mode in the first place.

### Location 3: Response Return Path (worker.js, lines 2283-2290)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 2283-2290

**Final Issue:**
The response is being returned with BOTH the clean reply AND the extracted coach object:

```javascript
return json({ 
  reply,                    // Clean text (coach metadata stripped)
  coach: coachObj,          // Coach object (extracted JSON)
  plan: { id: planId || activePlan.planId },
  _validation: { valid: contractValidation.valid, warnings: contractValidation.warnings }
}, 200, env, req);
```

**This is correct behavior**, but the smoke test is checking the `reply` field and finding coach metadata still present. This suggests the `extractCoach()` function is NOT being called properly OR the reply is being modified after extraction.

### Location 4: Post-Processing for Sales-Coach (worker.js, lines 1888-1931)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1888-1931

**The Real Culprit:**
After `extractCoach()` removes the coach blocks, the post-processing for Sales-Coach mode ONLY normalizes headers:

```javascript
if (mode === "sales-coach") {
  reply = reply
    .replace(/Coach [Gg]uidance:/g, 'Challenge:')
    .replace(/Next[- ]?[Mm]ove [Pp]lanner:/g, 'Rep Approach:')
    .replace(/Risk [Ff]lags:/g, 'Impact:')
    .replace(/Suggested [Pp]hrasing:/g, 'Suggested Phrasing:')
    .replace(/Rubric [Jj][Ss][Oo][Nn]:/g, '');

  // Format validation logic follows...
}
```

**The header normalization does NOT strip remaining `<coach>{}` blocks.** If the LLM embeds coach metadata INSIDE the response text (not cleanly wrapped), it will survive this post-processing.

---

## Root Cause Summary

**PRIMARY CAUSE:** Sales-Coach prompt (line 1480) explicitly instructs LLM to append `<coach>{...}</coach>` blocks.

**SECONDARY CAUSE:** Post-processing normalization (lines 1888-1931) does not explicitly strip remaining coach metadata blocks if they're embedded within the response text.

**TERTIARY CAUSE:** The `<coach>{}` blocks are appearing WITHIN the response text, not at the end, so `extractCoach()` may not catch them if the format is malformed.

---

## Files & Lines to Review

| File | Lines | Function | Issue |
|------|-------|----------|-------|
| worker.js | 1424-1505 | postChat() | salesContract prompt tells LLM to include `<coach>{}</coach>` |
| worker.js | 1480 | prompt template | "Then append deterministic EI scoring:" instruction |
| worker.js | 1888-1931 | postChat() | Post-processing doesn't strip embedded coach blocks |
| worker.js | 396-419 | extractCoach() | Works correctly but called AFTER LLM generation |

---

## Recommendation: Next Fix

**Remove the coach-block instruction from Sales-Coach prompt** (line 1480):
- Delete the line: "Then append deterministic EI scoring:"
- Delete the entire `<coach>{...}</coach>` template block
- Coach metadata should be generated INTERNALLY, not by the LLM prompt

---

---

# SECTION B: EI FINAL QUESTION RULE FAILURE

## The Problem
EI-01 Rule requires: "Responses must end with a question mark (?)"

Smoke test found: 2 questions present, but response ends with period/punctuation instead of "?"

## Root Cause Analysis

### Location 1: EI Prompt (worker.js, lines 1570-1610)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1570-1610

**Current EI Prompt:**
```javascript
const eiPrompt = [
  `You are Reflectiv Coach in Emotional Intelligence mode.`,
  `...`,
  `OUTPUT STYLE:`,
  `- 2-4 short paragraphs of guidance (max 350 words)`,
  `- Include 1-2 Socratic questions to deepen metacognition`,
  `- Reference Triple-Loop Reflection when relevant`,
  `- Model empathy and warmth in your coaching tone`,
  `- End with a reflective question that builds emotional metacognition`,  // <-- Line says "End with reflective question"
  `- If discussing the EI framework itself, ground responses in the actual framework content and domains`,
  ``,
  `DO NOT:`,
  `- Role-play as HCP`,
  `- Provide sales coaching or product info`,
  `- Include coach scores or rubrics`,
  `- Use structured Challenge/Rep Approach format`
].join("\n") + eiFrameworkContent;
```

**The Issue:**
- Line ~1600 says: "End with a reflective question"
- This is ASPIRATIONAL language, not a MANDATORY constraint
- The LLM interprets "end with a reflective question" as optional guidance

**Missing:** Explicit instruction to ensure the final character is "?"

### Location 2: Validation Logic - Where Rule is Checked (worker.js, line 2026)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 2026-2050 (deterministic scoring fallback)

**Current code:**
```javascript
if (!coachObj || !coachObj.scores) {
  const usedFactIds = (activePlan.facts || []).map(f => f.id);
  const overall = deterministicScore({ reply, usedFactIds });
  coachObj = {
    overall,
    scores: { 
      empathy: 3, clarity: 4, compliance: 4, 
      discovery: /[?]\s*$/.test(reply) ? 4 : 3,  // <-- Checks if ends with ?
      objection_handling: 3, confidence: 4, 
      active_listening: 3, adaptability: 3, 
      action_insight: 3, resilience: 3 
    },
    ...
  };
}
```

**The Issue:**
- Line ~2037 CHECKS if reply ends with "?": `/[?]\s*$/.test(reply)`
- If it does → discovery score = 4
- If it doesn't → discovery score = 3
- But the LLM is NOT being instructed to ensure this happens. The check is REACTIVE, not PROACTIVE.

### Location 3: No Post-Processing Fix for EI (worker.js, lines 1820-1860)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1820-1860 (post-processing for role-play only)

**Current code:**
```javascript
// Post-processing: Strip unwanted formatting for role-play mode
if (mode === "role-play") {
  // Removes headers for RP mode
  reply = reply
    .replace(/^[\s]*Suggested Phrasing:\s*/gmi, '')
    .replace(/^[\s]*Coach Guidance:\s*/gmi, '')
    // ...
    .trim();
}

// Post-processing: Normalize headings for sales-coach mode
if (mode === "sales-coach") {
  // Normalizes headers for SC mode
  // ...
}

// NO POST-PROCESSING FOR EI MODE
```

**The Issue:**
- EI mode has NO post-processing to enforce final "?"
- Role-Play and Sales-Coach have post-processing, but EI doesn't
- The response text is returned AS-IS from the LLM

---

## Root Cause Summary

**PRIMARY CAUSE:** EI prompt says "end with a reflective question" but doesn't MANDATE final "?"

**SECONDARY CAUSE:** No post-processing for EI mode to enforce/correct final punctuation

**TERTIARY CAUSE:** Deterministic scoring CHECKS for "?" (reactive) but doesn't ENSURE it (proactive)

---

## Files & Lines to Review

| File | Lines | Function | Issue |
|------|-------|----------|-------|
| worker.js | 1570-1610 | postChat() | EI prompt lacks mandatory final "?" instruction |
| worker.js | ~1600 | eiPrompt | "End with a reflective question" is aspirational, not mandatory |
| worker.js | 1820-1860 | postChat() | No post-processing for EI mode to fix punctuation |
| worker.js | 2037 | deterministic scoring | Checks for "?" but doesn't enforce it |

---

## Recommendation: Next Fix

**Add explicit final-question constraint to EI prompt:**
- Add line: "**CRITICAL: Your response MUST end with a single question mark (?). The last character must be '?'.**"
- Add post-processing for EI mode (similar to RP/SC) to strip any trailing periods and ensure final "?"
- Example: `if (mode === "emotional-assessment") { reply = reply.replace(/\.\s*$/, "?").trim(); }`

---

---

# SECTION C: PRODUCT KNOWLEDGE CITATIONS MISSING

## The Problem
PK-01 Rule requires: "Citations in [REF-CODE-###] format"

Smoke test found: 0 citations in expected [REF-CODE-###] format

## Root Cause Analysis

### Location 1: PK Prompt (worker.js, lines 1612-1680)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1612-1680

**Current PK Prompt:**
```javascript
const pkPrompt = [
  `You are ReflectivAI, an advanced AI knowledge partner...`,
  ``,
  `AVAILABLE CONTEXT:`,
  `${disease ? `Disease Focus: ${disease}` : ''}`,
  `${persona ? `HCP Context: ${persona}` : ''}`,
  `${factsStr ? `\nRelevant Facts:\n${factsStr}` : ''}`,
  `${citesStr ? `\nReferences:\n${citesStr}` : ''}`,
  ``,
  `COMPLIANCE & QUALITY STANDARDS:`,
  `- Distinguish clearly between on-label and off-label information`,
  `- Present risks, contraindications, and safety considerations alongside benefits`,
  `- Recommend consulting official sources (FDA labels, guidelines) for prescribing decisions`,
  `- MUST use [numbered citations] [1], [2], [3] for ALL clinical claims and scientific facts - this is required`,
  `- Each numbered citation [1], [2] must reference the facts listed above`,
  `- If asked about something outside your knowledge, acknowledge limitations`,
  ...
].join("\n");
```

**The Issue:**
- The prompt asks for **NUMBERED citations** `[1], [2], [3]`
- The prompt does NOT ask for **CODED citations** `[REF-CODE-###]`
- The FACTS_DB uses coded format: `"HIV-PREP-ELIG-001"`, `"HIV-PREP-TAF-002"`, etc.
- **Mismatch:** Prompt expects LLM to use numbered format, but database has coded format

### Location 2: Facts String Construction (worker.js, lines 1407-1423)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 1407-1423

**Current code:**
```javascript
const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");

// Handle both citation formats: {text, url} objects and plain strings
const citesStr = activePlan.facts
  .flatMap(f => f.cites || [])
  .slice(0, 6)
  .map(c => {
    if (typeof c === 'object' && c.text) {
      return `- ${c.text}${c.url ? ` (${c.url})` : ''}`;
    }
    return `- ${c}`;
  })
  .join("\n");
```

**The Issue:**
- `factsStr` includes the FACT IDs: `[HIV-PREP-ELIG-001]`, `[HIV-PREP-TAF-002]`, etc.
- But this is just for REFERENCE — LLM reads these as context
- The prompt instructs LLM to use NUMBERED citations `[1], [2]`, NOT the fact codes

**Example of what's passed to LLM:**
```
Relevant Facts:
- [HIV-PREP-ELIG-001] PrEP is recommended for individuals...
- [HIV-PREP-TAF-002] Descovy is indicated for...
- [HIV-PREP-SAFETY-003] Assess renal function...

References:
- CDC PrEP Guidelines 2024 (https://...)
- FDA Label - Descovy PrEP (https://...)
...
```

**The LLM sees the codes but is told to use numbered format,** creating confusion.

### Location 3: Response Post-Processing for PK (worker.js, lines 2054-2107)
**File:** `worker.js`  
**Function:** `postChat()`  
**Lines:** 2054-2107

**Current code:**
```javascript
// APPEND REFERENCES: For product-knowledge mode, convert citation codes to numbered refs and append full URLs
if (mode === "product-knowledge" && activePlan && activePlan.facts && activePlan.facts.length > 0) {
  // Extract all citation codes from the reply (e.g., [HIV-PREP-001], [CV-SGLT2-SAFETY-005])
  const citationCodes = (reply.match(/\[([A-Z]{2,}-[A-Z0-9-]{2,})\]/g) || [])
    .map(m => m.slice(1, -1)); // Remove brackets
  
  if (citationCodes.length > 0) {
    // Build reference list from cited facts
    const refMap = new Map(); // code -> {number, citations}
    let refNumber = 1;
    
    citationCodes.forEach(code => {
      if (!refMap.has(code)) {
        // Find the fact with this code
        const fact = activePlan.facts.find(f => f.id === code);
        if (fact && fact.cites && fact.cites.length > 0) {
          refMap.set(code, {
            number: refNumber++,
            citations: fact.cites
          });
        }
      }
    });

    // Replace citation codes with numbered references in the text
    refMap.forEach((value, code) => {
      const regex = new RegExp(`\\[${code}\\]`, 'g');
      reply = reply.replace(regex, `[${value.number}]`);
    });

    // Build the references section
    if (refMap.size > 0) {
      reply += '\n\n**References:**\n';
      refMap.forEach((value, code) => {
        value.citations.forEach(cite => {
          if (typeof cite === 'object' && cite.text && cite.url) {
            reply += `${value.number}. [${cite.text}](${cite.url})\n`;
          } else if (typeof cite === 'string') {
            reply += `${value.number}. ${cite}\n`;
          }
        });
      });
      reply = reply.trim();
    }
  }
}
```

**The Issue:**
- This post-processing LOOKS for citation codes in the LLM response
- It tries to REPLACE them with numbered references
- **But if the LLM didn't generate the codes in the first place, this code finds nothing**

**Test Result:** 0 citations found = LLM never generated `[HIV-PREP-XXX]` codes

---

## Root Cause Summary

**PRIMARY CAUSE:** PK prompt instructs LLM to use **numbered** citations `[1], [2]` but facts database provides **coded** citations `[HIV-PREP-001]`

**SECONDARY CAUSE:** LLM sees fact codes in context but is told to use different format, causing it to ignore the codes and use generic text instead

**TERTIARY CAUSE:** Post-processing (lines 2054-2107) EXPECTS coded citations in the response but LLM never generated them

---

## Root Cause Breakdown

**Step 1: Disease scenario request**  
Request for cardiovascular_hypertension mode:product-knowledge

**Step 2: Fact loading**  
Loads 8 CV facts from FACTS_DB. Examples:
- `"CV-GDMT-HFREF-001"`
- `"CV-ARNI-ENTRESTO-002"`
- `"CV-SGLT2-HF-003"`
- etc.

**Step 3: Fact string construction**  
`factsStr` built as:
```
- [CV-GDMT-HFREF-001] Guideline-directed medical therapy...
- [CV-ARNI-ENTRESTO-002] Sacubitril/valsartan...
```

**Step 4: PK prompt sent to LLM**  
Prompt says: "MUST use [numbered citations] [1], [2], [3]"  
Prompt also provides facts with codes in context

**Step 5: LLM generates response**  
LLM reads prompt instruction ("use numbered format") and ignores the fact codes in context.  
LLM generates generic response WITHOUT citations because it doesn't understand how to map the codes.

**Step 6: Response validation**  
Post-processing looks for `[CV-GDMT-...]` pattern but finds nothing.  
Zero citations in response.

---

## Files & Lines to Review

| File | Lines | Function | Issue |
|------|-------|----------|-------|
| worker.js | 1612-1680 | postChat() | PK prompt instructs LLM to use numbered format `[1], [2]` NOT fact codes |
| worker.js | ~1656 | pkPrompt | "MUST use [numbered citations] [1], [2], [3]" conflicts with fact code format |
| worker.js | 1407-1423 | postChat() | factsStr includes codes but prompt doesn't tell LLM to use them |
| worker.js | 2054-2107 | postChat() | Post-processing expects codes in response but LLM never generates them |

---

## Recommendation: Next Fix

**Option 1 (Recommended):** Modify PK prompt to instruct LLM to use the FACT CODES directly
- Change prompt line ~1656 to: "Reference the fact IDs directly: [CV-GDMT-HFREF-001], [HIV-PREP-TAF-002], etc."
- Remove instruction to use numbered format
- This matches the facts database and post-processing logic

**Option 2 (Alternative):** Modify PK prompt to ask for BOTH formats
- Keep numbered format for inline citations
- Add instruction: "You may also reference fact codes from the context like [CV-GDMT-HFREF-001]"
- Update post-processing to handle both

**Option 3 (Nuclear):** Remove post-processing entirely and accept numbered citations
- Let LLM use numbered format
- Update post-processing to map numbered citations to references
- This changes the contract but is simpler

---

---

## AUDIT SUMMARY TABLE

| Anomaly | Root Cause | File | Lines | Severity |
|---------|-----------|------|-------|----------|
| EI Metadata in SC | Prompt tells LLM to append `<coach>{}` | worker.js | 1480 | CRITICAL |
| EI Metadata in SC | No post-processing strip for coach blocks | worker.js | 1888-1931 | HIGH |
| EI No Final "?" | Prompt says "end with question" not mandatory | worker.js | 1600 | MEDIUM |
| EI No Final "?" | No post-processing for EI final punctuation | worker.js | 1820-1860 | MEDIUM |
| PK No Citations | Prompt instructs numbered format, not codes | worker.js | 1656 | MEDIUM |
| PK No Citations | Mismatch between prompt and fact database | worker.js | 1407-1423 | MEDIUM |

---

## NEXT STEPS (IN ORDER)

1. **CRITICAL:** Remove coach-block instruction from Sales-Coach prompt (line 1480)
2. **HIGH:** Add post-processing to strip remaining `<coach>{}` blocks from SC mode
3. **MEDIUM:** Add mandatory final "?" constraint to EI prompt
4. **MEDIUM:** Add post-processing for EI to enforce final "?"
5. **MEDIUM:** Modify PK prompt to instruct LLM to use fact codes `[CV-GDMT-...]` instead of numbered format

---

**Analysis Complete. No code changes made per request.**
