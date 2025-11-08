# Quick Verification Steps

## Prerequisites
1. Deploy worker: `wrangler deploy`
2. Ensure PROVIDER_KEY secret is set: `wrangler secret put PROVIDER_KEY`
3. Merge PR to main to deploy frontend via GitHub Actions

## Manual Browser Tests

### Test 1: Sales Simulation (Main Fix Validation)
**URL**: `https://reflectivei.github.io/reflectiv-ai/#simulations`

**Steps**:
1. Open Chrome DevTools (F12)
2. Go to Console tab
3. Select scenario: "Descovy for PrEP"
4. Type: "How do I approach this HCP?"
5. Click Send

**Expected Console Output**:
```
✅ No warning about SSE streaming
✅ No CORS errors
```

**Expected Network Tab** (filter to /chat):
```
Status: 200 OK
Response Headers:
  Access-Control-Allow-Origin: https://reflectivei.github.io
  Content-Type: application/json
```

**Expected Response Body**:
```json
{
  "reply": "...",
  "coach": {
    "scores": {
      "accuracy": 4,
      "compliance": 4,
      "discovery": 3,
      "clarity": 4,
      "objection_handling": 3,
      "empathy": 3
    },
    "worked": ["..."],
    "improve": ["..."],
    "phrasing": "...",
    "feedback": "..."
  },
  "plan": {
    "id": "..."
  }
}
```

**Expected UI**:
```
✅ Message appears in chat
✅ Coach panel shows scores (accuracy, compliance, etc.)
✅ "What Worked" section populated
✅ "Areas to Improve" section populated
✅ "Suggested Phrasing" shown
```

### Test 2: Role Play Mode
**URL**: `https://reflectivei.github.io/reflectiv-ai/#role-play`

**Steps**:
1. Open DevTools
2. Select scenario
3. Type: "Good morning, Doctor. Do you have a moment?"
4. Click Send

**Expected**:
```
✅ No CORS errors
✅ Status 200
✅ Response in HCP's voice (first-person)
✅ No coach panel (role-play mode)
```

### Test 3: Error Handling (Optional)
**Note**: Only run if you want to verify error handling

**Setup**:
1. In Cloudflare Dashboard, temporarily delete PROVIDER_KEY secret
2. Send a message from widget

**Expected**:
```
Status: 500 (expected)
Response Headers: ✅ CORS header present
Response Body: {"error":"server_error","detail":"Provider API key not configured"}
Console: ✅ No CORS error (just the 500 response)
```

**Cleanup**: Re-add PROVIDER_KEY secret

## Quick CLI Checks

### Check Worker Health
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Expected: "ok"
```

### Check Worker Version
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
# Expected: {"version":"r10.1"}
```

### Test CORS Preflight
```bash
curl -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io" \
  -H "Access-Control-Request-Method: POST" \
  -v 2>&1 | grep -i "access-control"

# Expected to see:
# Access-Control-Allow-Origin: https://reflectivei.github.io
# Access-Control-Allow-Methods: GET,POST,OPTIONS
# Access-Control-Allow-Headers: content-type,authorization,x-req-id
```

## Success Criteria

All of these must be TRUE:
- [ ] ✅ No "SSE streaming failed" warning in console
- [ ] ✅ No "CORS policy: No 'Access-Control-Allow-Origin'" errors
- [ ] ✅ POST /chat returns Status 200 (not 500)
- [ ] ✅ Response includes Access-Control-Allow-Origin header
- [ ] ✅ Response body contains { reply, coach, plan }
- [ ] ✅ Chat UI displays the reply
- [ ] ✅ Coach panel shows scores and feedback

## If Tests Fail

### Still seeing SSE warning?
- Check widget.js line 63: `const USE_SSE = false;` (should be false)
- Clear browser cache and hard reload (Ctrl+Shift+R)

### Still seeing CORS errors?
- Check wrangler.toml CORS_ORIGINS includes your domain
- Verify worker deployed: `wrangler deployments list`
- Check response headers in Network tab

### Still seeing 500 errors?
- Verify PROVIDER_KEY is set: `wrangler secret list`
- Check Cloudflare worker logs for detailed error
- Ensure worker.js deployed with latest code

### Coach panel not showing?
- Check Network tab response body
- Look for JavaScript errors in console
- Verify response structure matches expected format

## Debug Mode

Add `?debug=1` to URL to see telemetry:
```
https://reflectivei.github.io/reflectiv-ai/?debug=1#simulations
```

Telemetry footer shows:
- Request timing (open → first byte → first chunk → done)
- HTTP status
- Retry count
- Bytes/tokens received

## Rollback

If you need to rollback:

### Rollback Frontend
```bash
git revert a2fbc7d  # widget.js changes
git push origin main
```

### Rollback Worker
```bash
wrangler rollback $(wrangler deployments list --json | jq -r '.[1].id')
```

---

**Quick Reference**: All tests should show ✅ in browser console with no errors
