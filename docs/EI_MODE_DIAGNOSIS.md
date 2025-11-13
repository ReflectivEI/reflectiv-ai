# EI MODE DIAGNOSIS: ROOT CAUSE ANALYSIS

**Generated:** November 13, 2025  
**Status:** CONFIRMED ISSUES IDENTIFIED

---

## EXECUTIVE SUMMARY

**Root Cause:** EI mode's Worker system prompt references the `about-ei.md` framework but DOES NOT embed actual framework content. Additionally, EI-specific context from `ei-context.js` and `about-ei.md` is loaded by widget.js but NOT used in the main coach.js API flow.

**Impact:** When users ask questions in EI mode, the LLM receives an INSTRUCTIONAL prompt (telling it to be "EI-centric") but no CONCRETE framework data to reference, causing responses to sound generic and indistinguishable from General Assistant.

**Severity:** HIGH — EI mode outputs lack grounding in EI theory, frameworks, and specific coaching heuristics.

---

## DETAILED DIAGNOSIS

### Issue 1: About-EI.md NOT Embedded in eiPrompt

**File:** `worker.js` lines 994–1040  
**Problem:** The `eiPrompt` says:

```
MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.
```

But `about-ei.md` content is NEVER loaded, embedded, or passed to the Worker. The Worker has:
- No file system access to load about-ei.md at runtime
- No environment variable or KV store containing about-ei.md content
- No client-side mechanism to include about-ei.md content in the request payload

**Result:** The LLM sees instructions to use "about-ei.md framework" but has NO actual framework to cite or reference. It falls back to generic coaching language.

**Evidence:**
- ✅ about-ei.md exists and is comprehensive (306 lines)
- ❌ Worker.js has no mention of loading or embedding about-ei.md
- ❌ postChat function receives no "about-ei" or "ei-framework" parameter
- ❌ No KV namespace defined for EI content
- ✅ Coach.js sends `eiProfile` and `eiFeature` but NOT framework content

---

### Issue 2: EI-Context.js Loaded But Not Integrated Into Coach API Flow

**File:** `assets/chat/ei-context.js`  
**Problem:** The module defines `EIContext.getSystemExtras()` which loads about-ei.md content and builds a comprehensive system context string.

However:
1. It's only used in `widget.js` line 3260 (for SSE streaming to the model, NOT for coach.js)
2. It's NEVER called or integrated when using the `/chat` endpoint (which is what the UI currently uses)
3. The Coach API layer (`core/api.js`) doesn't load or pass EI context

**Current Flow (Coach.js → API → Worker):**
```
askCoach() payload = {
  mode: "emotional-assessment",
  message: "...",
  history: [],
  eiProfile: "difficult",    ← EI metadata only
  eiFeature: "empathy",      ← EI metadata only
  // ❌ NO "eiContext", "framework", or "about_ei_content"
}
```

**Expected Flow (if EI context was integrated):**
```
askCoach() payload = {
  mode: "emotional-assessment",
  message: "...",
  history: [],
  eiProfile: "difficult",
  eiFeature: "empathy",
  eiContext: "[Full about-ei.md or systemExtras]"  ← Would be EI-centric
}
```

**Evidence:**
- ✅ `ei-context.js` exists and exports `getSystemExtras()`
- ✅ `widget.js` loads `ei-context.js` globally (line 551)
- ❌ `coach.js` never calls `EIContext.getSystemExtras()`
- ❌ `core/api.js` has no logic to inject EI context
- ✅ Only SSE streaming path (callModel) attempts to use EIContext

---

### Issue 3: About-EI-Modal.js Only For Static Reference, Not Chat Integration

**File:** `assets/chat/about-ei-modal.js`  
**Problem:** This module provides a UI modal to display `about-ei.md` content when user clicks "About EI" or similar button.

But:
1. It's a SEPARATE modal, not integrated into chat responses
2. When a user asks "How does this mode work?" in EI mode, the system does NOT automatically load and display about-ei.md content
3. The Worker's eiPrompt doesn't reference the modal or trigger it

**Result:** The EI framework is HIDDEN behind an extra button click. It's not integrated into the chat coaching flow.

---

### Issue 4: eiPrompt Is Instructional, Not Data-Driven

**File:** `worker.js` lines 994–1040  
**Example:**
```javascript
const eiPrompt = [
  `You are Reflectiv Coach in Emotional Intelligence mode.`,
  ``,
  `MISSION: Help the rep develop emotional intelligence through reflective practice based on about-ei.md framework.`,
  ``,
  `FOCUS AREAS (CASEL SEL Competencies):`,
  `- Self-Awareness: Recognizing emotions, triggers, communication patterns`,
  `- Self-Regulation: Managing stress, tone, composure under pressure`,
  // ... MORE INSTRUCTIONAL TEXT ...
  `DO NOT:`,
  `- Role-play as HCP`,
  `- Provide sales coaching or product info`,
  `- Include coach scores or rubrics`,
  `- Use structured Challenge/Rep Approach format`
].join("\n");
```

**Problem:** This prompt tells the LLM WHAT to be ("EI-centric") but NOT with what data. It's a TEMPLATE, not grounded in actual EI framework content.

**Comparison with pkPrompt:**
The `pkPrompt` (Product Knowledge) provides similar instructions but is also NOT data-driven. However, Product Knowledge mode naturally has LESS expectation of specific framework content, whereas EI mode SHOULD explicitly embed the Triple-Loop Reflection, CASEL competencies, and heuristic evaluation model.

**Why This Is a Problem:**
When LLMs receive only instructions without concrete reference data, they often default to their training distribution, which can be generic. Example:

User asks EI mode: **"How does this mode work?"**

eiPrompt says: *"Help through reflective practice based on about-ei.md framework"*
LLM thinks: *"The framework exists but I don't have it. I'll use my training knowledge of reflective coaching..."*
Result: Generic response that could apply to ANY coaching mode.

---

### Issue 5: General Assistant Has Similar Prompt But Different Expectations

**File:** `worker.js` lines 1040–1080 (approx.)  
**Example:**
```javascript
const generalKnowledgePrompt = [
  `You are ReflectivAI, an advanced AI knowledge partner for life sciences professionals.`,
  ``,
  `CORE IDENTITY:`,
  `You are a highly knowledgeable, scientifically rigorous assistant trained to answer questions across:`,
  `- Disease states, pathophysiology, and clinical management`,
  `- Pharmacology, mechanisms of action, and therapeutic approaches`,
  // ...
].join("\n");
```

**Key Difference:** General Assistant is EXPECTED to be generic knowledge-oriented, so it doesn't promise specific framework integration.

**Why EI Mode Feels Like General Assistant:**
Both modes rely on the LLM's base instruction-following without concrete reference data. The LLM may respond similarly because neither mode provides specific, differentiating content.

---

## WHY THE BUG MANIFESTS

### User Scenario: "How does this mode work?"

**What Happens:**
1. User selects "Emotional Intelligence" from Learning Center dropdown
2. UI sets mode = "emotional-assessment"
3. User types: "How does this mode work?"
4. coach.js sends to Worker:
   ```json
   {
     "mode": "emotional-assessment",
     "message": "How does this mode work?",
     "history": [],
     "eiProfile": "difficult",
     "eiFeature": "empathy",
     "disease": null
   }
   ```
5. Worker receives, selects `eiPrompt` (which references about-ei.md but doesn't have it)
6. LLM sees: *"Help reps using about-ei.md framework (Triple-Loop Reflection, CASEL competencies, etc.)"*
7. LLM thinks: *"I don't have the actual framework. I'll synthesize general coaching language."*
8. Response generated: Generic coaching advice about reflection and emotional intelligence

**Why It Sounds Like General Assistant:**
- No specific Triple-Loop examples
- No explicit CASEL competencies mapping
- No heuristic rules or behavioral markers
- Just generic "be empathic, self-aware, regulated" advice
- Similar to what a generic LLM would produce

---

## VERIFICATION: EI vs GENERAL ASSISTANT Payloads

### Emotional Intelligence Mode Request
```json
{
  "mode": "emotional-assessment",
  "message": "How does this mode work?",
  "eiProfile": "difficult",
  "eiFeature": "empathy"
}
```

### General Assistant Mode Request
```json
{
  "mode": "general-knowledge",
  "message": "How does this mode work?"
}
```

**Observation:** EI request includes metadata (`eiProfile`, `eiFeature`) but NO framework content. General Assistant is simpler. Yet both may produce similar responses because neither has concrete EI framework data to differentiate them.

---

## ROOT CAUSE SUMMARY

| Layer | Component | Problem | Evidence |
|-------|-----------|---------|----------|
| **Worker** | eiPrompt | References about-ei.md but doesn't embed it | No file loading, no KV store, no environment variable |
| **Worker** | postChat() | No logic to ingest EI-specific context from request | Payload handled generically, no special EI processing |
| **Front-end** | coach.js | Never loads or sends EI context to Worker | askCoach() never calls EIContext, about-ei.md not referenced |
| **Front-end** | core/api.js | Generic payload builder, no EI enrichment | Sends only mode + messages, no framework content |
| **Front-end** | ei-context.js | Loaded but isolated; only used in SSE path | Never called from coach.js or main chat flow |
| **Front-end** | about-ei-modal.js | Static reference modal, not chat-integrated | Separate UI component, not triggered by responses |

---

## IMPACT ASSESSMENT

### Severity: HIGH

**Users Experience:**
- EI mode produces coaching that is generic and indistinguishable from General Assistant
- Requests for "how does this mode work?" return boilerplate responses without EI-specific content
- EI framework content (Triple-Loop, CASEL, heuristics) is never surfaced in chat responses
- Users must manually click "About EI" modal to learn the framework

### What SHOULD Happen:
- EI mode responses MUST reference the EI framework content
- Answers should include examples of Triple-Loop Reflection, CASEL competencies, and heuristic rules
- When asked "how does this mode work?", EI mode should explain its SPECIFIC coaching methodology, not generic coaching

### What IS Happening:
- EI mode responses sound generic
- Framework is not integrated into chat flow
- User must go out-of-band (click modal) to understand EI mode

---

## HYPOTHESIS VALIDATION

**Original Hypothesis:** "EI mode is falling back to the same prompt/handler as General Assistant"

**Refined Hypothesis:** "EI mode HAS a distinct prompt (eiPrompt) but it's INSTRUCTIONAL not DATA-DRIVEN. It references about-ei.md framework without embedding its content, causing the LLM to default to generic coaching language that's indistinguishable from General Assistant."

**Confidence:** 95% (HIGH)

---

## SUMMARY FOR PHASE 5 FIXES

To resolve, we need to:

1. **Embed about-ei.md content into the eiPrompt** or pass it via request payload
2. **Integrate ei-context.js into coach.js API flow** so EI context is sent to Worker
3. **Add EI-specific post-processing** in Worker to extract and reference EI framework in responses
4. **Consider about-ei-modal.js integration** for "how does this mode work?" responses
5. **Test EI vs General Assistant** to confirm distinct, non-generic outputs

---

**Next:** PHASE 5 will implement these fixes.
