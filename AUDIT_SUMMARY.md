# PRs #2 & #3 Audit Summary - Quick Reference

**Date:** 2025-11-02  
**Status:** ⚠️ **Minor tweaks needed - Not ready for production merge**

---

## PR #2: Fix Suggested Phrasing Rendering

### ✅ Working
- Four sections render in correct order: Challenge → Rep Approach → Impact → Suggested Phrasing
- All sections have proper fallback values
- No DOM or console errors

### ❌ Missing
- No specific retry logic when Suggested Phrasing is missing from response

---

## PR #3: Profile and Speed Up First Reply

### ✅ Working
- AbortController implemented (but timeout too long)
- Retry logic exists (but timing incorrect)
- Comprehensive error handling
- Proper fallbacks

### ❌ Critical Issues
1. **CSP URL Mismatch** 🚨
   - config.json: `my-chat-agent.tonyabdelmalak.workers.dev`
   - CSP allows: `my-chat-agent-v2.tonyabdelmalak.workers.dev`
   - **Result: All API calls will be blocked!**

2. **Timeout Wrong** 🚨
   - Required: 10 seconds
   - Actual: 45 seconds
   - **Impact: Users wait too long before errors**

3. **Missing 429 Handling** 🚨
   - Only retries on 5xx, timeout, NetworkError
   - Does not retry on HTTP 429 (Too Many Requests)

### ❌ Important Missing Features
4. **No EventSource Streaming**
   - Config flag is sent but streaming not implemented
   - Always uses JSON, never handles SSE

5. **No Typing Indicator**
   - No visual feedback while waiting for response
   - Requirement: show within 100-300ms

6. **No Retry Button**
   - No user recovery option after failures
   - Requirement: show after 8s of silence

7. **Incorrect Backoff Timing**
   - Current: 400ms → 800ms → 1600ms
   - Required: 300ms → 800ms → 1500ms

---

## Fix Priority

### 🔴 Critical (Must Fix Before Merge)
1. Fix CSP URL mismatch
2. Change timeout to 10 seconds
3. Add HTTP 429 to retry logic

### 🟡 Important (Should Fix Before Merge)
4. Implement EventSource streaming when enabled
5. Add typing indicator
6. Add retry button after 8s
7. Fix backoff timing to 300→800→1500ms
8. Add Suggested Phrasing retry

### 🟢 Nice to Have
9. Add test coverage
10. Split widget.js into modules (currently 1748 lines)

---

## Verdict

**⚠️ Not ready for production**

Fix critical issues (#1-3) first, then address important features (#4-8) before merging.

See `AUDIT_REPORT_PR2_PR3.md` for detailed analysis and recommendations.
