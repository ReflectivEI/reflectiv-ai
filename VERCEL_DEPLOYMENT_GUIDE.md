# VERCEL DEPLOYMENT GUIDE - CRITICAL SETUP STEPS

## 🚨 IMMEDIATE ACTION REQUIRED

Your Vercel deployment is currently **NOT FUNCTIONAL** because:
1. `.vercelignore` was blocking ALL files from deploying
2. `vercel.json` had deployments disabled
3. Missing environment variables

## ✅ FIXES APPLIED IN THIS PR

1. **Updated `vercel.json`** - Enabled deployments and configured POST routes
2. **Created `/api/coach-metrics.js`** - Missing analytics endpoint
3. **Fixed `.vercelignore`** - Now allows frontend and API files to deploy
4. **Updated `/api/chat.js`** - Already had proper POST support with CORS

## 📋 VERCEL DASHBOARD CONFIGURATION STEPS

### Step 1: Environment Variables (CRITICAL)
Go to your Vercel project settings → Environment Variables and add:

```
PROVIDER_KEY=<your-groq-api-key>
CORS_ORIGINS=https://reflectiv-ai-1z6a.vercel.app,https://reflectivei.github.io
```

**Without PROVIDER_KEY, the backend will not work!**

### Step 2: Deploy Settings
In Vercel Project Settings → General:

- **Framework Preset**: Other (or None)
- **Build Command**: Leave empty or use: `echo "Static site"`
- **Output Directory**: `.` (current directory)
- **Install Command**: `npm install` (default is fine)
- **Root Directory**: `.` (leave as repository root)

### Step 3: Deploy from This Branch

**Option A - Merge to Main (Recommended for Production)**
```bash
# This PR fixes the issues - merge it to main
# Vercel will auto-deploy from main branch
```

**Option B - Deploy from This Branch (For Testing)**
1. Go to Vercel Dashboard → Your Project
2. Click "Deployments" tab
3. Find the deployment from branch `copilot/diagnose-vercel-backend-issues`
4. Click "..." → "Promote to Production" (optional)

### Step 4: Verify Deployment

After deployment completes, test these endpoints:

```bash
# Test chat endpoint (should return 405 for GET, needs POST)
curl https://reflectiv-ai-1z6a.vercel.app/api/chat

# Test with POST (replace with actual request body)
curl -X POST https://reflectiv-ai-1z6a.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}],"disease":"HIV"}'

# Test analytics endpoint (should return 405 for GET)
curl https://reflectiv-ai-1z6a.vercel.app/api/coach-metrics
```

## 🔧 WHAT WAS BROKEN

### Before (Broken):
- `.vercelignore` had `*` - ignored everything
- `vercel.json` had `deploymentEnabled: false`
- No `/api/coach-metrics.js` file
- Vercel couldn't find any files to deploy

### After (Fixed):
- `.vercelignore` only ignores build artifacts and tests
- `vercel.json` enables deployments with proper POST routing
- `/api/coach-metrics.js` created for analytics
- All frontend files (HTML, JS, CSS) can deploy
- API endpoints properly configured

## 📁 FILES THAT WILL DEPLOY

Frontend:
- `index.html`
- `widget.js`
- `widget.css`, `widget-modern.css`
- `site.css`, `styles.css`
- `assets/` directory (including `assets/chat/config.json`)
- `docs/` directory
- Images and static assets

Backend (Serverless Functions):
- `api/chat.js` - Main chat endpoint
- `api/coach-metrics.js` - Analytics endpoint

## ⚙️ VERCEL CONFIGURATION FILES

### `vercel.json` (Updated)
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
  "headers": [...]
}
```

This configuration:
- ✅ Explicitly allows POST requests on `/api/chat`
- ✅ Explicitly allows POST requests on `/api/coach-metrics`
- ✅ Handles OPTIONS for CORS preflight
- ✅ Sets proper CORS headers

## 🧪 TESTING AFTER DEPLOYMENT

1. **Open the live site**: https://reflectiv-ai-1z6a.vercel.app
2. **Click "Explore Platform"**
3. **Test each mode**:
   - Sales Coach - should get response with yellow feedback panel
   - Role Play - should get HCP persona response
   - Product Knowledge - should get factual response
   - Emotional Intelligence - should work
   - General Assistant - should work

4. **Check browser console** (F12):
   - No CORS errors
   - No 403 Forbidden errors
   - POST requests to `/api/chat` should succeed (status 200)

## ❌ COMMON ERRORS AND FIXES

### Error: "Forbidden. Only GET requests are allowed"
- **Cause**: Old deployment without updated `vercel.json`
- **Fix**: Redeploy with this PR's changes

### Error: "PROVIDER_KEY not set"
- **Cause**: Missing environment variable
- **Fix**: Add PROVIDER_KEY in Vercel dashboard settings

### Error: "Failed to fetch" or CORS errors
- **Cause**: CORS_ORIGINS not set or incorrect
- **Fix**: Add CORS_ORIGINS in Vercel dashboard with your domain

### Error: Analytics fails
- **Cause**: Missing coach-metrics endpoint
- **Fix**: Already created in this PR - redeploy

## 🚀 DEPLOYMENT CHECKLIST

- [ ] Merge this PR to main branch
- [ ] Add PROVIDER_KEY to Vercel environment variables
- [ ] Add CORS_ORIGINS to Vercel environment variables
- [ ] Wait for automatic deployment to complete
- [ ] Test all 5 modes on live site
- [ ] Verify no console errors
- [ ] Verify yellow coach feedback panel appears
- [ ] Test analytics events (check Vercel function logs)

## 📞 CURRENT DEPLOYMENT INFO

Based on your message:
- **Production URL**: https://reflectiv-ai-1z6a.vercel.app
- **Source Branch**: main (commit 9bcb983)
- **Project**: ReflectivEI/reflectiv-ai

**Next Step**: Merge this PR to main, and Vercel will automatically deploy the fixes.

## 🔐 SECURITY NOTE

The PROVIDER_KEY is sensitive. Only add it in:
- Vercel Dashboard → Environment Variables
- Mark it as "Secret" 
- Do NOT commit it to the repository

## 📊 EXPECTED BEHAVIOR AFTER FIX

1. **Chat Widget Loads**: ✅ Widget appears on page
2. **Mode Selection Works**: ✅ All 5 modes available
3. **Send Message**: ✅ POST to `/api/chat` succeeds
4. **Get Response**: ✅ Assistant replies appear
5. **Coach Feedback**: ✅ Yellow panel shows scores and feedback
6. **Analytics**: ✅ Events POST to `/api/coach-metrics`
7. **No Errors**: ✅ No 403, 404, or CORS errors

---

**STATUS**: This PR fixes all backend configuration issues. After merging and setting environment variables, the widget will be fully functional.
