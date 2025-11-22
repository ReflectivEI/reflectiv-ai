# Phase 3 Local Testing Guide

## Quick Start

### Run Local Tests Across All 5 Modes

```bash
# Default throttle (3 seconds between tests)
node tests/phase3_local_test.js

# Or with custom throttle (e.g., 4 seconds)
PHASE3_THROTTLE_MS=4000 node tests/phase3_local_test.js
```

## What Gets Tested

The local test suite validates all 5 modes with the Phase 3 hotfixes applied:

### 1. Sales-Coach (SC-LOCAL-01)
- ✅ No `<coach>` blocks in reply text
- ✅ All 4 sections present (Challenge, Rep Approach, Impact, Suggested Phrasing)
- ✅ Rep Approach has 3+ bullets
- ✅ Proper formatting and structure

### 2. Role-Play (RP-LOCAL-01)
- ✅ First-person HCP voice (uses "I", "my", "we")
- ✅ No coaching language
- ✅ No `<coach>` blocks
- ✅ Natural conversation (1-8 sentences)
- ✅ No Challenge/Rep Approach headers

### 3. Emotional-Assessment (EI-LOCAL-01)
- ✅ **Response ends with question mark** ← PHASE 3 FIX
- ✅ Contains 2+ reflective questions
- ✅ Includes EI framework keywords (pattern, trigger, emotion, etc.)
- ✅ No coaching structure
- ✅ No `<coach>` blocks

### 4. Product-Knowledge (PK-LOCAL-01)
- ✅ **Citations in [REF-CODE] format** ← PHASE 3 FIX
- ✅ References section included
- ✅ No `<coach>` blocks
- ✅ Reasonable response length (30+ words)

### 5. General-Knowledge (GK-LOCAL-01)
- ✅ Natural language response
- ✅ No structure leakage (no Challenge/Rep Approach)
- ✅ No `<coach>` blocks
- ✅ Reasonable length (40+ words)

## Expected Output

```
================================================================================
TEST: SC-LOCAL-01 - Sales-Coach: No <coach> blocks in reply
================================================================================
📤 Sending to sales-coach mode...
✅ Response received (1245 chars)

Reply preview:
Challenge: The HCP may struggle to recognize...
...

  ✅ No <coach> block in reply
  ✅ Has Challenge section
  ✅ Has Rep Approach section
  ✅ Has Impact section
  ✅ Has Suggested Phrasing section
  ✅ Has 3+ bullets

✅ TEST PASSED

... (more tests)

================================================================================
SUMMARY
================================================================================

Total Tests: 5
✅ Passed: 5
❌ Failed: 0
Pass Rate: 100.0%

🎉 ALL TESTS PASSED! Phase 3 hotfixes are working correctly.
```

## Troubleshooting

### "Connection refused" or "Worker not responding"
- Ensure the Cloudflare Worker is deployed: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
- Check if worker.js changes were pushed

### "Test FAILED: No <coach> block in reply"
- This means `<coach>` blocks are still appearing in Sales-Coach responses
- Verify lines 1277 and 1306 in worker.js are present

### "Test FAILED: Response does not end with question mark"
- This means EI response enforcement isn't working
- Verify line 1391 in worker.js is present

### "Test FAILED: No citations found in PK response"
- This means Product-Knowledge isn't getting facts
- Verify line 847 in worker.js includes "product-knowledge" in requiresFacts

## Next Steps After Local Tests Pass

1. ✅ **Local tests pass** (current step)
2. Run edge-case test suite:
   ```bash
   PHASE3_THROTTLE_MS=3000 node tests/phase3_edge_cases.js
   ```
3. Run smoke test suite twice:
   ```bash
   node tests/lc_integration_tests.js
   ```
4. Manual UI testing in browser for all 5 modes
5. Deploy to production (git push origin main)

## File Locations

- **Local test script:** `tests/phase3_local_test.js` (just created)
- **Edge case tests:** `tests/phase3_edge_cases.js`
- **Integration tests:** `tests/lc_integration_tests.js`
- **Worker code:** `worker.js`

## Test Modes Mapped to Code

| Test | Mode ID | Tests |
|------|---------|-------|
| SC-LOCAL-01 | sales-coach | 4-section format, 3+ bullets, no <coach> |
| RP-LOCAL-01 | role-play | HCP first-person, no coaching, no <coach> |
| EI-LOCAL-01 | emotional-assessment | Ends with ?, Socratic questions ← **FIX TESTED** |
| PK-LOCAL-01 | product-knowledge | Citations [REF-CODE], References ← **FIX TESTED** |
| GK-LOCAL-01 | general-knowledge | Natural language, no leakage, no <coach> |
