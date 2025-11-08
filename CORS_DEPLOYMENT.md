# CORS Configuration and Deployment Guide

## Overview
This document explains the CORS (Cross-Origin Resource Sharing) configuration for the ReflectivAI worker and how to deploy updates.

## Problem Fixed
The worker had a CORS implementation bug where it was setting both:
- `Access-Control-Allow-Origin: *` (wildcard)
- `Access-Control-Allow-Credentials: true`

This combination violates the CORS specification and causes browsers to block requests with the error:
```
Access to fetch at 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat' from origin 
'https://reflectivei.github.io' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' 
header is present on the requested resource.
```

## Solution
The CORS function in `worker.js` has been updated to:
1. Only set `Access-Control-Allow-Credentials: true` when returning a specific origin
2. Never combine wildcard origin (`*`) with credentials flag
3. Properly handle missing Origin headers

## CORS Configuration

### Allowed Origins
The allowed origins are configured in `wrangler.toml` under the `[vars]` section:

```toml
CORS_ORIGINS = "https://reflectivei.github.io,https://reflectivai.github.io,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://reflectivai.com,https://www.reflectivai.com,https://www.tonyabdelmalak.com"
```

### How It Works
- If `CORS_ORIGINS` is set (as above), only listed origins are allowed
- If `CORS_ORIGINS` is empty or not set, all origins are allowed
- Requests from allowed origins receive proper CORS headers with credentials support
- Requests from non-allowed origins receive `Access-Control-Allow-Origin: null`

## Deployment

### Prerequisites
1. Install [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/):
   ```bash
   npm install -g wrangler
   ```

2. Authenticate with Cloudflare:
   ```bash
   wrangler login
   ```

### Deploying the Worker

To deploy the updated worker with the CORS fix:

```bash
# From the repository root
wrangler deploy
```

This will:
1. Upload the fixed `worker.js` code
2. Use the CORS_ORIGINS configuration from `wrangler.toml`
3. Deploy to the existing worker endpoint

### Setting Secrets
If this is the first deployment or if the API key needs to be updated:

```bash
wrangler secret put PROVIDER_KEY
```

Then paste your Groq API key (starting with "gsk_...") when prompted.

### Verifying Deployment

After deployment, verify CORS is working:

1. **Check preflight request:**
   ```bash
   curl -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
     -H "Origin: https://reflectivei.github.io" \
     -H "Access-Control-Request-Method: POST" \
     -i
   ```

   Expected response headers should include:
   ```
   Access-Control-Allow-Origin: https://reflectivei.github.io
   Access-Control-Allow-Credentials: true
   Access-Control-Allow-Methods: GET,POST,OPTIONS
   ```

2. **Test from browser console:**
   Open https://reflectivei.github.io in a browser and run:
   ```javascript
   fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health')
     .then(r => r.text())
     .then(console.log)
     .catch(console.error)
   ```

   Should return "ok" without CORS errors.

## Testing

Run the CORS test suite to verify the implementation:

```bash
node worker.cors.test.js
```

All 33 tests should pass.

## Adding New Allowed Origins

To add a new origin to the allowlist:

1. Edit `wrangler.toml` and add the origin to `CORS_ORIGINS` (comma-separated, no spaces after commas):
   ```toml
   CORS_ORIGINS = "https://reflectivei.github.io,https://new-domain.com"
   ```

2. Deploy the updated configuration:
   ```bash
   wrangler deploy
   ```

## Troubleshooting

### CORS errors still occurring after deployment
1. Clear browser cache and hard reload (Ctrl+Shift+R or Cmd+Shift+R)
2. Verify the deployment succeeded: `wrangler deployments list`
3. Check the deployed environment variables: `wrangler deployments view <deployment-id>`
4. Test with curl (see verification steps above)

### Worker not deploying
1. Ensure you're authenticated: `wrangler whoami`
2. Check you have permission to deploy to this worker
3. Review error messages from `wrangler deploy`

### Credentials still causing issues
The credentials header is only set when:
- A specific origin is matched (not wildcard)
- The origin is in the allowlist (or no allowlist is configured)

If you don't need credentials, you can comment out line 158 in worker.js.

## References
- [MDN: CORS](https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS)
- [Cloudflare Workers CORS documentation](https://developers.cloudflare.com/workers/examples/cors-header-proxy/)
- [Wrangler CLI documentation](https://developers.cloudflare.com/workers/wrangler/)
