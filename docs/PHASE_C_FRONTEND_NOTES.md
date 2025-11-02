# Phase C Frontend Notes: EI Flag and Debug Overlay

## Overview
This document describes the frontend changes made to ensure the `emitEi` flag is properly passed to the Worker and to provide a temporary debug overlay for verifying EI payload delivery.

## Changes Made

### 1. Request Flag Implementation
**Location:** `widget.js` - `callModel()` function

- **Query Parameter**: When `currentMode === 'sales-simulation'`, the function now appends `?emitEi=true` to the Worker URL
- **Header**: Adds `X-Emit-EI: true` header to fetch requests in sales-simulation mode
- **URL Handling**: Preserves existing query parameters using URL API

### 2. Debug Overlay
**Location:** `widget.js` - `showEiDebugOverlay()` function

A temporary debug overlay appears in the bottom-right corner after each response in sales-simulation mode, showing:
- ✅/❌ `emitEi` query parameter present
- ✅/❌ `X-Emit-EI` header added
- ✅/❌ `_coach.ei` present in response
- Worker host from URL

The overlay automatically fades out and is removed after 8 seconds.

### 3. Response Data Capture
**Location:** `widget.js` - `callModel()` function

- Stores the full Worker response in `lastWorkerResponse` global variable
- Merges `_coach.ei` data from Worker response into the conversation message if present
- Enables debug overlay to verify EI payload delivery

### 4. Safe Fallback
**Location:** `widget.js` - `renderEiPanel()` function

- No changes required - already handles missing EI gracefully
- Shows legacy yellow bullets when no `_coach.ei` present
- Shows 5 pills (Empathy, Discovery, Compliance, Clarity, Accuracy) when EI is present

### 5. Cache-bust
**Location:** `index.html`

Updated script tag:
```html
<script defer src="widget.js?v=ei-hotfix"></script>
```

## Verification Steps

### Using Browser DevTools

1. **Open the site:**
   ```
   https://reflectivei.github.io/reflectiv-ai/#simulations
   ```

2. **Open DevTools:**
   - Press F12 or Cmd+Option+I (Mac) / Ctrl+Shift+I (Windows/Linux)
   - Go to the **Network** tab
   - Filter by "chat" to see Worker requests

3. **Start a Sales Simulation:**
   - Select "Sales Simulation" mode
   - Send a message to the HCP

4. **Verify the Request:**
   - Click on the `/chat?emitEi=true` request in Network tab
   - **Headers** tab → Request Headers should show:
     ```
     X-Emit-EI: true
     ```
   - **Request URL** should contain:
     ```
     ?emitEi=true
     ```

5. **Verify the Response:**
   - Click on the same request
   - **Response** tab should show JSON with structure:
     ```json
     {
       "content": "...",
       "_coach": {
         "ei": {
           "scores": {
             "empathy": 4,
             "discovery": 3,
             "compliance": 4,
             "clarity": 5,
             "accuracy": 4
           },
           "rationales": { ... },
           "tips": [ ... ],
           "rubric_version": "v1.2"
         }
       }
     }
     ```

6. **Verify the UI:**
   - Yellow panel should show 5 pills with the scores
   - Debug overlay should appear bottom-right for 8 seconds showing all ✅ checkmarks

7. **Verify Console:**
   - Check Console tab for any errors (there should be none)

### Using curl (Optional)

You can also test the Worker directly:

```bash
curl -sS -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat?emitEi=true" \
  -H "Content-Type: application/json" \
  -H "X-Emit-EI: true" \
  -d '{
    "mode": "sales-simulation",
    "messages": [
      {"role": "user", "content": "What criteria do you use to select patients for PrEP?"}
    ]
  }' | jq '._coach.ei.scores'
```

Expected output:
```json
{
  "empathy": 4,
  "discovery": 3,
  "compliance": 4,
  "clarity": 5,
  "accuracy": 4
}
```

## Rollback Plan

If issues occur:

1. **GitHub:** Revert this PR through GitHub UI
2. **Quick Fix:** Change `widget.js?v=ei-hotfix` back to `widget.js?v=202511021843` in index.html
3. **Force Refresh:** Users should hard-refresh (Ctrl+Shift+R / Cmd+Shift+R)

## Known Limitations

- Debug overlay only appears in `sales-simulation` mode
- Debug overlay does not block UI interaction (pointer-events: none)
- EI flag is not sent for other modes (emotional-assessment, product-knowledge, role-play)
- Legacy yellow bullets fallback is preserved for backward compatibility

## Next Steps

After Worker PR is merged and deployed:
1. Test on production Worker endpoint
2. Verify debug overlay shows all ✅ marks
3. Confirm EI pills render correctly with scores
4. Monitor for console errors or network failures
