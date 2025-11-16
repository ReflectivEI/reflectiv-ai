# 🚀 Cloudflare Worker Deployment Instructions

## Current Status

✅ **Code is ready:**
- `assets/chat/core/api.js` - Now properly calls the Cloudflare Worker
- `wrangler.toml` - Configured with correct model: llama-3.1-8b-instant
- `worker.js` - Ready to be deployed

⚠️ **Action Required:**
- The worker needs to be deployed to https://my-chat-agent-v2.tonyabdelmalak.workers.dev

## Deployment Options

### Option 1: GitHub Actions (Easiest) ✨

1. **Merge this PR to main:**
   - The `.github/workflows/deploy-cloudflare-worker.yml` will auto-deploy on merge

2. **OR manually trigger the workflow:**
   - Go to: https://github.com/ReflectivEI/reflectiv-ai/actions/workflows/deploy-cloudflare-worker.yml
   - Click "Run workflow"
   - Select branch: `copilot/diagnose-cloudflare-worker-issue`
   - Click "Run workflow" button

### Option 2: Deploy Locally 💻

```bash
# Make sure you're in the repo
cd /path/to/reflectiv-ai

# Checkout this branch
git checkout copilot/diagnose-cloudflare-worker-issue
git pull

# Deploy with wrangler
npx wrangler deploy

# If prompted for login, follow the OAuth flow
# Your CLOUDFLARE_API_TOKEN from GitHub secrets should already be configured
```

### Option 3: Cloudflare Dashboard 🌐

1. Go to: https://dash.cloudflare.com
2. Navigate to: Workers & Pages → my-chat-agent-v2
3. Click "Edit Code"
4. Copy the entire contents of `worker.js`
5. Paste and "Save and Deploy"

## Verification After Deployment

Once deployed, test these endpoints:

### 1. Health Check
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```
**Expected:** `ok`

### 2. Version Check
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```
**Expected:** `{"version":"r10.1"}`

### 3. Chat Endpoint
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-coach",
    "messages": [{"role": "user", "content": "What is PrEP?"}],
    "threadId": "test-123"
  }'
```
**Expected:** JSON response with `reply`, `coach`, and `plan` fields

## Troubleshooting

If deployment fails:

1. **Check PROVIDER_KEY secret:**
   ```bash
   npx wrangler secret put PROVIDER_KEY
   # Enter your Groq API key (starts with gsk_...)
   ```

2. **Verify GitHub secret is set:**
   - Go to: https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
   - Ensure `CLOUDFLARE_API_TOKEN` exists

3. **Check deployment logs:**
   - GitHub Actions: Check the workflow run logs
   - Cloudflare Dashboard: Workers & Pages → my-chat-agent-v2 → Logs

## What This Fixes

✅ The frontend will now successfully call the Cloudflare Worker
✅ Chat functionality will work with actual AI (not hardcoded responses)
✅ Proper retry logic and error handling
✅ Correct model: llama-3.1-8b-instant (your paid Groq model)
