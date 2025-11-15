# TESTING_GUARDRAILS: Real Tests Only

**Date:** 2025-11-15  
**Version:** 1.0  
**Status:** Enforced

---

## FUNDAMENTAL RULE

**All system tests MUST use:**
1. Real mode keys from the codebase
2. Real personas from `persona.json`
3. Real scenario IDs from `scenarios.merged.json`
4. The LIVE Worker endpoint at `POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat`
5. Actual HTTP calls (no mocks, no simulations)

**Absolutely FORBIDDEN:**
- ❌ Imaginary mode keys or fake scenarios
- ❌ Theoretical reasoning about test outcomes
- ❌ "Simulated" tests that don't hit the real endpoint
- ❌ Claiming tests passed without HTTP logs
- ❌ Fictional test matrices based on made-up configurations
- ❌ Using mock responses or unit tests as proof of integration

---

## Why This Matters

### The Problem

Previous iterations included "tests" that were:
- Theoretical analysis without actual API calls
- Claims of success based on code review alone
- Fake test matrices that looked comprehensive but never ran
- Mocked responses that didn't reflect real LLM behavior

**Result:** Unknown actual state; false confidence in system correctness

### The Solution

**PHASE 2 Rule:** Every claim about system correctness is backed by real HTTP evidence.

---

## What "Real" Means

### ✅ Real Test

```javascript
// REAL: Actual HTTP request to Worker
const response = await fetch(
  'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat',
  {
    method: 'POST',
    body: JSON.stringify({
      mode: 'sales-coach',                        // From LC_TO_INTERNAL mapping
      persona: 'hiv_fp_md_timepressed',           // From persona.json
      disease: 'hiv_im_decile3_prep_lowshare',    // From scenarios.merged.json
      messages: [...],
      // etc.
    })
  }
);
const result = await response.json();
// Assert on real response
console.assert(result.reply.includes('Challenge:'));
```

### ❌ Fake Test

```javascript
// FAKE: No actual HTTP call
const mockResponse = {
  reply: "Challenge: ...\nRep Approach: ...",  // Manually crafted
  coach: { scores: { empathy: 4 } }
};
console.log("✓ Test passed"); // Never actually called the Worker
```

---

## Test Execution Requirements

### When Adding Tests

1. **Identify Real Data:**
   - Pick a mode key: `sales-coach`, `role-play`, `emotional-assessment`, `product-knowledge`, `general-knowledge`
   - Pick a persona ID from `persona.json` (verify it exists in repo)
   - Pick a disease scenario from `scenarios.merged.json` (verify it exists in repo)
   - Formulate a realistic question

2. **Execute HTTP Call:**
   - Make the actual POST request to the live endpoint
   - Capture HTTP status code and response body
   - Include raw request/response in documentation if claiming a result

3. **Validate Against Contract:**
   - For each mode, check the format contract from `LC_FORMAT_CONTRACTS.md`
   - Verify response matches the required structure
   - Document any violations or warnings

4. **Document:**
   - Save test ID, mode, HTTP status, response snippet
   - Include timestamp of when test was run
   - Record any rate-limit retries (429 responses)

### When Running Full Suite

```bash
# CORRECT: Run actual tests
node tests/lc_integration_tests.js

# Result: See actual HTTP logs, pass/fail per test, timing info
```

**Output checklist:**
- ✓ Per-test results (PASS/FAIL with reason)
- ✓ HTTP status codes
- ✓ Response format validation
- ✓ Any violations detected
- ✓ Retry counts (if hit rate limits)
- ✓ Raw response samples (for debugging)

---

## Current Test Suite (PHASE 2)

**File:** `tests/lc_integration_tests.js`

**Structure:** 20 real HTTP tests (4 per mode)
- **Sales Coach (SC-01 to SC-04):** Real scenarios testing format enforcement
- **Role Play (RP-01 to RP-04):** Real HCP personas in different contexts
- **EI Assessment (EI-01 to EI-04):** Real reflective coaching scenarios
- **Product Knowledge (PK-01 to PK-04):** Real clinical knowledge questions
- **General Knowledge (GK-01 to GK-04):** Real general questions

**Execution:** Every test makes a real HTTP POST to the live Worker endpoint

**Results:** All 20 tests pass format contract validation (as of 2025-11-15)

---

## Validation Assertions Per Mode

### Sales Coach
```javascript
✓ HTTP 200 OK
✓ Response contains all 4 sections: Challenge, Rep Approach, Impact, Suggested Phrasing
✓ Rep Approach has 3+ bullets with reference codes [FACT-ID]
✓ Coach block present with all 10 EI metrics
✓ Each metric is numeric 1-5
```

### Role Play
```javascript
✓ HTTP 200 OK
✓ No Challenge/Rep Approach/Impact/Suggested Phrasing headers
✓ No coach block (or coach is null/empty)
✓ First-person HCP voice ("I", "my", "we")
✓ 1-4 sentences OR brief bullets (natural HCP speech)
✓ Length <= 300 words
```

### EI Assessment
```javascript
✓ HTTP 200 OK
✓ 2-4 paragraphs (reflective coaching)
✓ 1+ Socratic questions (marked by ?)
✓ References to EI framework (CASEL, Triple-Loop, emotional intelligence, etc.)
✓ NO coaching structure (no Challenge/Rep/Impact)
✓ NO coach block with metrics
✓ Length <= 400 words
```

### Product Knowledge
```javascript
✓ HTTP 200 OK
✓ Clinical/scientific prose (300-600 words)
✓ Citations [1], [2], [3] for claims
✓ References section mapping numbers to sources
✓ No coach block
✓ No coaching structure
✓ Label-aligned language for drugs/treatments
```

### General Knowledge
```javascript
✓ HTTP 200 OK
✓ Non-empty response
✓ NO coaching structure (Challenge/Rep/Impact)
✓ NO coach block
✓ Length <= 700 words
✓ No obvious HCP persona leakage ("In my clinic...")
✓ Helpful, conversational tone
```

---

## Checklist Before Modifying Tests

If you need to add, remove, or change tests:

- [ ] New test uses a real mode key (verified in widget.js)
- [ ] New test uses a real persona ID (verified in persona.json)
- [ ] New test uses a real disease scenario (verified in scenarios.merged.json)
- [ ] Test makes an actual HTTP call to the live Worker
- [ ] Test captures HTTP response including status and body
- [ ] Test validates against the correct format contract
- [ ] Test is documented with ID, mode, personas, assertions
- [ ] Test is included in `tests/lc_integration_tests.js`
- [ ] Test can be run via `node tests/lc_integration_tests.js`
- [ ] Results are reproducible and logged

---

## Troubleshooting Failed Tests

### HTTP 429 (Rate Limited)
- **Expected:** Will happen under load
- **Behavior:** Test harness retries up to 3 times with exponential backoff
- **Fix:** Space tests out or increase retry delay

### HTTP 500 (Server Error)
- **Action:** Check Worker logs at Cloudflare dashboard
- **Look for:** Invalid payload format, missing environment variables, provider API failures
- **Fix:** Debug in worker.js, redeploy, retry

### Contract Validation Failed
- **Check:** Which mode failed and which contract requirement
- **Verify:** Mode-specific prompt in worker.js is up to date
- **Verify:** Mode-specific validator in `validateResponseContract()` is correct
- **Fix:** Adjust prompt or validator to match contract spec

### Test Timeout
- **Increase:** Timeout in `tests/lc_integration_tests.js` (line ~400)
- **Check:** Is Worker responding at all? (curl the endpoint manually)
- **Check:** Rate limiting? (look for 429 responses)

---

## Continuous Integration

Once this guard is established:

1. **Pre-commit:** All tests must pass locally before pushing
2. **CI/CD:** Tests run on each commit (no mocks allowed)
3. **Deployment:** Only deploy if all 20 tests pass
4. **Monitoring:** Log test results post-deployment to catch regressions

---

## References

- **Format Contracts:** `LC_FORMAT_CONTRACTS.md` (source of truth for mode structures)
- **Test File:** `tests/lc_integration_tests.js` (the real test harness)
- **Worker Endpoint:** `https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat`
- **Real Data Files:**
  - `persona.json` (all persona IDs)
  - `scenarios.merged.json` (all disease scenario IDs)
  - `widget.js` (mode key mapping: LC_TO_INTERNAL)

---

## Questions to Ask Before Committing "Test Evidence"

1. **Did I make an actual HTTP POST request?** (Not just thinking about it)
2. **Did I capture the HTTP status code?** (200, 429, 500, etc.)
3. **Did I validate against the real format contract?** (From LC_FORMAT_CONTRACTS.md)
4. **Can I reproduce this test RIGHT NOW if asked?** (Is it in the test suite?)
5. **Would a stranger be able to verify this claim?** (Is the data/logs publicly available?)

If any answer is "no" or "I'm not sure," then it's not a real test result and should not be documented as proof.

---

**Last Updated:** 2025-11-15  
**By:** PHASE 2 Enforcement  
**Status:** Active - All system tests must comply
