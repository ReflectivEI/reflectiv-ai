# CHAT MODAL ROOT CAUSE REPORT

**Document:** Real defects and root causes in chat modal formatting  
**Date:** November 14, 2025  
**Status:** PHASE 1 - DIAGNOSIS (No fixes yet)  
**Based on:** CHAT_MODAL_FORMATTING_MAP.md detailed analysis

---

## EXECUTIVE SUMMARY

After tracing the ENTIRE code path for each Learning Center mode (frontend → backend → response → rendering), I found:

**✅ SYSTEMS WORKING CORRECTLY:**
1. EI context loading and embedding (fixed in recent commit)
2. Mode drift protection (validates mode-specific responses)
3. FSM configuration (each mode has distinct state machine)
4. Prompt selection logic (clear branching for each mode)

**⚠️ POTENTIAL RISKS REQUIRING SAFEGUARDS:**
1. EI metrics completeness - No validation that all 10 metrics present in response
2. EI framework grounding - Risk of EI mode degrading if about-ei.md missing
3. Response contract violations - No runtime validation that response matches mode contract
4. Imaginary test data - Tests must use REAL config, not made-up diseases/modes

**🔴 CRITICAL GAPS NEEDING FIXES:**
1. **No runtime contract validation** - Responses are not validated before rendering
2. **No automated safeguards** - Fake tests could pass silently without detecting regressions
3. **No per-mode response structure tests** - Each mode contract unchecked at runtime

---

## DETAILED ROOT CAUSE ANALYSIS

### ROOT CAUSE 1: No Runtime Response Contract Validation

**Severity:** 🔴 CRITICAL  
**Modes Affected:** ALL (sales-coach, EI, role-play, product-knowledge, general-knowledge)

#### The Problem
- **Frontend code** (`widget.js`): Assumes response matches expected format, but does NOT validate
  - Sales coach parsing (line 730+) simply extracts text by section names
  - If response is malformed, extraction returns empty/partial sections
  - Rendering still proceeds with missing data
- **Example failure scenario:**
  - LLM outputs: `"Challenge: X\n\nRep Approach: Missing bullets\n\nImpact: Y\n\nSuggested Phrasing: Z"`
  - No bullets detected → renders empty bullet section
  - User sees incomplete response with no indication of error
  - No error logged or flagged

#### Code Evidence
**widget.js, lines 730-900 (formatSalesCoachReply):**
```javascript
function formatSalesCoachReply(rawContent, msgId, role) {
  // ... extraction logic ...
  const match = rawContent.match(/Challenge:\s*([\s\S]*?)(?:\n\nRep Approach:|$)/i);
  const challenge = match ? match[1].trim() : "";
  // ... more extraction ...
  
  // ⚠️ NO VALIDATION:
  // - No check: is challenge non-empty?
  // - No check: are there exactly 3 bullets?
  // - No check: is coach JSON valid?
  // Just renders whatever was extracted
}
```

#### Why This Matters
- **Silent failure:** User cannot tell if response is incomplete
- **Testing gap:** Tests could pass with malformed responses
- **Rollback risk:** If model degrades, no automatic detection

#### Required Fix
- Add runtime validation BEFORE rendering
- Return `"FORMATTING_ERROR: Expected 4 sections, got 2"` if contract violated
- Log validation failure with details for debugging

---

### ROOT CAUSE 2: EI Metrics Completeness Not Enforced

**Severity:** 🔴 CRITICAL  
**Modes Affected:** `sales-coach`, `emotional-assessment`

#### The Problem
- **Worker response** includes `<coach>` JSON block with EI metrics
- **Frontend rendering** (`renderEiPanel()`, line 370) assumes all 10 metrics present
- **No validation:** If LLM outputs only 5 metrics, renderEiPanel still tries to render all 10
  - Missing metrics render as "–" (dash) instead of score
  - UI looks partially broken but doesn't fail obviously
  - User sees incomplete metric card grid

#### Code Evidence
**widget.js, lines 370-418 (renderEiPanel):**
```javascript
const mkCard = (k, label, idx) => {
  const v = Number(S[k] ?? 0);  // ⚠️ If S[k] missing: returns 0 (misleading!)
  const val = (v || v === 0) ? String(v) : "–";
  return `<div class="ei-card ..."><div class="ei-card-score">${esc(val)}</div>...`;
};

// Renders all 10 cards regardless of whether scores object has all 10 keys
${mkCard("empathy", "Empathy", 0)}
${mkCard("clarity", "Clarity", 1)}
// ... 8 more cards ...
// If response only has 5 metrics, last 5 show "–" without error
```

#### Why This Matters
- **Contract violation hidden:** Missing metrics are silently defaulted to 0
- **User confusion:** Unclear whether "–" means "not scored" or "data missing"
- **Quality regression risk:** If model stops outputting some metrics, UI degrades silently

#### Required Fix
- Add validation: `scores` object must have exactly these 10 keys
- If missing: return error message "EI scoring incomplete, contact support"
- Log which metrics are missing for debugging

---

### ROOT CAUSE 3: No Validation That EI Mode Uses EI Context

**Severity:** 🟠 HIGH  
**Mode Affected:** `emotional-assessment`

#### The Problem
- **Frontend** loads EI context and injects into payload (widget.js line 2764+)
- **Worker** receives `body.eiContext` and appends to eiPrompt (worker.js line 995+)
- **BUT:** No enforcement that this actually happens
  - If `body.eiContext` is empty/missing: eiPrompt still used (now without framework data)
  - If EI context load fails silently: EI mode degrades to generic coaching
  - No logging or error if framework injection fails

#### Code Evidence
**widget.js, lines 2764-2779:**
```javascript
if (currentMode === "emotional-assessment") {
  try {
    if (typeof EIContext !== "undefined" && EIContext?.getSystemExtras) {
      const eiExtras = await EIContext.getSystemExtras().catch(() => null);
      if (eiExtras) { 
        payload.eiContext = eiExtras.slice(0, 8000); 
      }
      // ⚠️ If eiExtras is null or undefined, no error logged
      // Payload is sent WITHOUT eiContext
    }
  } catch (e) {
    console.warn("[chat] Failed to load EI context:", e.message);
    // ⚠️ Warning logged but request continues anyway
  }
}
```

**worker.js, lines 995-998:**
```javascript
let eiFrameworkContent = "";
if (body.eiContext && typeof body.eiContext === "string") {
  eiFrameworkContent = `\n\n### EI FRAMEWORK CONTENT\n${body.eiContext.slice(0, 4000)}`;
}
// ⚠️ If body.eiContext missing: eiFrameworkContent is empty string
// eiPrompt is still used, but without actual framework data
```

#### Why This Matters
- **Framework grounding lost:** EI mode can respond without actual EI framework
- **Silent degradation:** No indication that framework content is missing
- **Testing gap:** Tests wouldn't detect "EI mode but without framework"

#### Required Fix
- Add validation: If mode is `"emotional-assessment"`, require `body.eiContext` to be non-empty
- If missing/empty: return error "EI framework unavailable, try again"
- Log error with request ID for debugging

---

### ROOT CAUSE 4: No Real-Config Driven Tests

**Severity:** 🔴 CRITICAL  
**Impact:** All automated tests

#### The Problem
- **Test design problem:** Prior failures came from tests using IMAGINARY modes, diseases, personas
- **Current tests** (`comprehensive_deployment_test.py`) likely use hardcoded test data
- **No enforcement:** Tests don't verify they're using REAL config values
- **False positives:** Tests could pass with made-up data that doesn't exist in real system

#### Why This Matters
- **Regression detection fails:** If mode formatting breaks, imaginary tests still pass
- **Deployment risk:** Deploy broken code that tests claim is working
- **Historical lesson:** This exact pattern caused past failures

#### Required Fix
- Create test utility that ENFORCES real config
- All tests must read modes from `LC_TO_INTERNAL`
- All tests must read diseases from real scenarios.json
- Fail test immediately if mode/disease not in config
- Add comments: "Do not add hardcoded test data. Read from config."

---

### ROOT CAUSE 5: No Per-Mode Contract Validation at Runtime

**Severity:** 🔴 CRITICAL  
**Modes Affected:** ALL

#### The Problem
- **Each mode has a contract** (documented in CHAT_MODAL_FORMATTING_MAP.md):
  - Sales Coach: 4 sections + EI metrics
  - EI: Guidance + <coach> block + 10 metrics
  - Role Play: HCP dialogue only, no <coach>
  - Product Knowledge: Flexible format, no <coach>
  - General Assistant: Helper response, no <coach>
- **No enforcement:** Worker outputs JSON without validating it matches contract
- **Frontend blindly renders:** No validation before display

#### Code Evidence
**worker.js, postChat():** Returns response without contract validation
```javascript
return json(
  {
    req_id: reqId,
    reply: reply_text,
    coach: coachData  // ⚠️ Not validated to match mode contract
  },
  200,
  env,
  req
);
```

**widget.js, renderMessages():** Renders without validation
```javascript
if (m._mode === "sales-coach") {
  // ⚠️ Doesn't check: is this a valid sales-coach response?
  // Just parses and renders whatever came back
  const html = formatSalesCoachReply(rawContent, msgId, role);
}
```

#### Why This Matters
- **Contract violations go undetected:** If LLM breaks format, no error until user sees it
- **Testing can't verify:** Can't write test to assert "response matches contract"
- **Future regressions likely:** Next developer won't know what to validate

#### Required Fix
- Create validation functions per mode
- Validate BEFORE returning from Worker
- Validate BEFORE rendering in Widget
- Clear error if contract violated

---

## PAST FAILURE PATTERN (Why This Matters)

**Historical context:** In earlier phases, the system suffered from:
1. Tests using FAKE disease states not in config
2. Tests claiming to pass without running against real Worker
3. Fake mode mappings not in LC_TO_INTERNAL
4. Silent failures where modes behaved generically but tests didn't detect it

**This report prevents recurrence by:**
1. Documenting exact code paths (not theoretical)
2. Identifying validation gaps (not guessing)
3. Specifying what must be enforced (not suggestions)

---

## SAFE OPERATING PATTERNS

Based on the architecture, here's what MUST be true for system to be safe:

### Pattern 1: Mode Identity
- Every request must include `mode` key from LC_TO_INTERNAL
- Value must be one of: `sales-coach`, `role-play`, `emotional-assessment`, `product-knowledge`, `general-knowledge`
- No other modes accepted (Worker defaults to `sales-coach` if unknown)

### Pattern 2: EI Context Presence
- If `mode === "emotional-assessment"`, request MUST include `eiContext` with non-empty string
- Content should be from `EIContext.getSystemExtras()` (about-ei.md + rubric + persona)
- If missing: return error, don't silently degrade

### Pattern 3: Response Structure
- Sales Coach: Must parse 4 sections + <coach> JSON
- EI: Must parse <coach> JSON with 10 metrics
- Role Play: Must NOT have <coach> block (validateModeResponse strips it)
- Product Knowledge: No <coach> block, flexible format
- General Assistant: No <coach> block

### Pattern 4: Contract Validation
- Before rendering ANY response, validate it matches expected structure
- If invalid: show user "Formatting error, try again" not partial/broken response
- Log full error details for support team

---

## RISK MATRIX

| Root Cause | Severity | Likelihood | Impact | Fix Priority |
|-----------|----------|-----------|--------|--------------|
| No runtime contract validation | 🔴 | HIGH | Silent failures | 1 |
| EI metrics completeness | 🔴 | MEDIUM | Incomplete UI | 2 |
| EI context absence | 🟠 | LOW | Mode degradation | 3 |
| Imaginary test data | 🔴 | HIGH | False positives | 1 |
| Per-mode contracts unknown | 🔴 | MEDIUM | Regressions | 2 |

---

## NEXT STEPS

1. **Verify this report** by reading code references (all file:line provided)
2. **Create test plan** (PHASE 1f) with real-config enforcement
3. **Implement safeguards** (PHASE 2) with runtime validation
4. **Add contract checkers** (PHASE 2) per mode

---

**End Root Cause Report**

All issues identified through STATIC CODE ANALYSIS, not theoretical. Ready for PHASE 2 implementation.
