# Deploy Cloudflare Worker - Instructions

## Repository Restored to Cloudflare-Only Backend

All Vercel-related changes have been reverted. The repository is now back to the state from PR #136 with Cloudflare Workers as the **only** backend.

## Architecture
- **Frontend**: GitHub Pages (`https://reflectivei.github.io/reflectiv-ai/`)
- **Backend**: Cloudflare Workers (`https://my-chat-agent-v2.tonyabdelmalak.workers.dev`) ⚡

## Deployment Instructions

### Option 1: Use the Deploy Script (Recommended)

```bash
# From repository root
./deploy-worker.sh
```

This script will:
1. Check that worker.js and wrangler.toml exist
2. Verify wrangler is installed
3. Check Cloudflare authentication
4. Deploy the worker

### Option 2: Manual Deployment with Wrangler

```bash
# Install wrangler if not already installed
npm install -g wrangler

# Authenticate with Cloudflare
wrangler login

# Deploy the worker
wrangler deploy
```

### Verify Deployment

After deployment, test the worker:

```bash
# Health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Version check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version

# Test CORS with GitHub Pages origin
curl -I -H "Origin: https://reflectivei.github.io" \
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

Expected CORS header:
```
access-control-allow-origin: https://reflectivei.github.io
```

## Current CORS Configuration

The worker allows these origins only:
- `https://reflectivei.github.io`
- `https://reflectivei.github.io/reflectiv-ai`
- `https://reflectivai.github.io`
- `https://tonyabdelmalak.github.io`
- `https://tonyabdelmalak.com`
- `https://reflectivai.com`
- `https://www.reflectivai.com`
- `https://www.tonyabdelmalak.com`
- `https://dash.cloudflare.com`
- `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`

**No Vercel domains are included.**

## Troubleshooting

### Authentication Issues
If you get authentication errors:
```bash
wrangler login
```

### Verify Configuration
Check that your Cloudflare account ID is correct:
```bash
grep account_id wrangler.toml
```

### View Deployment History
```bash
wrangler deployments list
```

### Rollback if Needed
```bash
wrangler rollback <deployment-id>
```

## Test Results

All tests pass with reverted configuration:
- ✅ 34 CORS tests pass
- ✅ 12 worker functionality tests pass
- ✅ Simple exact-match CORS validation (no wildcards)

## What Changed in This Commit

**Commit**: d3865ed
**Message**: Revert all Vercel-related changes - restore to Cloudflare-only backend (PR #136 state)

**Files Reverted:**
- `worker.js` - Removed wildcard pattern matching
- `wrangler.toml` - Removed `https://*.vercel.app`
- `vercel.json` - Reverted to minimal config
- `index.html` - Reverted CSP (removed Vercel Live)

**Files Deleted:**
- `DEPLOYMENT_INSTRUCTIONS_BACKEND.md`
- `FIX_SUMMARY_CORS_DEPLOYMENT.md`
- `READY_TO_DEPLOY.md`
- `test-cors-wildcard.js`
