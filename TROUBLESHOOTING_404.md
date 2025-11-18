# Troubleshooting "404: NOT_FOUND" Vercel Error

**Error ID:** `sfo1::rfspz-1763468217508-eeaf0fc785ca`  
**Error Message:** `404: NOT_FOUND Code: NOT_FOUND`

This is a Vercel deployment issue. Here's how to fix it.

---

## What This Error Means

Vercel can't find the resource you're trying to access. Common causes:

1. **API route not deployed** - Your `/api/chat.js` file isn't accessible
2. **Vercel configuration error** - `vercel.json` has issues
3. **Environment variables missing** - Required secrets not set
4. **Deployment failed** - Build or deployment didn't complete
5. **Wrong URL** - Accessing a path that doesn't exist

---

## Quick Fix (Recommended)

**Stop fighting with Vercel. Use Cloudflare Workers instead:**

```bash
# 1. Install wrangler
npm install -g wrangler

# 2. Login
wrangler login

# 3. Set API key
wrangler secret put PROVIDER_KEY

# 4. Deploy
wrangler deploy

# 5. Test
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

**Done.** No more 404 errors.

---

## If You Must Use Vercel

### Step 1: Check Deployment Status

```bash
# Install Vercel CLI
npm install -g vercel

# Check deployments
vercel ls

# Look for your project and latest deployment
# Status should be "Ready" not "Error" or "Building"
```

### Step 2: Verify Files Are Present

```bash
# Check API files exist
ls -la api/
# Should show:
# - chat.js
# - coach-metrics.js
```

### Step 3: Fix vercel.json

Your `vercel.json` should look like this:

```json
{
  "version": 2,
  "routes": [
    {
      "src": "/api/chat",
      "methods": ["POST", "OPTIONS"],
      "dest": "/api/chat.js"
    },
    {
      "src": "/api/coach-metrics",
      "methods": ["POST", "OPTIONS"],
      "dest": "/api/coach-metrics.js"
    }
  ],
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [
        {
          "key": "Access-Control-Allow-Origin",
          "value": "*"
        },
        {
          "key": "Access-Control-Allow-Methods",
          "value": "POST, OPTIONS"
        },
        {
          "key": "Access-Control-Allow-Headers",
          "value": "X-Requested-With, Content-Type, Authorization"
        }
      ]
    }
  ],
  "git": {
    "deploymentEnabled": true
  }
}
```

**This configuration:**
- ✅ Defines explicit routes for `/api/chat` and `/api/coach-metrics`
- ✅ Allows POST and OPTIONS methods
- ✅ Sets CORS headers
- ✅ Enables git-based deployments

### Step 4: Set Environment Variables

1. Go to: https://vercel.com/dashboard
2. Select your project
3. Go to: Settings → Environment Variables
4. Add these:

```
PROVIDER_KEY = your-groq-api-key-here
CORS_ORIGINS = https://your-frontend-url.vercel.app
```

**Without `PROVIDER_KEY`, the API won't work!**

### Step 5: Redeploy

```bash
# Option A: Redeploy via CLI
vercel --prod

# Option B: Trigger redeploy via git
git commit --allow-empty -m "Trigger Vercel redeploy"
git push

# Option C: Redeploy via dashboard
# Go to: Vercel Dashboard → Deployments → ... → Redeploy
```

### Step 6: Test the Deployment

```bash
# Replace YOUR-PROJECT.vercel.app with your actual URL

# Test API endpoint exists (should NOT return 404)
curl https://YOUR-PROJECT.vercel.app/api/chat

# Should return: "Method not allowed" (405) - that's OK!
# If it returns 404, the route isn't deployed

# Test with POST (should work)
curl -X POST https://YOUR-PROJECT.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"general-knowledge","messages":[{"role":"user","content":"test"}]}'

# Should return JSON with "reply" field
```

---

## Common Vercel 404 Causes

### Cause 1: `.vercelignore` blocking files

**Check:**
```bash
cat .vercelignore
```

**Should NOT contain:**
- `api/` (would block all API files)
- `*` (would block everything)
- `api/*.js` (would block API routes)

**Should contain:**
```
node_modules
.git
tests/
*.test.js
```

### Cause 2: Wrong API directory structure

Vercel expects:
```
/api/chat.js         ← Accessible at /api/chat
/api/coach-metrics.js ← Accessible at /api/coach-metrics
```

Not:
```
/backend/api/chat.js  ← Won't work
/src/api/chat.js      ← Won't work
```

### Cause 3: Export syntax in API files

Each API file must export a default function:

```javascript
// ✅ CORRECT
export default async function handler(req, res) {
  // ...
}

// ❌ WRONG
module.exports = async function handler(req, res) {
  // ...
}

// ❌ WRONG
export function handler(req, res) {
  // ...
}
```

### Cause 4: Build failed silently

Check deployment logs:
1. Go to: Vercel Dashboard → Your Project → Deployments
2. Click on latest deployment
3. Click "View Function Logs"
4. Look for errors

Common errors:
- Syntax errors in API files
- Missing dependencies
- Runtime errors during initialization

---

## Debugging Checklist

Work through this checklist:

- [ ] Vercel CLI installed: `npm install -g vercel`
- [ ] Logged into Vercel: `vercel login`
- [ ] Project linked: `vercel link`
- [ ] Files exist: `ls api/chat.js api/coach-metrics.js`
- [ ] vercel.json is valid JSON: `node -e "require('./vercel.json')"`
- [ ] .vercelignore doesn't block api/: `cat .vercelignore | grep api`
- [ ] Environment variables set in Vercel dashboard
- [ ] Latest deployment status is "Ready": `vercel ls`
- [ ] API routes respond (not 404): `curl https://your-app.vercel.app/api/chat`
- [ ] Function logs show no errors

If all checked and still getting 404: **Use Cloudflare Workers instead.**

---

## Why Cloudflare is Better

**Cloudflare Workers advantages:**
- ✅ Single command deployment
- ✅ No hidden configuration
- ✅ Better error messages
- ✅ Faster cold starts
- ✅ More reliable routing
- ✅ Easier debugging

**Vercel disadvantages:**
- ❌ Complex routing configuration
- ❌ Silent deployment failures
- ❌ Environment variable confusion
- ❌ Hidden .vercelignore issues
- ❌ API route discovery problems

**Recommendation:** Start with Cloudflare. Add Vercel later if needed.

---

## Emergency Recovery

If you're completely stuck:

### 1. Verify Local Files Work
```bash
# Test API locally
node -e "require('./api/chat.js')"
# Should not throw syntax errors
```

### 2. Check Vercel Status
```bash
# Get deployment URL
vercel ls

# Check if site loads
curl -I https://your-project.vercel.app/

# Check specific route
curl -I https://your-project.vercel.app/api/chat
```

### 3. View Deployment Logs
```bash
# Stream logs
vercel logs

# Filter errors only
vercel logs --follow | grep -i error
```

### 4. Nuclear Option: Delete and Redeploy
```bash
# Remove Vercel configuration
rm -rf .vercel

# Link to new project
vercel

# Set environment variables in dashboard
# Redeploy
vercel --prod
```

### 5. Switch to Cloudflare
```bash
# Give up on Vercel
# Use Cloudflare instead
wrangler deploy
```

---

## Success Criteria

After following this guide, verify:

1. ✅ No 404 errors when accessing `/api/chat`
2. ✅ POST requests to `/api/chat` return valid JSON
3. ✅ Environment variables are set
4. ✅ Deployment status is "Ready"
5. ✅ Frontend can call backend without errors

If you can't achieve all 5, **use Cloudflare Workers instead.**

---

## Need More Help?

**Still getting 404 errors?**

1. Share deployment URL
2. Share full error message
3. Share `vercel ls` output
4. Share deployment logs
5. Share vercel.json content

**Or just use Cloudflare:**
```bash
wrangler deploy
```

It works. Every time. No 404s.
