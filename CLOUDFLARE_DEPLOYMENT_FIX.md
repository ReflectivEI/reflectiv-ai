# Cloudflare Deployment Fix - Action Plan

## Root Causes Found

### 🔴 CRITICAL BLOCKER #1: Missing account_id
**File**: `wrangler.toml`  
**Issue**: The `account_id` field is commented out  
**Impact**: Wrangler cannot determine which Cloudflare account to deploy to

### 🔴 CRITICAL BLOCKER #2: Missing GitHub Secret
**Secret**: `CLOUDFLARE_API_TOKEN`  
**Issue**: Required for GitHub Actions deployment, may not be configured  
**Impact**: Automated deployment will fail

### 🟡 RUNTIME REQUIREMENT: Missing PROVIDER_KEY
**Secret**: `PROVIDER_KEY` (Groq API key)  
**Issue**: Not set in Cloudflare  
**Impact**: Worker will deploy but fail at runtime without AI provider key

## Quick Fix Instructions

### Fix #1: Set Account ID (Required)

1. **Get your Cloudflare Account ID**:
   - Go to https://dash.cloudflare.com
   - Select your account
   - Look for "Account ID" in the right sidebar
   - Copy the ID (format: 32 hex characters)

2. **Update wrangler.toml**:
   ```toml
   # Find this line in wrangler.toml:
   # account_id = "your-account-id-here"
   
   # Uncomment and replace with your actual account ID:
   account_id = "abc123def456..."  # Your actual account ID
   ```

### Fix #2: Configure GitHub Secret (Required)

1. **Create Cloudflare API Token**:
   - Go to https://dash.cloudflare.com/profile/api-tokens
   - Click "Create Token"
   - Use "Edit Cloudflare Workers" template
   - Click "Continue to summary" → "Create Token"
   - **COPY THE TOKEN** (you can't view it again!)

2. **Add to GitHub**:
   - Go to https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
   - Click "New repository secret"
   - Name: `CLOUDFLARE_API_TOKEN`
   - Value: (paste your token)
   - Click "Add secret"

### Fix #3: Set Provider Key (Required for Runtime)

After successful deployment, set the Groq API key:

```bash
# Method A: Using wrangler CLI
wrangler secret put PROVIDER_KEY
# Enter your Groq API key when prompted (starts with gsk_...)

# Method B: Using Cloudflare Dashboard
# 1. Go to https://dash.cloudflare.com
# 2. Select Workers & Pages
# 3. Click on "my-chat-agent-v2"
# 4. Go to Settings → Variables
# 5. Add encrypted variable: PROVIDER_KEY = your_groq_key
```

## Deployment Steps (After Fixes)

### Option A: GitHub Actions (Recommended)
1. Ensure fixes #1 and #2 are complete
2. Go to https://github.com/ReflectivEI/reflectiv-ai/actions
3. Click "Deploy Cloudflare Worker"
4. Click "Run workflow" → Select `main` branch
5. Click "Run workflow"
6. Wait ~2 minutes for deployment
7. Check logs for success/errors

### Option B: Manual Deployment
```bash
# Install wrangler (if needed)
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
cd /path/to/reflectiv-ai
wrangler deploy

# Set provider key
wrangler secret put PROVIDER_KEY
```

## Verification Checklist

After deployment, verify each step:

### 1. DNS Resolution
```bash
host my-chat-agent-v2.tonyabdelmalak.workers.dev
# Should show IP addresses, not "not found"
```

### 2. Health Check
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: "ok"
```

### 3. Deep Health Check
```bash
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1"
# Should return JSON with provider status
```

### 4. Chat Endpoint (Basic)
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"Hello"}],"mode":"sales-coach"}'
# Should return JSON with "reply" field
```

### 5. Widget Test
1. Open https://reflectivei.github.io/reflectiv-ai/
2. Click "Explore Platform" or "Open Coach"
3. Type: "What is HIV PrEP?"
4. Verify response appears

## Troubleshooting

### If deployment fails with "account_id required":
- Double-check wrangler.toml has uncommented account_id
- Verify account_id is correct (no typos)

### If deployment fails with "authentication error":
- Verify CLOUDFLARE_API_TOKEN secret is set correctly
- Check token has "Edit Cloudflare Workers" permissions
- Token may have expired - create a new one

### If deployment succeeds but worker fails at runtime:
- Set PROVIDER_KEY secret (Groq API key)
- Check key is valid and has quota
- View logs: `wrangler tail`

### If DNS still fails after deployment:
- Wait 2-5 minutes for DNS propagation
- Try: `curl -v https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
- Check Cloudflare dashboard to confirm worker is deployed

## Expected Timeline

- Fix configuration: 5 minutes
- Set secrets: 3 minutes  
- Deploy worker: 2 minutes
- DNS propagation: 1-5 minutes
- Widget working: Immediately after DNS propagates

**Total: ~10-15 minutes**

## Files Modified

This fix requires changes to:
- `wrangler.toml` - Add account_id
- GitHub Secrets - Add CLOUDFLARE_API_TOKEN
- Cloudflare Secrets - Add PROVIDER_KEY (after deployment)

## Next Steps After Deployment

1. ✅ Verify all health checks pass
2. ✅ Test widget in browser
3. ✅ Monitor worker logs for errors
4. ✅ Set up key rotation schedule (optional)
5. ✅ Configure custom domain (optional)

## Support Resources

- Cloudflare Workers Docs: https://developers.cloudflare.com/workers/
- Wrangler CLI Docs: https://developers.cloudflare.com/workers/wrangler/
- API Token Creation: https://developers.cloudflare.com/fundamentals/api/get-started/create-token/
- GitHub Actions Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
