# Quick Fix: Deployment Error

## The Problem

You got this error:
```
✘ [ERROR] Missing entry-point to Worker script or to assets directory
```

**Cause:** You ran `npx wrangler deploy` from the wrong directory.

## The Solution

**You MUST run the command from the repository root directory** where `wrangler.toml` is located.

### Step-by-Step Fix

```bash
# 1. Navigate to the repository root (wherever you cloned it)
cd /path/to/reflectiv-ai

# 2. Verify you're in the right place (should show wrangler.toml and worker.js)
ls -la wrangler.toml worker.js

# 3. Now deploy
export CLOUDFLARE_API_TOKEN="your-github-actions-token-value"
npx wrangler deploy

# 4. Add the secret
npx wrangler secret put PROVIDER_KEY
```

### How to Know You're in the Right Directory

Before running `npx wrangler deploy`, make sure:

```bash
# This should show both files exist:
ls wrangler.toml worker.js
```

Expected output:
```
wrangler.toml  worker.js
```

If you see "No such file or directory", you're in the wrong folder.

### Example

```bash
# ❌ WRONG - Running from home directory
cd ~
npx wrangler deploy
# Error: Missing entry-point...

# ✅ CORRECT - Running from repo root
cd ~/projects/reflectiv-ai  # or wherever you cloned it
npx wrangler deploy
# Success!
```

### After Successful Deployment

You should see:
```
✨ Success! Uploaded...
Published my-chat-agent-v2
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev
```

Then verify:
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok
```

### Still Having Issues?

If you're in the right directory and still getting the error, run:

```bash
# Show wrangler what file to use explicitly
npx wrangler deploy worker.js
```

Or check wrangler.toml exists and has this line:
```toml
main = "worker.js"
```
