# Emergency Rollback & Recovery Procedure

## Immediate Rollback (< 2 minutes)

### Option 1: Cloudflare Dashboard Rollback
```bash
# In Cloudflare Workers dashboard:
1. Go to Workers & Pages → my-chat-agent-v2
2. Click "Deployments" tab
3. Find last known-good deployment (prior to today)
4. Click "..." → "Rollback to this deployment"
5. Confirm rollback
```

### Option 2: CLI Rollback to r10.1-backup
```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai
cp worker-r10.1-backup.js worker.js
cp wrangler-r10.1-backup.toml wrangler.toml
wrangler deploy
```

### Option 3: Complete Revert to r9 (Nuclear Option)
```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai
cp worker-r9.js worker.js
cp wrangler-r9.toml wrangler.toml
wrangler deploy
```

---

## Diagnosis Commands

### Check Live Worker Health
```bash
# Basic health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Deep health (shows provider + key pool)
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1"

# Version check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

### Test Rate Limiting
```bash
# Should succeed 10 times, then 429 on 11th
for i in {1..12}; do
  echo "Request $i:"
  curl -s -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
    -H "Content-Type: application/json" \
    -H "Origin: https://reflectivei.github.io" \
    -d '{"mode":"sales-simulation","user":"test","disease":"HIV","persona":"MD"}' \
    -w "\nHTTP: %{http_code}\n" | head -3
  sleep 1
done
```

### Check Cloudflare Logs
```bash
# Real-time tail
wrangler tail

# Filter errors only
wrangler tail --status error
```

---

## Failure Scenarios & Fixes

### Scenario 1: Rate Limiting Too Aggressive (429 errors)
**Symptoms:** Users blocked after 4-10 requests
**Diagnosis:**
```bash
curl -v "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1" 2>&1 | grep -i rate
```
**Fix:**
```bash
# Increase burst/rate via dashboard or wrangler.toml
# Edit wrangler.toml:
RATELIMIT_RATE = "20"      # was 10
RATELIMIT_BURST = "8"      # was 4
wrangler deploy
```

### Scenario 2: CORS Blocking Requests
**Symptoms:** Browser console: "No 'Access-Control-Allow-Origin' header"
**Diagnosis:**
```bash
curl -s -I -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io" | grep -i access-control
```
**Fix:** Verify CORS_ORIGINS includes all domains:
```bash
# Check current config
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/debug/ei | jq .cors_origins

# If missing domains, update wrangler.toml and redeploy
```

### Scenario 3: Provider API Keys Not Working
**Symptoms:** 502 errors, "No completion from providers"
**Diagnosis:**
```bash
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1" | jq .
# Check key_pool count (should be 3) and provider.ok (should be true)
```
**Fix:**
```bash
# Verify secrets are set
wrangler secret list

# Re-set if missing
wrangler secret put GROQ_API_KEY
wrangler secret put GROQ_API_KEY_2
wrangler secret put GROQ_API_KEY_3
```

### Scenario 4: Mode Leakage / Wrong Formatting
**Symptoms:** Sales-simulation missing "Suggested Phrasing", role-play bleeding into product-knowledge
**Diagnosis:** Check validation logs:
```bash
wrangler tail --status ok | grep -i violation
```
**Fix:** Rollback to r10.1-backup (had working validation) or adjust FSM caps:
```javascript
// In worker.js, adjust sentence caps if too strict
const FSM = {
  "sales-simulation": { maxSentences: 12 },  // increase if truncating
  "role-play": { maxSentences: 4 },
  // ...
};
```

### Scenario 5: Tony Site Widget Broken
**See dedicated section below** ⬇️

---

## Validation Checklist (Post-Fix)

After any fix, run this validation:

```bash
# 1. Health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Expected: "ok"

# 2. Deep health
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1" | jq .
# Expected: {"ok":true,"key_pool":3,"provider":{"ok":true,...}}

# 3. Version
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
# Expected: {"version":"r10.1",...}

# 4. Sales-simulation format test
curl -s -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-simulation",
    "user": "What about TAF vs TDF?",
    "disease": "HIV",
    "persona": "Clinically curious MD"
  }' | jq -r '.reply' | grep -i "suggested phrasing"
# Expected: Should contain "Suggested Phrasing" section

# 5. CORS test
curl -s -I -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io" | grep "Access-Control-Allow-Origin: https://reflectivei.github.io"
# Expected: Exact origin match

# 6. Run local test suites
npm test
node test-formatting.js
# Expected: All PASS
```

---

## Monitoring & Alerts

### Set Up Cloudflare Alerts (Dashboard)
1. Workers & Pages → my-chat-agent-v2 → Metrics
2. Create alert rules:
   - Error rate > 5% for 5 minutes
   - CPU time > 50ms p99 for 10 minutes
   - Request rate drops > 50% (potential outage)

### Daily Health Ping (Cron)
```bash
# Add to crontab (runs every hour)
0 * * * * curl -sf "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1" || echo "Worker DOWN" | mail -s "Worker Alert" tony.abdelmalak@yahoo.com
```

---

## Contact & Escalation

**If all rollback/fix attempts fail:**
1. Rollback to last known-good deployment (Dashboard → Deployments)
2. Notify stakeholders: widget will show cached/offline mode
3. Review Cloudflare logs for root cause: `wrangler tail --status error`
4. Open GitHub issue with logs and failure mode
5. If critical, contact Cloudflare support: https://dash.cloudflare.com/support

**Backup Communication:**
- Email: tony.abdelmalak@yahoo.com
- GitHub: https://github.com/ReflectivEI/reflectiv-ai/issues

---

## Version History (for rollback reference)

| Version | Date | Changes | Stability |
|---------|------|---------|-----------|
| **r10.1 (current)** | 2025-11-10 | Rate limiting, deep health, GROQ_* keys, XML respect | ⚠️ UNTESTED LIVE |
| **r10.1-backup** | 2025-11-09 | Clean r10.1 before hardening patches | ✅ STABLE |
| **r9** | 2025-11-08 | Full hardening (streaming, strict XML, seq rotation) | ✅ STABLE |

---

## Recovery Time Objectives (RTO)

| Failure Type | Target RTO | Method |
|--------------|-----------|--------|
| Worker crash/500s | < 2 min | Dashboard rollback to last deployment |
| CORS misconfiguration | < 5 min | Update CORS_ORIGINS, redeploy |
| Rate limit too strict | < 10 min | Adjust wrangler.toml RATELIMIT_* vars |
| Provider API key exhaustion | < 15 min | Rotate keys via `wrangler secret put` |
| Complete worker failure | < 30 min | Rollback to r10.1-backup or r9 |

---

**Last Updated:** 2025-11-10
**Maintained By:** Tony Abdelmalak / GitHub Copilot
