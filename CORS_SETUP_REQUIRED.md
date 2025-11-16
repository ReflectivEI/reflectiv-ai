# CORS Configuration Issue - Backend Setup Required

## Issue
The widget is correctly detecting that the backend is unavailable and showing:
- ⚠️ Banner: "Backend unavailable. Trying again…"
- 🔒 SEND button: Disabled

However, the console shows the actual root cause:
```
Access to fetch at 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat' 
from origin 'https://reflectivei.github.io' has been blocked by CORS policy: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
The Cloudflare Worker backend needs to be configured to allow requests from the GitHub Pages origin (`https://reflectivei.github.io`).

## Solution: Configure CORS_ORIGINS Environment Variable

### Option 1: Via Cloudflare Dashboard
1. Go to Cloudflare Workers & Pages
2. Select the worker: `my-chat-agent-v2`
3. Go to Settings → Variables
4. Add or update the environment variable:
   - **Name:** `CORS_ORIGINS`
   - **Value:** `https://reflectivei.github.io`
   
   Or for multiple origins:
   - **Value:** `https://reflectivei.github.io,http://localhost:8080`

5. Save and redeploy the worker

### Option 2: Via wrangler.toml
Add to `wrangler.toml`:
```toml
[vars]
CORS_ORIGINS = "https://reflectivei.github.io"
```

Then redeploy:
```bash
wrangler publish
```

### Option 3: Via Wrangler CLI
```bash
wrangler secret put CORS_ORIGINS
# Enter: https://reflectivei.github.io
```

## How the Worker Handles CORS

From `worker.js` (lines 251-286):
```javascript
function cors(env, req) {
  const reqOrigin = req.headers.get("Origin") || "";
  const allowed = String(env.CORS_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  // If no allowlist is configured, allow any origin
  // If allowlist exists, check if request origin is in the list
  const isAllowed = allowed.length === 0 || allowed.includes(reqOrigin);
  
  // ...
}
```

**Important:** The worker code expects `CORS_ORIGINS` to be a comma-separated list of allowed origins.

## Verification

After configuring CORS_ORIGINS:

1. Wait ~30 seconds for worker to redeploy
2. Refresh the GitHub Pages site
3. The health check should pass
4. Banner should disappear
5. SEND button should be enabled
6. Messages should send successfully

## Why the Widget is Working Correctly

The widget's behavior is **correct**:
1. ✅ Initial health check fails due to CORS → button disabled, banner shown
2. ✅ Health check polling starts (every 20 seconds)
3. ✅ When user tries to send → blocked by disabled button
4. ✅ Once CORS is fixed → health check passes → banner hides, button enables

## Current Status

**Widget Code:** ✅ Working correctly
**Backend Config:** ❌ Needs CORS_ORIGINS environment variable set

**Action Required:** Configure the Cloudflare Worker's `CORS_ORIGINS` environment variable to include `https://reflectivei.github.io`
