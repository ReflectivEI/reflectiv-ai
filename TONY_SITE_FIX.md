# Tony Professional Site Widget Fix

## Problem Statement

Your **tonyabdelmalak.github.io** site has a chat widget that was previously wired to the same Cloudflare Worker (`my-chat-agent-v2.tonyabdelmalak.workers.dev`) that now serves the ReflectivAI sales coaching widget.

**The Tony site widget is now broken** because the worker has been modified to expect ReflectivAI-specific modes (`sales-simulation`, `role-play`, etc.) and the Tony site sends different request structures.

---

## Root Cause Analysis

### What Changed in the Worker

The current `worker.js` expects requests like:
```json
{
  "mode": "sales-simulation",
  "user": "What about TAF?",
  "disease": "HIV",
  "persona": "MD"
}
```

### What the Tony Widget Sends

Based on the GitHub repo analysis, the Tony widget (`/chat-widget/assets/chat/widget.js`) sends:
```json
{
  "model": "llama-3.1-8b-instant",
  "temperature": 0.25,
  "messages": [
    { "role": "system", "content": "..." },
    { "role": "user", "content": "Tell me about your projects" }
  ],
  "systemUrl": "https://raw.githubusercontent.com/tonyabdelmalak/...",
  "kbUrl": "https://raw.githubusercontent.com/tonyabdelmalak/..."
}
```

**This is a completely different request format**, so the current worker rejects it.

---

## Solution Options

### Option 1: Deploy Separate Worker for Tony Site (RECOMMENDED)

**Pros:**
- Clean separation of concerns
- Tony widget continues working independently
- No risk of cross-contamination between ReflectivAI and Tony sites
- Can use different GROQ API keys if needed

**Cons:**
- Requires deploying a second worker

**Implementation:**
```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai

# Copy the Tony-specific worker from the GitHub repo
# (it's already in your repo at chat-widget/worker.js)
cp /path/to/tonyabdelmalak.github.io/chat-widget/worker.js tony-worker.js

# Create separate wrangler config
cat > tony-wrangler.toml << 'EOF'
name = "tony-chat-widget"
main = "tony-worker.js"
compatibility_date = "2024-11-12"
workers_dev = true

[vars]
# Tony-specific config
CORS_ORIGINS = "https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"

# Secrets (set via wrangler secret put):
# GROQ_API_KEY
# OPENROUTER_API_KEY (optional fallback)
EOF

# Deploy Tony's dedicated worker
wrangler deploy -c tony-wrangler.toml

# Output will show URL like:
# https://tony-chat-widget.tonyabdelmalak.workers.dev
```

**Then update Tony site's widget config:**
```javascript
// In tonyabdelmalak.github.io/chat-widget/assets/chat/widget.js
const DEFAULTS = {
  workerUrl: "https://tony-chat-widget.tonyabdelmalak.workers.dev/chat",  // NEW URL
  // ...
};
```

---

### Option 2: Add Backward-Compatible `/chat` Handler

**Pros:**
- Single worker for both sites
- Minimal code changes

**Cons:**
- Increases worker complexity
- Risk of mode confusion if request detection fails
- Harder to debug/maintain

**Implementation:**

Add this logic to `worker.js` at the `/chat` handler:

```javascript
// In worker.js, around line 92 (before postChat)
if (url.pathname === "/chat" && req.method === "POST") {
  const body = await req.clone().json().catch(() => ({}));
  
  // Detect Tony widget request format (has messages[] + systemUrl)
  if (Array.isArray(body.messages) && body.systemUrl) {
    // Forward to Tony-specific handler
    return await handleTonyChatRequest(req, env, body);
  }
  
  // Otherwise, handle as ReflectivAI request (has mode + disease)
  // ... existing postChat logic
}
```

**Add Tony handler function:**
```javascript
async function handleTonyChatRequest(req, env, body) {
  const model = body.model || "llama-3.1-8b-instant";
  const temperature = body.temperature || 0.25;
  const messages = body.messages || [];
  
  // Fetch Tony's system.md + about-tony.md (with caching)
  const systemUrl = body.systemUrl || "https://raw.githubusercontent.com/tonyabdelmalak/tonyabdelmalak.github.io/main/chat-widget/assets/chat/system.md";
  const kbUrl = body.kbUrl || "https://raw.githubusercontent.com/tonyabdelmalak/tonyabdelmalak.github.io/main/chat-widget/assets/chat/about-tony.md";
  
  const [systemMd, kbMd] = await Promise.all([
    fetch(systemUrl).then(r => r.text()),
    fetch(kbUrl).then(r => r.text())
  ]);
  
  // Build unified system prompt
  const unifiedSystem = `## Role & Voice\nYou are Tony. Speak in first person as Tony.\n\n## System Rules\n${systemMd}\n\n## Knowledge Base\n${kbMd}`;
  
  const finalMessages = [
    { role: "system", content: unifiedSystem },
    ...messages.filter(m => m.role !== "system")
  ];
  
  // Call Groq
  const providerResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      messages: finalMessages,
      max_tokens: 1024
    })
  });
  
  const data = await providerResp.json();
  const content = data.choices?.[0]?.message?.content || "Sorry, I couldn't generate a reply.";
  
  return json({
    role: "assistant",
    content,
    provider: "groq",
    model_used: model
  }, 200, env, req);
}
```

---

### Option 3: Dual-Route Worker (Cleanest Hybrid)

**Pros:**
- Single worker with clear separation
- Different endpoints for different sites
- Easy to debug

**Implementation:**

```javascript
// In worker.js, modify routing:

// ReflectivAI routes (existing)
if (url.pathname === "/chat" && req.method === "POST") {
  // ... existing postChat logic for ReflectivAI
}

// Tony site route (NEW)
if (url.pathname === "/tony-chat" && req.method === "POST") {
  return await handleTonyChatRequest(req, env, body);
}
```

**Update Tony widget to use `/tony-chat`:**
```javascript
// In tonyabdelmalak.github.io/chat-widget/assets/chat/widget.js
const DEFAULTS = {
  workerUrl: "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/tony-chat",  // NEW PATH
  // ...
};
```

---

## Recommended Action Plan

### Phase 1: Immediate Fix (Deploy Separate Worker)
```bash
# 1. Extract Tony worker from GitHub repo
cd ~/Desktop
git clone https://github.com/tonyabdelmalak/tonyabdelmalak.github.io.git
cp tonyabdelmalak.github.io/chat-widget/worker.js ~/Desktop/reflectiv-ai/tony-worker.js

# 2. Create Tony-specific wrangler config
cat > ~/Desktop/reflectiv-ai/tony-wrangler.toml << 'EOF'
name = "tony-chat-widget"
main = "tony-worker.js"
compatibility_date = "2024-11-12"
workers_dev = true

[vars]
CORS_ORIGINS = "https://tonyabdelmalak.github.io,https://tonyabdelmalak.com,https://www.tonyabdelmalak.com"
EOF

# 3. Deploy
cd ~/Desktop/reflectiv-ai
wrangler deploy -c tony-wrangler.toml

# 4. Set secrets
wrangler secret put GROQ_API_KEY -c tony-wrangler.toml
# (paste same API key used for ReflectivAI worker)

# 5. Test
curl https://tony-chat-widget.tonyabdelmalak.workers.dev/health
```

### Phase 2: Update Tony Site Widget Config
```bash
# 1. Clone Tony site repo if not already local
cd ~/Desktop
git clone https://github.com/tonyabdelmalak/tonyabdelmalak.github.io.git
cd tonyabdelmalak.github.io

# 2. Edit widget.js
# Find line ~14 in chat-widget/assets/chat/widget.js:
# OLD: workerUrl: "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat",
# NEW: workerUrl: "https://tony-chat-widget.tonyabdelmalak.workers.dev/chat",

# 3. Also update config.json if present
# Find chat-widget/assets/chat/config.json
# Update workerUrl to new endpoint

# 4. Commit & push
git add chat-widget/assets/chat/widget.js chat-widget/assets/chat/config.json
git commit -m "Update chat widget to use dedicated worker"
git push origin main

# 5. Wait 1-2 minutes for GitHub Pages to rebuild
# Test at https://tonyabdelmalak.github.io
```

### Phase 3: Validation
```bash
# Test Tony widget live
open https://tonyabdelmalak.github.io
# Click chat widget, send test message like "Tell me about your projects"
# Expected: Should get response in Tony's voice about dashboards/analytics

# Test ReflectivAI widget still works
open https://reflectivei.github.io
# (or local index.html)
# Send sales-simulation test
# Expected: 4-section response with Suggested Phrasing
```

---

## Timeline & Priority

| Task | Priority | Est. Time | Owner |
|------|----------|-----------|-------|
| Deploy separate Tony worker | 🔴 HIGH | 10 min | You |
| Update Tony site widget config | 🔴 HIGH | 5 min | You |
| Test Tony site live | 🔴 HIGH | 2 min | You |
| Verify ReflectivAI unaffected | 🟡 MEDIUM | 2 min | You |
| Monitor both workers for 24h | 🟢 LOW | Ongoing | Automated |

**Total hands-on time: ~20 minutes**

---

## Monitoring Both Workers

### Set Up Dual Health Checks
```bash
# Add to crontab
*/15 * * * * curl -sf https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health || echo "ReflectivAI worker DOWN"
*/15 * * * * curl -sf https://tony-chat-widget.tonyabdelmalak.workers.dev/health || echo "Tony widget worker DOWN"
```

### Cloudflare Dashboard Quick Access
- **ReflectivAI Worker:** https://dash.cloudflare.com → Workers → my-chat-agent-v2
- **Tony Widget Worker:** https://dash.cloudflare.com → Workers → tony-chat-widget

---

## Cost Impact

**Current state:**
- 1 worker (my-chat-agent-v2) serving both sites

**After fix:**
- 2 workers total:
  - `my-chat-agent-v2` (ReflectivAI sales coaching)
  - `tony-chat-widget` (Tony personal site)

**Cloudflare Workers Free Tier:**
- 100,000 requests/day **per account** (not per worker)
- Both workers share the same quota
- Unless you're getting 50k+ requests/day on **each** site, you'll stay free tier

**Cost estimate:** $0/month (well within free tier for typical personal site + demo traffic)

---

## Rollback Plan (If Tony Fix Breaks Something)

```bash
# Emergency: Revert Tony site widget to offline/cached mode
# Edit tonyabdelmalak.github.io/chat-widget/assets/chat/widget.js
# Comment out fetch to worker, show cached greeting:

async function sendToWorker(userText) {
  // TEMPORARY: Worker offline, show cached response
  return "Thanks for your message! The chat widget is temporarily offline. Please email tony.abdelmalak@yahoo.com";
  
  // ... (rest of function commented out)
}

# Commit & push
git commit -am "Temporarily disable chat widget - worker migration"
git push origin main
```

---

## When to Handle This

**Recommended:** Handle Tony site fix **AFTER** ReflectivAI worker is validated live.

**Sequence:**
1. ✅ Deploy current hardened worker for ReflectivAI
2. ✅ Validate ReflectivAI widget works (index.html local + live)
3. ⏳ **THEN** deploy separate Tony worker (this document)
4. ⏳ Update Tony site to use new worker URL
5. ⏳ Validate both sites working independently

**Why wait?**
- Avoid debugging two deployments simultaneously
- Ensure ReflectivAI (primary business use case) is stable first
- Tony site is personal/portfolio, lower urgency

---

**Last Updated:** 2025-11-10  
**Status:** Ready to implement when ReflectivAI deployment validated  
**Owner:** Tony Abdelmalak
