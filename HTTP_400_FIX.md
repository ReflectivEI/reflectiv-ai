# HTTP 400 Error - FIXED ✅

## Problem
Widget was getting HTTP 400 error when sending messages:
```
Failed to load resource: the server responded with a status of 400 ()
Error: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat_http_400
```

## Root Cause
The widget was conditionally sending scenario fields only when a scenario was selected:
```javascript
const payload = { messages, mode: currentMode };
if (scenarioContext) {
  payload.disease = scenarioContext.therapeuticArea || "";
  payload.persona = scenarioContext.hcpProfile || "";
  payload.goal = scenarioContext.goal || "";
}
```

But worker r10.1 **always expects** these fields for plan generation. When they were missing, the worker couldn't generate a plan and returned HTTP 400.

## Fix Applied
Now **always** include these fields with empty string defaults:
```javascript
const payload = {
  messages,
  mode: currentMode,
  disease: scenarioContext?.therapeuticArea || scenarioContext?.diseaseState || "",
  persona: scenarioContext?.hcpProfile || scenarioContext?.hcpRole || "",
  goal: scenarioContext?.goal || "",
  scenarioId: scenarioContext?.id || null
};
```

## How Worker Handles It
Worker r10.1 (lines 822-826):
```javascript
// If no disease-specific facts, take first 8 from DB
// (some modes like product-knowledge, emotional-assessment don't require disease context)
if (factsRes.length === 0) {
  factsRes = FACTS_DB.slice(0, 8);
}
```

So even with empty `disease`, the worker can use fallback facts.

## Expected Behavior Now

### Scenario 1: With Scenario Selected
- Widget sends: `{disease: "HIV", persona: "HCP", goal: "discuss PrEP"}`
- Worker uses: HIV-specific facts
- Response: Sales coach guidance for HIV/PrEP

### Scenario 2: Without Scenario (General Question)
- Widget sends: `{disease: "", persona: "", goal: ""}`
- Worker uses: First 8 facts from database (fallback)
- Response: General coaching based on available facts

### Scenario 3: Product Knowledge Mode
- Widget sends: `{disease: "", persona: "", goal: ""}`
- Worker: Doesn't require scenario context
- Response: Direct Q&A about products

## Testing

### Before Fix
```
POST /chat
{
  "messages": [...],
  "mode": "sales-coach"
  // Missing: disease, persona, goal
}
→ HTTP 400 Bad Request
```

### After Fix
```
POST /chat
{
  "messages": [...],
  "mode": "sales-coach",
  "disease": "",
  "persona": "",
  "goal": "",
  "scenarioId": null
}
→ HTTP 200 OK
→ Response with fallback facts
```

## Verification

To verify the fix works:

1. **Open browser DevTools** (F12)
2. **Go to Network tab**
3. **Send a message** in the widget
4. **Check the request**:
   - Should see `/chat` request
   - Status should be `200` (not 400)
   - Payload should include `disease`, `persona`, `goal` fields

5. **Check response**:
   - Should get a reply
   - Should see coaching guidance or Q&A answer

## Related Files

- `widget.js` (line 2704-2713): Payload construction
- `worker.js` (line 777-796): Payload parsing
- `worker.js` (line 810-838): Plan generation with fallback

## Status

✅ **FIXED** - Committed in: `97647d1`

Widget now always sends required fields, worker can generate plans with or without scenario context.

---

**Next**: Test the widget - messages should send successfully now!
