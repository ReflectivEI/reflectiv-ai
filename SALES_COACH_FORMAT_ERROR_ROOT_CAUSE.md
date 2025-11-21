# Sales Coach format_error Root Cause Analysis

## Issue Summary

**Error**: Sales Coach mode returning `format_error` response
```json
{
  "error": "format_error",
  "card": "sales-coach",
  "message": "Response Format Error"
}
```

**User Impact**: Users unable to get Sales Coach responses, seeing error message instead

## Root Cause Analysis

### Investigation Process

1. **Traced error source** → `worker.js` lines 1626 and 1630
2. **Identified validation logic** → `validateModeResponse()` function at line 557
3. **Examined validation requirements** → Lines 683-694
4. **Compared with prompt template** → Lines 995-1044
5. **Found schema mismatch** ← **ROOT CAUSE**

### The Problem

#### Validation Requirements (worker.js lines 689-694)
```javascript
const requiredKeys = ["scores","rationales","worked","improve","feedback","rubric_version"];
for (const k of requiredKeys) {
  if (!(k in coach)) {
    violations.push(`missing_coach_key:${k}`);
  }
}
```

The validation code expects the coach JSON block to contain these 6 keys:
- `scores` ✅
- `rationales` ✅
- `worked` ❌ **MISSING FROM PROMPT**
- `improve` ❌ **MISSING FROM PROMPT**
- `feedback` ❌ **MISSING FROM PROMPT**
- `rubric_version` ✅

#### Prompt Template (worker.js lines 1037-1042)
```javascript
<coach>{
  "scores":{"empathy":0-5,...},
  "rationales":{"empathy":"...",...},
  "tips":["Tip 1","Tip 2","Tip 3"],  // ❌ WRONG - Should be worked, improve, feedback
  "rubric_version":"v2.0"
}</coach>
```

The prompt template was asking the AI to generate a `tips` array, but the validation was looking for `worked`, `improve`, and `feedback` keys.

### Why This Caused Failures

1. **AI generates response** with `tips` key as instructed by prompt
2. **Validation checks for** `worked`, `improve`, `feedback` keys
3. **Keys not found** → Validation fails with violations
4. **Repair attempt** → Tries to fix with another AI call
5. **Repair also fails** → Same schema mismatch issue
6. **Error returned** → `format_error` sent to frontend

### Flow Diagram

```
User Request
    ↓
Worker receives request (mode: sales-coach)
    ↓
AI generates response with <coach>{"tips":[...]}</coach>
    ↓
extractCoach() extracts coach JSON
    ↓
validateModeResponse() checks for required keys
    ↓
Missing keys: "worked", "improve", "feedback"
    ↓
violations.push("missing_coach_key:worked")
violations.push("missing_coach_key:improve")
violations.push("missing_coach_key:feedback")
    ↓
Attempt repair with another AI call
    ↓
Repair still uses same prompt → Same issue
    ↓
Return format_error to frontend
    ↓
User sees error message
```

## The Fix

### Updated Prompt Template (worker.js line 1037-1044)

**Before:**
```javascript
<coach>{
  "scores":{...},
  "rationales":{...},
  "tips":["Tip 1","Tip 2","Tip 3"],
  "rubric_version":"v2.0"
}</coach>
```

**After:**
```javascript
<coach>{
  "scores":{...},
  "rationales":{...},
  "worked":["What went well in this exchange","Another positive aspect"],
  "improve":["Area for improvement","Another suggestion"],
  "feedback":"Overall feedback on the rep's approach",
  "rubric_version":"v2.0"
}</coach>
```

### Key Changes

1. **Removed**: `"tips":["Tip 1","Tip 2","Tip 3"]`
2. **Added**: 
   - `"worked":[...]` - Array of what went well
   - `"improve":[...]` - Array of areas to improve
   - `"feedback":"..."` - Overall feedback string

## Additional Issues Fixed

### config.json Mode Names

**Before:**
```json
{
  "modes": ["emotional-assessment", "product-knowledge", "sales-simulation"],
  "defaultMode": "sales-simulation"
}
```

**Issue**: Using `sales-simulation` instead of `sales-coach`

**After:**
```json
{
  "modes": ["sales-coach", "role-play", "emotional-assessment", "product-knowledge", "general-knowledge"],
  "defaultMode": "sales-coach"
}
```

**Note**: Worker already had normalization logic (lines 928-931) to handle `sales-simulation` → `sales-coach`, but it's better to use correct names in config.

## Validation Logic Review

### Current Validation (worker.js lines 644-696)

The Sales Coach validation is comprehensive and checks for:

1. **No HCP voice patterns** (lines 646-661)
   - Ensures coach isn't speaking as HCP (mode drift detection)

2. **4 required headers in order** (lines 664-672)
   - Challenge:
   - Rep Approach:
   - Impact:
   - Suggested Phrasing:

3. **Rep Approach has exactly 3 bullets** (lines 674-676)
   - Validates bullet count using regex

4. **Valid coach JSON block** (lines 678-695)
   - Must exist and be valid JSON
   - Must have all 10 EI metrics with scores 1-5
   - Must have all 6 required keys

### Metrics Required (lines 683-687)

All 10 EI dimensions must be present with valid scores:
- empathy
- clarity
- compliance
- discovery
- objection_handling
- confidence
- active_listening
- adaptability
- action_insight
- resilience

## Testing Recommendations

### Manual Test

1. **Use Sales Coach mode**
2. **Ask a question** (e.g., "How should I discuss PrEP with an HCP?")
3. **Verify response includes**:
   - Challenge section
   - Rep Approach with 3 bullets
   - Impact section
   - Suggested Phrasing section
   - No format_error

### Automated Test

```javascript
// Test that coach block has correct schema
const response = await fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat', {
  method: 'POST',
  headers: {'Content-Type': 'application/json'},
  body: JSON.stringify({
    mode: 'sales-coach',
    messages: [{role: 'user', content: 'How should I discuss PrEP?'}]
  })
});

const data = await response.json();
assert(!data.error, 'Should not return format_error');
assert(data.coach, 'Should have coach block');
assert(data.coach.worked, 'Coach should have worked array');
assert(data.coach.improve, 'Coach should have improve array');
assert(data.coach.feedback, 'Coach should have feedback string');
```

## Impact Assessment

### Before Fix
- ❌ Sales Coach mode non-functional
- ❌ All requests returning format_error
- ❌ Users unable to get coaching responses
- ❌ Schema mismatch between prompt and validation

### After Fix
- ✅ Sales Coach mode functional
- ✅ Responses pass validation
- ✅ Users get properly formatted coaching responses
- ✅ Schema aligned between prompt and validation

## Related Systems

### Other Modes Status

| Mode | Status | Notes |
|------|--------|-------|
| sales-coach | ✅ FIXED | Was broken, now fixed |
| role-play | ✅ OK | Not affected by coach block schema |
| emotional-assessment | ✅ OK | Uses different validation |
| product-knowledge | ✅ OK | No coach block required |
| general-knowledge | ✅ OK | No strict validation |

## Lessons Learned

1. **Schema Validation Must Match Prompts**: Always ensure validation logic and prompt templates are in sync
2. **Test All Code Paths**: The validation → repair → re-validation path needs testing
3. **Document Schema Requirements**: Clearly document what the AI should generate
4. **Version Control for Schemas**: Consider using schema version numbers to detect mismatches

## Prevention

### Recommendations

1. **Add Schema Tests**: Create unit tests that verify prompt template matches validation requirements
2. **Documentation**: Keep a single source of truth for coach block schema
3. **Code Review Checklist**: Include "prompt-validation alignment" in code reviews
4. **Monitoring**: Log when repair attempts fail to catch issues early

## Files Changed

- `worker.js` - Fixed salesContract prompt template (line 1037-1044)
- `config.json` - Fixed mode names (sales-simulation → sales-coach, added all 5 modes)
- `COMPREHENSIVE_CODE_AUDIT.md` - Added comprehensive audit documentation

## Conclusion

**Root Cause**: Schema mismatch between AI prompt template and validation logic

**Fix**: Updated prompt template to generate `worked`, `improve`, and `feedback` keys instead of `tips`

**Result**: Sales Coach mode now generates properly formatted responses that pass validation

**Status**: ✅ RESOLVED

---

**Analysis Date**: 2025-11-21
**Severity**: HIGH (Complete mode failure)
**Resolution Time**: Same day
**Affected Users**: All Sales Coach mode users
**Fix Verified**: ✅ Yes
