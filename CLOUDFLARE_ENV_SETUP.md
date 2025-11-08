# Cloudflare Environment Variables Configuration

This document describes the required environment variables for the ReflectivAI Cloudflare Worker.

## Required Environment Variables

Configure these in the Cloudflare Dashboard under Workers & Pages → your worker → Settings → Variables:

### CORS_ORIGINS

**Required for Production**

Comma-separated list of allowed origins for Cross-Origin Resource Sharing (CORS).

**Required Values:**
```
https://reflectivei.github.io,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com
```

**Format:**
- Comma-separated list with NO spaces
- Each origin must include the protocol (https://)
- No trailing slashes on origins

**Example:**
```
CORS_ORIGINS = "https://reflectivei.github.io,https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"
```

**Note:** If CORS_ORIGINS is not set, the worker will allow all origins (*), which is NOT recommended for production.

### PROVIDER_URL

URL of the AI provider API endpoint.

**Example:**
```
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
```

### PROVIDER_MODEL

Model identifier for the AI provider.

**Example:**
```
PROVIDER_MODEL = "llama-3.1-70b-versatile"
```

### PROVIDER_KEY

**Secret - Encrypt this variable**

API key for authenticating with the AI provider.

**Important:** Make sure to encrypt this variable in the Cloudflare dashboard.

### MAX_OUTPUT_TOKENS (Optional)

Maximum number of output tokens for AI responses.

**Example:**
```
MAX_OUTPUT_TOKENS = "1400"
```

### REQUIRE_FACTS (Optional)

Whether to require at least one fact in the plan.

**Example:**
```
REQUIRE_FACTS = "true"
```

## How to Set Environment Variables

1. Log in to Cloudflare Dashboard
2. Navigate to Workers & Pages
3. Select your worker: `my-chat-agent-v2`
4. Go to Settings → Variables
5. Add each environment variable:
   - Click "Add variable"
   - Enter variable name
   - Enter value
   - For PROVIDER_KEY, click "Encrypt" before saving
   - Click "Save"
6. Deploy the worker for changes to take effect

## Verification

After setting the environment variables, verify CORS is working:

1. Open browser console on https://reflectivei.github.io
2. Check that requests to the worker succeed
3. Verify no CORS errors appear in console
4. Check response headers include:
   - `Access-Control-Allow-Origin: https://reflectivei.github.io`
   - `Access-Control-Allow-Methods: GET,POST,OPTIONS`
   - `Access-Control-Allow-Credentials: true`

## Troubleshooting

### CORS Error: "No 'Access-Control-Allow-Origin' header"

**Cause:** CORS_ORIGINS is not configured or doesn't include the requesting origin.

**Solution:** 
1. Verify CORS_ORIGINS includes the exact origin (https://reflectivei.github.io)
2. Check for typos in the origin URLs
3. Ensure no extra spaces in the comma-separated list
4. Redeploy the worker after making changes

### 500 Internal Server Error

**Cause:** PROVIDER_KEY is not configured or invalid.

**Solution:**
1. Verify PROVIDER_KEY is set and encrypted
2. Check Cloudflare logs for specific error messages
3. Verify PROVIDER_URL and PROVIDER_MODEL are correct
