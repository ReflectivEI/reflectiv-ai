# Environment Variables Setup for Vercel

## Required Variables

### PROVIDER_KEY
- **Type**: Secret
- **Value**: Your GROQ API key
- **Format**: Starts with `gsk_`
- **Where to get it**: https://console.groq.com/keys
- **Usage**: Required for LLM API calls in `/api/chat.js`
- **Environments**: Production, Preview, Development

**How to add**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Click "Add New"
3. Name: `PROVIDER_KEY`
4. Value: `gsk_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
5. Check all environments: Production, Preview, Development
6. Click "Save"

### CORS_ORIGINS
- **Type**: Plain Text
- **Value**: Comma-separated list of allowed origins
- **Default**: `https://reflectiv-ai.vercel.app,https://reflectivei.github.io/reflectiv-ai`
- **Usage**: Allows cross-origin requests from these domains
- **Environments**: Production, Preview, Development

**How to add**:
1. Go to Vercel Dashboard → Settings → Environment Variables
2. Click "Add New"
3. Name: `CORS_ORIGINS`
4. Value: `https://reflectiv-ai.vercel.app,https://reflectivei.github.io/reflectiv-ai`
5. Check all environments: Production, Preview, Development
6. Click "Save"

## Optional Variables

### PROVIDER_MODEL
- **Type**: Plain Text
- **Value**: `llama-3.1-8b-instant` (default if not set)
- **Usage**: Overrides the default LLM model
- **Note**: Currently hardcoded in `api/chat.js`, can be made configurable

### MAX_OUTPUT_TOKENS
- **Type**: Plain Text
- **Value**: `1400` (default if not set)
- **Usage**: Maximum tokens for LLM responses
- **Note**: Currently hardcoded in `api/chat.js`, can be made configurable

## Verification

After adding environment variables:

1. Trigger a new deployment (push to main or redeploy)
2. Check build logs to ensure no warnings about missing variables
3. Test the API endpoint:

```bash
curl -X POST https://reflectiv-ai.vercel.app/api/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectiv-ai.vercel.app" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"test"}]}'
```

Expected: JSON response with AI reply
Error if PROVIDER_KEY missing: `{"error":"bad_request"}`

## Security Notes

- ✅ **PROVIDER_KEY** is marked as Secret - encrypted at rest
- ✅ **CORS_ORIGINS** restricts API access to specific domains
- ❌ **DO NOT** commit API keys to the repository
- ❌ **DO NOT** expose API keys in client-side code
- ✅ **DO** rotate API keys periodically
- ✅ **DO** monitor API usage in GROQ dashboard

## Quick Setup Script

For command-line deployment (using Vercel CLI):

```bash
# Install Vercel CLI
npm install -g vercel

# Login
vercel login

# Set environment variables
vercel env add PROVIDER_KEY production
# Paste your GROQ API key when prompted

vercel env add CORS_ORIGINS production
# Paste: https://reflectiv-ai.vercel.app,https://reflectivei.github.io/reflectiv-ai

# Deploy
vercel --prod
```

## Troubleshooting

### "PROVIDER_KEY not set" error
1. Verify variable exists in Vercel Dashboard
2. Check variable is enabled for the correct environment (Production/Preview/Development)
3. Redeploy after adding variable
4. Check function logs for actual error

### CORS errors
1. Verify CORS_ORIGINS includes your domain
2. Check domain spelling and protocol (https://)
3. Ensure no trailing slashes in origins
4. Redeploy after changes

### Variables not updating
1. Variables are cached - need to redeploy
2. Click "Redeploy" in Vercel Dashboard
3. Or push new commit to trigger deployment
