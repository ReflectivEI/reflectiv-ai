# Phase 14b: Worker-Side Analysis & Observability

## Executive Summary

**Worker Version:** r10.1  
**Analysis Date:** 2025-11-22  
**Branch:** phase14b/worker-hardening (conceptual)

**Status:** Worker is well-structured with proper error handling. Implementing minimal hardening improvements for consistency and observability.

---

## 1. Worker Input/Output Contract Per Mode

### Base Request Structure (All Modes)

**Endpoint:** `POST /chat`

**Request Body:**
```javascript
{
  messages: [                     // REQUIRED: Non-empty array
    { role: "system"|"user"|"assistant", content: string }
  ],
  mode: string,                   // REQUIRED: One of 5 modes
  disease: string,                // OPTIONAL: Therapeutic area
  persona: string,                // OPTIONAL: HCP profile
  goal: string,                   // OPTIONAL: Scenario goal
  plan: object,                   // OPTIONAL: Pre-generated plan
  planId: string,                 // OPTIONAL: Plan identifier
  session: string                 // OPTIONAL: Session ID (default: "anon")
}
```

**Worker Validation (worker.js:846-941):**
- ✅ JSON parse errors → 400 with error details
- ✅ Empty messages array → 400
- ✅ No user message in array → 400
- ✅ Empty user content → 400
- ✅ Missing provider keys → 500
- ✅ Mode normalization: "sales-simulation" → "sales-coach"

### Success Response Structure (All Modes)

**HTTP 200 OK:**
```javascript
{
  reply: string,                  // Mode-specific formatted content
  coach: object | null,           // EI scores (mode-dependent)
  plan: {
    id: string                    // Plan identifier
  }
}
```

**Worker Implementation (worker.js:1757):**
```javascript
return json({ reply, coach: coachObj, plan: { id: planId || activePlan.planId } }, 200, env, req);
```

---

## 2. Mode-Specific Contracts

### Mode 1: Sales Coach

**Input Requirements:**
- mode: "sales-coach"
- disease: Recommended (used for fact selection)
- persona: Recommended (used for prompting)
- goal: Recommended (used for context)

**Output Guarantee:**
```javascript
{
  reply: string,  // 4-section format enforced:
                  // - Challenge: [sentence]
                  // - Rep Approach: [3 bullets with [FACT-ID]]
                  // - Impact: [sentence]
                  // - Suggested Phrasing: "[quote]"
  coach: {
    scores: { empathy: 0-5, clarity: 0-5, ... },  // 10 dimensions
    rationales: { empathy: string, ... },
    worked: string[],
    improve: string[],
    feedback: string,
    phrasing: string,
    context: { rep_question: string, hcp_reply: string }
  },
  plan: { id: string }
}
```

**Enforcement (worker.js:1472-1529):**
- Validates presence of 4 sections
- Enforces exactly 3 bullets in Rep Approach
- Auto-adds Suggested Phrasing if missing
- Strips any `<coach>` blocks from reply

### Mode 2: Role Play

**Input Requirements:**
- mode: "role-play"
- disease: Required for context
- persona: Required for HCP character
- goal: Recommended

**Output Guarantee:**
```javascript
{
  reply: string,  // Pure HCP dialogue, first-person
                  // 1-4 sentences or brief bullets
                  // NO coaching sections
  coach: {
    scores: { ... },  // Minimal/default scores
    worked: [...],
    improve: [...]
  },
  plan: { id: string }
}
```

**Enforcement (worker.js:1421-1469):**
- Strips ALL coaching format markers
- Removes sales-coach sections if leaked
- Removes scoring/rubric JSON fragments
- Preserves clinical bullets (•, -, *)

### Mode 3: Product Knowledge

**Input Requirements:**
- mode: "product-knowledge"
- disease: Optional (may be empty)
- persona: Usually empty
- goal: Usually empty

**Output Guarantee:**
```javascript
{
  reply: string,  // Markdown with inline [n] citations
                  // References section
                  // Headers, bullets, structured content
  coach: null,    // No coaching in PK mode
  plan: { id: string }
}
```

**Prompt (worker.js:1177-1251):**
- Comprehensive knowledge response
- Inline citations [1], [2]
- References section required
- No sales-coach format

### Mode 4: Emotional Assessment

**Input Requirements:**
- mode: "emotional-assessment"
- disease: Optional context
- persona: Optional context
- goal: Development focus

**Output Guarantee:**
```javascript
{
  reply: string,  // Socratic coaching
                  // 2-4 paragraphs (max 350 words)
                  // MUST end with "?"
  coach: {
    scores: { ... },  // EI-focused metrics
    worked: [...],
    improve: [...],
    feedback: string
  },
  plan: { id: string }
}
```

**Enforcement (worker.js:1576-1582):**
- Forces final "?" if missing
- Adds reflective question if needed
- Socratic prompting framework

### Mode 5: General Knowledge

**Input Requirements:**
- mode: "general-knowledge"
- disease: Usually empty
- persona: Usually empty
- goal: Usually empty

**Output Guarantee:**
```javascript
{
  reply: string,  // Markdown-formatted answer
                  // Proper list formatting
                  // Each item on new line
  coach: null,    // No coaching
  plan: { id: string }
}
```

**Prompt (worker.js:1253-1320):**
- General helpful responses
- Markdown with line breaks
- No mode-specific structures

---

## 3. Error Response Contracts

### Current Error Handling

**Worker uses consistent error envelope:**

#### 429 Rate Limited (worker.js:94-99)
```javascript
{
  error: "rate_limited",
  retry_after_sec: 2  // Default, configurable via RATELIMIT_RETRY_AFTER
}

HTTP Headers:
- Retry-After: "2"
- X-RateLimit-Limit: "10"
- X-RateLimit-Remaining: "0"
- x-req-id: "<uuid>"
```

**Implementation:**
- Token bucket algorithm (10 req/min, burst 4)
- Per-IP tracking: `${ip}:chat`
- Configurable via RATELIMIT_RATE, RATELIMIT_BURST, RATELIMIT_RETRY_AFTER

#### 400 Bad Request
```javascript
{
  error: "bad_request",
  message: "<specific error description>"
}
```

**Causes:**
- Empty request body → `message: "Request body is empty"`
- Invalid JSON → `message: "Invalid JSON in request body: ..."`
- Empty messages array → `message: "messages array is empty"`
- No user message → `message: "No user message found in messages array"`
- Empty user content → `message: "User message cannot be empty"`
- No facts for disease → `message: "No facts available for disease..."`

#### 500 Server Error
```javascript
{
  error: "server_error",
  message: "Internal server error"
}
```

**Causes:**
- No provider keys configured
- Uncaught exceptions in top-level handler

#### 502 Bad Gateway (Provider Error)
```javascript
{
  error: "provider_error",
  message: "External provider failed or is unavailable"
}
```

**Causes:**
- Provider HTTP errors (timeouts, 5xx from Groq)
- Plan generation failures

### Error Response Consistency

**✅ Good:**
- All errors use `json()` helper → consistent JSON + CORS
- All errors include x-req-id when available
- 429 includes retry guidance
- Error messages are descriptive

**⚠️ Areas for Improvement:**
- Could add structured `details` object to all errors (currently only on some)
- Could add error codes beyond just string error types
- Could include more context in 502 provider errors

---

## 4. Observability & Logging

### Current Logging

**Startup Log (worker.js:40):**
```javascript
{
  event: "startup_config",
  key_pool_size: N,
  cors_allowlist_size: N,
  rotation_strategy: "session"
}
```

**Request Start Log (worker.js:860-868):**
```javascript
{
  event: "chat_request",
  req_id: "<uuid>",
  mode: "sales-coach",
  has_plan: true|false,
  has_history: true|false,
  disease: "HIV" | null,
  persona: "Difficult HCP" | null
}
```

**Error Log (worker.js:1760-1766):**
```javascript
{
  req_id: "<uuid>",
  step: "general"|"config_check"|"json_parse"|"request_validation"|...,
  message: "<error message>",
  stack: "<stack trace>",
  duration_ms: 1234
}
```

**Validation Warning Log (worker.js:1494-1502):**
```javascript
"sales_simulation_format_incomplete" {
  has_challenge: true|false,
  has_rep_approach: true|false,
  has_impact: true|false,
  has_suggested: true|false,
  bullet_count: N
}
```

**CORS Denial Log (worker.js:272):**
```javascript
"CORS deny" {
  origin: "https://...",
  allowedList: [...]
}
```

### Observability Gaps

**Missing:**
- ❌ Success duration metrics
- ❌ LLM provider response time tracking
- ❌ Token usage tracking
- ❌ Mode-specific success/failure counts
- ❌ Fallback usage tracking
- ❌ Contract violation counts

**Recommendation:** Add structured metrics object to success path

---

## 5. Rate Limiting Analysis

### Implementation (worker.js:1843-1854)

**Algorithm:** Token Bucket
- Refill rate: 10 tokens/minute (configurable via RATELIMIT_RATE)
- Burst capacity: 4 tokens (configurable via RATELIMIT_BURST)
- Granularity: Per-IP per-endpoint

**Code:**
```javascript
function rateLimit(key, env) {
  const rate = Number(env.RATELIMIT_RATE || 10);
  const burst = Number(env.RATELIMIT_BURST || 4);
  const now = Date.now();
  const b = _buckets.get(key) || { tokens: burst, ts: now };
  const elapsed = (now - b.ts) / 60000; // per minute
  b.tokens = Math.min(burst, b.tokens + elapsed * rate);
  b.ts = now;
  if (b.tokens < 1) {
    _buckets.set(key, b);
    return { ok: false, limit: rate, remaining: 0 };
  }
  b.tokens -= 1;
  _buckets.set(key, b);
  return { ok: true, limit: rate, remaining: Math.max(0, Math.floor(b.tokens)) };
}
```

**Storage:** In-memory Map (`_buckets`)
- ✅ Fast access
- ⚠️ Lost on worker restart
- ⚠️ Not shared across worker instances

**Response (worker.js:94-99):**
```javascript
return json(
  { error: "rate_limited", retry_after_sec: retry },
  429,
  env,
  req,
  {
    "Retry-After": String(retry),
    "X-RateLimit-Limit": String(gate.limit),
    "X-RateLimit-Remaining": String(gate.remaining),
    "x-req-id": reqId
  }
);
```

### 429 Propagation from Provider

**Scenario:** Groq API returns 429

**Current Handling:**
- `providerChat()` function catches provider errors
- Converts to `provider_http_429` error message
- Caught by postChat error handler
- Returns 502 (provider_error), NOT 429

**Code Path (worker.js:1769-1781):**
```javascript
const isProviderError = e.message && (
  e.message.startsWith("provider_http_") ||
  e.message === "plan_generation_failed"
);

if (isProviderError) {
  return json({
    error: "provider_error",
    message: "External provider failed or is unavailable"
  }, 502, env, req);
}
```

**Issue:** Provider 429s are returned as 502, not 429
- Widget retry logic treats 502 same as 429 (retryable)
- But error message doesn't indicate rate limiting
- Could be improved

### Rate Limit Recommendations

**Immediate:**
1. ✅ Current 429 response is well-structured
2. ✅ Includes retry_after_sec
3. ✅ Includes rate limit headers

**Future Enhancements:**
1. Differentiate worker 429 vs provider 429
2. Consider KV-based rate limiting for persistence
3. Add per-user (session) rate limits in addition to per-IP
4. Track rate limit hit rate for capacity planning

---

## 6. Staging vs Production Drift

### Current Configuration (wrangler.toml)

**Single Environment:** Production only
- No `[env.staging]` block
- No `[env.dev]` block
- All configuration in main vars section

**Configuration:**
```toml
[vars]
PROVIDER = "groq"
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
PROVIDER_MODEL = "llama-3.1-8b-instant"
MAX_OUTPUT_TOKENS = "1400"
CORS_ORIGINS = "https://reflectivei.github.io,..."

[[kv_namespaces]]
binding = "SESS"
id = "75ab38c3bd1d4c37a0f91d4ffc5909a7"
preview_id = "75ab38c3bd1d4c37a0f91d4ffc5909a7"  # Same as prod
```

**Secrets (set via wrangler secret put):**
- PROVIDER_KEY
- PROVIDER_KEY_2
- PROVIDER_KEY_3

### Analysis

**✅ No Drift Issues:**
- Only one environment defined
- Preview uses same KV namespace
- No accidental configuration differences

**⚠️ Recommendations for Future:**
If staging environment is added:
1. Use separate KV namespace for staging
2. Use separate/lower rate limits for staging
3. Consider separate CORS origins for staging
4. Use separate (or same) provider keys depending on quota needs
5. Add environment identifier to logs

**Current State:** Low risk of drift (single environment)

---

## 7. Contract Enforcement & Fallbacks

### Input Contract Enforcement

**Location:** `worker.js:846-941` (postChat function start)

**Validations:**
1. ✅ JSON parse errors caught
2. ✅ Empty body detected
3. ✅ Messages array presence checked
4. ✅ Messages array non-empty checked
5. ✅ User message existence validated
6. ✅ User message content non-empty checked
7. ✅ Mode normalization ("sales-simulation" → "sales-coach")

**Error Responses:** All return structured JSON with descriptive messages

### Output Contract Enforcement

**Per-Mode Validation (worker.js:1640-1650):**

```javascript
const validation = validateModeResponse(mode, reply, coachObj);
reply = validation.reply; // Use cleaned reply

if (validation.warnings.length > 0 || validation.violations.length > 0) {
  console.log({
    event: "validation_check",
    mode,
    warnings: validation.warnings,
    violations: validation.violations,
    reply_length: reply.length
  });
}
```

**Mode-Specific Enforcement:**

1. **Sales Coach:**
   - 4-section format enforced (Challenge, Rep Approach, Impact, Suggested Phrasing)
   - Exactly 3 bullets in Rep Approach
   - Auto-repair missing Suggested Phrasing
   - Strip `<coach>` blocks

2. **Role Play:**
   - Strip ALL coaching format markers
   - Remove sales-coach sections
   - Clean scoring/rubric JSON

3. **Product Knowledge:**
   - Validate citations present
   - Validate References section
   - No sales-coach headings

4. **Emotional Assessment:**
   - Enforce final "?"
   - Add reflective question if missing

5. **General Knowledge:**
   - No mode-specific structures
   - Standard markdown

### Fallback Handling

**Current State:**

**✅ Good Fallbacks:**
- Deterministic scoring if provider omits coach data (worker.js:1586-1598)
- Auto-repair of missing Suggested Phrasing in Sales Coach
- Auto-add of final "?" in EI mode
- FSM-based sentence capping prevents infinite responses

**⚠️ Areas for Improvement:**
- No explicit fallback if LLM returns null/empty
- No fallback if LLM returns completely malformed JSON in structured modes
- Could add mode-specific "safe" fallback responses

**Recommendation:** Add explicit null/empty response handling with safe fallbacks

---

## 8. Potential Improvements

### Priority 1: Standardize Error Details

**Current:**
```javascript
{ error: "bad_request", message: "..." }
```

**Proposed:**
```javascript
{
  error: {
    type: "bad_request",
    code: "EMPTY_MESSAGES",
    message: "messages array is empty"
  }
}
```

**Benefits:**
- Machine-readable error codes
- Easier client-side error handling
- Better observability

### Priority 2: Add Success Metrics

**Proposed Addition:**
```javascript
{
  reply: "...",
  coach: {...},
  plan: {...},
  _meta: {
    duration_ms: 1234,
    mode: "sales-coach",
    used_fallback: false,
    validation_warnings: 0
  }
}
```

**Benefits:**
- Client-side performance tracking
- Debugging assistance
- Contract monitoring

### Priority 3: Differentiate Provider 429s

**Current:** Provider 429 → 502 (provider_error)

**Proposed:** Provider 429 → 429 (rate_limited, source: "provider")

**Change:**
```javascript
if (isProviderError) {
  const is429 = e.message === "provider_http_429";
  if (is429) {
    return json({
      error: "rate_limited",
      source: "provider",
      message: "External API rate limit exceeded",
      retry_after_sec: 60
    }, 429, env, req);
  }
  // ... other provider errors remain 502
}
```

### Priority 4: Add Null Response Handling

**Proposed Guard:**
```javascript
// After LLM call, before processing
if (!raw || raw.trim() === "") {
  console.warn("empty_llm_response", { mode, session });
  raw = getFallbackResponse(mode);
}

function getFallbackResponse(mode) {
  const fallbacks = {
    "sales-coach": "Challenge: Unable to generate guidance at this time.\n\nRep Approach:\n• Please try again\n• Check your connection\n• Contact support if issue persists\n\nImpact: Request can be retried.\n\nSuggested Phrasing: \"Let me try that again.\"",
    "role-play": "I need a moment to consider that. Could you rephrase your question?",
    "product-knowledge": "I'm unable to provide information at this time. Please try again or consult official sources.",
    "emotional-assessment": "What would help you feel more prepared for similar conversations?",
    "general-knowledge": "I'm unable to provide an answer at this time. Please try again."
  };
  return fallbacks[mode] || fallbacks["general-knowledge"];
}
```

---

## 9. Test Coverage Analysis

### Existing Tests

**worker.test.js:**
- ✅ Health endpoint
- ✅ Version endpoint
- ✅ 404 for unknown endpoints
- ✅ 500 when PROVIDER_KEY missing
- ✅ Widget payload format handling

**worker.audit.test.js:**
- Audit-specific tests (not reviewed in detail)

**real_test.js:**
- Live tests against deployed worker
- Tests all 5 modes
- Validates response structure

### Test Gaps

**Missing Tests:**
- ❌ 429 rate limit response structure
- ❌ Per-mode output contract validation
- ❌ Fallback behavior when LLM returns null
- ❌ Provider 429 vs worker 429 differentiation
- ❌ Validation warning/violation logging

### Recommended Test Additions

1. **Rate Limit Test:**
```javascript
// Send 5 requests rapidly, expect 429 on 5th
// Validate 429 response structure
// Validate Retry-After header
```

2. **Mode Contract Tests:**
```javascript
// For each mode, validate success response has:
// - reply (string)
// - coach (object|null as expected)
// - plan.id (string)
```

3. **Error Envelope Tests:**
```javascript
// Test each error type returns consistent structure
// - 400 bad_request
// - 429 rate_limited
// - 500 server_error
// - 502 provider_error
```

---

## 10. Summary & Recommendations

### Current State: ✅ Solid Foundation

**Strengths:**
- Well-structured error handling
- Consistent JSON response format
- Per-mode validation and enforcement
- Proper CORS handling
- Good logging for errors
- Token bucket rate limiting

**Areas for Enhancement:**
- Error response structure could be more standardized
- Success path lacks observability metrics
- Provider 429s should be differentiated
- Null/empty LLM response needs explicit handling
- Test coverage could be expanded

### Recommended Changes (Phase 14b)

**Priority 1 (Immediate):**
1. ✅ Add structured error envelope with error codes
2. ✅ Add _meta object to success responses
3. ✅ Add null/empty response fallbacks
4. ✅ Differentiate provider vs worker 429s

**Priority 2 (Near-term):**
1. Add comprehensive test suite for contracts
2. Add success duration metrics
3. Document staging environment setup (when needed)

**Priority 3 (Future):**
1. Consider KV-based rate limiting for persistence
2. Add per-user rate limits
3. Implement structured logging pipeline
4. Add token usage tracking

---

## Next Steps

1. Implement Priority 1 changes in worker.js
2. Update tests to validate new contracts
3. Create PHASE14B_WORKER_NOTES.md with deployment guidance
4. Run test suite
5. Prepare PR for phase14b/worker-hardening

**Estimated Code Changes:** ~100-150 lines (mostly additions)
**Risk Level:** Low (additive changes, backward compatible)
**Testing Required:** Update existing tests, add new contract tests
