# ReflectivAI Widget - Phase 2 Diagnostic Analysis
## Repository: ReflectivEI/reflectiv-ai
## Date: 2025-11-06

---

## EXECUTIVE SUMMARY

This Phase 2 diagnostic analysis examines the fragile cache-buster behavior where changing the `?v=` query parameter on `widget.js` causes the widget to disappear or fail to reappear. This document maps all potential failure paths, compares current behavior against expected functionality, provides hypotheses for the cache-buster symptom, and creates a Safe-Edit Map for Phase 3 modifications.

**Key Finding:** The widget disappearance is likely NOT caused by logic within `widget.js` itself, but rather by external factors including browser caching, Cloudflare Worker routing, or Service Worker state. The widget's internal logic is robust against filename/query changes.

---

## 1. CONFIRMED INVARIANTS (What is NOT Breaking)

### 1.1 Mount Discovery Logic - ROBUST ✅

**File:** `widget.js` Lines 28-50

The mount discovery mechanism is **filename-agnostic** and will work regardless of the script's query parameters:

```javascript
function waitForMount(cb) {
  const findMount = () =>
    document.getElementById("reflectiv-widget") ||
    document.querySelector("#coach-widget, [data-coach-mount], .reflectiv-widget");
  // ... MutationObserver setup
}
```

**Why It's Invariant:**
- Uses only DOM selectors (getElementById, querySelector)
- No dependency on script path, filename, or URL
- No assumptions about how the script was loaded
- MutationObserver provides 15-second window for late DOM insertion

**Verification:** This code has no way to detect or respond to its own filename/query string.

### 1.2 Initialization Sequence - PATH-INDEPENDENT ✅

**File:** `widget.js` Lines 2108-2140 (init function)

The initialization loads resources using **relative paths only**:

```javascript
async function init() {
  try {
    cfg = await fetchLocal("./assets/chat/config.json");
  } catch (e) {
    cfg = await fetchLocal("./config.json");
  }
  // ... loads system.md, about-ei.md, scenarios
}
```

**Why It's Invariant:**
- All fetch calls use relative URLs (./assets/chat/...)
- No reference to script[src] or document.currentScript
- No dynamic path construction based on script location
- Paths are hardcoded and relative to document base

**Verification:** The widget never introspects its own script tag or URL.

### 1.3 Modal Container - STATIC HTML ✅

**File:** `index.html` Lines 443-452

The mount point is **pre-existing** in the HTML:

```html
<div id="coachModal" class="modal" aria-hidden="true">
  <div class="modal-box" role="dialog">
    <div class="modal-head">
      <div id="coachTitle" class="modal-title">Reflectiv Coach</div>
      <button class="modal-close" data-close="#coachModal">Close</button>
    </div>
    <div id="coachBody">
      <div id="reflectiv-widget" class="reflectiv-widget">
        <noscript>You need JavaScript to use the ReflectivAI Coach.</noscript>
      </div>
    </div>
  </div>
</div>
```

**Why It's Invariant:**
- Mount element exists before any JS executes
- Not created dynamically by widget.js
- Modal structure is completely independent of script versioning

---

## 2. POTENTIAL FAILURE PATHS (Comprehensive Mapping)

### 2.1 Mount Discovery Failures

#### 2.1.A: Element Not Found (15-Second Timeout)
**Location:** `widget.js` Lines 28-50
**Condition:** MutationObserver disconnects after 15 seconds without finding mount
**Likelihood:** LOW - Mount exists in static HTML before script loads
**Detection:** 
- No error thrown
- Console would show no widget initialization messages
- `mount` variable remains null

**Why Cache-Buster Wouldn't Cause This:**
The DOM state and script execution are independent of query parameters.

#### 2.1.B: Script Executes Before DOM Ready
**Location:** `widget.js` Lines 20-26, 49
**Condition:** Script tries to find mount before DOMContentLoaded
**Likelihood:** ZERO - `defer` attribute ensures DOM is ready
**Evidence from index.html Line 128:**
```html
<script defer src="widget.js?v=20251025-1045"></script>
```

The `defer` attribute guarantees:
1. Script downloads in parallel with HTML parsing
2. Script executes only after DOM is completely parsed
3. DOMContentLoaded has already fired or will fire immediately

#### 2.1.C: Modal Initially Hidden
**Location:** `index.html` Line 443, CSS
**Condition:** `#coachModal` has CSS that prevents finding child elements
**Likelihood:** LOW - querySelector works on hidden elements
**Verification:** CSS `display:none` or `visibility:hidden` do NOT prevent DOM traversal

The modal being closed (not `.open`) is **normal and expected**. The widget finds `#reflectiv-widget` regardless of modal visibility.

### 2.2 Data Loading Failures

#### 2.2.A: config.json Load Failure
**Location:** `widget.js` Lines 2110-2118
**Condition:** Both fetch attempts fail (./assets/chat/config.json and ./config.json)
**Impact:** PARTIAL - Widget continues with defaults but no API endpoint
**Symptom:** Widget appears but all API calls fail

```javascript
try {
  cfg = await fetchLocal("./assets/chat/config.json");
} catch (e) {
  cfg = await fetchLocal("./config.json");
}
} catch (e) {
  console.error("config load failed:", e);
  cfg = { defaultMode: "sales-simulation" };
}
```

**Why Cache-Buster Could Affect This:**
If changing `widget.js?v=X` triggers browser cache invalidation that also affects `config.json`, the fetch might see:
- 404 if Worker routing changed
- Network error if offline/CDN issue
- CORS error if serving domain changed

**Test:** Check Network tab for config.json status when widget disappears.

#### 2.2.B: system.md or about-ei.md Load Failure
**Location:** `widget.js` Lines 2125-2136
**Condition:** Fetch returns non-200 status
**Impact:** GRACEFUL - Widget continues with empty strings
**Symptom:** Lower quality AI responses, but widget still appears

These are **non-blocking failures**. Widget will still mount and render.

#### 2.2.C: Scenarios Load Failure
**Location:** `widget.js` Lines 2067-2105
**Condition:** scenariosUrl fetch fails or returns invalid JSON
**Impact:** PARTIAL - Sales Simulation and Role Play modes degraded
**Symptom:** Empty dropdowns, but widget still appears

```javascript
async function loadScenarios() {
  try {
    if (cfg && cfg.scenariosUrl) {
      const payload = await fetchLocal(cfg.scenariosUrl);
      // ...
    }
  } catch (e) {
    console.error("scenarios load failed:", e);
    scenarios = [];
  }
}
```

**Why This Matters:**
If scenarios.merged.json fails to load, the Disease State and HCP dropdowns will be empty, making the widget appear "broken" even though it's mounted.

### 2.3 UI Construction Failures

#### 2.3.A: buildUI() Exception Before DOM Attachment
**Location:** `widget.js` Lines 883-1406
**Condition:** JavaScript exception thrown before `mount.appendChild(shell)`
**Impact:** CRITICAL - Widget container remains empty
**Symptom:** Empty `<div id="reflectiv-widget">` in DOM

**Critical Line:** Line 884
```javascript
function buildUI() {
  mount.innerHTML = "";  // Clears existing content
  if (!mount.classList.contains("cw")) mount.classList.add("cw");
  // ... if exception here, mount stays empty
}
```

**Most Likely Exception Points:**
1. **Line 888-927:** CSS injection - if document.head is null
2. **Line 930-942:** Shell skeleton creation - malformed innerHTML
3. **Line 1074:** shell.appendChild(bar) - if bar is malformed

**Why Cache-Buster Wouldn't Cause This:**
JavaScript syntax and logic are identical regardless of query parameter. However, if the browser cached a **corrupted version** of widget.js, this could cause exceptions.

#### 2.3.B: CSS Injection Failure
**Location:** `widget.js` Lines 888-927
**Condition:** document.getElementById("reflectiv-widget-inline-style") returns unexpected value
**Impact:** MEDIUM - Widget appears but unstyled
**Symptom:** Broken layout, overlapping elements

```javascript
const STYLE_ID = "reflectiv-widget-inline-style";
let style = document.getElementById(STYLE_ID);
if (!style) {
  style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `/* 924 lines of CSS */`;
  document.head.appendChild(style);
}
```

**Race Condition Possibility:**
If buildUI() is called twice simultaneously (shouldn't happen, but...), the second call might see `style` exists and skip injection, then a DOM mutation could remove it.

**Likelihood:** VERY LOW - Protected by existing style check

### 2.4 CSS / Visibility Interactions

#### 2.4.A: Modal Not Opening
**Location:** index.html Lines 467-482 (Bootstrap JS for modals)
**Condition:** Modal controls fail to add `.open` class to `#coachModal`
**Impact:** Widget is mounted but modal never visible
**Symptom:** User clicks "Try a Simulation" but nothing appears

**Modal Opening Logic (index.html Line 482):**
```javascript
document.getElementById('openCoach')?.addEventListener('click', e => {
  e.preventDefault();
  openModal('#coachModal');
});
```

**Why Cache-Buster Could Affect This:**
If the page JavaScript (not widget.js) is also cached, and changing widget.js query triggers a page reload that fails to load the modal controller script, the modal won't open.

**Test:** Open DevTools, type `openModal('#coachModal')` in console. If modal appears, widget is mounted correctly.

#### 2.4.B: CSS Display Override
**Location:** External stylesheets or inline styles
**Condition:** CSS rule with higher specificity sets `display:none` on widget or modal
**Likelihood:** LOW - Would require external CSS change
**Example:**
```css
.reflectiv-widget { display: none !important; }
/* or */
#coachModal { display: none !important; }
```

**Why Cache-Buster Could Trigger This:**
If there's a Service Worker or CDN that serves different CSS based on widget.js version, and the new version is incompatible.

#### 2.4.C: Z-Index Layering Issue
**Location:** widget.css, inline styles
**Condition:** Another element has higher z-index and covers widget
**Symptom:** Widget is rendered but not visible/clickable

**Current Z-Index Values:**
- `#coachModal`: z-index 10000 (index.html line 48)
- `#aloraFab`: z-index 10001 (index.html lines 62, 131)
- `.alora`: z-index 10001 (index.html line 64)

These are extremely high, making overlap unlikely unless another element uses `z-index: 10002+`.

### 2.5 Runtime JavaScript Errors

#### 2.5.A: Exception in init() Before buildUI()
**Location:** `widget.js` Lines 2108-2140
**Condition:** Unhandled exception in data loading phase
**Impact:** CRITICAL - buildUI() never called
**Symptom:** Mount element remains empty

**Protected Sections:**
- Config load: try-catch with fallback (Lines 2110-2118)
- System prompt load: try-catch, continues with empty string (Lines 2125-2129)
- EI load: try-catch with warning (Lines 2131-2136)
- Scenarios load: try-catch with empty array (Lines 2138)

**Vulnerable Section:**
Lines 2139-2140:
```javascript
await loadScenarios();
buildUI();
```

If `loadScenarios()` throws an **unexpected** exception not caught by its internal try-catch, `buildUI()` never runs.

**Example Scenario:**
```javascript
async function loadScenarios() {
  try {
    // ... normal logic
  } catch (e) {
    scenarios = [];
  }
  // If this line throws (e.g., undefined.forEach), it's not caught:
  scenarios.forEach(s => { /* validation */ });
}
```

#### 2.5.B: Exception in buildUI() Itself
**Location:** `widget.js` Lines 883-1406
**Condition:** Unhandled exception during UI construction
**Impact:** CRITICAL - Widget partially or not rendered

**High-Risk Zones:**
1. **Lines 952-1071:** Select element construction - if LC_OPTIONS is corrupted
2. **Lines 1010-1057:** EI selects hydration - if config data is malformed
3. **Lines 1372-1405:** Event handler binding - if elements are null

**Current Protection:**
No explicit try-catch around buildUI(). An exception anywhere will halt execution and leave widget in partial state.

#### 2.5.C: Syntax Error in widget.js
**Condition:** Browser receives corrupted or incomplete widget.js
**Impact:** CRITICAL - Script never executes
**Symptom:** Console shows syntax error, widget never attempts to mount

**Why Cache-Buster Could Cause This:**
1. **Mid-transfer corruption:** Browser cache partially updated
2. **CDN race condition:** Cloudflare serves old cache header with new content
3. **Build artifact mismatch:** Different minification based on versioning

**Detection:** Console will show explicit syntax error with line number.

### 2.6 Script Path / Cache-Buster Specific Issues

#### 2.6.A: Service Worker Cache Mismatch
**Location:** N/A (no Service Worker in current repo)
**Condition:** Service Worker caches `widget.js?v=OLD` and doesn't fetch `widget.js?v=NEW`
**Likelihood:** ZERO - No Service Worker registered in this repo
**Verification:** Check `navigator.serviceWorker.controller` in console (should be null)

#### 2.6.B: Browser Cache Serving Stale Script
**Condition:** Browser ignores query parameter and serves cached `widget.js` body
**Likelihood:** LOW but POSSIBLE with misconfigured cache headers
**Mechanism:**
1. Browser requests `widget.js?v=20251025-1045`
2. Cache lookup ignores query string (incorrect behavior but possible)
3. Returns cached `widget.js` from previous version
4. Widget executes but with old logic that might have bugs

**Test:** Hard refresh (Ctrl+Shift+R) should bypass cache and load new version.

#### 2.6.C: Cloudflare Worker Routing Based on Query
**Location:** worker.js (frozen, cannot inspect)
**Condition:** Worker has logic that routes `widget.js?v=X` differently based on `v` value
**Likelihood:** MEDIUM if Worker was configured with version-specific routing
**Hypothesis:**
```javascript
// Hypothetical Worker logic (not visible in this repo)
if (url.searchParams.get('v') === 'expected-version') {
  return fetchAsset('widget.js');
} else {
  return new Response('Version mismatch', { status: 404 });
}
```

**Why This Matters:**
If Worker expects a specific version string and `index.html` is updated with a different one, the Worker might reject the request.

**Detection:** Network tab shows 404 or 403 for widget.js.

#### 2.6.D: CSP Violation from Script Integrity
**Location:** index.html Lines 12-20 (Content Security Policy)
**Condition:** CSP enforces Subresource Integrity (SRI) and hash doesn't match
**Likelihood:** ZERO - Current CSP has no SRI hashes
**Current CSP:**
```html
<meta http-equiv="Content-Security-Policy"
      content="
        default-src 'self';
        img-src 'self' data:;
        style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
        font-src  'self' https://fonts.gstatic.com;
        script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com;
        connect-src 'self' https://my-chat-agent-v2.tonyabdelmalak.workers.dev
      ">
```

`script-src 'self'` allows any script from same origin without integrity check. Query parameters don't affect this.

#### 2.6.E: Browser Extension Blocking Based on URL Pattern
**Condition:** Ad blocker or privacy extension blocks `widget.js?v=*` matching some pattern
**Likelihood:** LOW but POSSIBLE
**Example:** Extension blocks all scripts with `widget` in filename

**Detection:** Disable all extensions and test. Check console for blocked script messages.

### 2.7 Timing and Race Conditions

#### 2.7.A: Modal Opened Before Widget Initialized
**Condition:** User clicks "Try a Simulation" before widget.js has mounted
**Impact:** Modal opens but shows empty or "Loading..." state
**Symptom:** Modal visible but no chat interface

**Sequence Analysis:**
1. Page loads, widget.js deferred
2. User immediately clicks "Try a Simulation"
3. Modal opens via index.html bootstrap JS
4. Widget not yet initialized → empty `#reflectiv-widget`

**Protection:** MutationObserver in waitForMount would eventually populate it, but there's a visual gap.

**Why Cache-Buster Affects This:**
Changing query parameter forces browser to download new file. If network is slow or CDN cold cache, the delay increases the window where modal can open before widget is ready.

#### 2.7.B: Multiple buildUI() Calls
**Condition:** init() called twice (shouldn't happen but...)
**Impact:** MEDIUM - Second call clears and rebuilds UI, resetting state
**Location:** Lines 2139-2140

**Current Protection:** NONE
The code has no guard against multiple init() calls. If waitForMount triggers twice (MutationObserver bug?), init() runs twice.

**Symptom:** Widget appears then disappears then reappears, conversation history lost.

---

## 3. CACHE-BUSTER / SCRIPT-PATH HYPOTHESES

### Hypothesis 1: Cloudflare Worker Version Whitelist
**Likelihood:** HIGH 🔴
**Description:** Worker.js has hardcoded version validation

**Mechanism:**
```javascript
// Hypothetical worker.js logic
const ALLOWED_WIDGET_VERSIONS = ['20251025-1045', '20251024-0900'];
const version = url.searchParams.get('v');
if (!ALLOWED_WIDGET_VERSIONS.includes(version)) {
  return new Response('Invalid version', { status: 403 });
}
```

**Why It Fits:**
- Explains why specific version strings work or don't
- Accounts for "widget disappears" (403/404 from Worker)
- Requires no changes to index.html or config.json to fix (just Worker)

**Test:**
1. Open DevTools Network tab
2. Change `?v=20251025-1045` to `?v=test123` in index.html
3. Reload page
4. Check if widget.js request returns 403/404

**Falsification:** If widget.js loads successfully (200 OK) with any version string, this hypothesis is false.

**Files Involved:** worker.js (frozen), index.html (frozen)

### Hypothesis 2: CDN Cache Key Collision
**Likelihood:** MEDIUM 🟡
**Description:** Cloudflare CDN caches based on path only, ignoring query

**Mechanism:**
1. CDN sees `widget.js?v=OLD` and caches response at key `widget.js`
2. Request for `widget.js?v=NEW` hits same cache key
3. CDN serves old content despite new version requested
4. Old widget.js has bug or incompatibility with current HTML/config

**Why It Fits:**
- Explains intermittent behavior (cache TTL effects)
- Common CDN misconfiguration
- Would cause symptoms to resolve after cache expiry

**Test:**
1. Add unique cache-buster timestamp: `?v=20251106&t=1699291234`
2. If widget appears, CDN was serving stale content
3. Check Response headers for `CF-Cache-Status: HIT` vs `MISS`

**Falsification:** If changing only the version always breaks, regardless of delay, CDN caching is not the issue.

**Files Involved:** Cloudflare CDN config (not in repo), wrangler.toml (frozen)

### Hypothesis 3: Browser Heuristic Cache Invalidation
**Likelihood:** LOW 🟢
**Description:** Browser aggressively caches main page, changing script src invalidates too much

**Mechanism:**
1. Browser caches `index.html` with `widget.js?v=OLD`
2. Change to `widget.js?v=NEW` invalidates entire page cache
3. On reload, browser fetches all resources fresh
4. Race condition: config.json not ready when widget.js executes
5. Widget fails to load config, API calls fail, widget appears "broken"

**Why It's Weak:**
- Modern browsers handle this correctly
- async/defer should prevent race
- Doesn't explain complete widget disappearance

**Test:**
1. Clear all browser cache
2. Load page with new version
3. Check Network tab for all resource load order
4. Verify config.json loads before widget tries to use it

**Falsification:** If widget still disappears with empty cache, this is not the cause.

**Files Involved:** Browser behavior (external)

### Hypothesis 4: Hardcoded Version Check in widget.js
**Likelihood:** VERY LOW ⚪
**Description:** widget.js itself validates its version against expected value

**Mechanism:**
```javascript
// Hypothetical code that doesn't exist in current widget.js
const EXPECTED_VERSION = '20251025-1045';
const scriptTag = document.querySelector('script[src*="widget.js"]');
const actualVersion = new URL(scriptTag.src).searchParams.get('v');
if (actualVersion !== EXPECTED_VERSION) {
  console.error('Version mismatch, refusing to initialize');
  return;
}
```

**Why It's Unlikely:**
- **Verification:** Searched entire widget.js, NO such logic exists
- widget.js never accesses `document.currentScript` or `script[src]`
- No references to version numbers anywhere in widget.js

**Test:** Search widget.js for:
- `searchParams`
- `currentScript`
- `script[src`
- Version number strings

**Falsification:** Already falsified - no such code exists.

**Files Involved:** widget.js (can verify by inspection)

### Hypothesis 5: Deployment Race Condition
**Likelihood:** MEDIUM 🟡
**Description:** GitHub Pages and Cloudflare Worker deploy out of sync

**Mechanism:**
1. Deploy updated `widget.js` to GitHub Pages
2. Worker still routes to old version or expects old behavior
3. Short window (minutes to hours) where widget.js and Worker are incompatible
4. Changing version string in index.html triggers re-fetch during this window

**Why It Fits:**
- Explains transient failures that self-resolve
- Common in multi-service architectures
- Worker (frozen) might have expectations about widget behavior

**Test:**
1. Note exact time when version is changed
2. Wait 1 hour, test again
3. If widget appears after delay, deployment sync was the issue

**Falsification:** If widget never appears no matter how long you wait, deployment sync is not primary cause.

**Files Involved:** GitHub Pages deploy, Cloudflare Worker deploy (external)

---

## 4. SAFE-EDIT MAP FOR widget.js (Phase 3 Preparation)

This map categorizes every major function/section of widget.js for safety of modifications.

### 4.1 SAFE-UI: Layout & Styling Only

These sections affect only visual presentation, not initialization or core logic.

| Function/Lines | Description | Safe Changes | Risky Changes |
|----------------|-------------|--------------|---------------|
| **Lines 888-927: CSS Injection** | Inline styles for widget | Change colors, spacing, font sizes, borders | Remove critical display/positioning rules |
| **Lines 930-1074: buildUI() Shell** | HTML structure creation | Reorder elements, change classes, add/remove containers | Remove mount.appendChild(), change element IDs |
| **Lines 1190-1289: renderCoach()** | Coach panel rendering | Change layout, formatting, label text | Remove score calculation, change data flow |
| **Lines 466-505: renderLegacyCoachCard()** | Coach card HTML | Modify structure, styles, labels | Remove required data fields |
| **Lines 422-440: md() function** | Markdown to HTML | Adjust formatting rules | Break sanitization, introduce XSS risk |

**SAFE-UI Examples:**
- Change coach panel background from `#fffbe8` to `#f0f7ff`
- Reorder "What worked" and "What to improve" sections
- Add icons next to section headers
- Adjust padding/margins in chat messages

**RISK INDICATORS:**
- Any change to `.innerHTML = ""` (line 884, 1192)
- Removing any `appendChild()` calls
- Modifying element selectors used later

### 4.2 SAFE-BEHAVIOR: Controlled Logic Changes

These sections implement business logic that can be modified with careful testing.

| Function/Lines | Description | Safe Changes | Risky Changes |
|----------------|-------------|--------------|---------------|
| **Lines 621-693: scoreReply()** | Deterministic scoring | Adjust weights, thresholds, add new signals | Change return structure, remove required fields |
| **Lines 696-758: EI scoring functions** | Empathy/stress calculation | Modify scoring formula, keyword lists | Remove return values, break persona mapping |
| **Lines 760-786: generateDynamicFeedback()** | EI feedback text | Edit feedback messages, add new cases | Remove persona/feature validation |
| **Lines 222-316: sanitizeRolePlayOnly()** | Text sanitization | Add new patterns, adjust regex | Remove critical sanitization steps |
| **Lines 317-345: isGuidanceLeak()** | Leak detection | Tune detection sensitivity, add patterns | Disable detection entirely |
| **Lines 802-880: buildPreface()** | Mode-specific prompts | Edit prompt text, add instructions | Remove mode checks, break JSON structure |

**SAFE-BEHAVIOR Examples:**
- Increase empathy score weight from 0.1 to 0.15
- Add new keyword "validate" to empathy detection
- Edit system prompt to emphasize compliance more
- Adjust "too long" threshold from 220 to 250 words

**RISK INDICATORS:**
- Changing function signatures (parameters or return values)
- Removing validation checks
- Modifying data structures (coach object shape, message format)

### 4.3 RISKY: Initialization & Core Infrastructure

These sections control whether widget appears and functions at all. Changes require extreme caution.

| Function/Lines | Description | Why Risky | Allowed Changes |
|----------------|-------------|-----------|-----------------|
| **Lines 20-50: onReady(), waitForMount()** | Mount discovery | Breaks initialization if selectors wrong | Add logging only |
| **Lines 2108-2140: init()** | Data loading sequence | Failure here = no widget | Add error reporting only |
| **Lines 883-1406: buildUI()** | UI construction | Exception here = empty widget | Only in SAFE-UI sections |
| **Lines 1540-1662: callModel()** | API communication | Breaks all AI responses | Timeout tuning only |
| **Lines 1823-2064: sendMessage()** | Message flow orchestrator | Breaks user interaction | Add logging only |
| **Lines 98-103: fetchLocal()** | Resource loader | Breaks data loading | Add retry logic carefully |
| **Lines 2067-2105: loadScenarios()** | Scenario loading | Breaks sales-simulation mode | Add validation carefully |

**RISKY Examples (DO NOT DO in Phase 3):**
- Change mount selector from `#reflectiv-widget` to `#widget`
- Modify fetch() URLs or error handling in init()
- Remove try-catch blocks
- Change order of init() steps
- Modify MutationObserver configuration

**Allowed Changes in RISKY Sections:**
- Add `console.log()` statements for debugging
- Add try-catch around currently unprotected code
- Add validation before risky operations
- Improve error messages

### 4.4 CRITICAL-PATH: Never Touch

These are the absolute core that must remain unchanged unless debugging a specific crash.

| Lines | Description | Why Critical | Phase 3 Action |
|-------|-------------|--------------|----------------|
| **28-35** | Mount selector logic | Any change = widget never mounts | FREEZE |
| **49** | onReady callback invocation | Entry point, must not change | FREEZE |
| **884** | mount.innerHTML clear | Essential for UI reset | FREEZE |
| **1074** | shell.appendChild sequence | Attaches UI to DOM | FREEZE |
| **2139-2140** | loadScenarios() → buildUI() chain | Core initialization sequence | FREEZE |
| **2143** | waitForMount(init) invocation | Widget entry point | FREEZE |

**Phase 3 Rule:** If code review suggests changing these lines, escalate to Phase 4 (controlled refactor) instead.

---

## 5. MANUAL TEST CHECKLIST

This checklist allows a human tester to diagnose widget failures without modifying code.

### 5.1 Pre-Test Setup

- [ ] Open page in Chrome/Firefox (latest version)
- [ ] Open DevTools (F12)
- [ ] Enable "Preserve log" in Network tab
- [ ] Enable "Disable cache" while DevTools is open
- [ ] Set Console filter to "All levels" (show verbose, info, warn, error)

### 5.2 Test 1: Verify Widget Mounts

**Steps:**
1. Load page: `https://reflectivei.github.io/reflectiv-ai/`
2. Wait 20 seconds (exceeds 15-second timeout)
3. Open Elements tab in DevTools
4. Find `<div id="reflectiv-widget">`

**Expected Result:**
```html
<div id="reflectiv-widget" class="reflectiv-widget cw">
  <div class="reflectiv-chat">
    <div class="chat-toolbar">...</div>
    <div class="scenario-meta"></div>
    <div class="chat-messages">...</div>
    <div class="chat-input">...</div>
    <div class="coach-section">...</div>
  </div>
</div>
```

**Failure Modes:**
- ❌ `<div id="reflectiv-widget">` is empty → Mount found but buildUI() failed
- ❌ `<div id="reflectiv-widget">` has only `<noscript>` → Mount found but init() never called
- ❌ Element not found in Elements tab → Mount selector broken (impossible with current HTML)

**Record:**
- Screenshot of Elements tab showing widget structure
- Console messages (if any)

### 5.3 Test 2: Verify Script Loading

**Steps:**
1. Load page
2. Go to Network tab
3. Filter by "JS"
4. Find `widget.js?v=...` request

**Expected Result:**
- Status: `200 OK`
- Size: ~65 KB (unminified) or ~25 KB (minified)
- Time: < 1 second
- Type: `application/javascript` or `text/javascript`

**Failure Modes:**
- ❌ Status `404` → Script not found (Worker routing issue?)
- ❌ Status `403` → Permission denied (Worker version check?)
- ❌ Status `304` → Not Modified (using cached version, could be stale)
- ❌ Status `ERR_CONNECTION_REFUSED` → Server unreachable
- ❌ Status `(failed) net::ERR_CERT_AUTHORITY_INVALID` → HTTPS issue

**Record:**
- Screenshot of Network tab showing widget.js request
- Response Headers (especially `Cache-Control`, `CF-Cache-Status`)
- Request Headers (especially `If-None-Match`, `If-Modified-Since`)

### 5.4 Test 3: Verify Data Loading

**Steps:**
1. Load page
2. Wait 5 seconds
3. Check Network tab for:
   - `config.json`
   - `system.md`
   - `about-ei.md`
   - `scenarios.merged.json`

**Expected Result:**
All 4 files return `200 OK`

**Failure Modes:**
- ❌ Any file returns `404` → Widget initializes with defaults/empty data
- ❌ config.json fails → No API endpoint, all AI calls will fail
- ❌ scenarios.merged.json fails → Dropdowns will be empty

**Record:**
- Screenshot of Network tab filtered to show these 4 files
- Status codes for each

### 5.5 Test 4: Verify Modal Opens

**Steps:**
1. Load page
2. Scroll to hero section
3. Click "Try a Simulation" button
4. Modal should appear

**Expected Result:**
- Modal `#coachModal` has class `.open`
- Modal is visible on screen
- Widget chat interface is visible inside modal

**Failure Modes:**
- ❌ Modal doesn't open → JavaScript error in page (not widget)
- ❌ Modal opens but empty → Widget failed to mount before modal opened
- ❌ Modal opens with widget but unstyled → CSS injection failed

**Record:**
- Screenshot of modal open (or failed to open)
- Console errors (if any)

### 5.6 Test 5: Console Error Scan

**Steps:**
1. Load page
2. Open Console tab
3. Look for any red error messages
4. Particularly look for:
   - `Failed to load ...` (network errors)
   - `Uncaught TypeError` (JavaScript errors)
   - `Uncaught SyntaxError` (script corruption)
   - `Refused to execute` (CSP errors)

**Expected Result:**
No errors (warnings are OK)

**Failure Modes:**
- ❌ `Uncaught SyntaxError: Unexpected token` → widget.js corrupted or incomplete
- ❌ `TypeError: Cannot read property 'appendChild' of null` → mount element not found
- ❌ `Failed to fetch` → Network issue loading resources

**Record:**
- Full console log (copy/paste or screenshot)
- Pay special attention to line numbers and stack traces

### 5.7 Test 6: Version Change Impact

**Purpose:** Test cache-buster hypothesis

**Steps:**
1. Note current version in `index.html`: `widget.js?v=20251025-1045`
2. Using browser DevTools, manually change URL:
   - Go to Elements tab
   - Find `<script defer src="widget.js?v=20251025-1045">`
   - Right-click → Edit as HTML
   - Change to `widget.js?v=TEST123`
   - Press Enter to apply
3. Open Console tab
4. Type: `location.reload(true)` and press Enter (hard reload)
5. Observe what happens

**Expected Result (if no version validation):**
Widget loads normally with version TEST123

**Failure Modes:**
- ❌ widget.js request returns 404/403 → Worker validates version (Hypothesis 1)
- ❌ widget.js loads but widget doesn't appear → Old cached version loaded (Hypothesis 2)
- ❌ Network tab shows widget.js cached (304) → Cache-Control headers wrong

**Record:**
- Network tab screenshot showing widget.js?v=TEST123 request
- Status code and response headers
- Whether widget appeared or not

### 5.8 Test 7: Service Worker Check

**Steps:**
1. Open Console tab
2. Type: `navigator.serviceWorker.controller`
3. Press Enter

**Expected Result:**
`null` (no service worker active)

**Failure Modes:**
- ❌ Returns ServiceWorker object → Unexpected SW is active, could be caching
- If not null:
  - Type: `navigator.serviceWorker.getRegistrations().then(r => r.forEach(reg => reg.unregister()))`
  - Reload page
  - Test again

**Record:**
- Console output of serviceWorker check

### 5.9 Test 8: Cache Header Analysis

**Steps:**
1. Load page
2. Network tab → Click on `widget.js?v=...` request
3. Go to Headers sub-tab
4. Examine Response Headers:
   - `Cache-Control`
   - `CF-Cache-Status` (Cloudflare specific)
   - `Age`
   - `Expires`
   - `ETag`

**Expected Result:**
- `Cache-Control: public, max-age=<some value>` or `no-cache`
- `CF-Cache-Status: HIT` or `MISS` or `DYNAMIC`

**Suspicious Results:**
- ❌ `Cache-Control: public, max-age=31536000` (1 year) → Query param might not bust cache
- ❌ `CF-Cache-Status: HIT` on first load after version change → CDN ignoring query param
- ❌ No `Cache-Control` header → Caching behavior undefined

**Record:**
- Full Response Headers for widget.js
- Full Response Headers for config.json

### 5.10 Test 9: Timing Analysis

**Purpose:** Detect race conditions

**Steps:**
1. Open Network tab
2. Right-click on column headers
3. Enable: "Waterfall", "Time", "Initiator"
4. Load page
5. Examine load order:
   - When does widget.js start downloading?
   - When does it finish?
   - When do config.json, system.md, etc. start?
   - Which loads first: widget.js or config.json?

**Expected Result:**
- widget.js finishes before config.json loads
- All data files load after widget.js execution starts
- No requests fail or retry

**Suspicious Results:**
- ❌ config.json starts before widget.js finishes → Race condition possible
- ❌ widget.js takes > 5 seconds → Network issue or large file
- ❌ Multiple retries on any request → Network instability

**Record:**
- Screenshot of Network tab with Waterfall view showing all relevant requests

---

## 6. RECOMMENDED TARGETS FOR PHASE 3

Based on this diagnostic analysis, these are the safest and most valuable changes to make in Phase 3.

### 6.1 High Value, Low Risk

**Target 1: Enhanced Error Logging**
- **File:** widget.js
- **Functions:** init(), buildUI(), callModel()
- **Change:** Add console.error() with context for all failure paths
- **Why:** Currently many failures are silent. Adding logs will help diagnose future issues.
- **Safety:** SAFE-BEHAVIOR - Only adding logging, not changing logic

**Example:**
```javascript
// Line 2110, in init()
try {
  cfg = await fetchLocal("./assets/chat/config.json");
} catch (e) {
  console.error("ReflectivAI: Failed to load primary config", e);
  try {
    cfg = await fetchLocal("./config.json");
  } catch (e2) {
    console.error("ReflectivAI: Failed to load fallback config", e2);
    cfg = { defaultMode: "sales-simulation" };
  }
}
```

**Target 2: Mount Success Indicator**
- **File:** widget.js
- **Function:** buildUI()
- **Change:** Add `console.info('ReflectivAI widget mounted successfully')` at end
- **Why:** Confirms widget initialization completed
- **Safety:** SAFE-UI - Only adding confirmation message

**Target 3: Version Reporting**
- **File:** widget.js
- **Location:** Top of file (line 2)
- **Change:** Add version constant and log it
- **Why:** Confirms which version is actually running vs. what was requested
- **Safety:** SAFE-BEHAVIOR - Informational only

**Example:**
```javascript
/* widget.js
 * ReflectivAI Chat/Coach — drop-in
 * Version: 20251106-1200
 */
(function () {
  const WIDGET_VERSION = '20251106-1200';
  console.info(`ReflectivAI widget.js version ${WIDGET_VERSION} loaded`);
  // ... rest of code
```

### 6.2 Medium Value, Medium Risk

**Target 4: Graceful Empty Scenarios**
- **File:** widget.js
- **Function:** populateDiseases() (line 1156)
- **Change:** Show user-friendly message when scenarios array is empty
- **Why:** Currently empty dropdowns are confusing
- **Safety:** SAFE-UI with careful testing

**Target 5: Config Validation**
- **File:** widget.js
- **Function:** init()
- **Change:** Validate cfg.apiBase exists and is a valid URL
- **Why:** Prevents cryptic fetch failures later
- **Safety:** SAFE-BEHAVIOR - Adds validation without changing flow

### 6.3 Low Value, High Risk (Defer to Phase 4)

**Target 6: Retry on Mount Timeout**
- **File:** widget.js
- **Function:** waitForMount()
- **Change:** Retry mount discovery if 15-second timeout expires
- **Why:** Increases resilience to slow DOM construction
- **Safety:** RISKY - Changes core initialization timing

**Target 7: buildUI() Exception Wrapper**
- **File:** widget.js
- **Function:** buildUI()
- **Change:** Wrap entire function in try-catch
- **Why:** Prevents partial UI states
- **Safety:** RISKY - Could mask important errors

---

## 7. SUMMARY AND CONCLUSIONS

### 7.1 Key Findings

1. **Widget Logic is Cache-Buster Agnostic** ✅
   - No code in widget.js examines its own URL or query parameters
   - Mount discovery, initialization, and data loading are path-independent
   - Internal logic cannot cause version-specific failures

2. **Most Likely Root Cause: External Routing** 🔴
   - Hypothesis 1 (Cloudflare Worker version validation) is most consistent with symptoms
   - Worker.js (frozen) may have hardcoded version whitelist or routing logic
   - Changing `?v=` triggers different Worker behavior

3. **Secondary Likely Cause: CDN Cache Misconfiguration** 🟡
   - Hypothesis 2 (CDN cache key collision) explains intermittent issues
   - Cloudflare CDN may ignore query parameters in cache key
   - Results in serving stale content despite version change

4. **Widget Has Silent Failure Modes** ⚠️
   - Config load failure: Widget mounts but API calls fail
   - Scenarios load failure: Widget mounts but dropdowns empty
   - buildUI() exception: Widget container remains empty
   - All failures could appear as "widget disappeared" to user

5. **No Service Worker Involvement** ✅
   - Repository has no Service Worker registered
   - Service Worker hypothesis ruled out

### 7.2 Diagnostic Strategy

**Immediate Actions (No Code Changes):**
1. Run Manual Test Checklist (Section 5) to gather data
2. Check widget.js Network request status (200 vs 404/403)
3. Examine Cache-Control and CF-Cache-Status headers
4. Test with hard refresh (Ctrl+Shift+R) to bypass cache

**If widget.js Returns 404/403:**
- Root cause is Worker routing (Hypothesis 1)
- Solution requires Worker.js modification (Phase 4)
- Or requires coordinating version strings between index.html and Worker config

**If widget.js Returns 200 but Widget Doesn't Appear:**
- Check Console for JavaScript errors
- Verify mount element exists in Elements tab
- Check if config.json, scenarios.json loaded successfully
- Root cause likely in data loading or UI construction

**If widget.js Returns 304 (Not Modified):**
- Cache header issue (Hypothesis 2)
- Clear browser cache and test
- Examine `Cache-Control` header on widget.js response

### 7.3 Phase 3 Strategy

Based on Safe-Edit Map:

**DO in Phase 3:**
- Add comprehensive error logging to all RISKY functions
- Add version reporting at widget load
- Improve empty-state UI (graceful degradation messages)
- Enhance config validation

**DON'T in Phase 3:**
- Change mount discovery logic (CRITICAL-PATH)
- Modify initialization sequence (CRITICAL-PATH)
- Remove error handling (RISKY)
- Change API communication (RISKY without tests)

**Rationale:**
Phase 3 should focus on observability and resilience, not behavioral changes. The goal is to make failures **visible and diagnosable**, not to prevent them through code changes.

### 7.4 Open Questions for Investigation

1. **Worker.js Behavior:**
   - Does Worker validate version string from query parameter?
   - Does Worker have version-specific routing rules?
   - What happens when Worker sees unknown version?

2. **Cloudflare Cache Configuration:**
   - Does CDN respect query parameters in cache key?
   - What is `Cache-Control` header on widget.js?
   - Is there cache purge automation on deploy?

3. **Deployment Timing:**
   - How long between GitHub Pages deploy and Cloudflare cache refresh?
   - Is there a window where HTML and JS are out of sync?

4. **Browser Cache Behavior:**
   - Do different browsers handle `?v=` differently?
   - Does hard refresh work consistently?
   - Are there browser extensions interfering?

### 7.5 Success Criteria for Phase 3

**Observability Improvements:**
- [ ] Every failure path logs to console with context
- [ ] Widget version is clearly reported on load
- [ ] Mount success is confirmed in console
- [ ] Config and scenario load failures are explicit

**Resilience Improvements:**
- [ ] Empty scenarios show user-friendly message
- [ ] Invalid config is detected and reported
- [ ] Partial UI states are prevented or logged

**No Regressions:**
- [ ] Widget still mounts in all 4 modes
- [ ] All existing functionality preserved
- [ ] No new exceptions introduced
- [ ] Manual Test Checklist passes

---

## APPENDICES

### Appendix A: Function Classification Summary

**CRITICAL-PATH (Never Touch):**
- waitForMount (28-50)
- onReady (20-26)
- init invocation (2143)
- buildUI invocation (2140)
- mount.appendChild (1074)

**RISKY (Phase 4 Only):**
- init() (2108-2140)
- callModel() (1540-1662)
- sendMessage() (1823-2064)
- loadScenarios() (2067-2105)
- fetchLocal() (98-103)

**SAFE-BEHAVIOR (Phase 3 with Testing):**
- scoreReply() (621-693)
- EI scoring (696-758)
- generateDynamicFeedback() (760-786)
- sanitizeRolePlayOnly() (222-316)
- buildPreface() (802-880)

**SAFE-UI (Phase 3 Low Risk):**
- CSS injection (888-927)
- renderCoach() (1190-1289)
- renderMessages() (1192-1220)
- md() formatting (422-440)

### Appendix B: Error Message Reference

**Current Error Messages in widget.js:**

Line 100: `Failed to load ${path} (${r.status})`
Line 148: `${path}_http_${r.status}`
Line 184: `${path}_failed_after_retries`
Line 2117: `config load failed:`
Line 2128: `system.md load failed:`
Line 2135: `about-ei.md load failed:`
Line 2094: `scenarios load failed:`

**Recommended Additional Messages:**

```javascript
// In init() after config load
console.info('ReflectivAI: Config loaded', { apiBase: cfg.apiBase, modes: cfg.modes });

// In buildUI() at end
console.info('ReflectivAI: UI built successfully', { mode: currentMode });

// In waitForMount() on timeout
console.warn('ReflectivAI: Mount timeout after 15s, widget may not appear');

// In callModel() on retry
console.warn(`ReflectivAI: API call retry ${attempt}/${maxRetries}`);
```

### Appendix C: Network Request Checklist

When widget fails, verify these Network requests:

1. **widget.js?v=XXXXXXXX**
   - Status: Should be 200
   - Size: ~65 KB
   - Type: application/javascript
   - Timing: < 1 second

2. **assets/chat/config.json**
   - Status: Should be 200
   - Size: ~1 KB
   - Contains: apiBase, modes, scenariosUrl

3. **assets/chat/system.md**
   - Status: Should be 200
   - Size: ~5 KB
   - Contains: System instructions text

4. **assets/chat/about-ei.md**
   - Status: Should be 200
   - Size: ~7 KB
   - Contains: EI framework text

5. **assets/chat/data/scenarios.merged.json**
   - Status: Should be 200
   - Size: ~varies
   - Contains: Array of scenario objects

### Appendix D: Console Debug Commands

**Check if widget mounted:**
```javascript
document.getElementById('reflectiv-widget')?.classList.contains('cw')
// Should return true if widget initialized
```

**Check config loaded:**
```javascript
// This won't work - config is in IIFE scope
// But you can check network tab for config.json 200 OK
```

**Force modal open:**
```javascript
document.getElementById('coachModal')?.classList.add('open')
document.getElementById('coachModal')?.setAttribute('aria-hidden', 'false')
```

**Check for Service Worker:**
```javascript
navigator.serviceWorker.controller
// Should be null
```

**Check script load:**
```javascript
Array.from(document.scripts).find(s => s.src.includes('widget.js'))
// Should return the script element
```

---

**END OF PHASE 2 DIAGNOSTIC ANALYSIS**
