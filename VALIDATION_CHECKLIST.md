# VALIDATION CHECKLIST - AI Chat Fix

Use this checklist to validate the fix after deployment.

---

## Pre-Deployment Validation ✅

- [x] All code changes reviewed
- [x] Environment variables documented
- [x] CORS configuration verified
- [x] Token limits verified
- [x] Error handling tested
- [x] Documentation complete

---

## Deployment Steps

### Step 1: Set PROVIDER_KEY Secret
```bash
cd /home/runner/work/reflectiv-ai/reflectiv-ai
wrangler login
wrangler secret put PROVIDER_KEY
# Enter GROQ API key when prompted (starts with gsk_...)
```

**Validation**:
```bash
wrangler secret list
# Should show: PROVIDER_KEY
```

- [ ] PROVIDER_KEY secret set ✓

---

### Step 2: Deploy Worker
```bash
wrangler deploy
```

**Expected Output**:
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded my-chat-agent-v2 (X.XX sec)
Published my-chat-agent-v2 (X.XX sec)
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev
```

- [ ] Worker deployed successfully ✓

---

## Post-Deployment Validation

### Test 1: Health Endpoint
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

**Expected**: `ok`  
**Status**: [ ] Pass [ ] Fail

---

### Test 2: Version Endpoint
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

**Expected**: `{"version":"r10.1"}`  
**Status**: [ ] Pass [ ] Fail

---

### Test 3: Chat Endpoint (Valid Request)
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivai.github.io" \
  -d '{
    "messages": [
      {"role": "system", "content": "Test system prompt"},
      {"role": "user", "content": "Tell me about HIV PrEP"}
    ]
  }'
```

**Expected**: JSON with `reply`, `coach`, `plan`  
**Status**: [ ] Pass [ ] Fail

**Check Response**:
- [ ] Contains "reply" field
- [ ] Contains "coach" object
- [ ] Contains "plan" object
- [ ] coach.scores exists
- [ ] No error field

---

### Test 4: Chat Endpoint (Missing PROVIDER_KEY)
**Only test if you haven't set PROVIDER_KEY yet**

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

**Expected**: Status 500 with message "PROVIDER_KEY not configured. Contact system administrator."  
**Status**: [ ] Pass [ ] Fail [ ] N/A (key already set)

---

### Test 5: CORS Headers
```bash
curl -i -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivai.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected Headers**:
- `Access-Control-Allow-Origin: https://reflectivai.github.io`
- `Access-Control-Allow-Methods: GET,POST,OPTIONS`
- `Access-Control-Allow-Headers: content-type,authorization,x-req-id,x-emit-ei`

**Status**: [ ] Pass [ ] Fail

---

### Test 6: Invalid Plan (No Facts)
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "Test message",
    "disease": "NonexistentDisease123"
  }'
```

**Expected**: Status 422 with message "Plan does not contain valid facts array"  
**Status**: [ ] Pass [ ] Fail

---

### Test 7: GitHub Pages Integration
1. Open https://reflectivai.github.io or https://tonyabdelmalak.github.io
2. Open browser DevTools (F12)
3. Go to Network tab
4. Open chat widget
5. Select mode: "Sales Simulation"
6. Select disease: "HIV"
7. Select HCP profile
8. Type message: "What should I know about PrEP?"
9. Click Send

**Expected**:
- Message appears in chat thread
- Response appears (not "Still working..." forever)
- Coach panel shows scores
- No errors in console

**Check Network Tab**:
- [ ] Request to worker URL
- [ ] Status 200
- [ ] Response has Access-Control-Allow-Origin header
- [ ] Response contains reply, coach, plan

**Check UI**:
- [ ] Message appears in chat
- [ ] Response appears within 5 seconds
- [ ] Coach panel shows scores
- [ ] No console errors
- [ ] No "Still working..." hang

**Status**: [ ] Pass [ ] Fail

---

### Test 8: System Prompt Verification
Send a message with a specific system instruction:

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {
        "role": "system", 
        "content": "You must always end your responses with the exact phrase: VALIDATION_TEST_PASSED"
      },
      {"role": "user", "content": "Tell me about HIV prevention"}
    ]
  }'
```

**Expected**: Response contains "VALIDATION_TEST_PASSED"  
**Status**: [ ] Pass [ ] Fail

**Note**: This confirms system prompts are being used by the AI

---

### Test 9: Multiple Modes
Test each mode works:

**Sales Simulation**:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"system","content":"You are in sales-simulation mode"},
      {"role":"user","content":"How should I approach this HCP?"}
    ]
  }'
```
**Status**: [ ] Pass [ ] Fail

**Role Play**:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"system","content":"You are in role-play mode as an HCP"},
      {"role":"user","content":"What are your thoughts on PrEP?"}
    ]
  }'
```
**Status**: [ ] Pass [ ] Fail

**Product Knowledge**:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [
      {"role":"system","content":"You are in product-knowledge mode"},
      {"role":"user","content":"What is Descovy indicated for?"}
    ]
  }'
```
**Status**: [ ] Pass [ ] Fail

---

### Test 10: Error Messages Quality
Test that error messages are clear:

**Wrong Content-Type**:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: text/plain" \
  -d 'test'
```
**Expected**: 415 with "Content-Type must be application/json"  
**Status**: [ ] Pass [ ] Fail

**Invalid JSON**:
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d 'invalid json'
```
**Expected**: 400 with clear error message  
**Status**: [ ] Pass [ ] Fail

---

## Monitoring Validation

### Check Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Navigate to Workers > my-chat-agent-v2
3. Check Metrics tab

**Verify**:
- [ ] Requests per second > 0
- [ ] Error rate < 5%
- [ ] P95 latency < 2s

### Check Logs
```bash
wrangler tail
```

Send a test message and verify logs show:
- [ ] Request received
- [ ] No errors logged
- [ ] Response sent

---

## Performance Validation

### Response Time Test
```bash
time curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'
```

**Expected**: < 3 seconds total time  
**Actual**: ___ seconds  
**Status**: [ ] Pass [ ] Fail

---

## Rollback Readiness

### Verify Rollback Process
```bash
# List recent deployments
wrangler deployments list

# Note most recent deployment ID: ___________
```

**Rollback command** (if needed):
```bash
wrangler rollback [deployment-id]
```

- [ ] Rollback process documented ✓

---

## Final Sign-Off

### All Critical Tests Passed
- [ ] Health endpoint works
- [ ] Chat endpoint returns valid responses
- [ ] CORS works from GitHub Pages
- [ ] System prompts are used
- [ ] Error messages are clear
- [ ] No 502 errors
- [ ] No TypeError crashes
- [ ] All modes work

### Documentation Verified
- [ ] EXECUTIVE_SUMMARY.md reviewed
- [ ] AUDIT_FINDINGS.md reviewed
- [ ] DEPLOYMENT_RUNBOOK.md reviewed
- [ ] PATCH_RECOMMENDATIONS.md reviewed

### Monitoring Setup
- [ ] Cloudflare dashboard reviewed
- [ ] Logs accessible
- [ ] Error tracking in place

### Support Readiness
- [ ] Team knows how to check logs
- [ ] Team knows how to rollback
- [ ] Team has GROQ API access
- [ ] Team has Cloudflare access

---

## Sign-Off

**Deployment Date**: ___________  
**Deployed By**: ___________  
**Validation Date**: ___________  
**Validated By**: ___________  

**Overall Status**: [ ] PASS [ ] FAIL

**Notes**:
```
_________________________________________________________________
_________________________________________________________________
_________________________________________________________________
```

---

## Quick Commands Reference

```bash
# Health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Test chat
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}]}'

# View logs
wrangler tail

# List secrets
wrangler secret list

# List deployments
wrangler deployments list

# Rollback
wrangler rollback [deployment-id]
```

---

**End of Validation Checklist**
