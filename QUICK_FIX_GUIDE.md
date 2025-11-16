# Quick Reference: Fix Cloudflare Deployment

## Problem
Cloudflare Worker deployment failing with "CLOUDFLARE_API_TOKEN not set" error.

## Solution (5 Steps)

### 1. Create Token
🔗 https://dash.cloudflare.com/profile/api-tokens
- Click "Create Token"
- Use "Edit Cloudflare Workers" template
- Copy token (you won't see it again!)

### 2. Add to GitHub
🔗 https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
- Click "New repository secret"
- Name: `CLOUDFLARE_API_TOKEN`
- Value: Paste your token
- Click "Add secret"

### 3. Deploy
- Option A: Merge this PR to `main` (auto-deploys)
- Option B: Go to Actions → Deploy Cloudflare Worker → Run workflow

### 4. Verify
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok
```

### 5. Test
Visit https://reflectivei.github.io and test the chat widget.

## Files Changed in This PR
- ✅ `.github/workflows/deploy-cloudflare-worker.yml` - Better workflow
- ✅ `wrangler.toml` - Added docs
- ✅ `DEPLOYMENT_FIX_README.md` - Full guide
- ✅ `CLOUDFLARE_DEPLOYMENT_FIX_SUMMARY.md` - Summary

## Need Help?
See `DEPLOYMENT_FIX_README.md` for detailed step-by-step instructions.

## Status
✅ Fix ready - just need to add the secret!
