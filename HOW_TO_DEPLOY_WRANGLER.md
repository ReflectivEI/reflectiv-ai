# How to Deploy with Wrangler - Step by Step Guide

This guide walks you through deploying the CORS-fixed worker to Cloudflare using Wrangler.

## What is Wrangler?
Wrangler is Cloudflare's official CLI tool for managing and deploying Cloudflare Workers. It handles authentication, deployment, and configuration management.

## Prerequisites
- Node.js installed (version 16.13.0 or later)
- A Cloudflare account
- Access to the Cloudflare account where the worker is deployed

## Step 1: Install Wrangler

### Option A: Global Installation (Recommended)
```bash
npm install -g wrangler
```

### Option B: Use npx (No Installation Required)
If you prefer not to install globally, you can use npx:
```bash
npx wrangler [command]
```

### Verify Installation
```bash
wrangler --version
```
Should output something like: `wrangler 3.x.x`

## Step 2: Authenticate with Cloudflare

### Login to Cloudflare
```bash
wrangler login
```

This will:
1. Open your browser
2. Ask you to log in to your Cloudflare account
3. Request permission to access your account
4. Save authentication token locally

### Verify Authentication
```bash
wrangler whoami
```

Should display your account email and account ID.

## Step 3: Configure the Worker (Already Done)

The `wrangler.toml` file in the repository is already configured:

```toml
name = "my-chat-agent-v2"
main = "worker.js"
compatibility_date = "2024-11-12"
workers_dev = true

[vars]
PROVIDER = "groq"
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
PROVIDER_MODEL = "llama-3.1-70b-versatile"
MAX_OUTPUT_TOKENS = "1400"
CORS_ORIGINS = "https://reflectivei.github.io,https://reflectivai.github.io,..."
```

No changes needed here!

## Step 4: Set Secrets (If First Deployment)

The worker needs the `PROVIDER_KEY` secret (Groq API key).

### Check if Secret Exists
```bash
wrangler secret list
```

### Set the Secret (if needed)
```bash
wrangler secret put PROVIDER_KEY
```

When prompted, paste your Groq API key (starts with "gsk_...") and press Enter.

**Note:** If the secret is already set, you don't need to set it again.

## Step 5: Deploy the Worker

### From the Repository Root
```bash
cd /home/runner/work/reflectiv-ai/reflectiv-ai
wrangler deploy
```

### What Happens During Deployment
1. Wrangler reads `wrangler.toml`
2. Bundles `worker.js` and dependencies
3. Uploads to Cloudflare
4. Applies configuration and environment variables
5. Activates the new version

### Expected Output
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded my-chat-agent-v2 (X.XX sec)
Published my-chat-agent-v2 (X.XX sec)
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev
Current Deployment ID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## Step 6: Verify Deployment

### Check Deployment Status
```bash
wrangler deployments list
```

Shows recent deployments with timestamps.

### View Specific Deployment
```bash
wrangler deployments view <deployment-id>
```

### Test the Health Endpoint
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

Should return: `ok`

### Test CORS Headers
```bash
curl -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -i
```

Should include these headers:
```
Access-Control-Allow-Origin: https://reflectivei.github.io
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,OPTIONS
```

## Step 7: Test from Browser

1. Navigate to https://reflectivei.github.io
2. Open browser Developer Tools (F12)
3. Go to Console tab
4. Run this command:
```javascript
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health')
  .then(r => r.text())
  .then(console.log)
  .catch(console.error)
```

Should print: `ok` (no CORS errors)

5. Test the chat widget - it should work without errors!

## Common Commands

### View Logs (Real-time)
```bash
wrangler tail
```
Press Ctrl+C to stop.

### View Logs (Filtered)
```bash
wrangler tail --status error
```

### Check Configuration
```bash
wrangler whoami        # Show account info
wrangler secret list   # List secrets (not values)
```

### Rollback (if needed)
```bash
wrangler rollback [deployment-id]
```

## Troubleshooting

### "Not authorized" Error
**Solution:** Run `wrangler login` again

### "Worker name already exists"
**Solution:** This is expected - it will update the existing worker

### "Secret not found" Error
**Solution:** Set the secret:
```bash
wrangler secret put PROVIDER_KEY
```

### "Permission denied" Error
**Solution:** Verify you have access to the Cloudflare account
```bash
wrangler whoami
```

### Deployment succeeds but CORS still broken
**Solution:** 
1. Hard refresh browser (Ctrl+Shift+R)
2. Clear browser cache
3. Check deployment: `wrangler deployments list`
4. Verify the latest deployment is active

### "Module not found" Error
**Solution:** Ensure you're in the correct directory:
```bash
pwd  # Should show: /home/runner/work/reflectiv-ai/reflectiv-ai
ls worker.js  # Should exist
```

## Alternative: Deploy via Cloudflare Dashboard

If you prefer using the web interface:

1. Go to https://dash.cloudflare.com/
2. Select your account
3. Go to "Workers & Pages"
4. Find "my-chat-agent-v2"
5. Click "Edit Code"
6. Paste the contents of `worker.js`
7. Click "Save and Deploy"

**Note:** This method won't update `wrangler.toml` settings. CLI deployment is recommended.

## Quick Reference Commands

```bash
# Install
npm install -g wrangler

# Login
wrangler login

# Check auth
wrangler whoami

# Set secret (first time only)
wrangler secret put PROVIDER_KEY

# Deploy
wrangler deploy

# View deployments
wrangler deployments list

# View logs
wrangler tail

# Test health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

## After Deployment Checklist

- [ ] `wrangler deploy` completed successfully
- [ ] Health endpoint returns "ok"
- [ ] CORS headers present in curl test
- [ ] Browser console shows no CORS errors
- [ ] Chat widget works on https://reflectivei.github.io
- [ ] Error messages from problem statement resolved

## Need Help?

- Wrangler Docs: https://developers.cloudflare.com/workers/wrangler/
- Workers Docs: https://developers.cloudflare.com/workers/
- Cloudflare Discord: https://discord.gg/cloudflaredev

---

## Summary

The deployment process is simple:
1. `npm install -g wrangler`
2. `wrangler login`
3. `wrangler deploy`
4. Test and verify

That's it! The CORS fix will be live after step 3.
