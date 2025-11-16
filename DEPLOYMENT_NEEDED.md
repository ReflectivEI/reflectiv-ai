# Deployment Required to Fix Chat Error

## Summary
The chat errors were caused by **two issues**:
1. **Payload mismatch** between the widget and worker (HTTP 400 error) - **FIXED**
2. **CORS configuration** missing the correct origin - **FIXED**

Both the widget.js and worker.js need to be deployed for the fixes to take effect.

## What Was Fixed

### Issue 1: Payload Mismatch (HTTP 400 Error)

#### Frontend Fix (widget.js)
**Problem:** Widget was sending entire `scenario` object in payload
**Solution:** Extract individual fields from scenario object

Changed from:
```javascript
{
  messages,
  mode: currentMode,
  scenario: scenarioContext  // ❌ Wrong - worker doesn't use this
}
```

Changed to:
```javascript
{
  messages,
  mode: currentMode,
  disease: scenarioContext.therapeuticArea,     // ✅ Correct
  persona: scenarioContext.hcpProfile,          // ✅ Correct
  goal: scenarioContext.goal,                   // ✅ Correct
  scenarioId: scenarioContext.id                // ✅ Correct
}
```

**Files changed:**
- `widget.js` (lines 2704-2716)
- `index.html` (updated cache-busting version to 20251116-1121)

### Issue 2: CORS Configuration Error

#### Backend Fix (wrangler.toml)
**Problem:** CORS_ORIGINS was missing `https://reflectivei.github.io` (without path)
**Error:** `Access-Control-Allow-Origin header has a value 'null'`

**Solution:** Added `https://reflectivei.github.io` to CORS_ORIGINS

Changed from:
```toml
CORS_ORIGINS = "https://reflectivei.github.io/reflectiv-ai,https://reflectivai.github.io,..."
```

Changed to:
```toml
CORS_ORIGINS = "https://reflectivei.github.io,https://reflectivei.github.io/reflectiv-ai,https://reflectivai.github.io,..."
```

**Note:** Browser sends origin as `https://reflectivei.github.io` (without path), so it must be in the allowlist.

**Files changed:**
- `wrangler.toml` (line 24)

### Backend Compatibility (worker.js)
The current worker.js (r10.1) expects this payload format:
```javascript
{
  messages: [...],
  mode: "sales-coach",
  disease: "HIV",           // Not "scenario" object
  persona: "Internal Medicine MD",
  goal: "...",
  scenarioId: "hiv_im_decile3_prep_lowshare"
}
```

## Deployment Steps

### 1. Deploy Frontend (GitHub Pages)
The repository appears to be hosted on GitHub Pages. To deploy:

```bash
# The changes are already committed to the branch
# GitHub Pages will automatically deploy when changes are merged to main branch
# OR if the branch is configured as the deployment branch
```

**Files to deploy:**
- `widget.js` (contains the payload fix)
- `index.html` (updated cache-busting version)

### 2. Deploy Worker (Cloudflare)
The Cloudflare worker needs to be deployed (or redeployed) to ensure it's running the latest code:

```bash
# Authenticate (if not already done)
wrangler login

# Deploy the worker
wrangler deploy
```

**Verify deployment:**
```bash
# Check version
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version

# Expected response:
# {"version":"r10.1"}
```

## Why Both Need to Be Deployed

1. **Frontend (widget.js):** Sends the correct payload format
2. **Backend (worker.js + wrangler.toml):** 
   - Expects and processes the correct payload format
   - Has the correct CORS origins configured

If only one is deployed, issues will persist:
- Old widget + New worker = ❌ Still sends wrong format
- New widget + Old worker/config = ❌ CORS error or wrong payload handling  
- New widget + New worker + New config = ✅ Everything works

## Testing After Deployment

### Test 1: Version Check
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```
Should return: `{"version":"r10.1"}`

### Test 2: Chat Request
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [{"role": "user", "content": "Test message"}],
    "disease": "HIV",
    "persona": "Internal Medicine MD"
  }'
```
Should return a successful response (not 400)

### Test 3: Browser Test
1. Open the website in a browser
2. Clear browser cache (or open in incognito/private mode)
3. Select a scenario
4. Send a chat message
5. Should receive a response without 400 error

## Cache Busting
The widget.js version has been updated from `?v=20251116-0600` to `?v=20251116-1121` to ensure browsers load the new version. Users may need to:
- Hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- Clear browser cache
- Use incognito/private mode

## Summary Checklist
- [x] Fix applied to widget.js (extract scenario fields)
- [x] Cache-busting version updated in index.html
- [x] Fix applied to wrangler.toml (add CORS origin)
- [x] Changes committed to repository
- [ ] **Deploy frontend (GitHub Pages or hosting platform)**
- [ ] **Deploy worker (Cloudflare Workers via wrangler deploy)**
- [ ] Verify /version endpoint returns r10.1
- [ ] Verify CORS headers are correct
- [ ] Test chat functionality in browser
- [ ] Clear browser cache if needed
