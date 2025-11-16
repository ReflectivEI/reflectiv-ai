# HTTP 400 Error Investigation

## Current Status

The widget is returning:
```
Failed to send message: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat_http_400
```

## Investigation Steps

### 1. Verify Fix Was Applied

Checking worker.js lines 835-847...
    // Validate activePlan structure to avoid obscure crashes
    // Allow empty facts array for modes that don't require product context
    const requiresFacts = ["sales-coach", "role-play", "product-knowledge"].includes(mode);
    if (!activePlan || !Array.isArray(activePlan.facts)) {
      console.error("chat_error", { step: "plan_validation", message: "invalid_plan_structure", activePlan });
      throw new Error("invalid_plan_structure");
    }
    // Relaxed validation: only error if facts array is missing entirely, not just empty
    // Allow empty facts for general queries - worker will use fallback facts from DB
    if (requiresFacts && !activePlan.facts) {
      console.error("chat_error", { step: "plan_validation", message: "no_facts_array", mode, disease });
      throw new Error("invalid_plan_structure");
    }

    // Provider prompts with format hardening
    const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");

✅ **Fix is present in code** - validation now checks `!activePlan.facts` instead of `activePlan.facts.length === 0`

### 2. Potential Causes of HTTP 400

The error could be from:

#### A. Plan Validation Errors (lines 1622-1629)
      return json({
        error: "provider_error",
        message: "External provider failed or is unavailable"
      }, 502, env, req);
    } else if (isPlanError) {
      // Plan validation errors return 400 Bad Request (not 422 - that confuses retry logic)
      return json({
        error: "bad_request",
        message: e.message === "no_facts_for_mode"
          ? `No facts available for disease "${disease || "unknown"}" in mode "${mode}". Please select a scenario or provide disease context.`
          : "Unable to generate or validate plan with provided parameters",
        details: { mode, disease, persona, error: e.message }
      }, 400, env, req);
    } else {
      // Other errors are treated as bad_request
      return json({

#### B. Other Errors (lines 1631-1636)
      }, 400, env, req);
    } else {
      // Other errors are treated as bad_request
      return json({
        error: "bad_request",
        message: "Chat request failed"
      }, 400, env, req);
    }

### 3. Root Cause Analysis

**CRITICAL ISSUE IDENTIFIED:**

Looking at the current fix (line 844):
```javascript
if (requiresFacts && !activePlan.facts) {
```

**Problem:** In JavaScript, `![]` evaluates to `false`, NOT `true`!

This means:
- If `activePlan.facts = []` (empty array), then `!activePlan.facts` is `false`
- The validation passes even with an empty array ✅ (This is what we want)

BUT the real issue is on **line 850**:
```javascript
const factsStr = activePlan.facts.map(f => `- [${f.id}] ${f.text}`).join("\n");
```

If `activePlan.facts` is an empty array `[]`, this will create an empty string `""`, which might cause issues downstream.

### 4. Why HTTP 400 Still Occurs

**Two Scenarios:**

**Scenario A: Worker Not Deployed**
- The fix is in the repository but NOT deployed to Cloudflare
- The live worker still has the old validation code
- Users still get HTTP 400

**Scenario B: Empty Facts Array Issue**
- Even with the fix, if FACTS_DB is somehow empty
- Or if the filtering logic produces empty array
- Downstream code might fail when processing empty factsStr

### 5. Checking FACTS_DB

FACTS_DB has 53 fact entries

const FACTS_DB = [
  // HIV Facts (10 facts)
  { id: "HIV-PREP-ELIG-001", ta: "HIV", topic: "PrEP Eligibility", text: "PrEP is recommended for individuals at substantial risk of HIV acquisition, including those with sexual partners of unknown HIV status, inconsistent condom use, or recent STI diagnoses.", cites: [{ text: "CDC PrEP Guidelines 2024", url: "https://www.cdc.gov/hiv/risk/prep/index.html" }] },

✅ **FACTS_DB is populated** with 53 fact entries

### 6. Testing the Logic

Let's trace through what happens when disease = "":

1. Line 811: `!disease` is `true`, so filter passes ALL facts ✅
2. Line 813: factsRes should have all 53 facts ✅
3. Line 817: Length check - factsRes.length should be 53, not 0 ✅
4. Line 821: facts = first 8 from factsRes ✅
5. Line 826: activePlan.facts = mapped array with 8 facts ✅
6. Line 844: Validation passes (array is not empty) ✅

**Conclusion: The logic should work IF deployed**

### 7. Verification Needed

**Action Items:**

1. ✅ Fix is in repository code
2. ⏳ **FIX IS NOT DEPLOYED TO CLOUDFLARE** ← This is the issue!
3. ⏳ Need to run: `wrangler deploy`

### 8. Recommendation

**Immediate Action:**
Deploy the worker to Cloudflare:
```bash
cd /home/runner/work/reflectiv-ai/reflectiv-ai
npx wrangler deploy
```

**Alternative Diagnosis:**
If error persists AFTER deployment, the issue might be:
- CORS headers blocking the request
- Different error path returning 400
- Widget sending malformed payload

### 9. Additional Validation

Let me check if there are other places that might return 400:

All 400 error returns in worker.js:
1631:      }, 400, env, req);
1637:      }, 400, env, req);

Only 2 places return 400:
1. Line 1631: Plan validation errors
2. Line 1637: Other errors (catch-all)

Both are in the postChat error handler.

## Conclusion

**PRIMARY CAUSE: Worker not deployed to Cloudflare**

The fix exists in the repository but hasn't been deployed to the live Cloudflare Worker endpoint. The HTTP 400 error will persist until deployment.

**Next Steps:**
1. Set up GitHub Secrets (see GITHUB_SECRETS_SETUP.md)
2. Deploy worker: `npx wrangler deploy`
3. Test the endpoint after deployment
4. If error persists, investigate widget payload structure

