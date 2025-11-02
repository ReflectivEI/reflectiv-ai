# Frontend Integration Notes for emitEi Flag

## Overview
The backend worker now supports the `?emitEi=true` query parameter. The frontend needs to be updated to pass this flag when making chat requests in sales-simulation mode.

## Current State
The widget.js currently calls the worker endpoint via:
- Direct fetch in `callModel()` function (line ~1841)
- SSE streaming via `streamWithSSE()` function (line ~1627)

## Required Frontend Changes

### Option 1: Update SSE URL Construction (Recommended)
In the `streamWithSSE` function (around line 1642-1644), add the emitEi parameter:

```javascript
// Current code:
const sseUrl = new URL(url);
sseUrl.searchParams.set("stream", "true");
sseUrl.searchParams.set("data", btoa(payloadStr));

// Should become:
const sseUrl = new URL(url);
sseUrl.searchParams.set("stream", "true");
sseUrl.searchParams.set("data", btoa(payloadStr));
if (currentMode === "sales-simulation") {
  sseUrl.searchParams.set("emitEi", "true");
}
```

### Option 2: Update Regular Fetch URL (for non-streaming)
In the `callModel` function (around line 1841), update the fetch call:

```javascript
// Current code:
const r = await fetch(url, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Req-Id": rid()
  },
  body: JSON.stringify(payload),
  signal: controller.signal
});

// Should become:
const requestUrl = currentMode === "sales-simulation" 
  ? `${url}?emitEi=true` 
  : url;

const r = await fetch(requestUrl, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Req-Id": rid()
  },
  body: JSON.stringify(payload),
  signal: controller.signal
});
```

### Option 3: Global Configuration Flag
Add to config.json:
```json
{
  "emitEi": true,
  // ... other config
}
```

Then in widget.js, check this config flag and append the parameter accordingly.

## Testing Frontend Integration

After making the changes:

1. **Test sales-simulation mode**: Verify that EI scores appear in the coach panel
2. **Test role-play mode**: Verify that EI scores do NOT appear
3. **Test with emitEi disabled**: Verify behavior matches expectations

### Expected Coach Object Structure

**With emitEi=true and sales-simulation:**
```javascript
{
  overall: 85,
  scores: {
    empathy: 4,
    discovery: 5,
    compliance: 5,
    clarity: 5,
    accuracy: 5
  },
  scores_v2: {
    confidence: 5,
    active_listening: 5,
    rapport: 4,
    adaptability: 5,
    persistence: 5
  },
  worked: ["..."],
  improve: ["..."],
  phrasing: "...",
  feedback: "...",
  context: {...}
}
```

**Without emitEi or in role-play:**
```javascript
{
  overall: 85,
  worked: ["..."],
  improve: ["..."],
  phrasing: "...",
  feedback: "...",
  context: {...}
}
```

## Backend Support Already Implemented ✅

The worker.js has been updated with:
- ✅ Query parameter extraction for `emitEi`
- ✅ New deterministic EI scoring (5 dimensions)
- ✅ Mapping to legacy keys for backward compatibility
- ✅ Conditional inclusion based on flag and mode
- ✅ Both v2 and legacy scores for diagnostics

## Next Steps (Frontend Task)

1. Update widget.js to append `?emitEi=true` when in sales-simulation mode
2. Test the integration end-to-end
3. Verify EI scores display correctly in the widget UI
4. Ensure no breaking changes in role-play mode

---

**Note**: The problem statement mentions this will be handled in a separate Copilot task for the frontend repository. This document serves as a guide for that implementation.
