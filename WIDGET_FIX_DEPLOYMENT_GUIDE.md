# Widget Functionality Restoration - Deployment Guide

## Root Cause: Cloudflare Worker Not Deployed

The widget is failing with "No response from server" because the Cloudflare Worker at `https://my-chat-agent-v2.tonyabdelmalak.workers.dev` does not exist or is not reachable.

### Evidence

```bash
$ curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
curl: (6) Could not resolve host: my-chat-agent-v2.tonyabdelmalak.workers.dev
```

DNS resolution fails, meaning the worker was never deployed, was deleted, or the Cloudflare account has issues.

## Solution: Deploy the Worker to Cloudflare

### Prerequisites

1. **Cloudflare Account** with Workers enabled
   - Account ID: `59fea97fab54fbd4d4168ccaa1fa3410` (from wrangler.toml)

2. **Cloudflare API Token** with Workers deployment permissions
   - Needs to be added to GitHub Secrets: `CLOUDFLARE_API_TOKEN`

3. **Groq API Key** for the LLM provider
   - Get from: https://console.groq.com/keys
   - Format: starts with `gsk_...`

### Deployment Steps

#### Option 1: Deploy via GitHub Actions (Recommended)

1. **Set GitHub Secrets:**
   
   Go to: https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
   
   Add these secrets:
   - `CLOUDFLARE_API_TOKEN` - Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` - `59fea97fab54fbd4d4168ccaa1fa3410`

2. **Trigger Deployment:**
   
   The workflow `.github/workflows/cloudflare-worker.yml` will automatically deploy on push to `main` branch.
   
   Or manually trigger:
   - Go to: https://github.com/ReflectivEI/reflectiv-ai/actions/workflows/cloudflare-worker.yml
   - Click "Run workflow" → Select branch `main` → "Run workflow"

3. **Set Worker Secrets:**
   
   After deployment, set the PROVIDER_KEY via Cloudflare Dashboard or wrangler CLI:
   
   ```bash
   npx wrangler secret put PROVIDER_KEY
   # Enter your Groq API key when prompted
   ```

#### Option 2: Deploy Manually via Wrangler CLI

1. **Install Wrangler:**
   ```bash
   npm install -g wrangler
   # Or use npx: npx wrangler <command>
   ```

2. **Login to Cloudflare:**
   ```bash
   npx wrangler login
   ```

3. **Deploy the Worker:**
   ```bash
   cd /path/to/reflectiv-ai
   npx wrangler deploy
   ```

4. **Set Secrets:**
   ```bash
   npx wrangler secret put PROVIDER_KEY
   # Enter your Groq API key when prompted
   
   # Optional: Add additional keys for rotation
   npx wrangler secret put PROVIDER_KEY_2
   npx wrangler secret put PROVIDER_KEY_3
   ```

5. **Verify Deployment:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   # Should return: "ok"
   
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
   # Should return: {"version":"r10.1"}
   ```

### Verification

After deployment, test the worker:

1. **Health Check:**
   ```bash
   curl -v https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   ```
   Expected: HTTP 200 OK with body "ok"

2. **Deep Health Check:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=true
   ```
   Expected: JSON response with `{"ok":true,"time":...,"key_pool":...,"provider":{...}}`

3. **Version Check:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
   ```
   Expected: `{"version":"r10.1"}`

4. **Test Chat Endpoint:**
   ```bash
   curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
     -H "Content-Type: application/json" \
     -H "Origin: https://reflectivei.github.io" \
     -d '{
       "mode": "sales-coach",
       "user": "How do I start a conversation with a busy HCP?",
       "history": [],
       "disease": "HIV",
       "persona": "Busy PCP",
       "goal": "Initiate PrEP discussion"
     }'
   ```
   Expected: JSON response with `{"reply":"...","coach":{...},"plan":{...}}`

### Widget Testing

After worker is deployed and responding:

1. Open: https://reflectivei.github.io/reflectiv-ai/ (or your deployment)
2. Click "Explore Platform" or "Open Coach"
3. Select a mode (e.g., "Sales Coach")
4. Type a message and click Send
5. Verify you receive a response (not "No response from server")

## Troubleshooting

### Worker Deploys but Health Check Fails

**Problem:** `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health` returns 502 or 500

**Solutions:**
1. Check PROVIDER_KEY is set:
   ```bash
   npx wrangler secret list
   ```
2. Check worker logs:
   ```bash
   npx wrangler tail
   ```
3. Verify CORS_ORIGINS includes your frontend domain in wrangler.toml

### DNS Still Not Resolving

**Problem:** Worker deploys successfully but DNS still fails

**Solutions:**
1. Wait 5-10 minutes for DNS propagation
2. Clear your DNS cache:
   - macOS: `sudo dscacheutil -flushcache`
   - Windows: `ipconfig /flushdns`
   - Linux: `sudo systemd-resolve --flush-caches`
3. Try a different DNS server (e.g., 8.8.8.8)
4. Check Cloudflare dashboard to verify worker exists

### Widget Still Shows "No Response"

**Problem:** Worker is healthy but widget still fails

**Solutions:**
1. Check browser console for CORS errors:
   - Open DevTools → Console
   - Look for "CORS" or "blocked" errors
2. Verify CORS_ORIGINS in wrangler.toml includes your frontend origin
3. Hard refresh the page (Ctrl+Shift+R or Cmd+Shift+R)
4. Check widget.js is loading the correct WORKER_URL (check line 276-277)

## Alternative: Deploy to Different Worker Name

If `my-chat-agent-v2.tonyabdelmalak.workers.dev` cannot be used:

1. **Update wrangler.toml:**
   ```toml
   name = "reflectiv-ai-worker"  # Change this line
   ```

2. **Deploy:**
   ```bash
   npx wrangler deploy
   ```
   This will create: `https://reflectiv-ai-worker.tonyabdelmalak.workers.dev`

3. **Update index.html line 525:**
   ```javascript
   const BASE = 'https://reflectiv-ai-worker.tonyabdelmalak.workers.dev';
   ```

4. **Commit and deploy to GitHub Pages**

## Files Modified in This Fix

- `WIDGET_FIX_DEPLOYMENT_GUIDE.md` - This deployment guide (new)
- (No code changes needed - deployment issue only)

## Success Criteria

✅ Worker health endpoint returns 200 OK  
✅ Worker version endpoint returns `{"version":"r10.1"}`  
✅ Widget opens and displays chat interface  
✅ Sending a message returns an AI response  
✅ No "No response from server" errors  

## Need Help?

If you encounter issues:

1. Check GitHub Actions logs: https://github.com/ReflectivEI/reflectiv-ai/actions
2. Check Cloudflare Worker logs: `npx wrangler tail`
3. Review CORS setup in wrangler.toml lines 38-40
4. Verify Groq API key is valid: https://console.groq.com/keys
