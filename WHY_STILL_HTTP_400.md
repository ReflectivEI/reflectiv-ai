# Still Getting HTTP 400? Here's Why and How to Fix

## The Problem

You're getting HTTP 400 because **the fix hasn't been deployed yet**.

### Current Situation

| Location | Status | Version |
|----------|--------|---------|
| **Your browser** | ❌ Old code | Has HTTP 400 bug |
| **This PR branch** | ✅ Fixed code | Has the fix |
| **Main branch** | ❌ Old code | Needs PR merge |
| **Live website** | ❌ Old code | Serves from main branch |

---

## Why You Still See the Error

### If viewing https://reflectivei.github.io/reflectiv-ai/:

1. **Website serves from `main` branch**
2. **This PR is on `copilot/fix-message-sending-widget` branch**
3. **PR not merged to main yet**
4. **Website still has old buggy code**

### Solution: Merge this PR

```bash
# Merge this PR to main branch
# Then GitHub Pages will automatically update
# Website will get the fixed widget.js
```

---

## How to Test the Fix RIGHT NOW

### Option 1: Test Locally (Recommended)

```bash
# 1. Clone this branch
git clone https://github.com/ReflectivEI/reflectiv-ai.git
cd reflectiv-ai
git checkout copilot/fix-message-sending-widget

# 2. Open test-http-400-fix.html in browser
# This loads the FIXED widget.js from this branch

# 3. Send a message
# Should work - no HTTP 400
```

### Option 2: Use Local HTTP Server

```bash
# In the repository directory:
python3 -m http.server 8000

# Then open: http://localhost:8000/test-http-400-fix.html
```

### Option 3: Check Payload in DevTools

If you want to verify the fix would work:

1. Open browser DevTools (F12)
2. Go to **Network** tab
3. Try sending a message
4. Click on the `/chat` request
5. Look at **Request** → **Payload**

**With Bug (current live site)**:
```json
{
  "messages": [...],
  "mode": "sales-coach"
  // ❌ Missing: disease, persona, goal
}
```

**With Fix (this branch)**:
```json
{
  "messages": [...],
  "mode": "sales-coach",
  "disease": "",      // ✅ Now included
  "persona": "",      // ✅ Now included
  "goal": "",         // ✅ Now included
  "scenarioId": null  // ✅ Now included
}
```

---

## Quick Fix: Force Reload

If you've opened `test-http-400-fix.html` but still see the error:

1. **Hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear cache**: DevTools → Network tab → Disable cache checkbox
3. **Incognito mode**: Try in a new incognito window

---

## After Merging PR to Main

Once this PR is merged:

1. **GitHub Pages auto-deploys** (takes 1-2 minutes)
2. **Website gets updated widget.js**
3. **Users need to hard refresh** (Ctrl+Shift+R)
4. **HTTP 400 error disappears**

---

## Verify the Fix is Deployed

### Check widget.js source:

1. View source of widget.js on live site
2. Search for: `disease: scenarioContext?.therapeuticArea`
3. If found → Fix is deployed ✅
4. If not found → Old version still deployed ❌

### URL to check:
```
https://reflectivei.github.io/reflectiv-ai/widget.js
```

Search for this exact line:
```javascript
disease: scenarioContext?.therapeuticArea || scenarioContext?.diseaseState || "",
```

---

## What's Happening

### Timeline:
1. **Nov 16 11:40** - You cloned repo (has old code)
2. **Nov 16 ~12:00** - I fixed the bug in this PR
3. **Right now** - Fix is in PR branch, NOT in main
4. **Your browser** - Loading from live site (main branch)
5. **Result** - You see old code with HTTP 400 bug

### To Fix:
- **Merge this PR** → Updates main branch
- **GitHub Pages deploys** → Updates live site  
- **Hard refresh** → Browser gets new code
- **Test** → HTTP 400 gone ✅

---

## Alternative: Manual Patch

If you need it working RIGHT NOW before merge:

1. **Download fixed widget.js** from this PR
2. **Host it locally** or replace on your server
3. **Update index.html** to load local widget.js

```html
<!-- Instead of -->
<script src="widget.js?v=20251116-1121"></script>

<!-- Use -->
<script src="widget.js?v=FIXED-LOCAL"></script>
```

---

## Summary

**Why still broken**: Live site hasn't been updated with the fix
**Where fix is**: This PR branch  
**How to fix**: Merge PR → Deploy → Hard refresh  
**Test now**: Use `test-http-400-fix.html` locally

---

## Next Steps

1. **Merge this PR** to main branch
2. **Wait 1-2 minutes** for GitHub Pages deploy
3. **Hard refresh** the website (Ctrl+Shift+R)
4. **Test** - HTTP 400 should be gone
5. **If still fails** - Share the new error (will be different)
