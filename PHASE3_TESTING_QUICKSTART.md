# Phase 3 Hotfix - Complete Testing Setup

## Overview

You now have a complete testing setup to validate Phase 3 hotfixes across all 5 modes. The fixes address three critical issues identified in smoke tests.

## The Three Fixes

### ✅ Fix #1: EI Metadata Leak in Sales-Coach (CRITICAL)
**Lines:** 1277, 1306 in worker.js  
**What it does:** Removes `<coach>` blocks that were leaking into Sales-Coach responses  
**Test:** Run `SC-LOCAL-01` test

### ✅ Fix #2: EI Final Question Mark Requirement (MEDIUM)
**Lines:** 1025, 1391 in worker.js  
**What it does:** Enforces that EI responses end with `?`  
**Test:** Run `EI-LOCAL-01` test (should end with question mark)

### ✅ Fix #3: PK Citation Loading (MEDIUM)
**Line:** 847 in worker.js  
**What it does:** Adds product-knowledge mode to requiresFacts, ensuring PK gets citation context  
**Test:** Run `PK-LOCAL-01` test (should have [REF-CODE] citations)

## Quick Test Commands

### 1. Local Test All 5 Modes (Recommended First)
```bash
node tests/phase3_local_test.js
```
- Tests each mode with specific checks for the fixes
- Quick feedback (5 requests total)
- Expected runtime: ~20-30 seconds
- **Expected result:** All 5 tests PASS ✅

### 2. Edge Case Test Suite
```bash
PHASE3_THROTTLE_MS=3000 node tests/phase3_edge_cases.js
```
- 30 comprehensive edge case tests
- Tests input validation, context handling, structure isolation
- Expected runtime: ~2 minutes
- **Expected result:** 30/30 passing ✅

### 3. Integration Test Suite
```bash
node tests/lc_integration_tests.js
```
- 20 real integration tests for all 5 modes
- Tests actual mode functionality and contracts
- Expected runtime: ~1.5 minutes
- **Expected result:** 20/20 passing ✅

## Test Execution Sequence

For complete validation, run in this order:

```bash
# Step 1: Quick local validation (5 tests)
echo "=== STEP 1: Local Tests ==="
node tests/phase3_local_test.js
# Expected: 5/5 PASS

# Step 2: Edge cases (30 tests)
echo "=== STEP 2: Edge Case Tests ==="
PHASE3_THROTTLE_MS=3000 node tests/phase3_edge_cases.js
# Expected: 30/30 PASS

# Step 3: Integration tests (20 tests)
echo "=== STEP 3: Integration Tests ==="
node tests/lc_integration_tests.js
# Expected: 20/20 PASS (or close to it)

# If all pass:
echo "🎉 All tests passed! Ready for deployment."
git add worker.js
git commit -m "Phase 3 hotfixes: Fix EI leak, enforce EI final ?, add PK citations"
git push origin main
```

## What Each Test Validates

### Local Tests (phase3_local_test.js)

| Test | Mode | Validates | Fix # |
|------|------|-----------|-------|
| SC-LOCAL-01 | sales-coach | No <coach> blocks, 4 sections, 3+ bullets | #1 |
| RP-LOCAL-01 | role-play | First-person HCP voice, no coaching | #1 |
| EI-LOCAL-01 | emotional-assessment | **Ends with ?**, Socratic questions | **#2** |
| PK-LOCAL-01 | product-knowledge | **[REF-CODE] citations**, References | **#3** |
| GK-LOCAL-01 | general-knowledge | Natural language, no structure leaks | #1 |

### Edge Case Tests (phase3_edge_cases.js)
- INPUT-01 to INPUT-10: Input validation (empty, long, gibberish, etc.)
- CTX-01 to CTX-10: Context handling (missing persona, truncated history, etc.)
- STRUCT-01 to STRUCT-10: Structure isolation (missing sections, truncation, leakage)

### Integration Tests (lc_integration_tests.js)
- SC-01 to SC-04: Sales-Coach mode (4 tests)
- RP-01 to RP-04: Role-Play mode (4 tests)
- EI-01 to EI-04: Emotional-Assessment mode (4 tests)
- PK-01 to PK-04: Product-Knowledge mode (4 tests)
- GK-01 to GK-04: General-Knowledge mode (4 tests)

## File Structure

```
/reflectiv-ai/
├── worker.js                           # Main worker code (contains fixes)
├── tests/
│   ├── phase3_local_test.js           # ← NEW: Quick local validation
│   ├── phase3_edge_cases.js           # 30 edge case tests
│   └── lc_integration_tests.js        # 20 integration tests
├── PHASE3_LOCAL_TESTING.md            # ← NEW: Local testing guide
├── PHASE3_HOTFIX_SUMMARY.md           # ← NEW: Summary of all fixes
└── ...other files...
```

## Troubleshooting

### All tests fail with "Connection refused"
**Problem:** Cloudflare Worker is not running  
**Solution:** 
1. Check worker deployment: `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
2. If not healthy, ensure changes are pushed: `git push origin main`
3. Wait 30-60 seconds for deployment

### Local tests pass but edge cases fail
**Problem:** Edge cases might have different issues (rate limiting, etc.)  
**Solution:**
1. Increase throttle: `PHASE3_THROTTLE_MS=5000 node tests/phase3_edge_cases.js`
2. Check worker logs in Cloudflare dashboard
3. Verify facts are loaded: `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/facts`

### Specific test failing
**Solution:**
1. Look at the detailed error message
2. Find the test in the script
3. Add console logging to debug the specific check
4. Verify the corresponding worker.js line

## Success Criteria

✅ **Local tests:** 5/5 passing  
✅ **Edge cases:** 30/30 passing  
✅ **Integration tests:** 20/20 passing (or ~18/20 with rate limiting)  
✅ **Manual UI test:** All 5 modes work correctly in browser  

If all these pass, the Phase 3 hotfixes are production-ready.

## Next Steps After Testing

1. **Local tests pass?** → Continue to edge cases
2. **Edge cases pass?** → Continue to integration tests
3. **Integration tests pass?** → Manual UI testing
4. **UI testing complete?** → Production deployment

### Production Deployment
```bash
git status  # Should only show worker.js
git add worker.js
git commit -m "Phase 3 hotfixes: Verified all tests passing"
git push origin main
```

Then verify deployment:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","persona":"onc_hemonc_md_costtox","disease":"onc_md_decile10_io_adc_pathways","messages":[{"role":"user","content":"What'\''s your experience with ADCs?"}]}'
```

## Files Modified

**Only 1 file modified:** `worker.js`

**Changes:**
- Line 847: Added "product-knowledge" to requiresFacts
- Line 1025: Updated eiPrompt to enforce final ?
- Line 1277: Added SAFETY check after extractCoach()
- Line 1306: Added CRITICAL SAFETY in Sales-Coach post-processing
- Line 1391: Added EI mode final ? enforcement

**No breaking changes.** All changes are backward-compatible and defensive (adding safety checks, not removing functionality).

## Summary

You now have:
- ✅ 3 targeted hotfixes applied to worker.js
- ✅ 1 local test script (5 quick validation tests)
- ✅ 2 comprehensive test suites (30 edge cases, 20 integration tests)
- ✅ Complete documentation (this guide + detailed markdown files)

**Next action:** Run local tests to verify fixes are working!

```bash
node tests/phase3_local_test.js
```
