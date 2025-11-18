# ReflectivAI - AI-Powered Sales Coach & Training Platform

A comprehensive AI-powered platform for pharmaceutical sales training, featuring role-play, emotional intelligence assessment, and product knowledge testing.

## 🚀 Quick Start

**Just want to see it work?** Choose your deployment platform:

### Option 1: Deploy to Cloudflare Workers (Recommended)

This is the **primary backend** that's fully tested and production-ready.

```bash
# 1. Install Wrangler
npm install -g wrangler

# 2. Login to Cloudflare
wrangler login

# 3. Set your GROQ API key
wrangler secret put PROVIDER_KEY
# When prompted, enter your GROQ API key (starts with gsk_...)

# 4. Deploy
wrangler deploy

# 5. Test it works
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

**That's it!** Your backend is live at: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`

### Option 2: Deploy to Vercel

This deploys both the **frontend** and **API endpoints** as serverless functions.

```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel

# 3. Set environment variables in Vercel Dashboard
# Go to: Project Settings → Environment Variables
# Add: PROVIDER_KEY = your-groq-api-key
# Add: CORS_ORIGINS = https://your-domain.vercel.app

# 4. Test
curl https://your-project.vercel.app/api/chat
```

### Option 3: Use GitHub Pages (Frontend Only)

The frontend auto-deploys to GitHub Pages on every push to `main`.

**Live at:** `https://reflectivei.github.io/reflectiv-ai/`

This uses the Cloudflare Worker backend for API calls.

---

## 📖 What Is This?

ReflectivAI is an AI training platform with 5 modes:

1. **Sales Coach** - Get AI feedback on your sales pitch with scoring
2. **Role Play** - Practice conversations with AI HCP personas  
3. **Emotional Intelligence** - Assess emotional intelligence in conversations
4. **Product Knowledge** - Test knowledge on therapeutic areas (HIV, Oncology, etc.)
5. **General Knowledge** - General medical/pharma Q&A

---

## 🏗️ Architecture

```
┌─────────────────┐
│  GitHub Pages   │  ← Frontend (HTML/CSS/JS)
│  index.html     │
│  widget.js      │
└────────┬────────┘
         │
         ├── Calls API ──┐
         │               │
         v               v
┌─────────────────┐   ┌──────────────────┐
│ Cloudflare      │   │ Vercel Serverless│
│ Worker          │   │ Functions        │
│ worker.js       │   │ /api/chat.js     │
└────────┬────────┘   └────────┬─────────┘
         │                     │
         └──── Both use ───────┘
                  │
                  v
         ┌────────────────┐
         │  GROQ API      │
         │  (LLM Provider)│
         └────────────────┘
```

**Primary Setup:**
- Frontend: GitHub Pages
- Backend: Cloudflare Workers
- LLM: GROQ (llama-3.1-8b-instant)

**Alternative Setup:**
- Frontend + Backend: Vercel (all-in-one)

---

## 🔧 Troubleshooting Common Errors

### ❌ Error: "404: NOT_FOUND" from Vercel

**Cause:** Vercel deployment issue or incorrect API route configuration.

**Solutions:**

1. **Check Vercel deployment status:**
   ```bash
   vercel ls
   ```

2. **Verify environment variables are set:**
   - Go to Vercel Dashboard → Your Project → Settings → Environment Variables
   - Ensure `PROVIDER_KEY` is set
   - Ensure `CORS_ORIGINS` includes your domain

3. **Redeploy:**
   ```bash
   vercel --prod
   ```

4. **Check API route:**
   - Vercel expects API files in `/api/` directory
   - Files: `api/chat.js` and `api/coach-metrics.js` ✓ (already present)
   - Test: `curl https://your-project.vercel.app/api/chat`

5. **If still failing, use Cloudflare Workers instead:**
   - More reliable
   - Easier to debug
   - See "Deploy to Cloudflare Workers" above

### ❌ Error: "CORS Error" or "Failed to fetch"

**Cause:** CORS headers not configured properly.

**Fix for Cloudflare:**
```bash
# Check wrangler.toml has your domain in CORS_ORIGINS
cat wrangler.toml | grep CORS_ORIGINS

# Should include: https://reflectivei.github.io
# If not, edit wrangler.toml and redeploy
```

**Fix for Vercel:**
```bash
# Add CORS_ORIGINS in Vercel Dashboard
# Settings → Environment Variables
# CORS_ORIGINS = https://your-frontend-domain.com
```

### ❌ Error: "provider_http_401" or API Key errors

**Cause:** GROQ API key not set or invalid.

**Fix:**

For Cloudflare:
```bash
wrangler secret put PROVIDER_KEY
# Paste your GROQ API key when prompted
```

For Vercel:
```bash
# Add in Vercel Dashboard → Environment Variables
# PROVIDER_KEY = gsk_your_key_here
```

**Get a GROQ API key:**
1. Go to: https://console.groq.com/
2. Sign up/login
3. Generate API key
4. Copy key (starts with `gsk_`)

### ❌ Error: "Still working..." forever

**Cause:** Widget can't reach backend or backend is timing out.

**Debug:**
1. Open browser DevTools (F12)
2. Go to Network tab
3. Send a test message
4. Look for failed requests (red)
5. Click the failed request to see error details

**Common fixes:**
- Backend not deployed → Deploy worker/Vercel
- Wrong backend URL → Check widget.js has correct BACKEND_URL
- API key missing → Set PROVIDER_KEY secret
- CORS issue → Add origin to CORS_ORIGINS

### ❌ Error: Can't pull PR or deploy

**If you're frustrated and nothing is working:**

1. **Start fresh with Cloudflare (most reliable):**
   ```bash
   # Clean slate
   wrangler secret put PROVIDER_KEY
   wrangler deploy
   
   # Test
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   ```

2. **Verify the deployment:**
   ```bash
   # Should return: ok
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   
   # Test chat endpoint
   curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
     -H "Content-Type: application/json" \
     -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}]}'
   ```

3. **If Cloudflare works, update frontend to use it:**
   - Frontend already configured to use Cloudflare backend
   - Just deploy to GitHub Pages and it works
   - No Vercel needed

---

## 🧪 Testing

### Test Backend (Cloudflare)
```bash
# Health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Version check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version

# Chat test
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [{"role": "user", "content": "What is PrEP?"}],
    "disease": "HIV"
  }'
```

### Test Backend (Vercel)
```bash
# Replace with your Vercel URL
curl -X POST https://your-project.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [{"role": "user", "content": "What is PrEP?"}]
  }'
```

### Test Frontend
1. Open: https://reflectivei.github.io/reflectiv-ai/
2. Click "Explore Platform"
3. Select a mode (e.g., "Sales Coach")
4. Send a test message
5. Should get response in 2-5 seconds
6. Check browser console (F12) for errors

### Run Automated Tests
```bash
# Install dependencies
npm install

# Run all tests
npm run test:all

# Run specific tests
npm run test:cors
npm run test:gk-date
```

---

## 📦 Repository Structure

```
reflectiv-ai/
├── index.html              # Main landing page
├── widget.js               # Chat widget (frontend)
├── widget.css              # Widget styles
├── worker.js               # Cloudflare Worker (backend)
├── wrangler.toml           # Cloudflare config
├── vercel.json             # Vercel config
├── api/
│   ├── chat.js             # Vercel serverless function
│   └── coach-metrics.js    # Analytics endpoint
├── docs/                   # Documentation
├── tests/                  # Test files
└── .github/workflows/
    ├── pages.yml           # GitHub Pages deployment
    └── reflectivai-ci.yml  # CI/CD pipeline
```

---

## 🔐 Environment Variables

### Required
- `PROVIDER_KEY` - Your GROQ API key (required for all deployments)

### Optional
- `CORS_ORIGINS` - Comma-separated list of allowed origins
- `PROVIDER_URL` - LLM API endpoint (default: GROQ)
- `PROVIDER_MODEL` - Model name (default: llama-3.1-8b-instant)
- `MAX_OUTPUT_TOKENS` - Max response length (default: 1400)

---

## 🚢 Deployment Checklist

Before deploying to production:

- [ ] Set `PROVIDER_KEY` secret in your platform
- [ ] Set `CORS_ORIGINS` to include your frontend domain
- [ ] Test `/health` endpoint returns `ok`
- [ ] Test `/chat` endpoint returns valid response
- [ ] Test frontend can send/receive messages
- [ ] Check browser console for errors (should be none)
- [ ] Verify coach feedback appears in Sales Coach mode
- [ ] Test all 5 modes work correctly

---

## 📚 Additional Documentation

- [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) - Detailed deployment instructions
- [VERCEL_DEPLOYMENT_GUIDE.md](VERCEL_DEPLOYMENT_GUIDE.md) - Vercel-specific setup
- [AUDIT_SUMMARY.md](AUDIT_SUMMARY.md) - System audit and architecture
- [PHASE3_VERIFICATION_CHECKLIST.md](PHASE3_VERIFICATION_CHECKLIST.md) - QA checklist

---

## 🆘 Still Having Issues?

**If nothing is working and you're frustrated:**

1. **Use the simplest path:** Deploy Cloudflare Worker only
   ```bash
   wrangler login
   wrangler secret put PROVIDER_KEY  # Enter your GROQ key
   wrangler deploy
   ```

2. **Verify it works:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   # Should return: ok
   ```

3. **If that works, the issue is with:**
   - Vercel configuration (not needed if Cloudflare works)
   - Frontend configuration (check BACKEND_URL in widget.js)
   - CORS setup (add your domain to CORS_ORIGINS)

4. **Common mistakes:**
   - Forgot to set PROVIDER_KEY secret
   - Using wrong backend URL in frontend
   - CORS_ORIGINS doesn't include your domain
   - API key expired or invalid

5. **Quick health check:**
   ```bash
   # This should work if backend is healthy
   curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
     -H "Content-Type: application/json" \
     -d '{"mode":"general-knowledge","messages":[{"role":"user","content":"test"}]}'
   
   # Should return JSON with "reply" field, not error
   ```

**The system DOES work.** If you're getting errors, it's a configuration issue (usually PROVIDER_KEY or CORS), not a code issue.

---

## 📞 Support

- Check existing [Issues](https://github.com/ReflectivEI/reflectiv-ai/issues)
- Review [Discussions](https://github.com/ReflectivEI/reflectiv-ai/discussions)
- Read troubleshooting section above
- Check deployment guides in `/docs`

---

## 📄 License

See [LICENSE](LICENSE) file for details.

---

**Last Updated:** 2025-11-18

**Status:** ✅ Production Ready
- Cloudflare Workers: Fully functional
- GitHub Pages: Deployed and working
- Vercel: Optional alternative deployment
