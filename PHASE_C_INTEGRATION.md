# Phase C – Frontend Integration and Verification

## Overview
This document describes the Phase C integration that enables the ReflectivAI frontend to automatically request and display Emotional Intelligence (EI) payloads from the Cloudflare Worker.

## Changes Made

### 1. Widget Request Hook (widget.js)
**Location:** Line ~1742 in `widget.js`, function `callModel()`

**Change:**
```javascript
async function callModel(messages) {
  let url = (cfg?.apiBase || cfg?.workerUrl || window.COACH_ENDPOINT || window.WORKER_URL || "").trim();
  
  // Phase C: Append ?emitEi=true for sales-simulation mode to request EI payload from Worker
  if (currentMode === "sales-simulation") {
    const separator = url.includes("?") ? "&" : "?";
    url += separator + "emitEi=true";
  }
  
  const useStreaming = cfg?.stream === true;
  // ... rest of function
}
```

**Behavior:**
- When `currentMode === "sales-simulation"`, appends `?emitEi=true` to Worker URL
- Handles both clean URLs and URLs with existing query parameters
- Other modes (product-knowledge, role-play, emotional-assessment) do NOT include this flag

### 2. Cache Busting (index.html)
**Location:** Line 127 in `index.html`

**Change:**
```html
<!-- Before -->
<script defer src="widget.js?v=202511021843"></script>

<!-- After -->
<script defer src="widget.js?v=emitEi"></script>
```

**Purpose:** Forces browsers and GitHub Pages to reload the updated widget.js file

## EI Panel Implementation

### Yellow EI Summary Panel
**Location:** Lines 182-212 in `widget.js`, function `renderEiPanel()`

The EI Summary panel is already implemented and renders automatically when the Worker response contains `_coach.ei` payload:

```javascript
function renderEiPanel(msg) {
  const ei = msg && msg._coach && msg._coach.ei;
  if (!ei || !ei.scores) return "";
  
  // Renders pills for: empathy, discovery, compliance, clarity, accuracy
  // Each pill shows score/5 with color coding (good/ok/bad)
  // Includes rationales and tips
}
```

### Expected Worker Response Structure
```json
{
  "content": "Assistant response text...",
  "_coach": {
    "ei": {
      "scores": {
        "empathy": 4,
        "discovery": 3,
        "compliance": 5,
        "clarity": 4,
        "accuracy": 4
      },
      "rationales": {
        "empathy": "Validated HCP constraints and reframed",
        "discovery": "Asked one focused question",
        ...
      },
      "tips": [
        "Open with HCP context then one ask",
        "Anchor claims to label/guideline",
        ...
      ],
      "rubric_version": "v1.2"
    }
  }
}
```

## Testing

### Dev Shim (Fallback Testing)
The `?eiShim=1` parameter remains available for testing without live Worker data:
```
https://reflectivei.github.io/reflectiv-ai/#simulations?eiShim=1
```

This will inject mock EI data for visual verification.

### Smoke Tests
1. **Desktop Test:**
   - Navigate to `/#simulations` (without ?eiShim=1)
   - Enter sales simulation mode
   - Send first message
   - Verify EI Summary panel appears with pills after assistant reply

2. **Mobile Test:**
   - Use Chrome DevTools iPhone 12 viewport
   - Repeat desktop test steps
   - Verify responsive layout

3. **Console Validation:**
   - Open browser DevTools Console
   - Check Network tab for Worker request
   - Verify URL includes `?emitEi=true` for sales-simulation mode
   - Confirm no CSP errors or 404s

4. **Asset Validation:**
   - All assets return 200 OK:
     - `/assets/chat/config.json` ✓
     - `/assets/chat/persona.json` ✓
     - `/assets/chat/data/scenarios.merged.json` ✓

## Deployment

### GitHub Pages
The changes are deployed automatically via GitHub Pages when merged to the main branch.

**Cache Purging:**
- The `?v=emitEi` query parameter ensures fresh widget.js load
- Browser caching is bypassed for first load after deployment
- Subsequent loads will cache the new version

### Verification Post-Merge
1. Confirm Worker live endpoint is returning EI data
2. Test end-to-end flow: chat → yellow EI panel with populated pills
3. Verify Response JSON contains `_coach.ei.scores.empathy`, etc.
4. Check console for errors
5. Test both with and without `?eiShim=1`

## Architecture

```
User Browser
     ↓
index.html (loads widget.js?v=emitEi)
     ↓
widget.js → callModel()
     ↓
     ├─ if mode === "sales-simulation"
     │     → URL + "?emitEi=true"
     │     → Cloudflare Worker
     │     → Response with _coach.ei payload
     │     → renderEiPanel() renders yellow summary
     │
     └─ if mode !== "sales-simulation"
           → URL (no flag)
           → Standard Worker response
           → No EI panel
```

## Compatibility

- **Browser Support:** All modern browsers (Chrome, Firefox, Safari, Edge)
- **Mobile Support:** Responsive design, tested on iPhone 12 viewport
- **CSP Compliance:** All requests to whitelisted Worker domain
- **Backward Compatibility:** No breaking changes to existing modes

## Files Modified

1. `widget.js` - Added ?emitEi=true logic (7 new lines)
2. `index.html` - Updated cache-busting version (1 line change)

## Related Documentation

- Worker Implementation: See Worker repo for EI payload generation
- EI Scoring Rubric: `/docs/about-ei.html#scoring`
- Testing Guidelines: See PR description for acceptance criteria
