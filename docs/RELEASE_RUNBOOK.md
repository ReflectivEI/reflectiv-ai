# Release Runbook

This document explains the deployment and health-gate steps for the ReflectivAI platform.

## Table of Contents
1. [Pre-Deployment Health Check](#pre-deployment-health-check)
2. [Deployment Steps](#deployment-steps)
3. [Post-Deployment Verification](#post-deployment-verification)
4. [Rollback Procedure](#rollback-procedure)
5. [Health Gate Details](#health-gate-details)

---

## Pre-Deployment Health Check

Before deploying any changes, verify the Worker backend is healthy:

```bash
# Check health endpoint
curl -I https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Expected response:
# HTTP/2 200
# (body contains "ok")
```

**Success criteria:**
- HTTP status: `200 OK`
- Response time: < 1500ms
- No 5xx errors in last 10 minutes

If health check fails, investigate Worker logs before proceeding.

---

## Deployment Steps

### 1. Deploy Worker (if changes included)

```bash
# From repository root
cd /path/to/reflectiv-ai

# Test worker locally
npm test

# Deploy to Cloudflare
npx wrangler deploy

# Verify deployment
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

### 2. Deploy Frontend

Frontend is automatically deployed via GitHub Pages when pushing to the main branch.

```bash
# Commit changes
git add .
git commit -m "Release: [description]"

# Push to trigger deployment
git push origin main
```

GitHub Actions will build and deploy to GitHub Pages automatically.

### 3. Cache Busting

Widget cache-bust version is controlled in `index.html`:

```html
<script defer src="widget.js?v=guardrails1"></script>
```

Increment the version parameter (e.g., `?v=guardrails2`) to force cache refresh on client browsers.

---

## Post-Deployment Verification

### 1. Health Gate Verification

The widget performs automatic health checks:

1. **On Init**: HEAD request to `${window.WORKER_URL}/health` with 1500ms timeout
2. **If unhealthy**: 
   - Send button is disabled
   - Yellow banner shows: "⚠️ Backend unavailable. Trying again…"
   - Auto-retry every 20 seconds
3. **When healthy**:
   - Banner disappears
   - Send button is enabled
   - Chat functionality restored

### 2. Manual Verification Steps

```bash
# 1. Test health endpoint
curl -I https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# 2. Test chat endpoint
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "test"}],
    "temperature": 0.2,
    "max_output_tokens": 100
  }'
```

### 3. Browser Testing

1. Open https://reflectivei.github.io/reflectiv-ai/
2. Open browser DevTools Console
3. Send a test message
4. Verify logs show: `[chat] status=200 path=/chat`
5. Check for any error toasts

---

## Rollback Procedure

### Quick Rollback (Widget Only)

If the widget has issues but the Worker is healthy:

1. Revert the cache-bust version in `index.html`:
   ```html
   <script defer src="widget.js?v=rollback1"></script>
   ```

2. Push to trigger redeployment:
   ```bash
   git add index.html
   git commit -m "Rollback: revert to rollback1"
   git push origin main
   ```

3. Clear CDN cache (if applicable)

### Full Rollback (Worker + Widget)

If the Worker needs to be rolled back:

1. **Worker rollback:**
   ```bash
   # View deployments
   npx wrangler deployments list
   
   # Rollback to previous deployment
   npx wrangler rollback [deployment-id]
   ```

2. **Widget rollback:**
   Follow the Quick Rollback steps above.

3. **Verify:**
   ```bash
   curl -I https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   ```

---

## Health Gate Details

### How It Works

The health gate is a client-side safety mechanism:

1. **Initialization** (`widget.js`):
   - On page load, `checkHealth()` is called
   - Performs HEAD request to `/health` endpoint
   - 1500ms timeout to fail fast

2. **Health Check Function**:
   ```javascript
   async function checkHealth() {
     const healthUrl = `${window.WORKER_URL}/health`;
     const controller = new AbortController();
     const timeout = setTimeout(() => controller.abort(), 1500);
     
     try {
       const response = await fetch(healthUrl, {
         method: "HEAD",
         signal: controller.signal
       });
       
       if (response.ok) {
         // Backend healthy - enable Send button, hide banner
         isHealthy = true;
         return true;
       }
       
       // Backend unhealthy - disable Send, show banner
       isHealthy = false;
       return false;
     } catch (e) {
       // Network error - disable Send, show banner
       isHealthy = false;
       return false;
     }
   }
   ```

3. **Retry Loop**:
   - If initial check fails, starts 20-second retry interval
   - Continues until backend becomes healthy
   - Auto-clears interval when healthy

4. **Send Protection**:
   ```javascript
   async function sendMessage(userText) {
     if (!isHealthy) {
       showToast("Backend unavailable. Please wait...", "error");
       return;
     }
     // ... proceed with send
   }
   ```

### Error Messages

The widget shows user-friendly error messages:

- **Backend unavailable**: "⚠️ Backend unavailable. Trying again…"
- **Network error**: "Network error. Please check your connection and retry."
- **Request failed**: "Request failed (status XYZ). Please retry."
- **JSON parse error**: "Request failed (JSON parse error). Please retry."

### Console Logging

All errors are logged in a consistent format:

```javascript
console.error(`[chat] status=<code> path=/chat`);
console.error(`[chat] status=timeout path=/chat retry=<N>`);
console.error(`[chat] status=network_error path=/chat error=<message>`);
```

Use browser DevTools to inspect these logs for debugging.

---

## Troubleshooting

### Widget shows "Backend unavailable" but Worker is up

1. Check CORS settings in Worker (`CORS_ORIGINS` environment variable)
2. Verify `window.WORKER_URL` is correct in `index.html`
3. Check browser console for CORS errors
4. Test health endpoint directly:
   ```bash
   curl -I https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   ```

### Chat requests fail with 429 or 5xx errors

1. Check Cloudflare Worker logs for rate limiting or errors
2. Verify Worker environment variables are set correctly
3. Check upstream provider (Groq API) status
4. Review Worker metrics in Cloudflare dashboard

### Send button never re-enables

1. Health check may be failing silently
2. Open browser DevTools Console
3. Look for health check errors
4. Manually test: `await checkHealth()` in console

---

## Environment Variables

Required Worker environment variables:

- `PROVIDER_URL`: Upstream AI provider URL
- `PROVIDER_MODEL`: Model name (e.g., "llama-3.1-70b-versatile")
- `PROVIDER_KEY`: API key for provider
- `CORS_ORIGINS`: Comma-separated allowed origins

Required Frontend configuration:

- `window.WORKER_URL`: Worker base URL (set in `index.html`)

---

## Support

For issues or questions:
- Check Worker logs in Cloudflare dashboard
- Review browser console logs
- Contact DevOps team for deployment issues
- See [maintenance.md](./maintenance.md) for additional guidance
