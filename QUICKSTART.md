# QUICKSTART - Get ReflectivAI Working in 5 Minutes

**Frustrated with deployment issues? This guide gets you working FAST.**

## The Problem

You're seeing errors like:
- `404: NOT_FOUND` from Vercel
- Can't pull PRs
- Can't deploy
- "NOTHING IS WORKING"

## The Solution

**Ignore Vercel for now.** Use Cloudflare Workers - it's simpler and more reliable.

## Step-by-Step (5 Minutes)

### 1. Get a GROQ API Key (1 minute)

```bash
# Go to: https://console.groq.com/
# Sign up (free)
# Click "API Keys"
# Click "Create API Key"
# Copy the key (starts with gsk_...)
```

### 2. Deploy to Cloudflare (2 minutes)

```bash
# Install wrangler (if you don't have it)
npm install -g wrangler

# Login to Cloudflare
wrangler login
# This opens a browser - click "Allow"

# Set your API key as a secret
wrangler secret put PROVIDER_KEY
# Paste your GROQ key when prompted

# Deploy
wrangler deploy
```

**Done!** Your backend is live.

### 3. Test It Works (1 minute)

```bash
# Health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Should return: ok
```

```bash
# Full test
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"general-knowledge","messages":[{"role":"user","content":"Hello"}]}'

# Should return JSON with a "reply" field
```

### 4. Use the Frontend (1 minute)

The frontend is already deployed to GitHub Pages:

**Open:** https://reflectivei.github.io/reflectiv-ai/

1. Click "Explore Platform"
2. Select a mode (e.g., "Sales Coach")
3. Type a message
4. Get a response in 2-5 seconds

**If it works, you're done!**

---

## What If It Still Doesn't Work?

### Error: "Still working..." forever

**Cause:** Frontend can't reach backend

**Fix:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors

**Common issues:**
- Backend URL is wrong → Check widget.js line ~50
- CORS issue → Add your domain to wrangler.toml CORS_ORIGINS
- Backend not deployed → Run `wrangler deploy` again

### Error: "provider_http_401"

**Cause:** GROQ API key not set or wrong

**Fix:**
```bash
wrangler secret put PROVIDER_KEY
# Paste the CORRECT key
```

**Verify your key works:**
```bash
# Test directly with GROQ
curl https://api.groq.com/openai/v1/chat/completions \
  -H "Authorization: Bearer YOUR_KEY_HERE" \
  -H "Content-Type: application/json" \
  -d '{"model":"llama-3.1-8b-instant","messages":[{"role":"user","content":"hi"}]}'

# Should return a response, not 401
```

### Error: CORS error

**Cause:** Your frontend domain not in CORS_ORIGINS

**Fix:**
```bash
# Edit wrangler.toml
# Add your domain to CORS_ORIGINS line

# Example:
CORS_ORIGINS = "https://reflectivei.github.io,https://your-domain.com"

# Redeploy
wrangler deploy
```

---

## Forget About Vercel (For Now)

**Why Vercel is giving you trouble:**
- Environment variables not set
- API routes not configured properly
- Deployment state is unclear

**Why Cloudflare is better:**
- Single command deployment
- Clear error messages
- Works in 5 minutes
- Production-ready

**You can always add Vercel later** once Cloudflare is working.

---

## The 30-Second Debug Process

If something breaks, do this:

```bash
# 1. Check backend health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# If it returns "ok", backend is fine
# If it fails, redeploy: wrangler deploy

# 2. Check backend can respond
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"general-knowledge","messages":[{"role":"user","content":"test"}]}'

# Should return JSON with "reply"
# If it returns error, check PROVIDER_KEY: wrangler secret put PROVIDER_KEY

# 3. Check frontend
# Open: https://reflectivei.github.io/reflectiv-ai/
# Open DevTools (F12) → Console
# Send a message
# Look for errors

# If you see CORS error:
# - Add your domain to CORS_ORIGINS in wrangler.toml
# - Run: wrangler deploy
```

---

## What You DON'T Need

❌ Vercel account (not required)  
❌ Complex configuration  
❌ Multiple deployments  
❌ Environment variable juggling  

## What You DO Need

✅ GROQ API key (free)  
✅ Cloudflare account (free)  
✅ 5 minutes  

---

## Still Stuck?

**Check these common mistakes:**

1. **PROVIDER_KEY not set:**
   ```bash
   wrangler secret put PROVIDER_KEY
   ```

2. **Wrong backend URL in frontend:**
   - Check widget.js line ~50
   - Should be: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`

3. **GROQ API key expired or invalid:**
   - Generate new key at console.groq.com
   - Update with: `wrangler secret put PROVIDER_KEY`

4. **Cached deployment:**
   ```bash
   # Force redeploy
   wrangler deploy --force
   ```

5. **Browser cache:**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito mode

---

## Success Checklist

After following this guide, you should have:

- [x] GROQ API key obtained
- [x] Cloudflare Workers deployed
- [x] Backend health check returns "ok"
- [x] Backend chat test returns valid JSON
- [x] Frontend loads at GitHub Pages URL
- [x] Can send messages and get responses
- [x] No errors in browser console

**If all checked, YOU'RE DONE! 🎉**

---

## Next Steps (Optional)

Now that it's working:

1. **Test all 5 modes:**
   - Sales Coach
   - Role Play
   - Emotional Intelligence
   - Product Knowledge
   - General Knowledge

2. **Review the full README:**
   - See README.md for architecture
   - See DEPLOYMENT_GUIDE.md for advanced setup

3. **Add Vercel (optional):**
   - Only if you want an alternative backend
   - Not required if Cloudflare is working

---

**Remember: The system WORKS. If it's not working for you, it's a configuration issue (usually PROVIDER_KEY or CORS), not a code issue.**

**Most common fix: `wrangler secret put PROVIDER_KEY`**
