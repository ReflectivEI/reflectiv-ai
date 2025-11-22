# Error Diagnostic Guide

## Current Status

### What's Fixed ✅
- Widget code bug: `isSending` state now properly resets
- Code cleanup: Removed old worker versions (r9, r10.1-backup)
- Using only worker.js r10.1 (latest version)
- Payload format verified and compatible

### What's Still Blocking ⚠️
**Cloudflare Worker is NOT deployed**
- URL: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`
- Status: DNS ENOTFOUND (worker not accessible)
- Impact: Widget cannot send messages until worker is deployed

---

## How to See the Error

### Browser Console Method (Most Detailed)
1. Open your browser
2. Navigate to: https://reflectivei.github.io/reflectiv-ai/
3. Press F12 to open Developer Tools
4. Click on "Console" tab
5. Try to send a message in the widget
6. Look for error messages (usually in red)

### What Error Are You Seeing?

Please check which error message appears:

#### Error A: "Cannot connect to backend"
```
Failed to send message. Cannot connect to backend. Please check your internet connection or try again later.
```
**Cause**: Worker is not deployed  
**Solution**: Deploy worker using instructions below

#### Error B: "Backend unavailable. Please wait..."
```
Backend unavailable. Please wait...
```
**Cause**: Health check failed, widget blocked sending  
**Solution**: Deploy worker

#### Error C: Network Error in Console
```
GET https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health net::ERR_NAME_NOT_RESOLVED
```
**Cause**: DNS lookup fails - worker not deployed  
**Solution**: Deploy worker

#### Error D: CORS Error
```
Access to fetch at 'https://...' from origin 'https://reflectivei.github.io' has been blocked by CORS policy
```
**Cause**: Worker deployed but CORS not configured  
**Solution**: Check CORS_ORIGINS in wrangler.toml

#### Error E: 500 Server Error
```
Failed to send message. Unknown error
```
**Cause**: Worker deployed but has runtime error  
**Solution**: Check worker logs with `wrangler tail`

#### Error F: 401/403 Authentication Error
```
Failed to send message. Authentication required - please check access permissions.
```
**Cause**: Cloudflare Access is blocking requests  
**Solution**: Configure Cloudflare Access or disable it for testing

---

## Quick Deploy Guide

### Method 1: GitHub Actions (Easiest)
```bash
# 1. Verify secret exists
# Go to: https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
# Confirm CLOUDFLARE_API_TOKEN is listed

# 2. Merge this PR to main branch
# GitHub Actions will auto-deploy

# 3. Wait ~1 minute for deployment

# 4. Test
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok
```

### Method 2: Manual Deploy (If You Have Wrangler)
```bash
# In the repository directory:

# 1. Set GROQ API key
wrangler secret put PROVIDER_KEY
# Enter your GROQ API key (starts with gsk_...)

# 2. Deploy
wrangler deploy

# 3. Verify
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok

# 4. Test chat
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}]}'
```

---

## Debugging Checklist

### Before Deployment
- [ ] GROQ API key is ready (starts with `gsk_...`)
- [ ] GitHub secret `CLOUDFLARE_API_TOKEN` is configured (for auto-deploy)
- [ ] OR Wrangler is installed and logged in (for manual deploy)

### After Deployment
- [ ] Run: `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
  - Expected: `ok`
  - If fails: Worker not deployed correctly
- [ ] Run: `./verify-deployment.sh`
  - Tests all endpoints and modes
- [ ] Open https://reflectivei.github.io/reflectiv-ai/
- [ ] Open browser console (F12)
- [ ] Try sending a message
- [ ] Check for errors in console

### If Still Getting Errors After Deployment

#### Check Worker Logs
```bash
wrangler tail
# Then try sending a message and watch the logs
```

#### Check Worker Status
```bash
wrangler deployments list
# Shows recent deployments
```

#### Check Secrets
```bash
wrangler secret list
# Should show: PROVIDER_KEY
```

#### Test Health Endpoint
```bash
curl -v https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# -v shows full response including headers
```

#### Test Chat Endpoint
```bash
curl -v -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {"role": "user", "content": "How do I approach an HCP about PrEP?"}
    ]
  }'
```

---

## Common Issues and Solutions

### Issue: "Worker not found" after deployment
**Cause**: Deployment failed or using wrong account  
**Fix**: 
```bash
wrangler whoami  # Check logged in account
wrangler deploy --dry-run  # Test deployment without publishing
wrangler deploy --verbose  # Deploy with detailed output
```

### Issue: "NO_PROVIDER_KEY" error
**Cause**: GROQ API key not set as secret  
**Fix**:
```bash
wrangler secret put PROVIDER_KEY
# Paste your GROQ API key
```

### Issue: Empty response from worker
**Cause**: GROQ API key is invalid or has no credits  
**Fix**: 
- Check GROQ API key at https://console.groq.com/keys
- Verify account has credits
- Try a different key if you have multiple

### Issue: CORS error
**Cause**: Origin not in CORS_ORIGINS allowlist  
**Fix**: Check `wrangler.toml` line 24:
```toml
CORS_ORIGINS = "https://reflectivei.github.io,https://reflectivei.github.io/reflectiv-ai,..."
```
Make sure your frontend URL is in the list.

---

## What Information Would Help?

If you're still seeing errors, please provide:

1. **The exact error message** from browser console
2. **Screenshot** of the error (if possible)
3. **Worker deployment status**: Run `wrangler deployments list` and share output
4. **Health check result**: Run `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health` and share output
5. **Browser console logs**: Any red errors when you try to send a message

---

## Summary

**Widget Code**: ✅ READY (bug fixed, cleaned up)  
**Worker Code**: ✅ READY (r10.1, tested)  
**Deployment**: ❌ REQUIRED (worker not accessible)  
**Next Step**: Deploy worker using one of the methods above

Once deployed, the widget should work immediately. If you still see errors after deployment, use the debugging steps above to diagnose.
