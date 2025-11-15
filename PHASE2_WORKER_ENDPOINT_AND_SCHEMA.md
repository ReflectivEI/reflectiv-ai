# PHASE 2: Worker Endpoint & Request Schema

**Created:** 2025-11-14  
**Source:** worker.js direct code inspection (lines 30-1050)  
**Purpose:** Document exact endpoint routing and request schema for 20 real tests

---

## 1. WORKER FETCH HANDLER ROUTING

**Base URL:** `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`

### Endpoints (from worker.js lines 52-102):

```javascript
// Line 52: Health check
if (url.pathname === "/health" && (req.method === "GET" || req.method === "HEAD"))

// Line 77: Version info
if (url.pathname === "/version" && req.method === "GET")

// Line 82: Debug EI info
if (url.pathname === "/debug/ei" && req.method === "GET")

// Line 86: Facts endpoint
if (url.pathname === "/facts" && req.method === "POST") return postFacts(req, env);

// Line 87: Plan endpoint
if (url.pathname === "/plan" && req.method === "POST") return postPlan(req, env);

// Line 88: **CHAT ENDPOINT (PRIMARY FOR ALL 5 MODES)**
if (url.pathname === "/chat" && req.method === "POST") {
  // Rate limiting check
  // Then: return postChat(req, env);
}

// Line 102: Coach metrics
if (url.pathname === "/coach-metrics" && req.method === "POST") return postCoachMetrics(req, env);
```

### **Primary Test Endpoint:**

```
POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
```

**All 5 modes use this endpoint.** No `/agent` or `/evaluate` routing for Learning Center modes.

---

## 2. REQUEST SCHEMA (from worker.js postChat function, lines 918-1050)

### TypeScript Interface (Inferred from Code):

```typescript
interface ChatRequest {
  // Required
  mode: string;  // "sales-coach" | "role-play" | "emotional-assessment" | "product-knowledge" | "general-knowledge"
  messages: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  
  // Optional but recommended
  disease?: string;        // disease state ID (e.g., "hiv_im_decile3_prep_lowshare")
  persona?: string;        // persona ID (e.g., "hiv_fp_md_timepressed")
  goal?: string;           // scenario goal
  history?: Array<{ role: string; content: string }>;  // legacy format
  user?: string;           // legacy format
  plan?: object;           // pre-generated plan
  planId?: string;         // plan ID
  session?: string;        // session identifier (default: "anon")
  
  // Legacy/alternate formats
  role?: string;           // if role === 'alora', handled separately
  model?: string;          // ignored (worker always uses provider model)
  temperature?: number;    // ignored (worker always uses provider temperature)
  
  // EI mode specific
  eiContext?: string;      // EI framework content from about-ei.md (injected into eiPrompt)
}
```

### Request Body Parsing Logic (lines 938-980):

The worker accepts **TWO payload formats:**

#### Format 1: Widget Format (Modern, Recommended)
```javascript
// If request has messages array:
if (body.messages && Array.isArray(body.messages)) {
  const msgs = body.messages;
  const lastUserMsg = msgs.filter(m => m.role === "user").pop();
  const historyMsgs = msgs.filter(m => m.role !== "system" && m !== lastUserMsg);

  mode = body.mode || "sales-coach";
  user = lastUserMsg?.content || "";
  history = historyMsgs;
  disease = body.disease || "";
  persona = body.persona || "";
  goal = body.goal || "";
  plan = body.plan;
  planId = body.planId;
  session = body.session || "anon";
}
```

**Result:** 
- `mode` extracted from `body.mode`
- `user` = last user message content
- `history` = all non-system messages except last user message

#### Format 2: ReflectivAI Format (Legacy)
```javascript
// If request does NOT have messages array:
else {
  mode = body.mode || "sales-coach";
  user = body.user;
  history = body.history || [];
  disease = body.disease || "";
  persona = body.persona || "";
  goal = body.goal || "";
  plan = body.plan;
  planId = body.planId;
  session = body.session || "anon";
}
```

**For this testing phase, use Format 1 (Widget Format with messages array).**

---

## 3. CANONICAL REQUEST PAYLOADS (Real Values Only)

### Sales Coach Mode

```json
{
  "mode": "sales-coach",
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "hiv_fp_md_timepressed",
  "goal": "Create urgency around PrEP gaps; commit to proactive Descovy prescribing",
  "messages": [
    {
      "role": "user",
      "content": "We're seeing more STI testing in young MSM - what's your approach to PrEP?"
    }
  ]
}
```

**Expected Response:**
- Challenge: 1 sentence
- Rep Approach: 3 bullets with [FACT-ID] references
- Impact: 1 sentence
- Suggested Phrasing: exact words
- `<coach>` block: 10 EI metrics (empathy, clarity, compliance, discovery, objection_handling, confidence, active_listening, adaptability, action_insight, resilience)

---

### Role Play Mode

```json
{
  "mode": "role-play",
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "hiv_fp_md_timepressed",
  "goal": "Natural HCP dialogue",
  "messages": [
    {
      "role": "user",
      "content": "Hi doctor, I wanted to talk about PrEP opportunities in your clinic"
    }
  ]
}
```

**Expected Response:**
- HCP first-person voice (1-4 sentences or bullets)
- NO coaching language
- NO "You should have..." meta-commentary
- NO coach blocks
- NO evaluation scores

---

### Emotional Intelligence (EI) Mode

```json
{
  "mode": "emotional-assessment",
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "hiv_fp_md_timepressed",
  "goal": "Develop EI through reflection",
  "eiContext": "[EMBEDDED about-ei.md framework content]",
  "messages": [
    {
      "role": "user",
      "content": "I felt the HCP was dismissive of my PrEP evidence. How do I handle that differently?"
    }
  ]
}
```

**Expected Response:**
- Reflective guidance (2-4 paragraphs, max 350 words)
- 1-2 Socratic questions
- Triple-Loop Reflection reference
- Ending reflective question
- NO HCP role-play
- NO coach blocks

---

### Product Knowledge Mode

```json
{
  "mode": "product-knowledge",
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "hiv_fp_md_timepressed",
  "goal": "Provide clinical knowledge",
  "messages": [
    {
      "role": "user",
      "content": "What are the renal safety considerations for Descovy vs TDF?"
    }
  ]
}
```

**Expected Response:**
- Clinical explanation with citations [1], [2], [3]
- Evidence-based information
- Disease/persona context referenced
- Length: 100-800 words (flexible based on question)
- NO coaching language
- NO coach blocks

---

### General Knowledge Mode

```json
{
  "mode": "general-knowledge",
  "disease": "hiv_im_decile3_prep_lowshare",
  "persona": "hiv_fp_md_timepressed",
  "goal": "Answer any topic",
  "messages": [
    {
      "role": "user",
      "content": "What's the latest in AI for clinical decision support?"
    }
  ]
}
```

**Expected Response:**
- Helpful, accurate answer on any topic
- No mandatory format
- NO coaching language
- NO coach blocks

---

## 4. RATE LIMITING & HEADERS

### Request Headers (Recommended):

```javascript
{
  "Content-Type": "application/json",
  "x-req-id": "[unique-request-id]"  // Optional, worker will generate if missing
}
```

### Rate Limiting (from worker.js lines 92-99):

```javascript
const ip = req.headers.get("CF-Connecting-IP") || "0.0.0.0";
const gate = rateLimit(`${ip}:chat`, env);
if (!gate.ok) {
  return json({ error: "rate_limited", retry_after_sec: retry }, 429, env, req, {
    "Retry-After": String(retry),
    "X-RateLimit-Limit": String(gate.limit),
    "X-RateLimit-Remaining": String(gate.remaining),
    "x-req-id": reqId
  });
}
```

**Rate Limit Behavior:**
- Per-IP rate limiting: `${ip}:chat`
- Retry-After header if 429
- X-RateLimit headers returned

---

## 5. RESPONSE SCHEMA (from worker.js postChat)

### Success Response (200)

```json
{
  "reply": "[mode-specific response]",
  "coach": {
    "scores": {
      "empathy": 3,
      "clarity": 4,
      "compliance": 5,
      "discovery": 3,
      "objection_handling": 2,
      "confidence": 4,
      "active_listening": 3,
      "adaptability": 4,
      "action_insight": 3,
      "resilience": 2
    },
    "rationales": { ... },
    "tips": [ ... ],
    "rubric_version": "v2.0"
  },
  "planId": "[generated-plan-id]",
  "session": "[session-id]"
}
```

### Error Response (400, 429, 500)

```json
{
  "error": "error_code",
  "message": "Human-readable error message"
}
```

**Possible errors:**
- `"rate_limited"` (429): IP rate limited, check Retry-After
- `"server_error"` (500): No provider keys configured
- `"no_facts_for_mode"` (400): No facts available for disease
- Other validation errors

---

## 6. TESTING CHECKLIST

### Pre-Test Verification

- [ ] Base URL accessible: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
- [ ] Mode values: Use LC_TO_INTERNAL keys (not UI labels)
- [ ] Persona values: Use actual persona IDs from persona.json (10 total)
- [ ] Disease values: Use actual scenario IDs from scenarios.merged.json (19 total)
- [ ] Message format: `{ "role": "user", "content": "..." }`
- [ ] Request headers: Include `"Content-Type": "application/json"`

### Test Execution

For each of 20 test cases:
1. **Construct request** with real mode, persona, disease, messages
2. **POST to `/chat`** endpoint
3. **Capture response** (full JSON, including coach block)
4. **Validate response** against mode-specific contract
5. **Log test result** (pass/fail + exact response)

---

## 7. CORS & Origin Configuration

From worker.js line 37-43 (CORS preflight):

```javascript
if (req.method === "OPTIONS") {
  const h = cors(env, req);
  h["x-req-id"] = reqId;
  return new Response(null, { status: 204, headers: h });
}
```

**CORS is configured via environment variables:**
- `CORS_ORIGINS`: Comma-separated allowlist
- Worker uses `cors(env, req)` helper

**For testing from Node.js/curl:** CORS preflight is handled automatically if using fetch/axios.

---

## 8. NEXT STEPS: PHASE 2 TEST EXECUTION

All 20 real test cases are ready to execute:

1. ✅ Real modes verified (5)
2. ✅ Real personas extracted (10)
3. ✅ Real diseases identified (19)
4. ✅ Request schema defined (Widget Format with messages array)
5. ✅ Endpoint confirmed: `/chat` POST
6. ✅ Response contracts per mode documented

**Ready:** Execute PHASE 2 with actual HTTP requests to `https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat`

**Payload construction:** Use exact values from REAL_TEST_INPUTS_PHASE1.md test matrix

**Result collection:** Capture all 20 response payloads for PHASE 3 validation
