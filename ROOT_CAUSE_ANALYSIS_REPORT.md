# Root Cause Analysis and Resolution Report

## Executive Summary

**Date:** November 16, 2025  
**Issue:** Widget automated tests failing - EI pills not displaying, modal not opening, General Assistant mode timeout  
**Status:** Root cause identified and fixed, pending deployment verification

---

## Root Cause

### The Problem

The widget's `callModel()` function was treating the worker's JSON response as plain text, causing the loss of critical coach data including EI scores.

**Worker Response Format:**
```json
{
  "reply": "The clean response text",
  "coach": {
    "scores": { "empathy": 4, "clarity": 5, ... },
    "worked": [...],
    "improve": [...],
    "phrasing": "..."
  },
  "plan": { "id": "..." }
}
```

**Widget Behavior (BEFORE FIX):**
```javascript
// widget.js line 2730-2738 (old)
const text = await r.text();  // Gets entire JSON as string
return text;  // Returns JSON string instead of parsed data
```

This caused the widget to:
1. Receive `"{"reply":"...","coach":{...}}"` as a string
2. Try to extract `<coach>` tags from the string (which don't exist in JSON)
3. Lose all coach data including EI scores
4. Render messages without EI pills

---

## Failed Tests Analysis

### Test 1: 10 EI Pills Not Present (0 found, expected 10)

**Root Cause:** Coach data with scores was not extracted from JSON response  
**Impact:** `renderEiPanel()` returned empty string because `msg._coach.scores` was undefined  
**Fix Applied:** Parse JSON response and extract coach data separately

### Test 2: Pills Missing Gradient Backgrounds

**Root Cause:** No pills were rendered (see Test 1)  
**Impact:** No gradients to check  
**Fix Applied:** Will be resolved once pills render correctly

### Test 3: Modal Not Opening on Pill Click

**Root Cause:** No pills were rendered (see Test 1)  
**Impact:** Nothing to click  
**Fix Applied:** Will be resolved once pills render correctly

### Test 4: General Assistant Mode Timeout

**Root Cause:** Possibly related to JSON parsing issue, needs further investigation  
**Impact:** Test times out waiting for response  
**Status:** May be resolved by fix, or may need separate investigation

---

## The Fix

### Changed Files
- `widget.js` - Modified `callModel()` and `sendMessage()` functions

### Code Changes

#### 1. Modified `callModel()` to Parse JSON Response (Lines 2724-2751)

**BEFORE:**
```javascript
const text = await r.text();
// ... telemetry ...
return text;
```

**AFTER:**
```javascript
const text = await r.text();
// ... telemetry ...

// Parse JSON response from worker and extract reply
// Worker returns: { reply, coach, plan }
try {
  const jsonResponse = JSON.parse(text);
  if (jsonResponse.reply !== undefined) {
    // Store coach data globally so it can be retrieved later
    window._lastCoachData = jsonResponse.coach || null;
    return jsonResponse.reply;
  }
} catch (e) {
  // If not JSON or doesn't have reply field, treat as legacy plain text
  console.warn('[callModel] Response is not JSON or missing reply field, treating as plain text');
}

return text;
```

**Rationale:**
- Maintains backward compatibility with legacy plain text responses
- Extracts coach data separately from reply text
- Uses global storage to pass coach data to sendMessage

#### 2. Modified `sendMessage()` to Use Coach Data (Lines 3132-3191)

**BEFORE:**
```javascript
let raw = await callModel(messages, sc);
let { coach, clean } = extractCoach(raw);
```

**AFTER:**
```javascript
let raw = await callModel(messages, sc);

// Get coach data from global storage (set by callModel when parsing JSON response)
let coachFromWorker = window._lastCoachData || null;
window._lastCoachData = null; // Clear after use

// Use coach data from worker if available, otherwise extract from raw text (legacy)
let coach = coachFromWorker;
let clean = raw;

// If no coach data from worker, try extracting from raw text (legacy behavior)
if (!coach) {
  const extracted = extractCoach(raw);
  coach = extracted.coach;
  clean = extracted.clean;
}
```

**Rationale:**
- Prioritizes coach data from worker JSON response
- Falls back to legacy text extraction if needed
- Maintains compatibility with both response formats

---

## Testing Plan

### Unit Tests
- [x] Verified JSON parsing logic works correctly
- [x] Verified syntax is valid (node -c widget.js)
- [ ] Need to test with actual worker responses

### Integration Tests
- [ ] Deploy to test environment
- [ ] Run automated test suite (automated-test.cjs)
- [ ] Verify EI pills render with correct scores
- [ ] Verify gradient backgrounds appear on pills
- [ ] Verify modal opens when clicking pills
- [ ] Verify General Assistant mode works without timeout

### Manual Tests
- [ ] Test Sales Coach mode with HCP objection
- [ ] Verify EI pills display all 10 metrics
- [ ] Click each pill type and verify modal content
- [ ] Test mode switching between all 5 modes
- [ ] Test with various message types and scenarios

---

## Deployment Notes

### Files Modified
- `widget.js` (lines 2724-2751, 3132-3191)

### Deployment Steps
1. Commit changes to branch
2. Push to GitHub
3. Deploy to production (GitHub Pages auto-deploys from main)
4. Run automated tests against production
5. Monitor for any regressions

### Rollback Plan
If issues occur:
1. Revert commit 22424cc
2. Re-deploy previous version
3. Investigate further

---

## Additional Notes

### Backward Compatibility
The fix maintains backward compatibility:
- If worker returns JSON with `reply` field → uses new parsing
- If worker returns plain text → falls back to legacy extraction
- If JSON parsing fails → treats as plain text

### Performance Impact
Minimal - adds one JSON.parse() call per response, which is negligible.

### Future Improvements
Consider:
1. Making the response format consistent (always JSON)
2. Removing legacy text extraction code once all workers use JSON
3. Adding proper TypeScript types for response structure
4. Adding response validation/schema checking

---

## Conclusion

The root cause was a simple but critical oversight: the widget was not parsing the worker's JSON response format. The fix is straightforward and maintains backward compatibility while enabling proper extraction of coach data and EI scores.

All failing tests should be resolved once this fix is deployed and the widget can properly access the coach data from the worker's JSON response.
