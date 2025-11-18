# Quick Start - Vercel Deployment

## ⚡ Fast Track (10 minutes)

### Step 1: Environment Variables (5 min)

Go to [Vercel Dashboard](https://vercel.com/dashboard) → Your Project → Settings → Environment Variables

Add these 2 variables for **all environments** (Production, Preview, Development):

| Variable | Value |
|----------|-------|
| `PROVIDER_KEY` | Your GROQ API key (get from https://console.groq.com/keys) |
| `CORS_ORIGINS` | `https://reflectiv-ai.vercel.app,https://reflectivei.github.io/reflectiv-ai` |

✅ Mark `PROVIDER_KEY` as **Secret**

### Step 2: Deploy (2-3 min)

Merge this PR to main → Vercel auto-deploys

### Step 3: Test (2 min)

```bash
curl -X POST https://reflectiv-ai.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectiv-ai.vercel.app" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}]}'
```

Expected: JSON response with AI reply ✅

---

## 📚 Full Documentation

- **VERCEL_DEPLOYMENT_INSTRUCTIONS.md** - Complete deployment guide
- **VERCEL_ENV_SETUP.md** - Environment variable reference
- **VERCEL_FIX_COMPLETE_SUMMARY.md** - Executive summary

## ❓ Need Help?

Check the troubleshooting section in `VERCEL_DEPLOYMENT_INSTRUCTIONS.md`

## ✅ What's Fixed

- Vercel 404 errors → Now deploys serverless functions
- API endpoints → Properly configured and routed
- CORS issues → Headers configured correctly
- Chat widget → Will work once deployed

## 🎯 Status

**Ready to Deploy**: ✅ YES
**Blockers**: None
**Required**: Set environment variables (see Step 1)
