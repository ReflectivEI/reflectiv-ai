# Quick Fix: Deploy the Cloudflare Worker

## The Problem
The widget cannot connect to the backend because the Cloudflare Worker is not deployed.

DNS test proves it:
```
$ host my-chat-agent-v2.tonyabdelmalak.workers.dev
Host not found: 5(REFUSED)
```

## The Solution
Deploy the worker to Cloudflare. Choose one method:

### Method 1: GitHub Actions (Recommended)
1. Go to https://github.com/ReflectivEI/reflectiv-ai/actions
2. Click "Deploy Cloudflare Worker" workflow
3. Click "Run workflow" button
4. Select `main` branch
5. Click green "Run workflow" button
6. Wait for deployment to complete (~1 minute)
7. Verify at: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

**Requirements**:
- `CLOUDFLARE_API_TOKEN` secret must be set in repository settings

### Method 2: Command Line (If you have Cloudflare access)
```bash
# Install wrangler globally
npm install -g wrangler

# Login to Cloudflare  
wrangler login

# Deploy
wrangler deploy

# Verify
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

## Verification
After deployment succeeds, test the widget:
1. Open https://reflectivei.github.io/reflectiv-ai/
2. Click "Explore Platform" or "Open Coach"
3. Type a message: "What is HIV PrEP?"
4. You should see a response rendered

## Timeline
- Before: Widget was working (worker was deployed)
- Now: Widget not working (worker not deployed)
- After deployment: Widget will work again

No code changes needed - just redeploy the worker!
