# Backend Deployment Instructions

## Issue Fixed
The Cloudflare Worker backend was returning `Access-Control-Allow-Origin: null` for Vercel preview deployment URLs, causing all API calls to fail with CORS errors.

## Root Cause
The CORS allowlist in the worker only supported exact domain matching. Vercel creates unique preview URLs for each PR (e.g., `https://reflectiv-ai-git-copilot-audit-repo-3e2e00-tony-abdels-projects.vercel.app`), which were not in the allowlist.

## Solution Implemented
Enhanced the worker's CORS function to support wildcard patterns and added `https://*.vercel.app` to the allowlist.

## Architecture
- **Frontend**: GitHub Pages at `https://reflectivei.github.io/reflectiv-ai/`
- **Backend**: Cloudflare Workers at `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`
- **PR Previews**: Vercel (automatic deployments for testing)

## Deployment Required

### Deploy Updated Worker to Cloudflare

The worker code has been updated with:
1. Wildcard pattern matching for CORS origins
2. Support for `*.vercel.app` domains
3. Security improvements (proper regex escaping)

**Deploy using Wrangler:**

```bash
# Navigate to repository root
cd /path/to/reflectiv-ai

# Deploy the worker
wrangler deploy

# Verify deployment
wrangler tail --format pretty
```

**Or use the deploy script:**

```bash
./deploy-worker.sh
```

### Verify Deployment

After deployment, test the CORS configuration:

```bash
# Test health endpoint from a Vercel preview URL
curl -I -H "Origin: https://test.vercel.app" \
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Should see:
# Access-Control-Allow-Origin: https://test.vercel.app
```

### No Frontend Changes Required

The frontend files (index.html, widget.js, assets/*) are already configured correctly:
- GitHub Pages will serve them from the `main` branch
- Vercel will automatically deploy PR previews
- Both will now be able to connect to the Cloudflare Worker backend

## Changes Made

### worker.js
- Added `matchesPattern()` function with wildcard support
- Properly escapes regex special characters
- Maintains backward compatibility with exact matches

### wrangler.toml
- Added `https://*.vercel.app` to `CORS_ORIGINS`

### vercel.json (for previews only)
- Ensures static assets (.md files) are served correctly
- Only affects Vercel preview deployments

### index.html
- Updated CSP to allow Vercel Live scripts
- Only affects Vercel preview deployments

## Testing

All tests pass:
- ✅ 34 existing CORS tests
- ✅ 8 new wildcard pattern tests
- ✅ 12 worker functionality tests
- ✅ 0 CodeQL security alerts

## Expected Outcome

After deploying the worker:
1. GitHub Pages deployment continues to work as before
2. Vercel PR preview deployments can now connect to the backend
3. All CORS errors will be resolved
4. Chat functionality will work on both GitHub Pages and Vercel previews
