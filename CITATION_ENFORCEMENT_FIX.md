# PHASE 2B: Citation Enforcement Fix

## Problem Identified

During real integration testing (PHASE 2B), 2 of 4 Product Knowledge tests failed:
- **PK-01** (renal safety Descovy vs TDF): No citations
- **PK-03** (biomarkers ADC response): No citations

While PK-02 and PK-04 passed with proper `[1], [2]` citation format.

## Root Cause Analysis

1. **pkPrompt (worker.js lines 1208-1282):** Requested citations but didn't enforce them
   - Old language: "Evidence citations [1], [2] **when available**" (optional)
   - Old language: "Use [numbered citations] **for clinical claims when references are available**" (optional)

2. **Validation (worker.js lines 620-631):** Only warned about missing citations, didn't enforce
   - Status: Warning only
   - Impact: Response still returned without citations

3. **LLM Behavior:** Inconsistent - sometimes includes citations, sometimes doesn't

## Fix Implemented

### 1. Enhanced pkPrompt (worker.js lines 1208-1243)

**Changed:**
- `"Evidence citations [1], [2] when available"` 
- → `"Evidence citations [1], [2] when available - REQUIRED for any clinical/scientific claims"`

- `"Use [numbered citations] for clinical claims when references are available"`
- → `"MUST use [numbered citations] [1], [2], [3] for ALL clinical claims and scientific facts - this is required"`

**Impact:** Explicit enforcement language signals to LLM that citations are mandatory, not optional.

### 2. Enhanced Validation (worker.js lines 638-663)

**Previous Logic:**
```javascript
const hasCitations = /\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/i.test(cleaned);
if (!hasCitations) {
  warnings.push("no_citations_detected");  // Only a warning
}
```

**New Logic:**
```javascript
// Detect clinical sentences (heuristic)
const clinicalSentences = cleaned.match(/[^.!?]*(?:[Dd]isease|[Cc]linical|...)[^.!?]*[.!?]/g) || [];
const citationMatches = cleaned.match(/\[HIV-PREP-[A-Z]+-\d+\]|\[\d+\]/gi) || [];

// VIOLATION if clinical content without citations
if (clinicalSentences.length > 0 && citationMatches.length === 0) {
  violations.push("product_knowledge_missing_citations");
  // Append flag to response
  cleaned = cleaned + `\n\n[CITATION REQUIRED: ...]`;
} else if (clinicalSentences.length > 1 && citationMatches.length < Math.ceil(...)) {
  warnings.push("product_knowledge_insufficient_citations");
}
```

**Impact:** 
- Detects clinical content via heuristic pattern matching
- Flags as VIOLATION (not just warning) if clinical content lacks citations
- Appends visible flag to response for transparency

## Test Impact

**Expected Outcome:**
- PK-01 and PK-03 will still execute but now include visible citation flag
- Marks responses as contract violations (expected behavior)
- Next step: If LLM still doesn't generate citations despite enhanced prompt, consider retrying with stronger constraints

## Deployment Steps

1. ✅ Enhanced pkPrompt with explicit citation requirements
2. ✅ Enhanced validateModeResponse for PK citations
3. 🔄 Re-run tests to verify behavior
4. 📊 Document results

## Files Modified

- **worker.js (lines 1208-1243):** Enhanced pkPrompt
- **worker.js (lines 638-663):** Enhanced PK citation validation

## Verification

**Test Command:**
```bash
node tests/lc_integration_tests.js
```

**Expected Results After Fix:**
- Same 18/20 pass rate OR improved if LLM responds to enhanced prompt
- Clear violation flags for PK-01, PK-03 if citations still missing
- Better transparency about what's being validated

---

## Next Steps if Tests Still Fail

### Option 1: Add Post-Processing Citation Generation
- Generate citations from activePlan.facts if LLM didn't include them
- Requires more aggressive modification

### Option 2: Retry Logic in postChat
- If citations missing, make another API call requesting citations
- Requires additional latency

### Option 3: Accept as LLM Limitation
- Some models may not reliably generate citations
- Consider switching to GPT-4 or Claude for PK mode
- Document limitation

---

**Fix Completed:** 2025-11-15
**Status:** Ready for testing
