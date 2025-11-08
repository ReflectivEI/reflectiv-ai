# ReflectivAI - Post-Audit Deployment Guide

**Status:** Ready for deployment
**Prerequisites:** GROQ API key required

---

## Quick Start

If you just want to deploy and test:

```bash
# 1. Set your GROQ API key as a secret
wrangler secret put PROVIDER_KEY
# When prompted, enter your GROQ API key (starts with gsk_...)

# 2. Deploy the worker
wrangler deploy

# 3. Test the /health endpoint
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# 4. Test the /chat endpoint
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is PrEP?"}]}'
```

That's it! If you get a valid response from step 4, the system is working.

---

## Detailed Deployment Steps

### Step 1: Install Wrangler (if not already installed)

```bash
npm install -g wrangler
wrangler login
```

### Step 2: Set Environment Secrets

The worker needs your GROQ API key to function. Set it as a secret:

```bash
wrangler secret put PROVIDER_KEY
```

When prompted, paste your GROQ API key. It should start with `gsk_`.

**Note:** This secret is NOT stored in the repository or wrangler.toml for security reasons.

### Step 3: (Optional) Create KV Namespace

For session persistence (optional feature):

```bash
# Create the KV namespace
wrangler kv:namespace create "SESS"

# Copy the returned ID
# Example output: { binding = "SESS", id = "abc123..." }

# Update wrangler.toml
# Replace "dev-sess-kv" with the real ID:
# [[kv_namespaces]]
# binding = "SESS"
# id = "abc123..."  # <-- Use the real ID here
```

**Note:** The system will work without this, but won't persist session state.

### Step 4: Deploy to Cloudflare Workers

```bash
wrangler deploy
```

You should see output like:

```
Uploading...
Uploaded worker.js
Published my-chat-agent-v2 (X.XX sec)
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev
```

### Step 5: Verify Deployment

#### Test /health Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

Expected response:
```
ok
```

#### Test /version Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

Expected response:
```json
{"version":"r10.1"}
```

#### Test /chat Endpoint (OpenAI-style payload)

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role": "user", "content": "What is PrEP?"}
    ]
  }'
```

Expected response (condensed):
```json
{
  "reply": "PrEP stands for Pre-Exposure Prophylaxis...",
  "coach": {
    "overall": 85,
    "scores": {...},
    "feedback": "...",
    "worked": [...],
    "improve": [...],
    "phrasing": "..."
  },
  "plan": {
    "id": "..."
  }
}
```

#### Test /facts Endpoint

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/facts \
  -H "Content-Type: application/json" \
  -d '{"disease":"HIV","topic":"PrEP"}'
```

Expected response:
```json
{
  "facts": [
    {
      "id": "HIV-PREP-ELIG-001",
      "ta": "HIV",
      "topic": "PrEP Eligibility",
      "text": "...",
      "cites": [...]
    },
    ...
  ]
}
```

---

## Frontend Testing

### Step 1: Deploy Frontend to GitHub Pages

The frontend is already configured for GitHub Pages. Just ensure the `main` branch (or your deployment branch) contains the latest changes.

### Step 2: Open the Live Site

Navigate to your GitHub Pages URL:
- `https://reflectivai.github.io/reflectiv-ai/`
- or `https://tonyabdelmalak.github.io/reflectiv-ai/`

### Step 3: Test Chat Functionality

1. **Open Chat Modal:**
   - Click the chat button or icon on the page
   - Modal should open with Learning Center dropdown

2. **Select Mode:**
   - Choose "Sales Simulation" from Learning Center dropdown
   - Select a Disease State (e.g., "HIV")
   - Select an HCP Profile

3. **Send Test Message:**
   - Type: "Tell me about HIV prevention options"
   - Click Send

4. **Verify Response:**
   - Should see response within 2-5 seconds (not "Still working..." forever)
   - Coach feedback card should appear below response
   - No errors in browser console

### Step 4: Browser Console Verification

Open DevTools (F12) → Console tab:

**Expected (Good):**
```
[ReflectivWidget] init: Initialization complete
[ReflectivWidget] sendMessage: Starting message send
[ReflectivWidget] callModel: Model call successful
```

**Not Expected (Bad):**
```
POST https://api.groq.com/openai/v1/chat/completions 400
CORS error
Timeout error
```

### Step 5: Network Tab Verification

Open DevTools (F12) → Network tab:

1. Clear network log
2. Send a test message
3. Look for POST request to:
   ```
   https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
   ```

4. Check:
   - Status: `200 OK` ✅ (not 400 or 502)
   - Response Type: `json`
   - Response Size: Several KB (actual response)

Click on the request to inspect:

**Request Headers:**
```
Content-Type: application/json
```

**Request Payload:**
```json
{
  "messages": [...],
  "model": "llama-3.1-8b-instant",
  "temperature": 0.2,
  ...
}
```

**Response (Preview):**
```json
{
  "reply": "...",
  "coach": {...},
  "plan": {...}
}
```

---

## Troubleshooting

### Issue: "Still working..." forever

**Symptoms:**
- Message sends but never gets response
- Timeout message appears after 10s

**Checks:**
1. Open browser console → Network tab
2. Look for failed requests (red)
3. Click failed request to see error

**Common Causes:**

#### 1. PROVIDER_KEY not set
```
Error: provider_http_401
```
**Solution:**
```bash
wrangler secret put PROVIDER_KEY
```

#### 2. Worker not deployed
```
Failed to fetch
net::ERR_NAME_NOT_RESOLVED
```
**Solution:**
```bash
wrangler deploy
```

#### 3. CORS issue
```
Access to fetch at '...' from origin '...' has been blocked by CORS policy
```
**Solution:** Check that your origin is in CORS_ORIGINS in wrangler.toml:
```toml
CORS_ORIGINS = "https://reflectivai.github.io,https://tonyabdelmalak.github.io,..."
```

### Issue: 400 Bad Request

**Symptoms:**
- POST to /chat returns 400
- Error message in response body

**Checks:**
1. Inspect request payload in Network tab
2. Check Content-Type header is `application/json`
3. Verify payload is valid JSON

**Common Causes:**

#### Invalid JSON
```json
// Bad (trailing comma)
{"messages": [...],}

// Good
{"messages": [...]}
```

#### Missing required field
- Ensure `messages` array is present
- Or ensure `user` field is present (ReflectivAI format)

### Issue: 502 Bad Gateway

**Symptoms:**
- Worker returns 502
- "Bad Gateway" error

**Checks:**
1. Check Cloudflare Worker logs:
   ```bash
   wrangler tail
   ```
2. Look for errors in worker execution

**Common Causes:**

#### GROQ API timeout
- GROQ API is down or slow
- Increase timeout in worker

#### Worker exception
- Check logs for stack trace
- Fix code error

### Issue: Empty Response

**Symptoms:**
- 200 OK status
- But response body is empty or malformed

**Checks:**
1. Inspect response in Network tab
2. Check worker logs:
   ```bash
   wrangler tail
   ```

**Common Causes:**

#### GROQ returned empty
- GROQ API issue
- Check GROQ API status

#### extractCoach() failed
- Coach JSON parsing error
- Check worker logs for warnings

---

## Monitoring & Logs

### Real-time Logs

```bash
# Stream logs from deployed worker
wrangler tail

# Filter by status
wrangler tail --status error
```

### Common Log Messages

**Good:**
```
[INFO] POST /chat 200 (1234ms)
[INFO] Provider call success
```

**Bad:**
```
[ERROR] Provider error 400: Invalid parameter max_output_tokens
[ERROR] Provider error 401: Invalid API key
```

### Cloudflare Dashboard

1. Go to: https://dash.cloudflare.com/
2. Select your account
3. Go to: Workers & Pages
4. Click on: `my-chat-agent-v2`
5. View:
   - Metrics (requests, errors, latency)
   - Logs (real-time)
   - Settings (environment variables, secrets)

---

## Performance Tuning

### Reduce Latency

#### 1. Use Faster Model
In wrangler.toml:
```toml
# Current (70B - slower but better quality)
PROVIDER_MODEL = "llama-3.1-70b-versatile"

# Alternative (8B - faster but lower quality)
PROVIDER_MODEL = "llama-3.1-8b-instant"
```

#### 2. Reduce Max Tokens
In worker.js, adjust per mode:
```javascript
// Current
if (mode === "sales-simulation") {
  maxTokens = 1400;  // Reduce to 1000 for faster responses
}
```

#### 3. Enable Streaming (Advanced)
In config.json:
```json
{
  "stream": true
}
```
**Note:** Requires SSE support in worker (already implemented but needs testing)

### Reduce Costs

#### 1. Use Smaller Model
```toml
PROVIDER_MODEL = "llama-3.1-8b-instant"  # Cheaper
```

#### 2. Reduce Token Limits
Lower MAX_OUTPUT_TOKENS in wrangler.toml:
```toml
MAX_OUTPUT_TOKENS = "800"  # Down from 1400
```

#### 3. Implement Caching
Cache frequent requests in KV:
```javascript
// In worker.js
const cacheKey = `chat:${hash(messages)}`;
const cached = await env.SESS.get(cacheKey);
if (cached) return JSON.parse(cached);
```

---

## Security Checklist

- [x] PROVIDER_KEY stored as secret (not in code)
- [x] CORS_ORIGINS configured (not `*`)
- [x] CSP headers in index.html
- [x] No PHI or PII logged
- [x] Error messages sanitized
- [x] HTTPS enforced (Cloudflare)
- [ ] Rate limiting (TODO: not implemented yet)
- [ ] API key rotation schedule (TODO: manual process)

---

## Rollback Procedure

If deployment causes issues:

### Option 1: Rollback via Wrangler

```bash
# List deployments
wrangler deployments list

# Rollback to previous deployment
wrangler rollback [deployment-id]
```

### Option 2: Revert Git Changes

```bash
# Revert this commit
git revert HEAD

# Deploy previous version
wrangler deploy
```

### Option 3: Quick Fix

1. Update wrangler.toml to point to old worker
2. Deploy:
   ```bash
   wrangler deploy
   ```

---

## Next Steps

### Recommended Enhancements

1. **Add Rate Limiting:**
   - Prevent abuse
   - Implement in worker using KV

2. **Add Monitoring:**
   - Set up Sentry or similar
   - Track errors and performance

3. **Add Caching:**
   - Cache responses in KV
   - Reduce GROQ API costs

4. **Add Analytics:**
   - Track usage by mode
   - Monitor response quality

5. **Add Tests:**
   - Unit tests for worker functions
   - E2E tests for full flow

### Documentation Updates

1. Update README.md with:
   - New deployment steps
   - API documentation
   - Troubleshooting guide

2. Create API_REFERENCE.md:
   - Document all endpoints
   - Request/response formats
   - Error codes

3. Create ARCHITECTURE.md:
   - System diagram
   - Component interactions
   - Data flow

---

## Support

### Common Questions

**Q: How much does this cost?**
A: Depends on GROQ pricing and Cloudflare Workers usage. Typical costs:
- GROQ: ~$0.50-2.00 per million tokens
- Cloudflare Workers: Free tier covers most small projects

**Q: Can I use a different LLM provider?**
A: Yes! Update PROVIDER_URL, PROVIDER_KEY, and adjust API call format in worker.js

**Q: How do I scale this?**
A: Cloudflare Workers auto-scale. For higher loads, consider:
- Caching frequently-used responses
- Rate limiting per user
- Using faster/cheaper models

**Q: Is this production-ready?**
A: Yes for small-scale use. For enterprise:
- Add rate limiting
- Add monitoring/alerting
- Implement request caching
- Set up error tracking

### Getting Help

1. Check AUDIT_SUMMARY.md for detailed diagnostics
2. Check browser console for client-side errors
3. Check `wrangler tail` for server-side errors
4. Review Network tab in DevTools
5. Search GitHub Issues for similar problems

---

## Conclusion

After deploying and verifying:

1. ✅ Worker deployed to Cloudflare
2. ✅ PROVIDER_KEY secret configured
3. ✅ /health endpoint responds
4. ✅ /chat endpoint works
5. ✅ Frontend calls worker (not GROQ directly)
6. ✅ No 400/502 errors
7. ✅ Responses appear in 2-5 seconds

Your ReflectivAI system is now fully operational! 🎉

For ongoing maintenance, review logs weekly and monitor API costs.
