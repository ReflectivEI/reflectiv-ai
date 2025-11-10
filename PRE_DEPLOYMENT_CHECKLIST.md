# Pre-Deployment Checklist - ReflectivAI Worker r10.1

**Date:** 2025-11-10  
**Status:** ✅ READY TO DEPLOY

---

## ✅ Test Results Summary

### Formatting Tests (test-formatting.js)
- **Status:** ✅ ALL PASS (36/36 checks)
- **Coverage:**
  - Standard sales-simulation format ✅
  - Alternative bullet markers ✅
  - Minimal format handling ✅
  - **"Suggested Phrasing" section:** ✅ Present in all tests
  - No raw bullet markers ✅
  - Quote styling intact ✅
  - No coach tags leaked ✅

### Worker Tests (worker.test.js)
- **Status:** ✅ ALL PASS (12/12 tests)
- **Coverage:**
  - `/health` endpoint ✅
  - `/version` endpoint ✅
  - 404 handling ✅
  - CORS headers ✅
  - Error handling (missing keys) ✅
  - Widget payload format support ✅

### Syntax Validation
- **worker.js:** ✅ No errors
- **widget.js:** ✅ No errors

---

## ✅ Feature Verification

### 1. API Key Rotation
**Status:** ✅ IMPLEMENTED
- Supports `GROQ_API_KEY`, `GROQ_API_KEY_2`, `GROQ_API_KEY_3`, `GROQ_API_KEY_4`, `GROQ_API_KEY_5`
- Supports `PROVIDER_KEYS` (comma-separated)
- Supports `PROVIDER_KEY_1`, `PROVIDER_KEY_2`, etc.
- Fallback to single `PROVIDER_KEY`
- Session-hash based selection (FNV-1a)
- Startup log shows key pool size

**Code location:** `worker.js` lines 278-305

### 2. Rate Limiting
**Status:** ✅ IMPLEMENTED
- Token bucket algorithm
- Default: 10 requests/min, burst 4
- Per-IP tracking
- Returns 429 with `Retry-After` header
- Configurable via `RATELIMIT_RATE`, `RATELIMIT_BURST`

**Code location:** `worker.js` lines 1084-1096, 92-102

### 3. Deep Health Endpoint
**Status:** ✅ IMPLEMENTED
- Accessible at `/health?deep=1`
- Returns: `{ ok, key_pool, provider }`
- Provider reachability check
- Key pool count
- HEAD method support

**Code location:** `worker.js` lines 54-71

### 4. Request ID Echo
**Status:** ✅ IMPLEMENTED
- Echoes `x-req-id` header in all responses
- Works with GET, HEAD, POST, OPTIONS
- Included in health endpoints

**Code location:** `worker.js` lines 248-254

### 5. Role-Play XML Enforcement
**Status:** ✅ IMPLEMENTED
- Respects `<role>HCP</role><content>...</content>` wrapper
- Extracts clean content from XML
- Falls back to full text if no wrapper

**Code location:** `worker.js` lines 832-839

### 6. Deterministic Scoring
**Status:** ✅ VERIFIED IN WIDGET
- Widget **does NOT use** `deterministicScore` function
- Scoring handled entirely by backend `/coach` endpoint
- Widget displays scores from backend response
- EI panel rendering confirmed functional

**Code location:** `widget.js` lines 315-345 (renderEiPanel)

### 7. Sales-Simulation Format
**Status:** ✅ VERIFIED
- 4-section structure enforced:
  1. **Challenge**
  2. **Rep Approach** (bullets)
  3. **Impact**
  4. **Suggested Phrasing** (quote-styled)
- Regex parsing intact
- No truncation by sentence cap (12-sentence limit)
- Coach tags stripped
- Bullet markers cleaned

**Code location:** `widget.js` lines 667-727 (formatSalesSimulationReply)

---

## ⚠️ Critical Pre-Deployment Actions

### 1. Set Cloudflare Secrets
**BEFORE DEPLOYMENT, run these commands:**

```bash
# Navigate to project directory
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai

# Set primary API key (REQUIRED)
wrangler secret put GROQ_API_KEY
# Paste your primary Groq API key when prompted

# Set rotation keys (RECOMMENDED for load balancing)
wrangler secret put GROQ_API_KEY_2
# Paste second API key

wrangler secret put GROQ_API_KEY_3
# Paste third API key

# Verify secrets are set
wrangler secret list
# Should show: GROQ_API_KEY, GROQ_API_KEY_2, GROQ_API_KEY_3
```

**Why this is critical:**
- Worker will return 500 "NO_PROVIDER_KEYS" without these
- Tests pass because they mock the environment
- Live deployment will fail requests without real keys

### 2. Verify wrangler.toml Configuration
**Current config validated:**
- ✅ `name = "my-chat-agent-v2"`
- ✅ `main = "worker.js"`
- ✅ `CORS_ORIGINS` includes all required domains
- ✅ `PROVIDER_URL` points to Groq API
- ✅ `PROVIDER_MODEL = "llama-3.3-70b-versatile"`
- ✅ Rate limit defaults set (10/min, burst 4)

### 3. Backup Current Production Worker
**Before deploying, create a snapshot:**

```bash
# Option 1: Via Cloudflare Dashboard
# 1. Go to Workers & Pages → my-chat-agent-v2 → Deployments
# 2. Find current deployment
# 3. Click "..." → "Download"
# 4. Save as worker-production-backup-2025-11-10.js

# Option 2: Via CLI (if you have a prior version deployed)
wrangler rollback --message "Pre-r10.1 backup"
# This creates a rollback point you can revert to
```

---

## 🚀 Deployment Commands

### Standard Deployment
```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai

# 1. Final syntax check
npm test

# 2. Deploy to Cloudflare
wrangler deploy

# Expected output:
# ✨ Total Upload: XXX KiB / gzip: YYY KiB
# ✨ Deployed my-chat-agent-v2
# ✨ https://my-chat-agent-v2.tonyabdelmalak.workers.dev
```

### Deployment with Environment Override (If Needed)
```bash
# Deploy to specific environment
wrangler deploy --env production

# Deploy with dry-run (preview only, doesn't publish)
wrangler deploy --dry-run
```

---

## 📊 Post-Deployment Validation

### Immediate Health Checks (Run within 2 minutes of deployment)

```bash
# 1. Basic health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Expected: "ok"

# 2. Deep health (verify provider + key pool)
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1" | jq .
# Expected: {"ok":true,"key_pool":3,"provider":{"ok":true,...}}

# 3. Version check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version | jq .
# Expected: {"version":"r10.1",...}

# 4. CORS preflight test
curl -I -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io"
# Expected: Access-Control-Allow-Origin: https://reflectivei.github.io

# 5. Sales-simulation test (verify "Suggested Phrasing" section)
curl -s -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-simulation",
    "user": "What about TAF vs TDF for HIV?",
    "disease": "HIV",
    "persona": "Clinically curious MD"
  }' | jq -r '.reply' | grep -i "suggested phrasing"
# Expected: Should output the "Suggested Phrasing:" line

# 6. Rate limit test (11th request should return 429)
for i in {1..11}; do
  echo "Request $i:"
  curl -s -w "HTTP %{http_code}\n" -X POST \
    "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
    -H "Content-Type: application/json" \
    -H "Origin: https://reflectivei.github.io" \
    -d '{"mode":"sales-simulation","user":"test","disease":"HIV","persona":"MD"}' \
    | head -1
  sleep 1
done
# Expected: First 10 succeed (200), 11th fails (429)
```

### Frontend Integration Test

```bash
# 1. Open local index.html
open /Users/anthonyabdelmalak/Desktop/reflectiv-ai/index.html

# 2. In browser console, verify:
# - Widget loads without errors
# - Can send sales-simulation message
# - Response shows all 4 sections (Challenge, Rep Approach, Impact, Suggested Phrasing)
# - Coach panel shows EI scores (if available)
# - No CORS errors in console

# 3. Test mode switching:
# - Switch to Role-Play mode
# - Send message
# - Verify HCP voice (no coach guidance leaked)
# - Switch to Product-Knowledge mode
# - Verify concise, factual response
# - Switch to Emotional-Assessment mode
# - Verify reflective EI scoring
```

---

## 🔍 Known Limitations & Edge Cases

### 1. ⚠️ Tony Site Widget Will Break
**Issue:** Tony's personal site (`tonyabdelmalak.github.io`) uses the same worker but sends different request format.

**Solution:** Deploy separate worker for Tony site after ReflectivAI validation.

**Timeline:** Handle within 24-48 hours post-deployment.

**Reference:** See `TONY_SITE_FIX.md`

### 2. ⚠️ Rate Limiting May Be Too Strict for Testing
**Issue:** Default 10 req/min may block rapid testing.

**Temporary workaround:**
```bash
# Increase limits for testing phase
# Edit wrangler.toml:
RATELIMIT_RATE = "30"
RATELIMIT_BURST = "10"

# Redeploy
wrangler deploy

# Reset to production values after testing
```

### 3. ⚠️ Deep Health May Fail on First Request
**Issue:** Cold start may timeout provider check.

**Behavior:** Returns `{"ok":true,"key_pool":3,"provider":{"ok":false,"error":"timeout"}}`

**Resolution:** Retry after 5 seconds; subsequent requests will succeed.

### 4. ⚠️ Sentence Cap May Truncate Long Responses
**Issue:** Role-play mode capped at 4 sentences; may cut off mid-thought.

**Monitoring:** Watch for validation violations in logs:
```bash
wrangler tail --status ok | grep "validation_check"
```

**Adjustment if needed:** Edit FSM maxSentences in worker.js

---

## 🛡️ Rollback Procedure (If Deployment Fails)

### Immediate Rollback (< 2 minutes)

**Option 1: Cloudflare Dashboard**
1. Go to Workers & Pages → my-chat-agent-v2
2. Click "Deployments" tab
3. Find previous deployment (before today)
4. Click "..." → "Rollback to this deployment"

**Option 2: CLI Rollback**
```bash
# Revert to r10.1-backup (clean version before hardening)
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai
cp worker-r10.1-backup.js worker.js
cp wrangler-r10.1-backup.toml wrangler.toml
wrangler deploy

# OR revert to r9 (full hardening with streaming)
cp worker-r9.js worker.js
cp wrangler-r9.toml wrangler.toml
wrangler deploy
```

**Reference:** See `ROLLBACK_PROCEDURE.md` for detailed recovery steps.

---

## 📋 Missing Components Analysis

### ❌ NOT Implemented (Deferred Features)

1. **SSE Streaming:**
   - r9 had streaming support
   - r10.1 uses standard JSON responses only
   - **Impact:** Slightly slower perceived response time
   - **Mitigation:** Frontend shows "typing" animation

2. **Dual Rotation Strategy (seq):**
   - Only session-hash rotation implemented
   - Sequential rotation with KV-backed counter deferred
   - **Impact:** No strict round-robin guarantee
   - **Mitigation:** Hash-based is sufficient for load distribution

3. **Strict Leak Firewall:**
   - Validation violations logged but don't block responses
   - r9 had retry loop on violations
   - **Impact:** Occasional coaching guidance may leak through
   - **Mitigation:** Frontend leak guards still active

4. **Request Logging to KV:**
   - No persistent request history
   - **Impact:** Limited debugging for historical issues
   - **Mitigation:** Use `wrangler tail` for real-time logs

### ✅ Intentionally Removed (Simplification from r9)

1. **Multiple `/agent` and `/evaluate` endpoints:** Consolidated to `/chat`
2. **XML retry loop:** Simplified to single attempt with fallback
3. **Site-specific routing (site=tony):** Removed (will be separate worker)

---

## 🎯 Success Criteria

**Deployment is considered successful when:**

1. ✅ `/health` returns "ok"
2. ✅ `/health?deep=1` returns `{"ok":true,"key_pool":3}`
3. ✅ Sales-simulation response includes "Suggested Phrasing" section
4. ✅ CORS allows `reflectivei.github.io` origin
5. ✅ Rate limiting returns 429 after burst exceeded
6. ✅ No 500 errors in first 100 requests
7. ✅ Frontend widget loads and displays messages correctly
8. ✅ All 4 modes respond without leakage

**If any criterion fails, execute rollback procedure immediately.**

---

## 📞 Post-Deployment Support

### Monitoring Commands
```bash
# Real-time log tail
wrangler tail

# Filter for errors only
wrangler tail --status error

# Filter for validation warnings
wrangler tail | grep validation_check
```

### Metrics Dashboard
- **Cloudflare Dashboard:** https://dash.cloudflare.com
- Navigate to: Workers & Pages → my-chat-agent-v2 → Metrics
- Monitor: Request rate, error rate, CPU time, invocation duration

### Contact & Escalation
- **Primary:** Review logs via `wrangler tail`
- **Rollback:** Execute procedure in `ROLLBACK_PROCEDURE.md`
- **Emergency:** Disable worker via dashboard if critical failure

---

## ✅ FINAL SIGN-OFF

**Code Status:**
- ✅ All tests passing (48/48)
- ✅ Zero syntax errors
- ✅ Hardening features implemented
- ✅ Documentation complete

**Deployment Readiness:**
- ⚠️ **BLOCKER:** Must set `GROQ_API_KEY` secrets before deployment
- ✅ Rollback procedure documented
- ✅ Success criteria defined
- ✅ Monitoring commands ready

**Recommendation:** 🟢 **READY TO DEPLOY** after setting API key secrets.

---

**Checklist Completed By:** GitHub Copilot  
**Date:** 2025-11-10  
**Next Action:** Run `wrangler secret put GROQ_API_KEY` → `wrangler deploy`
