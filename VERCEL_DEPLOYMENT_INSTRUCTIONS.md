# Vercel Deployment Instructions

## Overview

This guide provides step-by-step instructions to deploy ReflectivAI to Vercel with fully functional serverless API endpoints.

## Current Status

✅ **FIXED**: `vercel.json` now properly configured with:
- Serverless function builds for `/api/chat.js` and `/api/coach-metrics.js`
- Proper routing for API endpoints
- Static file serving for frontend assets
- CORS headers configuration

## Prerequisites

1. **Vercel Account**: Access to the Vercel dashboard
2. **Repository Access**: Admin access to ReflectivEI/reflectiv-ai
3. **API Keys**: GROQ API key for LLM provider

## Deployment Steps

### Step 1: Configure Environment Variables in Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (reflectiv-ai)
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:

| Variable Name | Value | Environment |
|--------------|--------|-------------|
| `PROVIDER_KEY` | Your GROQ API key (starts with `gsk_`) | Production, Preview, Development |
| `CORS_ORIGINS` | `https://reflectiv-ai.vercel.app,https://reflectivei.github.io/reflectiv-ai` | Production, Preview, Development |

**Important**: Mark `PROVIDER_KEY` as **Secret** (encrypted)

### Step 2: Deploy from Main Branch

**Option A: Automatic Deployment (Recommended)**
1. Merge this PR to `main` branch
2. Vercel will automatically detect changes and deploy
3. Wait 2-3 minutes for build to complete

**Option B: Manual Deployment**
1. Go to Vercel Dashboard → Your Project
2. Click **Deployments** tab
3. Click **Deploy** button
4. Select branch: `main`
5. Wait for deployment to complete

### Step 3: Verify Deployment

After deployment completes, test the endpoints:

#### Test Health Check
```bash
curl https://reflectiv-ai.vercel.app/
# Should return the index.html page
```

#### Test API Chat Endpoint (OPTIONS)
```bash
curl -X OPTIONS https://reflectiv-ai.vercel.app/api/chat \
  -H "Origin: https://reflectiv-ai.vercel.app" \
  -H "Access-Control-Request-Method: POST"
# Should return 204 with CORS headers
```

#### Test API Chat Endpoint (POST)
```bash
curl -X POST https://reflectiv-ai.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectiv-ai.vercel.app" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {"role": "user", "content": "How should I discuss PrEP with an HCP?"}
    ],
    "disease": "HIV"
  }'
# Should return a JSON response with reply and coach feedback
```

#### Test Analytics Endpoint
```bash
curl -X POST https://reflectiv-ai.vercel.app/api/coach-metrics \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectiv-ai.vercel.app" \
  -d '{
    "event": "test",
    "mode": "sales-coach",
    "session": "test-session"
  }'
# Should return {"success": true, ...}
```

### Step 4: Test the Chat Widget

1. Open https://reflectiv-ai.vercel.app in your browser
2. Open browser DevTools (F12) → Console tab
3. Click the chat widget icon (bottom-right corner)
4. Select a mode (e.g., "Sales Coach")
5. Type a message and send it
6. Verify:
   - ✅ No CORS errors in console
   - ✅ POST request to `/api/chat` returns 200
   - ✅ Response appears in chat
   - ✅ Coach feedback panel appears (for Sales Coach mode)
   - ✅ No 403, 404, or 500 errors

## Configuration Details

### vercel.json Structure

The configuration file defines:

1. **Builds**: Converts source files to deployable assets
   - API files → Serverless functions (Node.js runtime)
   - Static files → Static assets

2. **Routes**: Maps URL patterns to files
   - `/api/chat` → `api/chat.js` (serverless function)
   - `/api/coach-metrics` → `api/coach-metrics.js` (serverless function)
   - `/assets/*` → Static files
   - `/*` → `index.html` (SPA fallback)

3. **Headers**: Sets CORS headers for API endpoints

### API Endpoints

#### POST /api/chat
**Purpose**: Main chat endpoint for all modes

**Request Body**:
```json
{
  "mode": "sales-coach",
  "messages": [
    {"role": "user", "content": "message text"}
  ],
  "disease": "HIV",
  "persona": "engaged"
}
```

**Response**:
```json
{
  "reply": "AI response text",
  "coach": {
    "overall": 85,
    "scores": {...},
    "worked": ["point 1", "point 2"],
    "improve": ["point 1"],
    "phrasing": "suggested text",
    "feedback": "coach feedback"
  },
  "plan": {"id": "plan-id"}
}
```

#### POST /api/coach-metrics
**Purpose**: Analytics events tracking

**Request Body**:
```json
{
  "event": "message_sent",
  "mode": "sales-coach",
  "session": "session-id",
  "data": {...}
}
```

**Response**:
```json
{
  "success": true,
  "message": "Analytics event recorded",
  "timestamp": "2025-11-18T14:30:00.000Z"
}
```

## Troubleshooting

### Error: "PROVIDER_KEY not set"
**Cause**: Missing environment variable in Vercel
**Fix**: Add PROVIDER_KEY in Vercel Dashboard → Settings → Environment Variables

### Error: CORS errors in browser console
**Cause**: CORS_ORIGINS not set or incorrect
**Fix**: 
1. Add CORS_ORIGINS environment variable in Vercel
2. Include your domain: `https://reflectiv-ai.vercel.app`
3. Redeploy

### Error: 404 on /api/chat
**Cause**: Vercel not recognizing serverless functions
**Fix**: 
1. Verify `vercel.json` has correct builds and routes
2. Check that `api/chat.js` exports `default async function handler(req, res)`
3. Redeploy

### Error: 500 on /api/chat
**Cause**: Runtime error in serverless function
**Fix**:
1. Check Vercel function logs: Dashboard → Deployments → Select deployment → Functions tab
2. Look for error messages
3. Common issues:
   - Invalid PROVIDER_KEY
   - Groq API rate limit
   - Missing request fields

### Build fails in Vercel
**Cause**: Invalid vercel.json or missing files
**Fix**:
1. Validate JSON syntax: `cat vercel.json | python3 -m json.tool`
2. Check build logs in Vercel Dashboard
3. Ensure all referenced files exist

## Post-Deployment Checklist

After successful deployment:

- [ ] Environment variables configured (`PROVIDER_KEY`, `CORS_ORIGINS`)
- [ ] Deployment completed successfully
- [ ] `/api/chat` endpoint returns 200 for POST requests
- [ ] `/api/coach-metrics` endpoint returns 200 for POST requests
- [ ] Chat widget loads without errors
- [ ] Can send messages and receive responses
- [ ] Coach feedback panel appears (Sales Coach mode)
- [ ] No CORS errors in browser console
- [ ] Analytics events are logged (check function logs)

## Next Steps

Once Vercel is working:

1. **Update Cloudflare Worker** (optional fallback)
   - Enable POST method support
   - Keep as backup if Vercel has issues

2. **Update GitHub Pages** (if using as primary)
   - Configure to use Vercel API endpoints
   - Update config.json if needed

3. **Monitor Performance**
   - Check Vercel Analytics dashboard
   - Monitor function execution times
   - Watch for rate limits on Groq API

4. **Production Checklist**
   - Set up custom domain (if desired)
   - Configure production API keys
   - Enable Vercel Analytics
   - Set up error monitoring (Sentry, etc.)

## Support

If issues persist after following this guide:
1. Check Vercel function logs for detailed error messages
2. Verify all environment variables are set correctly
3. Test API endpoints directly with curl
4. Check browser console for client-side errors

## Files Modified

- `vercel.json` - Complete rewrite with proper configuration
- `VERCEL_DEPLOYMENT_INSTRUCTIONS.md` - This file

## Related Documentation

- [Vercel Serverless Functions](https://vercel.com/docs/functions/serverless-functions)
- [Vercel Configuration](https://vercel.com/docs/projects/project-configuration)
- [GROQ API Documentation](https://console.groq.com/docs)
