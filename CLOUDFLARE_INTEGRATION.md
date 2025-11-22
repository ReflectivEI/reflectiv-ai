# CloudflareWorker Integration Guide

## Overview

Your repository now has **TWO worker versions**:

1. **worker.js (r10.1)** - Current simplified worker with `/facts`, `/plan`, `/chat` endpoints
2. **worker-r9.js (NEW)** - Advanced worker with session management, XML validation, mode locking

## Decision: Which Worker Should You Use?

### Use worker.js (r10.1) IF:
- ✅ You want simpler debugging
- ✅ Your frontend sends `{mode, messages}` format
- ✅ You don't need session persistence
- ✅ You want the existing `/facts` and `/plan` endpoints

### Use worker-r9.js IF:
- ✅ You need strict mode isolation (prevents HCP from giving coaching advice)
- ✅ You want server-side session management
- ✅ You need XML role validation (`<role>HCP</role><content>...</content>`)
- ✅ You want key rotation across multiple GROQ API keys
- ✅ You need rate limiting per site (tony vs reflectivai)

## Recommended Approach: Use worker.js (r10.1)

The worker.js (r10.1) is the current recommended version for most use cases. It provides a simpler, more maintainable architecture with all essential features. If you need advanced session management and strict mode isolation, consider r9 as described below.

---

## Using worker.js (r10.1) - Quick Start

### Step 1: Configure Secrets

```bash
# Set your GROQ API key
npx wrangler secret put PROVIDER_KEY
# Paste your Groq API key when prompted (starts with gsk_...)
```

**Get GROQ Keys:** https://console.groq.com/keys

### Step 2: Deploy Worker

```bash
# Deploy the current worker.js (r10.1)
npx wrangler deploy

# Test at: https://your-worker-name.your-account.workers.dev
```

### Step 3: Test Deployment

```bash
# Test health endpoint
curl https://your-worker-name.your-account.workers.dev/health

# Test chat endpoint
curl -X POST https://your-worker-name.your-account.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "role-play",
    "messages": [{"role": "user", "content": "Tell me about PrEP"}]
  }'
```

---

## Optional: Migrating to r9 (Advanced Users Only)

If you need advanced features like strict mode isolation and server-side session management, follow these steps:

### Step 1: Create KV Namespace

```bash
# Create the session storage namespace
npx wrangler kv:namespace create "SESS"

# Copy the ID from output and update wrangler-r9.toml
# It will look like: id = "abc123def456..."
```

---

### Step 2: Configure Secrets (r9)

```bash
# Set your GROQ API keys (you can use 1-3 keys for rotation)
npx wrangler secret put GROQ_KEY_1
# Paste your Groq API key when prompted (starts with gsk_...)

# Optional: Add backup keys for automatic rotation
npx wrangler secret put GROQ_KEY_2
npx wrangler secret put GROQ_KEY_3
```

**Get GROQ Keys:** https://console.groq.com/keys

---

### Step 3: Deploy Worker (r9)

### Option A: Replace Existing Worker

```bash
# Backup current worker
cp worker.js worker-r10.1-backup.js
cp wrangler.toml wrangler-r10.1-backup.toml

# Replace with r9
mv worker-r9.js worker.js
mv wrangler-r9.toml wrangler.toml

# Update the KV namespace ID in wrangler.toml
# (from step 1)

# Deploy
npx wrangler deploy
```

### Option B: Deploy as New Worker

```bash
# Edit wrangler-r9.toml and change worker name
# name = "my-chat-agent-v3"  # Different name

# Deploy to new worker
npx wrangler deploy --config wrangler-r9.toml

# Test at: https://my-chat-agent-v3.tonyabdelmalak.workers.dev
```

---

### Step 4: Update Frontend (r9)

The r9 worker requires a different request format. You have two options:

### Option 1: Use Backward-Compatible `/chat` Endpoint

The r9 worker includes a `/chat` adapter that works with your existing frontend:

```javascript
// Your existing code works unchanged!
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    mode: 'role-play',
    messages: [
      { role: 'user', content: 'Hello doctor' }
    ]
  })
});
```

**No frontend changes needed!** ✅

### Option 2: Use New `/agent` Endpoint (Recommended)

For full features, update to the new format:

```javascript
// New strict endpoint
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/agent', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: 'unique-session-id',  // Generate once per session
    thread_id: 'main-conversation',    // Optional thread within session
    seq: 0,                             // Increment with each message
    mode: 'role-play',                  // or 'coach', 'sales-simulation', etc.
    input: 'Hello doctor',              // User's message
    stream: false                       // or true for SSE streaming
  })
});
```

---

### Step 5: Test Deployment (r9)

### Test Health Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Expected: {"ok":true,"time":1731283200000,"groq_keys":3}
```

### Test Version Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
# Expected: {"ok":true,"version":"r9","sig":"groq:llama-3.1-70b-versatile"}
```

### Test Chat Endpoint (Backward-Compatible)

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "role-play",
    "messages": [{"role": "user", "content": "Tell me about PrEP"}]
  }'
```

### Test New Agent Endpoint

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/agent \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "session_id": "test-123",
    "seq": 0,
    "mode": "role-play",
    "input": "Tell me about PrEP"
  }'
```

---

## Key Differences: r10.1 vs r9

| Feature | r10.1 (Current) | r9 (New) |
|---------|----------------|----------|
| **Session Management** | Client-side only | Server-side KV storage |
| **Mode Enforcement** | Client-controlled | Server-enforced, locked per session |
| **Response Format** | JSON | XML + JSON (validated) |
| **Endpoints** | `/facts`, `/plan`, `/chat` | `/agent`, `/evaluate`, `/chat` (compat) |
| **Secrets** | PROVIDER_KEY | GROQ_KEY_1/2/3 (rotation) |
| **Rate Limiting** | None | Per-site, per-mode |
| **Streaming** | Basic SSE | SSE with mode restrictions |
| **Role Validation** | None | Strict XML schema enforcement |

---

## Rollback Plan

If you migrated to r9 and need to rollback to r10.1:

```bash
# Restore backups
cp worker-r10.1-backup.js worker.js
cp wrangler-r10.1-backup.toml wrangler.toml

# Ensure PROVIDER_KEY secret is set
npx wrangler secret put PROVIDER_KEY

# Deploy
npx wrangler deploy
```

---

## Environment Variables Comparison

### r10.1 Requires:
```toml
PROVIDER_URL
PROVIDER_MODEL
CORS_ORIGINS
```

### r9 Requires:
```toml
PROVIDER_URL
PROVIDER_MODEL_HCP
PROVIDER_MODEL_COACH
PROVIDER_SIG
MAX_CHARS_CONTEXT
RESPONSE_TTL_SECONDS
CORS_ORIGINS
RATELIMIT_RATE
RATELIMIT_BURST
```

---

## Monitoring

### View Logs (Both Versions)

```bash
npx wrangler tail
```

### Check Metrics (r9 only)

r9 includes a `/coach-metrics` endpoint for analytics:

```javascript
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics', {
  method: 'POST',
  body: JSON.stringify({
    ts: Date.now(),
    schema: 'coach-v2',
    mode: 'sales-simulation',
    overall: 4.2,
    scores: { accuracy: 5, empathy: 4, clarity: 4, compliance: 5, discovery: 3, objection_handling: 4 },
    context: { rep_question: '...', hcp_reply: '...' }
  })
});
```

---

## Recommended Action Plan

1. ✅ **Continue:** Keep using worker.js (r10.1) as your primary worker
2. ✅ **Test:** Verify /facts, /plan, and /chat endpoints work with your frontend
3. ✅ **Validate:** Check all modes (role-play, sales-simulation, coach)
4. ✅ **Monitor:** Watch logs for errors using `npx wrangler tail`
5. ✅ **Optional:** If you need advanced session management, consider testing r9 as a separate deployment
6. ✅ **Deploy:** Push changes to GitHub Pages
7. ✅ **Maintain:** Keep worker.js (r10.1) updated with latest features

---

## Support

### Common Issues

**"Missing GROQ keys" error**
```bash
npx wrangler secret put GROQ_KEY_1
```

**CORS errors**
- Check CORS_ORIGINS in wrangler.toml includes your domain
- Verify Origin header is being sent by frontend

**Mode mismatch errors**
- r9 locks mode per session
- Clear session storage or use new session_id

**Rate limited**
- Default: 10 requests/minute
- Adjust RATELIMIT_RATE in wrangler.toml

---

*Need help? Check worker logs with `npx wrangler tail`*
