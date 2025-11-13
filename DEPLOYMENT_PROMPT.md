# Complete Deployment Instructions for ReflectivAI

## CRITICAL CONTEXT

**Repository:** ReflectivEI/reflectiv-ai  
**Branch:** main  
**Worker Version:** r10.1  
**Worker Name:** my-chat-agent-v2  
**Live Site:** https://reflectivei.github.io/reflectiv-ai/  
**Worker URL:** https://my-chat-agent-v2.tonyabdelmalak.workers.dev  

**CRITICAL BUG:** Role Play mode + Oncology disease state returns 422 errors due to PLAN_SCHEMA validation requiring facts array with minItems:1, but receiving empty arrays.

**LOCAL CHANGES MADE (NOT YET DEPLOYED):**
1. PLAN_SCHEMA facts made optional (removed from required, minItems: 0)
2. Mode normalization added to postPlan() and postChat()
3. Copilot instructions updated with correct mode list

---

## CHANGES MADE TO worker.js

### Change 1: PLAN_SCHEMA Facts Validation (Lines 182-203)

**BEFORE:**
```javascript
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    disease_state: { type: "string", minLength: 1 },
    scenario_summary: { type: "string", minLength: 1 },
    facts: {
      type: "array",
      items: { type: "number" },
      minItems: 1
    },
    turns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          turn_number: { type: "number" },
          hcp_says: { type: "string" },
          suggested_response: { type: "string" }
        },
        required: ["turn_number", "hcp_says", "suggested_response"]
      }
    }
  },
  required: ["disease_state", "scenario_summary", "facts", "turns"]
};
```

**AFTER:**
```javascript
const PLAN_SCHEMA = {
  type: "object",
  properties: {
    disease_state: { type: "string", minLength: 1 },
    scenario_summary: { type: "string", minLength: 1 },
    facts: {
      type: "array",
      items: { type: "number" },
      minItems: 0
    },
    turns: {
      type: "array",
      items: {
        type: "object",
        properties: {
          turn_number: { type: "number" },
          hcp_says: { type: "string" },
          suggested_response: { type: "string" }
        },
        required: ["turn_number", "hcp_says", "suggested_response"]
      }
    }
  },
  required: ["disease_state", "scenario_summary", "turns"]
};
```

**CHANGES:**
- Line 188: `minItems: 1` → `minItems: 0`
- Line 203: Removed `"facts"` from required array

---

### Change 2: Mode Normalization in postPlan() (Lines 572-591)

**BEFORE:**
```javascript
async function postPlan(req, env, ctx) {
  const body = await parseJSON(req);
  if (!body) return jsonError("Invalid JSON", 400);

  const { mode, disease_state, hcp_type, scenario_context } = body;
  if (!mode || !disease_state) {
    return jsonError("mode and disease_state required", 400);
  }

  const handler = planHandlers[mode];
  if (!handler) {
    return jsonError(`Unknown mode: ${mode}`, 400);
  }

  try {
    const plan = await handler({ disease_state, hcp_type, scenario_context }, env);
    return new Response(JSON.stringify(plan), {
      headers: { "Content-Type": "application/json" }
    });
```

**AFTER:**
```javascript
async function postPlan(req, env, ctx) {
  const body = await parseJSON(req);
  if (!body) return jsonError("Invalid JSON", 400);

  const { mode: rawMode, disease_state, hcp_type, scenario_context } = body;
  const mode = String(rawMode || "").trim().toLowerCase();
  if (!mode || !disease_state) {
    return jsonError("mode and disease_state required", 400);
  }

  const handler = planHandlers[mode];
  if (!handler) {
    return jsonError(`Unknown mode: ${mode}`, 400);
  }

  try {
    const plan = await handler({ disease_state, hcp_type, scenario_context }, env);
    return new Response(JSON.stringify(plan), {
      headers: { "Content-Type": "application/json" }
    });
```

**CHANGES:**
- Line 574: Destructure `rawMode` instead of `mode`
- Line 575: Add `const mode = String(rawMode || "").trim().toLowerCase();`

---

### Change 3: Mode Normalization in postChat() (Lines 682-701)

**BEFORE:**
```javascript
async function postChat(req, env, ctx) {
  const body = await parseJSON(req);
  if (!body) return jsonError("Invalid JSON", 400);

  const { mode, messages, model, max_tokens } = body;
  if (!mode || !messages || !Array.isArray(messages)) {
    return jsonError("mode and messages (array) required", 400);
  }

  const handler = chatHandlers[mode];
  if (!handler) {
    return jsonError(`Unknown mode: ${mode}`, 400);
  }

  const selectedModel = model || env.PROVIDER_MODEL;
  const selectedMaxTokens = max_tokens || parseInt(env.MAX_OUTPUT_TOKENS || "2048", 10);

  try {
    const result = await handler(
      { messages, model: selectedModel, max_tokens: selectedMaxTokens },
```

**AFTER:**
```javascript
async function postChat(req, env, ctx) {
  const body = await parseJSON(req);
  if (!body) return jsonError("Invalid JSON", 400);

  const { mode: rawMode, messages, model, max_tokens } = body;
  const mode = String(rawMode || "").trim().toLowerCase();
  if (!mode || !messages || !Array.isArray(messages)) {
    return jsonError("mode and messages (array) required", 400);
  }

  const handler = chatHandlers[mode];
  if (!handler) {
    return jsonError(`Unknown mode: ${mode}`, 400);
  }

  const selectedModel = model || env.PROVIDER_MODEL;
  const selectedMaxTokens = max_tokens || parseInt(env.MAX_OUTPUT_TOKENS || "2048", 10);

  try {
    const result = await handler(
      { messages, model: selectedModel, max_tokens: selectedMaxTokens },
```

**CHANGES:**
- Line 684: Destructure `rawMode` instead of `mode`
- Line 685: Add `const mode = String(rawMode || "").trim().toLowerCase();`

---

## DEPLOYMENT COMMANDS

### 1. Deploy Worker to Cloudflare

```bash
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai
wrangler deploy
```

**Expected Output:**
```
Total Upload: XX.XX KiB / gzip: XX.XX KiB
Uploaded my-chat-agent-v2 (X.XX sec)
Published my-chat-agent-v2 (X.XX sec)
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev
```

### 2. Verify Environment Variables

```bash
wrangler secret list
```

**Required Variables:**
- `PROVIDER_URL` - Groq API endpoint
- `PROVIDER_MODEL` - llama-3.3-70b-versatile
- `PROVIDER_KEY` - API key
- `CORS_ORIGINS` - https://reflectivei.github.io

**Check in Cloudflare Dashboard:**
Navigate to: Workers & Pages → my-chat-agent-v2 → Settings → Variables

Ensure `CORS_ORIGINS` is set to: `https://reflectivei.github.io`

### 3. Test Health Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

**Expected:** `{"status":"ok","timestamp":"..."}`

### 4. Test Version Endpoint

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```

**Expected:** `{"version":"r10.1"}`

### 5. Test Role Play Mode with Oncology

```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/plan \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "role-play",
    "disease_state": "Oncology",
    "hcp_type": "Oncologist",
    "scenario_context": "Initial consultation"
  }'
```

**Expected:** 200 status with JSON plan object (NOT 422 error)

### 6. Monitor Worker Logs

```bash
wrangler tail my-chat-agent-v2
```

Then test the site manually - logs will show real-time activity.

---

## TESTING CHECKLIST

### Pre-Deployment Verification
- [ ] All changes saved to worker.js
- [ ] No syntax errors in worker.js
- [ ] wrangler.toml exists with correct worker name

### Post-Deployment Verification
- [ ] Health endpoint returns 200
- [ ] Version endpoint returns r10.1
- [ ] /plan endpoint accepts role-play mode (case insensitive)
- [ ] Oncology disease state returns 200 (not 422)
- [ ] Facts array can be empty without validation error
- [ ] Browser console shows no CORS errors
- [ ] Live site at https://reflectivei.github.io/reflectiv-ai/ works

### Mode Testing
Test each mode/disease state combination:
- [ ] Sales Coach + HIV PrEP
- [ ] Role Play + Oncology (CRITICAL - was broken)
- [ ] Role Play + HIV PrEP
- [ ] Emotional Intelligence + General
- [ ] Product Knowledge + HIV PrEP

### Browser Console Check
Open DevTools on live site:
- [ ] No 422 errors
- [ ] No CORS errors
- [ ] No "[Coach] degrade-to-legacy" messages
- [ ] Successful plan generation visible in Network tab

---

## ARCHITECTURE REFERENCE

### Frontend Modes (assets/chat/modes/)
1. **salesCoach.js** - Sales coaching FSM
2. **rolePlay.js** - Role play scenarios (BROKEN with Oncology)
3. **emotionalIntelligence.js** - EI assessment
4. **productKnowledge.js** - Product info Q&A

**Note:** General Assistant is being converted to avatar feature (not dropdown mode)

### Backend FSM Modes (worker.js)
1. `sales-coach` - Lines 207-305
2. `role-play` - Lines 307-405
3. `emotional-assessment` - Lines 407-464
4. `product-knowledge` - Lines 466-522
5. `general-knowledge` - Lines 524-564

**Naming Inconsistency:** Frontend uses `emotionalIntelligence.js`, backend expects `emotional-assessment`

### Critical Files
- **worker.js** (1,434 lines) - Cloudflare Worker backend
- **widget.js** (952 lines) - Frontend orchestration
- **scenarios.merged.json** - Disease state scenarios
- **.github/copilot-instructions.md** - AI agent guidance

---

## KNOWN ISSUES & FUTURE WORK

### Issue 1: File Naming Consistency
- File: `emotionalIntelligence.js`
- FSM key: `emotional-assessment`
- Impact: May break dynamic imports
- Fix: Rename file OR update FSM to match

### Issue 2: General Assistant Avatar
- Requirement: Convert from dropdown to icon next to header
- Status: Discussed, not implemented
- Priority: Medium (after 422 fix verified)

### Issue 3: Facts Database
- Current: Only 3 HIV PrEP facts in FACTS_DB
- Impact: Role Play mode expects facts for all disease states
- Fix: Populate facts for Oncology, Cardiology, etc.
- Temporary: Empty facts array now allowed (minItems: 0)

---

## ROLLBACK PROCEDURE

If deployment breaks:

```bash
# Check deployment history
wrangler deployments list

# Rollback to previous version
wrangler rollback [DEPLOYMENT_ID]
```

Or use: `./ROLLBACK_TO_R10.sh` (if it exists)

---

## SUCCESS CRITERIA

1. ✅ Worker deploys without errors
2. ✅ Health and version endpoints respond
3. ✅ Role Play + Oncology returns 200 (not 422)
4. ✅ Browser console clean (no errors)
5. ✅ All 5 modes selectable and functional
6. ✅ No regression on previously working features

---

## CONTACT & DEBUGGING

If issues persist:

1. Check worker logs: `wrangler tail my-chat-agent-v2`
2. Verify CORS_ORIGINS in Cloudflare Dashboard
3. Test with curl to isolate frontend vs backend
4. Check browser Network tab for request/response details
5. Verify Groq API key is valid and has credits

**Last Updated:** November 12, 2025 (Conversation Summary)
