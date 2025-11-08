# REFLECTIVAI DEPLOYMENT RUNBOOK

## Quick Deploy (After Fixes)

### Prerequisites
- Cloudflare account with Workers enabled
- Wrangler CLI installed: `npm install -g wrangler`
- GROQ API key (starts with `gsk_...`)

### Deploy Steps

```bash
# 1. Navigate to project
cd /home/runner/work/reflectiv-ai/reflectiv-ai

# 2. Login to Cloudflare (if not already)
wrangler login

# 3. Set PROVIDER_KEY secret (CRITICAL - app won't work without this)
wrangler secret put PROVIDER_KEY
# When prompted, paste your GROQ API key (starts with gsk_...)

# 4. Deploy the worker
wrangler deploy

# 5. Verify deployment
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok

# 6. Test chat endpoint
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivai.github.io" \
  -d '{
    "messages": [
      {"role": "user", "content": "Tell me about HIV PrEP"}
    ]
  }'
# Should return JSON with reply, coach, plan
```

---

## Troubleshooting Guide

### Issue: "502 Bad Gateway"

**Symptom**: All requests return 502  
**Cause**: PROVIDER_KEY not set or invalid  

**Solution**:
```bash
# Check if secret is set
wrangler secret list

# If PROVIDER_KEY not listed, set it:
wrangler secret put PROVIDER_KEY
# Paste GROQ API key

# Redeploy
wrangler deploy
```

---

### Issue: "PROVIDER_KEY not configured"

**Symptom**: 500 error with message "PROVIDER_KEY not configured. Contact system administrator."  
**Cause**: New validation check detected missing env var  

**Solution**:
```bash
wrangler secret put PROVIDER_KEY
# Enter valid GROQ API key
wrangler deploy
```

---

### Issue: "Plan does not contain valid facts array"

**Symptom**: 422 error when sending messages  
**Cause**: No facts/scenarios match the selected disease state  

**Solution**:
1. Check `assets/chat/data/scenarios.merged.json`
2. Ensure scenarios exist for selected disease state
3. Verify `FACTS_DB` in worker.js has relevant entries
4. Try selecting a different disease state (e.g., "HIV")

---

### Issue: "CORS Error" in browser console

**Symptom**: Request blocked by CORS policy  
**Cause**: Origin not in CORS_ORIGINS list  

**Solution**:
```bash
# Edit wrangler.toml
# Add your origin to CORS_ORIGINS on line 16
CORS_ORIGINS = "https://reflectivai.github.io,https://your-domain.com"

# Redeploy
wrangler deploy
```

---

### Issue: Messages hang on "Still working..."

**Symptom**: UI shows "Still working..." indefinitely  
**Cause**: Could be multiple issues  

**Debugging Steps**:
1. Open browser DevTools > Network tab
2. Look for request to worker URL
3. Check response status:
   - **0**: CORS blocked - check browser console for CORS error
   - **400**: Bad request - check request payload format
   - **415**: Wrong Content-Type - should be application/json
   - **422**: Invalid plan - check disease/persona selection
   - **500**: Configuration error - check worker logs
   - **502**: Provider error - check PROVIDER_KEY

4. Check browser console for errors
5. Check Cloudflare Workers dashboard > Logs

---

### Issue: System prompt (system.md) not being used

**Symptom**: AI responses don't reflect system.md content  
**Cause**: Fixed in this PR - worker now uses system prompts  

**Verify Fix**:
```bash
# Check worker.js has this code:
grep -A 5 "systemPrompts =" worker.js
# Should show: systemPrompts = [] in processChatRequest
```

---

## Monitoring

### Check Worker Logs
```bash
# Real-time logs
wrangler tail

# In Cloudflare dashboard:
# Workers > my-chat-agent-v2 > Logs
```

### Check Worker Analytics
- Requests per second
- Error rate
- P50/P95/P99 latency

Visit: https://dash.cloudflare.com/[your-account-id]/workers/view/my-chat-agent-v2

---

## Testing Checklist

After deployment, test:

- [ ] Health endpoint: `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
- [ ] Chat endpoint with valid request
- [ ] CORS from GitHub Pages origin
- [ ] Error messages are clear (test with invalid request)
- [ ] System prompt is used (check AI response quality)
- [ ] Coach scores appear in response
- [ ] Multiple modes work (sales-simulation, role-play, product-knowledge)

---

## Rollback Plan

If deployment causes issues:

```bash
# 1. Check deployment history
wrangler deployments list

# 2. Rollback to previous version
wrangler rollback [deployment-id]

# Or redeploy previous code:
git checkout [previous-commit]
wrangler deploy
git checkout -
```

---

## Configuration Reference

### Environment Variables (wrangler.toml)

| Variable | Required | Example | Purpose |
|----------|----------|---------|---------|
| PROVIDER_URL | Yes | https://api.groq.com/openai/v1/chat/completions | GROQ API endpoint |
| PROVIDER_MODEL | Yes | llama-3.1-70b-versatile | AI model to use |
| MAX_OUTPUT_TOKENS | No | 1400 | Max tokens per response |
| CORS_ORIGINS | Yes | https://reflectivai.github.io,... | Allowed origins |

### Secrets (via wrangler secret)

| Secret | Required | Format | Purpose |
|--------|----------|--------|---------|
| PROVIDER_KEY | Yes | gsk_... | GROQ API authentication |

---

## Worker Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| /health | GET | Health check (returns "ok") |
| /version | GET | Get worker version |
| /debug/ei | GET | Debug EI flag configuration |
| /facts | POST | Get facts for disease/topic |
| /plan | POST | Create conversation plan |
| /chat | POST | Main chat endpoint |

---

## Performance Tuning

### Current Settings
- **Max Output Tokens**: 1400 (can be increased)
- **Temperature**: 0.2 (can be adjusted 0.0-2.0)
- **Provider**: GROQ (fast, low latency)
- **KV TTL**: 12 hours (for session state)

### Optimization Options
1. **Increase MAX_OUTPUT_TOKENS** for longer responses (up to 8000)
2. **Add caching** for facts/plans (reduce DB queries)
3. **Use Durable Objects** for session state (better than KV)
4. **Add rate limiting** to prevent abuse

---

## Security Checklist

- [ ] PROVIDER_KEY stored as secret (not in code)
- [ ] CORS restricted to known origins
- [ ] Content-Type validation enabled
- [ ] Error messages don't leak sensitive info
- [ ] No PHI/PII in logs or responses
- [ ] Input sanitization enabled

---

## Maintenance Schedule

### Weekly
- Check error rate in Cloudflare dashboard
- Review worker logs for issues
- Monitor GROQ API usage/costs

### Monthly
- Review and update FACTS_DB
- Check for Cloudflare Workers updates
- Test all modes (emotional-assessment, product-knowledge, sales-simulation, role-play)
- Update scenarios if needed

### Quarterly
- Update dependencies (wrangler, etc.)
- Review and optimize performance
- Check GROQ model updates (new models)
- Review CORS origins list

---

## Support Contacts

### For Configuration Issues
- Check this runbook first
- Check AUDIT_FINDINGS.md for root causes
- Review Cloudflare Workers logs

### For Provider Issues
- GROQ status: https://status.groq.com
- GROQ docs: https://console.groq.com/docs

### For Deployment Issues
- Wrangler docs: https://developers.cloudflare.com/workers/wrangler/
- Cloudflare Workers docs: https://developers.cloudflare.com/workers/

---

## Change Log

### 2025-11-08 - Critical Fixes
- Added PROVIDER_KEY validation
- Added null checks for facts array
- Added system prompt support
- Fixed config URL structure
- Enhanced error messages

**Deployment required**: YES  
**Secrets required**: YES (PROVIDER_KEY)  
**Breaking changes**: NO

---

## Quick Reference

```bash
# Deploy
wrangler deploy

# Set secret
wrangler secret put PROVIDER_KEY

# View logs
wrangler tail

# Test health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Test chat
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```
