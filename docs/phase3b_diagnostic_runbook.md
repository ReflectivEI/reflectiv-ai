# Phase 3B: Diagnostic Runbook for ReflectivAI Widget
## Repository: ReflectivEI/reflectiv-ai
## Date: 2025-11-06

---

## EXECUTIVE SUMMARY

This runbook provides step-by-step procedures to diagnose ReflectivAI widget failures using the diagnostic logging added in Phase 3A (commit db6c72b). It enables distinguishing between three primary failure scenarios:
1. **Script/Worker/Network Failure** - widget.js never executes
2. **Init Success but UI Failure** - init() completes but DOM never appears
3. **UI Success but API Failure** - Widget renders but can't communicate with backend

---

## PREREQUISITES

### Required Tools
- Modern browser (Chrome, Firefox, Edge, Safari)
- Developer Tools (F12 or Cmd+Option+I)
- Text editor for recording findings

### Required Knowledge
- Basic understanding of browser DevTools (Console, Network, Elements tabs)
- Ability to edit JavaScript files temporarily
- Understanding of HTTP status codes

### Preparation Steps

1. **Enable Debug Logging**
   - Open `/home/runner/work/reflectiv-ai/reflectiv-ai/widget.js`
   - Find line 19: `const DEBUG_WIDGET = false;`
   - Change to: `const DEBUG_WIDGET = true;`
   - Save the file
   - Deploy or refresh local server

2. **Open Developer Tools**
   - Open the page: `https://reflectivei.github.io/reflectiv-ai/` (or local URL)
   - Press F12 (or Cmd+Option+I on Mac)
   - Navigate to **Console** tab
   - Enable "Preserve log" (checkbox in console toolbar)
   - Set filter to "All levels" (show Verbose, Debug, Info, Warn, Error)

3. **Prepare Network Monitoring**
   - Switch to **Network** tab
   - Enable "Preserve log"
   - Enable "Disable cache" (while DevTools is open)
   - Clear any existing requests

4. **Create Log Template**
   ```
   Test Date: _______________
   Browser: _________________
   URL: _____________________
   Widget Version: __________
   
   Scenario Detected: [ ] Script Failure  [ ] UI Failure  [ ] API Failure
   
   Logs:
   ```

---

## SCENARIO 1: Script / Worker / Network Failure

### Description
`widget.js` never executes or aborts very early. No `[ReflectivWidget]` logs appear in console.

### Diagnostic Procedure

#### Step 1.1: Verify Script Loading
**Action:** Reload page (F5), immediately check Console tab

**Expected Output (Success):**
```
[ReflectivWidget] waitForMount: Searching for mount element
[ReflectivWidget] waitForMount: Mount element found
[ReflectivWidget] init: Starting initialization
```

**Failure Indicators:**
- ❌ **ZERO** `[ReflectivWidget]` messages appear
- ❌ Console may show: `Failed to load resource: net::ERR_NAME_NOT_RESOLVED`
- ❌ Console may show: `Uncaught SyntaxError: Unexpected token`

**Diagnosis:**
If no `[ReflectivWidget]` logs appear, widget.js never executed.

#### Step 1.2: Check Network Tab for widget.js
**Action:** Switch to Network tab, filter by "JS"

**Look for:** `widget.js?v=20251025-1045` (or current version)

**Possible Outcomes:**

| Status | Interpretation | Next Action |
|--------|----------------|-------------|
| **200 OK** | Script loaded successfully | Go to Step 1.3 |
| **404 Not Found** | Worker routing failure | Document: Hypothesis 1 confirmed |
| **403 Forbidden** | Worker version validation | Document: Hypothesis 1 confirmed |
| **304 Not Modified** | Serving cached version | Go to Step 1.4 |
| **500/502/503** | Worker/CDN error | Document: Worker deployment issue |
| **(failed) net::ERR_** | Network/DNS failure | Document: Network connectivity issue |
| **No request appears** | Script tag missing/incorrect | Document: HTML structure issue |

#### Step 1.3: Verify Script Content (200 OK case)
**Action:** In Network tab, click on `widget.js?v=...` request

**Check Response Preview:**
- Should start with: `/* widget.js`
- Should contain: `const DEBUG_WIDGET =`
- Should be ~2200 lines long

**Failure Indicators:**
- ❌ Response is HTML error page (e.g., "404 Page Not Found")
- ❌ Response is empty or incomplete
- ❌ Response contains syntax errors

**If script content is corrupt:**
```
DIAGNOSIS: CDN serving wrong content or incomplete transfer
ACTION: Check CF-Cache-Status header for cache behavior
```

#### Step 1.4: Check Cache Headers (304 case)
**Action:** In Network tab, click widget.js request → Headers tab

**Examine Response Headers:**
```
Status Code: 304 Not Modified
Cache-Control: _______________
CF-Cache-Status: _____________ (HIT/MISS/DYNAMIC)
ETag: _______________________
Age: ________________________
```

**Diagnosis:**
- If `CF-Cache-Status: HIT` and widget doesn't work → **CDN serving stale cached version**
- If `Age: 3600` (1 hour old) → Cache not respecting version query parameter

**Remediation Test:**
1. Hard refresh: Ctrl+Shift+R (Cmd+Shift+R on Mac)
2. Check if status changes to 200 OK
3. Check if widget appears

If hard refresh fixes it: **Cache-Control headers misconfigured** (Hypothesis 2)

#### Step 1.5: Check for JavaScript Errors
**Action:** Look for red error messages in Console

**Common Errors:**

**Error Type 1: Syntax Error**
```
Uncaught SyntaxError: Unexpected token '<' in JSON at position 0
    at widget.js:1
```
**Diagnosis:** Script request returned HTML instead of JavaScript (Worker routing issue)

**Error Type 2: Content Security Policy**
```
Refused to execute inline script because it violates the following 
Content Security Policy directive: "script-src 'self'"
```
**Diagnosis:** CSP blocking script execution (should not happen with current CSP)

**Error Type 3: CORS Error**
```
Access to fetch at 'https://...' from origin 'https://...' has been 
blocked by CORS policy
```
**Diagnosis:** Cross-origin restriction on resource loading

#### Step 1.6: Verify Script Tag in HTML
**Action:** Switch to Elements tab, use Find (Ctrl+F), search for: `widget.js`

**Expected HTML:**
```html
<script src="assets/chat/ei-context.js?v=1"></script>
<script defer src="widget.js?v=20251025-1045"></script>
```

**Check:**
- ✅ `defer` attribute present
- ✅ Path is correct (`widget.js` not `./widget.js` or `/widget.js`)
- ✅ Query parameter matches deployed version
- ✅ Script tag is properly closed

**Common Issues:**
- ❌ Script tag is `<script src="widget.js">` (no version query)
- ❌ Script tag is `<script async>` instead of `defer`
- ❌ Path is absolute `/widget.js` causing 404

### Summary: Scenario 1 Decision Tree

```
No [ReflectivWidget] logs appear
    ↓
Check Network tab for widget.js
    ↓
    ├─→ 404/403 → Worker routing issue (Hypothesis 1)
    ├─→ 500/502 → Worker deployment failure
    ├─→ 304 + no logs → Cached corrupt version (Hypothesis 2)
    ├─→ 200 + no logs → Check script content
    │       ↓
    │       ├─→ Content is HTML → Worker routing issue
    │       ├─→ Content incomplete → CDN truncation
    │       └─→ Content correct → Check for JS errors
    │               ↓
    │               ├─→ SyntaxError → Script corruption
    │               ├─→ CSP error → Policy too restrictive
    │               └─→ No errors → Check script tag in HTML
    │                       ↓
    │                       ├─→ Tag missing → HTML editing required
    │                       ├─→ Tag wrong path → HTML editing required
    │                       └─→ Tag correct → Unknown failure (escalate)
    └─→ No request → Script tag missing from HTML
```

### Output for Scenario 1

**Document the following:**
1. Exact error message (copy/paste from console)
2. widget.js HTTP status code and response size
3. Cache headers (Cache-Control, CF-Cache-Status, ETag, Age)
4. Screenshot of Network tab showing widget.js request
5. Screenshot of Console showing error (if any)

**Confirmed Hypothesis:**
- [ ] Hypothesis 1: Worker version validation
- [ ] Hypothesis 2: CDN cache key collision
- [ ] Hypothesis 3: Browser cache issue
- [ ] Other: _________________

---

## SCENARIO 2: Init Success but UI Failure

### Description
`widget.js` executes and init() runs, but buildUI() fails or the widget DOM never materializes. Console shows init-related `[ReflectivWidget]` logs but no UI appears.

### Diagnostic Procedure

#### Step 2.1: Confirm Init Executed
**Action:** Check Console for init logs

**Expected Output:**
```
[ReflectivWidget] waitForMount: Searching for mount element
[ReflectivWidget] waitForMount: Mount element found
[ReflectivWidget] init: Starting initialization
[ReflectivWidget] init: Config loaded from ./assets/chat/config.json
[ReflectivWidget] init: system.md loaded (5234 chars)
[ReflectivWidget] init: about-ei.md loaded (7012 chars)
[ReflectivWidget] loadScenarios: Loaded 42 scenarios from assets/chat/data/scenarios.merged.json
[ReflectivWidget] init: Scenarios loaded (42 scenarios)
[ReflectivWidget] buildUI: Starting UI construction
```

**Success Criteria:**
- ✅ All init logs appear
- ✅ No "load failed" error messages
- ✅ Scenarios count > 0

**If init logs appear but stop before "buildUI: Starting UI construction":**
→ **Go to Step 2.2**

**If "buildUI: Starting UI construction" appears:**
→ **Go to Step 2.3**

#### Step 2.2: Diagnose Init Failure
**Action:** Review console for error messages between init start and expected buildUI

**Common Patterns:**

**Pattern A: Config Load Failure**
```
[ReflectivWidget] init: Starting initialization
[ReflectivWidget] init: Config load failed, using defaults Error: Failed to load ./assets/chat/config.json (404)
config load failed: Error: Failed to load ./assets/chat/config.json (404)
```
**Diagnosis:** config.json not found, widget continues with defaults
**Impact:** PARTIAL - Widget may load but API endpoint may be wrong
**Action:** Check Network tab for `config.json` status (should be 200)

**Pattern B: Scenarios Load Failure**
```
[ReflectivWidget] loadScenarios: Failed to load scenarios Error: Failed to load assets/chat/data/scenarios.merged.json (404)
scenarios load failed: Error: ...
[ReflectivWidget] loadScenarios: WARNING - scenarios array is empty, dropdowns will be unavailable
[ReflectivWidget] init: Scenarios loaded (0 scenarios)
```
**Diagnosis:** Scenarios file missing, dropdowns will be empty
**Impact:** MEDIUM - Widget loads but Sales Simulation/Role Play won't work
**Action:** Check Network tab for `scenarios.merged.json` status

**Pattern C: Exception Before buildUI()**
```
[ReflectivWidget] init: Scenarios loaded (42 scenarios)
Uncaught TypeError: Cannot read property 'appendChild' of null
    at buildUI (widget.js:1074)
    at init (widget.js:2190)
```
**Diagnosis:** buildUI() was called but threw exception immediately
**Impact:** CRITICAL - Widget never renders
**Action:** Go to Step 2.3

#### Step 2.3: Diagnose buildUI() Failure
**Action:** Look for "buildUI: Starting UI construction" log

**Case A: Log appears but no "buildUI: UI construction complete"**
```
[ReflectivWidget] buildUI: Starting UI construction
Uncaught TypeError: Cannot set property 'innerHTML' of null
    at buildUI (widget.js:904)
```
**Diagnosis:** Exception inside buildUI() before completion
**Impact:** CRITICAL - Widget partially or not rendered

**Check Exception Location:**
- Lines 904-905: `mount.innerHTML = ""` → mount element became null
- Lines 910-927: CSS injection → document.head is null or appendChild failed
- Lines 930-1074: DOM construction → malformed HTML or element creation failed

**Case B: Both logs appear**
```
[ReflectivWidget] buildUI: Starting UI construction
[ReflectivWidget] buildUI: UI construction complete
```
**Diagnosis:** buildUI() completed successfully
**Action:** Go to Step 2.4

#### Step 2.4: Verify DOM Presence
**Action:** Switch to Elements tab, use Find (Ctrl+F), search for: `reflectiv-chat`

**Expected Structure:**
```html
<div id="reflectiv-widget" class="reflectiv-widget cw">
  <div class="reflectiv-chat">
    <div class="chat-toolbar">...</div>
    <div class="scenario-meta"></div>
    <div class="chat-messages">...</div>
    <div class="chat-input">
      <textarea placeholder="Type your message…"></textarea>
      <button class="btn">Send</button>
    </div>
    <div class="coach-section">...</div>
  </div>
</div>
```

**Diagnostic Checks:**

**Check 1: Does `#reflectiv-widget` exist?**
- ❌ Not found → HTML structure missing (should be impossible, see Step 1.6)
- ✅ Found → Continue to Check 2

**Check 2: Does `#reflectiv-widget` have class `cw`?**
- ❌ No class `cw` → buildUI() never ran (line 905 failed)
- ✅ Has class `cw` → Continue to Check 3

**Check 3: Does `.reflectiv-chat` child exist?**
- ❌ Not found → buildUI() cleared mount but never added content
- ✅ Found → Continue to Check 4

**Check 4: Are all 5 child divs present?**
(chat-toolbar, scenario-meta, chat-messages, chat-input, coach-section)
- ❌ Missing some → buildUI() threw exception mid-construction
- ✅ All 5 present → Continue to Step 2.5

#### Step 2.5: Check CSS Visibility
**Action:** In Elements tab, click on `<div class="reflectiv-chat">`

**Check Computed Styles (Styles panel, "Computed" sub-tab):**
```
display: __________ (should be "flex")
visibility: _______ (should be "visible")
opacity: __________ (should be "1")
position: _________ (should be "static" or "relative")
```

**Check Parent Modal:**
Find `<div id="coachModal">`

**Check Computed Styles:**
```
display: __________ (should be "flex" when open, "none" when closed)
```

**Common Issues:**

**Issue 1: Modal Not Open**
```html
<div id="coachModal" class="modal" aria-hidden="true">
  <!-- class does NOT include "open" -->
```
**Diagnosis:** Modal exists and widget mounted, but modal is closed
**Impact:** Widget is hidden, not broken
**Test:** Click "Try a Simulation" button on page
**Expected:** Modal should open and widget becomes visible

**Issue 2: CSS Override**
```css
.reflectiv-widget { display: none !important; }
/* OR */
#coachModal { display: none !important; }
```
**Diagnosis:** External stylesheet hiding widget
**Impact:** Widget fully functional but invisible
**Test:** In Console, type:
```javascript
document.querySelector('.reflectiv-chat').style.display = 'flex'
```
If widget appears → External CSS issue

**Issue 3: Inline Style Injection Failed**
In Elements tab, look for:
```html
<style id="reflectiv-widget-inline-style">
  #reflectiv-widget .reflectiv-chat { ... }
</style>
```
- ❌ Not found in `<head>` → CSS injection failed (line 908-927)
- ✅ Found → Widget should be styled correctly

#### Step 2.6: Check for Late-Appearing Errors
**Action:** Wait 30 seconds, check Console for any new errors

**Delayed Errors:**
```
[ReflectivWidget] waitForMount: 15-second timeout expired, mount element not found
```
**Diagnosis:** MutationObserver timeout (should never happen with static HTML)
**Impact:** Widget gave up searching for mount point

### Summary: Scenario 2 Decision Tree

```
[ReflectivWidget] init logs appear
    ↓
Check for "buildUI: Starting UI construction"
    ↓
    ├─→ Not present → Check for exception between init and buildUI
    │       ↓
    │       ├─→ TypeError at buildUI call → mount is null
    │       ├─→ Config/scenarios load errors → Partial data loaded
    │       └─→ No exception → Unknown (init() never called buildUI?)
    │
    └─→ Present → Check for "buildUI: UI construction complete"
            ↓
            ├─→ Not present → Exception inside buildUI()
            │       ↓
            │       └─→ Check line number in stack trace
            │
            └─→ Present → buildUI() succeeded
                    ↓
                    Check Elements tab for .reflectiv-chat
                    ↓
                    ├─→ Not found → DOM cleared or removed
                    ├─→ Found but not visible → Check CSS
                    │       ↓
                    │       ├─→ Modal closed → Click "Try a Simulation"
                    │       ├─→ display:none → External CSS issue
                    │       └─→ Inline style missing → CSS injection failed
                    └─→ Found and visible → Widget should be working!
```

### Output for Scenario 2

**Document the following:**
1. Last `[ReflectivWidget]` log before failure
2. First error message after last successful log
3. Exception stack trace (full text)
4. Screenshot of Elements tab showing widget DOM structure
5. Screenshot of Computed styles for `.reflectiv-chat`
6. Modal state (open/closed, classes present)

**Root Cause:**
- [ ] config.json load failed (partial function)
- [ ] scenarios.json load failed (partial function)
- [ ] Exception in buildUI() (critical)
- [ ] CSS injection failed (visual issue)
- [ ] Modal not opened (user action required)
- [ ] External CSS hiding widget (styling conflict)
- [ ] Other: _________________

---

## SCENARIO 3: UI Success but API Failure

### Description
Widget renders correctly, user can see and interact with the chat interface, but API calls fail or return empty responses. Console shows buildUI completion and no structural errors.

### Diagnostic Procedure

#### Step 3.1: Confirm UI is Functional
**Action:** Check Console and Elements tab

**Expected Console Logs:**
```
[ReflectivWidget] waitForMount: Mount element found
[ReflectivWidget] init: Starting initialization
[ReflectivWidget] init: Config loaded from ./assets/chat/config.json
[ReflectivWidget] init: system.md loaded (5234 chars)
[ReflectivWidget] init: about-ei.md loaded (7012 chars)
[ReflectivWidget] init: Scenarios loaded (42 scenarios)
[ReflectivWidget] buildUI: Starting UI construction
[ReflectivWidget] buildUI: UI construction complete
```

**Expected Visual State:**
- ✅ Modal is open (if you clicked "Try a Simulation")
- ✅ Chat interface visible with textarea and Send button
- ✅ Mode selector dropdowns populated
- ✅ No JavaScript errors in console

**If above criteria met:** Widget UI is functional, proceed to API diagnostics.

#### Step 3.2: Verify API Endpoint Configuration
**Action:** In Console tab, type:
```javascript
fetch('./assets/chat/config.json').then(r => r.json()).then(cfg => {
  console.log('API Base:', cfg.apiBase || cfg.workerUrl);
  console.log('Stream enabled:', cfg.stream);
  console.log('Model:', cfg.model);
})
```

**Expected Output:**
```
API Base: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
Stream enabled: false
Model: llama-3.1-8b-instant
```

**Check API Base:**
- ❌ `undefined` or empty → No API endpoint configured
- ❌ Incorrect URL → Wrong Worker endpoint
- ✅ Valid HTTPS URL → Endpoint configured

**If API Base is undefined:**
```
DIAGNOSIS: Config load failed or config.json missing apiBase/workerUrl
ACTION: Check [ReflectivWidget] init logs for config load errors
```

#### Step 3.3: Test Message Sending
**Action:** In widget interface:
1. Type a test message: `Hello`
2. Click Send (or press Enter)
3. Immediately switch to Console tab

**Expected Console Logs:**
```
[ReflectivWidget] logs (if user is sending multiple times rapidly)
OR
(No special logs if first send)
```

**Look for:**
- `[ReflectivWidget] sendMessage: Message ignored, already sending` → Indicates concurrent send attempt (normal if spamming)
- `[ReflectivWidget] callModel: Retry attempt 1/3` → API call failed, retrying
- `[ReflectivWidget] callModel: HTTP 429, will retry after 300ms` → Rate limited
- `[ReflectivWidget] sendMessage: callModel returned empty response, using fallback for mode: sales-simulation` → API returned nothing

#### Step 3.4: Monitor Network Activity
**Action:** Switch to Network tab, filter by "Fetch/XHR"

**Look for Request to Worker:**
```
Name: chat (or similar endpoint)
Status: _______
Type: fetch
Size: _______
Time: _______
```

**Analyze Request:**

**Status 200 OK:**
```
DIAGNOSIS: API call succeeded
ACTION: Go to Step 3.5 (check response content)
```

**Status 404 Not Found:**
```
DIAGNOSIS: Worker endpoint wrong or Worker not deployed
ACTION: Check config.json apiBase matches actual Worker URL
```

**Status 403 Forbidden:**
```
DIAGNOSIS: Worker rejecting request (authentication/authorization)
ACTION: Check Worker logs if accessible
```

**Status 429 Too Many Requests:**
```
DIAGNOSIS: Rate limiting by Worker or Cloudflare
ACTION: Wait 60 seconds and retry
```

**Status 500/502/503:**
```
DIAGNOSIS: Worker runtime error or Cloudflare issue
ACTION: Check Worker deployment status
```

**Status (failed) net::ERR_NAME_NOT_RESOLVED:**
```
DIAGNOSIS: DNS failure for Worker URL
ACTION: Verify Worker domain is correct and resolves
```

**Status (pending) - Request hangs:**
```
DIAGNOSIS: Request timeout or Worker not responding
ACTION: Go to Step 3.6
```

**No request appears:**
```
DIAGNOSIS: API call not being made at all
ACTION: Check if config.apiBase is empty (Step 3.2)
```

#### Step 3.5: Inspect API Response
**Action:** In Network tab, click on the chat request

**Headers Tab - Check Request:**
```
Request URL: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
Request Method: POST
Status Code: 200 OK
```

**Preview Tab - Check Response Structure:**

**Valid Response:**
```json
{
  "content": "Here is my response...",
  "reply": "Alternative response...",
  "choices": [
    {
      "message": {
        "content": "Another format..."
      }
    }
  ]
}
```
Widget looks for `content`, `reply`, or `choices[0].message.content` (see widget.js lines 1641-1645).

**Invalid Response Patterns:**

**Pattern 1: Empty Response**
```json
{}
```
**Diagnosis:** Worker returned success but no content
**Impact:** Widget shows fallback text
**Console Log:** `[ReflectivWidget] sendMessage: callModel returned empty response, using fallback for mode: sales-simulation`

**Pattern 2: Error Response**
```json
{
  "error": "Model timeout",
  "status": "failed"
}
```
**Diagnosis:** Worker encountered an error but returned 200
**Impact:** Widget treats as empty response, shows fallback

**Pattern 3: HTML Response**
```html
<!DOCTYPE html>
<html>
  <body>Error 404</body>
</html>
```
**Diagnosis:** Worker routing failed, served HTML error page
**Impact:** JSON parse fails, widget shows fallback or errors

#### Step 3.6: Diagnose Timeout Issues
**Action:** Check Console for retry logs

**Expected Pattern (Normal Retry):**
```
[ReflectivWidget] callModel: Retry attempt 1/3
[ReflectivWidget] callModel: timeout, will retry after 300ms
[ReflectivWidget] callModel: Retry attempt 2/3
[ReflectivWidget] callModel: timeout, will retry after 800ms
[ReflectivWidget] callModel: Retry attempt 3/3
[ReflectivWidget] callModel: timeout, will retry after 1500ms
[ReflectivWidget] callModel: Failed after 4 attempts Error: timeout
Model call failed: Error: timeout
```

**Timing Analysis:**
- First attempt: 0s
- Retry 1: +300ms = 0.3s
- Retry 2: +800ms = 1.1s
- Retry 3: +1500ms = 2.6s
- Total: ~2.6s + (4 × 10s timeout) = ~42.6s

**If you see this pattern:**
```
DIAGNOSIS: Worker not responding within 10-second timeout
IMPACT: User sees retry UI after 8 seconds total elapsed
ACTION: Check Worker logs for slow processing
```

**Check Network Tab:**
Look at timing for the chat request:
- **Waiting (TTFB):** > 10s → Worker processing is slow
- **Downloading:** > 1s → Response is very large
- **Stalled:** > 5s → Connection queuing issue

#### Step 3.7: Test with Sample Message
**Action:** Use the following test messages to isolate issues:

**Test 1: Minimal Message**
```
Hi
```
**Expected:** Quick response (< 3 seconds)
**If fails:** Basic Worker functionality broken

**Test 2: Mode-Specific Message**
```
Tell me about PrEP
```
**Expected:** Product knowledge response with references
**If fails:** Mode detection or prompt construction issue

**Test 3: Trigger Fallback**
Clear conversation, send:
```
(Just press Send with empty message)
```
**Expected:** Message should be rejected (length 0)
**Console:** No logs (empty messages are ignored at line 1863)

#### Step 3.8: Check CORS Headers
**Action:** In Network tab, click chat request → Headers

**Check Response Headers:**
```
Access-Control-Allow-Origin: *
OR
Access-Control-Allow-Origin: https://reflectivei.github.io
```

**If missing or wrong origin:**
```
DIAGNOSIS: CORS policy blocking response
Console shows: Access to fetch at '...' has been blocked by CORS policy
ACTION: Worker needs to add CORS headers
```

#### Step 3.9: Verify Streaming (if enabled)
**Action:** Check config.json for `"stream": true`

**If streaming is enabled:**
- Network request should be EventSource or long-lived fetch
- Console should show token-by-token updates
- No `[ReflectivWidget]` retry logs (streaming uses different error handling)

**If stream=true but request fails:**
```
[ReflectivWidget] logs about SSE failure
console.warn: SSE streaming failed, falling back to regular fetch
```
**Diagnosis:** Streaming endpoint not working, falls back to regular fetch

### Summary: Scenario 3 Decision Tree

```
Widget UI rendered and visible
    ↓
User sends message
    ↓
Check Console for sendMessage logs
    ↓
    ├─→ "Message ignored, already sending" → User spamming, normal
    │
    └─→ No special log → API call initiated
            ↓
            Check Network tab for request
            ↓
            ├─→ No request → config.apiBase is empty/undefined
            │       ↓
            │       └─→ Check config.json load status in init logs
            │
            ├─→ Request pending > 10s → Timeout occurring
            │       ↓
            │       └─→ Check Console for retry logs
            │               ↓
            │               ├─→ Multiple retries → Worker slow/unresponsive
            │               └─→ Final failure → Shows retry UI
            │
            └─→ Request completes → Check status code
                    ↓
                    ├─→ 200 OK → Check response content
                    │       ↓
                    │       ├─→ Empty {} → Worker returned no content
                    │       ├─→ HTML → Wrong endpoint or Worker routing fail
                    │       └─→ Valid JSON → Widget should show response
                    │
                    ├─→ 404 → Worker URL wrong or Worker not deployed
                    ├─→ 403 → Worker authentication/authorization failure
                    ├─→ 429 → Rate limiting (retry will happen)
                    ├─→ 500/502/503 → Worker error or CDN issue
                    └─→ CORS error → Worker CORS headers missing
```

### Output for Scenario 3

**Document the following:**
1. API endpoint from config.json (copy/paste URL)
2. Network request details:
   - Status code
   - Response time (ms)
   - Request size
   - Response size
3. Response body (first 500 chars)
4. Console logs related to API call (all `[ReflectivWidget]` logs from send to response)
5. Screenshot of Network tab showing request
6. Screenshot of Console showing retry logs (if any)

**Root Cause:**
- [ ] config.apiBase undefined (config load failed)
- [ ] Worker URL incorrect (configuration error)
- [ ] Worker not deployed (deployment issue)
- [ ] Worker authentication failure (403)
- [ ] Worker timeout (> 10s processing)
- [ ] Worker error (500/502/503)
- [ ] Rate limiting (429)
- [ ] CORS policy blocking response
- [ ] Response format incorrect (missing content field)
- [ ] Response is empty (Worker processed but returned nothing)
- [ ] Other: _________________

---

## CROSS-SCENARIO DIAGNOSTICS

### Master Checklist for Any Failure

Run through this checklist when you cannot determine which scenario applies:

#### Baseline Checks
- [ ] Browser DevTools are open
- [ ] Console tab is visible and logging enabled
- [ ] `DEBUG_WIDGET = true` in widget.js
- [ ] Page is fully loaded (no spinning indicators)
- [ ] Network tab has "Preserve log" enabled

#### Quick Triage
1. **Count `[ReflectivWidget]` logs in console:**
   - Zero → **Scenario 1** (Script failure)
   - 1-5 → **Scenario 2** (Init/UI failure)
   - 6+ → **Scenario 2** or **Scenario 3** (depends on buildUI completion)

2. **Check Elements tab for `.reflectiv-chat`:**
   - Not found → **Scenario 2** (UI construction failed)
   - Found → **Scenario 3** (API issue) or Modal not opened

3. **Try to interact with widget:**
   - Can't see widget → Modal closed or **Scenario 2**
   - Can see but can't type → **Scenario 2** (partial render)
   - Can type and send → **Scenario 3** (API issue)

#### Common False Positives

**False Positive 1: Widget "disappears" but it's just modal closed**
- Widget is working fine, user just needs to click "Try a Simulation"
- Test: Open modal manually, check if widget is there

**False Positive 2: Widget works but shows fallback text**
- API call succeeded but returned empty response
- Widget shows generic fallback like "Keep it concise..."
- This is **Scenario 3** (API issue), not Scenario 2

**False Positive 3: Loading state persists**
- Widget may be waiting for user to select Disease State / HCP
- Check if scenarios loaded (should be > 0 in init logs)
- If scenarios = 0, **Scenario 2** (data load failure)

### Logging Reference

**Complete Expected Log Sequence (Success Path):**
```
[ReflectivWidget] waitForMount: Searching for mount element
[ReflectivWidget] waitForMount: Mount element found
[ReflectivWidget] init: Starting initialization
[ReflectivWidget] init: Config loaded from ./assets/chat/config.json
[ReflectivWidget] init: API base set from window globals: https://...
[ReflectivWidget] init: system.md loaded (5234 chars)
[ReflectivWidget] init: about-ei.md loaded (7012 chars)
[ReflectivWidget] loadScenarios: Loaded 42 scenarios from assets/chat/data/scenarios.merged.json
[ReflectivWidget] init: Scenarios loaded (42 scenarios)
[ReflectivWidget] buildUI: Starting UI construction
[ReflectivWidget] buildUI: UI construction complete

(After user sends message "Hello")
[ReflectivWidget] callModel: Retry attempt 1/3  (if first attempt fails)
[ReflectivWidget] callModel: HTTP 429, will retry after 300ms  (if rate limited)
[ReflectivWidget] sendMessage: callModel returned empty response, using fallback for mode: sales-simulation  (if API returns empty)
```

**Logs That Indicate Problems:**
```
[ReflectivWidget] waitForMount: 15-second timeout expired, mount element not found
→ CRITICAL: Mount never found (should be impossible with static HTML)

[ReflectivWidget] init: Config load failed, using defaults Error: ...
→ WARNING: Using default config, API endpoint may be wrong

[ReflectivWidget] loadScenarios: Failed to load scenarios Error: ...
→ WARNING: Scenarios not loaded, dropdowns will be empty

[ReflectivWidget] loadScenarios: WARNING - scenarios array is empty, dropdowns will be unavailable
→ WARNING: No scenarios available

[ReflectivWidget] sendMessage: Message ignored, already sending
→ INFO: User tried to send while previous message still processing (normal)

[ReflectivWidget] callModel: Retry attempt 2/3
→ INFO: First attempt failed, retrying (normal for flaky network)

[ReflectivWidget] callModel: Failed after 4 attempts Error: ...
→ CRITICAL: All retries exhausted, API call completely failed

[ReflectivWidget] sendMessage: callModel returned empty response, using fallback for mode: ...
→ WARNING: API succeeded but returned no content
```

---

## REPORTING TEMPLATE

Use this template to document findings for each failure:

```markdown
## ReflectivAI Widget Diagnostic Report

**Date:** YYYY-MM-DD HH:MM
**Browser:** Chrome/Firefox/Safari/Edge [Version]
**URL:** https://reflectivei.github.io/reflectiv-ai/ (or local)
**Widget Version:** widget.js?v=XXXXX

### Scenario Identified
- [ ] Scenario 1: Script/Worker/Network Failure
- [ ] Scenario 2: Init Success but UI Failure  
- [ ] Scenario 3: UI Success but API Failure

### Console Logs
```
[Paste all [ReflectivWidget] logs here]
```

### Network Tab Details
| Resource | Status | Size | Time | Notes |
|----------|--------|------|------|-------|
| widget.js?v=XXX | | | | |
| config.json | | | | |
| system.md | | | | |
| about-ei.md | | | | |
| scenarios.merged.json | | | | |
| /chat (API) | | | | |

### Elements Tab Observations
- `#reflectiv-widget` exists: YES / NO
- `#reflectiv-widget` has class `cw`: YES / NO
- `.reflectiv-chat` exists: YES / NO
- All 5 child divs present: YES / NO
- Modal state: OPEN / CLOSED

### Error Messages
```
[Paste any error messages from Console here]
```

### Confirmed Hypothesis
- [ ] Hypothesis 1: Worker version validation failure
- [ ] Hypothesis 2: CDN cache key collision
- [ ] Hypothesis 3: Browser heuristic cache invalidation
- [ ] Hypothesis 5: Deployment race condition
- [ ] Other: _______________________

### Root Cause Analysis
[Detailed explanation of what went wrong]

### Recommended Fix
[What should be changed to resolve this issue]

### Attachments
- Screenshot: Console tab
- Screenshot: Network tab
- Screenshot: Elements tab
```

---

## QUICK REFERENCE COMMANDS

### Console Commands for Rapid Diagnosis

**Check if widget.js loaded:**
```javascript
!!document.querySelector('script[src*="widget.js"]')
```
Returns `true` if script tag exists.

**Check if mount element exists:**
```javascript
!!document.getElementById('reflectiv-widget')
```
Returns `true` if mount exists.

**Check if widget initialized:**
```javascript
document.getElementById('reflectiv-widget')?.classList.contains('cw')
```
Returns `true` if buildUI() ran (added 'cw' class).

**Check if UI rendered:**
```javascript
!!document.querySelector('.reflectiv-chat')
```
Returns `true` if UI DOM exists.

**Get config.json contents:**
```javascript
fetch('./assets/chat/config.json').then(r => r.json()).then(console.log)
```
Logs config object to console.

**Force modal open:**
```javascript
document.getElementById('coachModal').classList.add('open');
document.getElementById('coachModal').setAttribute('aria-hidden', 'false');
```
Opens modal if widget is hidden due to closed modal.

**Check Service Worker:**
```javascript
navigator.serviceWorker.controller
```
Returns `null` if no service worker (expected).

**Count scenarios loaded:**
```javascript
document.querySelectorAll('#cw-disease option').length - 1
```
Returns number of disease states (excludes "Select..." option).

---

## APPENDIX A: Log Message Index

| Log Message | Location | Meaning |
|-------------|----------|---------|
| `waitForMount: Searching for mount element` | Line 47 | Starting mount discovery |
| `waitForMount: Mount element found` | Line 50 | Mount found immediately |
| `waitForMount: Mount element found via MutationObserver` | Line 56 | Mount found after delay |
| `waitForMount: 15-second timeout expired, mount element not found` | Line 62 | Mount never found |
| `init: Starting initialization` | Line 2154 | init() function started |
| `init: Config loaded from ./assets/chat/config.json` | Line 2157 | Primary config loaded |
| `init: Config loaded from ./config.json (fallback)` | Line 2160 | Fallback config loaded |
| `init: Config load failed, using defaults` | Line 2163 | Both config paths failed |
| `init: API base set from window globals: ...` | Line 2169 | API from COACH_ENDPOINT |
| `init: system.md loaded (N chars)` | Line 2174 | System prompt loaded |
| `init: system.md load failed` | Line 2176 | System prompt failed |
| `init: about-ei.md loaded (N chars)` | Line 2183 | EI doc loaded |
| `init: about-ei.md load failed` | Line 2185 | EI doc failed |
| `loadScenarios: Loaded N scenarios from URL` | Line 2117 | Scenarios from URL |
| `loadScenarios: Loaded N scenarios from config.scenarios` | Line 2126 | Scenarios from config |
| `loadScenarios: No scenarios URL or inline scenarios...` | Line 2129 | No scenarios source |
| `loadScenarios: Failed to load scenarios` | Line 2133 | Scenarios load error |
| `loadScenarios: WARNING - scenarios array is empty...` | Line 2138 | Zero scenarios loaded |
| `init: Scenarios loaded (N scenarios)` | Line 2191 | Scenarios count |
| `buildUI: Starting UI construction` | Line 906 | buildUI() started |
| `buildUI: UI construction complete` | Line 1429 | buildUI() finished |
| `sendMessage: Message ignored, already sending` | Line 1857 | Concurrent send blocked |
| `sendMessage: callModel returned empty response...` | Line 1947 | API returned nothing |
| `callModel: Retry attempt N/3` | Line 1625 | Retry in progress |
| `callModel: HTTP NNN, will retry after Nms` | Line 1655 | HTTP error, retrying |
| `callModel: timeout, will retry after Nms` | Line 1667 | Timeout, retrying |
| `callModel: Failed after N attempts` | Line 1673 | API call failed |
| `callModel: Failed after all retries` | Line 1687 | Final failure |

---

## APPENDIX B: HTTP Status Code Reference

| Status | Meaning | Likely Cause | Action |
|--------|---------|--------------|--------|
| 200 | OK | Success | Check response content |
| 304 | Not Modified | Browser cache | Check if serving stale content |
| 400 | Bad Request | Malformed request | Check payload structure |
| 403 | Forbidden | Auth/permission | Check Worker access rules |
| 404 | Not Found | Wrong URL or Worker not deployed | Verify endpoint URL |
| 429 | Too Many Requests | Rate limiting | Wait and retry |
| 500 | Internal Server Error | Worker crashed | Check Worker logs |
| 502 | Bad Gateway | Worker timeout or CDN issue | Check Worker performance |
| 503 | Service Unavailable | Worker overloaded or maintenance | Wait and retry |

---

## APPENDIX C: Browser Compatibility Notes

### Chrome/Edge (Chromium-based)
- Full support for all debugging features
- Network tab shows comprehensive timing data
- Console filtering works reliably

### Firefox
- Full support for all debugging features
- Network tab format slightly different but equivalent
- Use "XHR" filter instead of "Fetch/XHR"

### Safari
- Console may not show `console.debug()` by default
- Enable "Show Log Messages" in Console settings
- Network tab is called "Network" or "Timelines"

### Mobile Browsers
- Use Remote Debugging:
  - Chrome Android: chrome://inspect
  - Safari iOS: Safari → Develop → iPhone
- Touch events may interfere with testing
- Use Desktop mode for easier debugging

---

**END OF DIAGNOSTIC RUNBOOK**
