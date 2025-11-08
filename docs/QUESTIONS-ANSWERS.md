# Widget-Worker Integration: Questions & Answers

This document answers specific questions about the ReflectivAI widget-worker integration.

## Q1: What is the canonical request/response schema for /chat?

### Request Schema

```typescript
interface ChatRequest {
  mode: "sales-simulation" | "role-play" | "product-knowledge" | "emotional-assessment";
  user: string;                    // User's message
  history?: Array<{                // Conversation history (optional)
    role: "user" | "assistant";
    content: string;
  }>;
  disease?: string;                // e.g., "HIV" (optional)
  persona?: string;                // e.g., "difficult", "engaged" (optional)
  goal?: string;                   // Session goal (optional)
  session?: string;                // Session ID (optional, defaults to "anon")
  plan?: object;                   // Pre-computed plan (optional)
  planId?: string;                 // Existing plan ID (optional)
}
```

**Required Fields**: `mode`, `user`  
**Optional Fields**: All others have sensible defaults

### Response Schema (Success - 200 OK)

```typescript
interface ChatResponse {
  reply: string;                   // Assistant's response text
  coach?: {                        // Coaching feedback (optional, may be null)
    overall?: number;              // 0-100 aggregate score
    scores: {                      // Individual dimension scores (0-5)
      accuracy: number;
      empathy: number;
      clarity: number;
      compliance: number;
      discovery: number;
      objection_handling: number;
    };
    worked?: string[];             // What worked well
    improve?: string[];            // Suggestions for improvement
    phrasing?: string;             // Example phrasing
    feedback?: string;             // Overall feedback
    context?: {
      rep_question?: string;
      hcp_reply?: string;
    };
  };
  plan?: {
    id: string;                    // Plan identifier
  };
}
```

### Error Response Schemas

**502 Bad Gateway** - Provider unavailable:
```json
{
  "error": "upstream_error",
  "message": "provider_http_500"
}
```

**415 Unsupported Media Type** - Wrong Content-Type:
```json
{
  "error": "unsupported_media_type",
  "message": "Content-Type must be application/json"
}
```

**500 Internal Server Error**:
```json
{
  "error": "server_error",
  "detail": "Error description"
}
```

## Q2: Under what conditions should the widget use Cloudflare Worker vs direct apiBase?

### Decision Tree

```
1. Is workerUrl/apiBase configured in config.json?
   NO → Widget cannot function (shows error)
   YES → Continue to 2

2. Widget attempts to use Worker (primary path)
   - POSTs to {workerUrl}/chat
   - SUCCESS → Use worker response
   - FAILURE → Continue to 3

3. Widget falls back to direct model (fallback path)
   - Catches error from worker (network, 4xx/5xx)
   - Calls callModel(messages) directly
   - SUCCESS → Use direct model response (no coach object)
   - FAILURE → Show error message to user
```

### When to Use Worker (Primary Path)

**Always prefer the worker when:**
- Worker URL is configured in `config.json`
- User is online and can reach worker endpoint
- Want structured coaching feedback (coach scores, suggestions)
- Want fact-based responses (worker manages fact DB)
- Want session state tracking (loop prevention)

**Implementation**: Widget tries worker first, falls back automatically on error

### When to Use Direct Model (Fallback Path)

**Widget falls back when:**
- Worker returns error (4xx/5xx status)
- Worker is unreachable (network error, timeout)
- Worker response is malformed (no `reply` field)

**Limitations of fallback**:
- No structured coach object (scores, feedback)
- No fact management (less accurate responses)
- No session state tracking (potential loops)
- Relies on direct LLM API access (if `apiBase` is model endpoint)

**Note**: The fallback is automatic - no user configuration needed.

## Q3: How are mode, disease, persona, and goal used on the server side?

### mode

**Usage**: Determines prompt engineering strategy and response format

- **sales-simulation**: 
  - System prompt requests coaching guidance + `<coach>{...}</coach>` tags
  - Expects structured feedback with scores
  - FSM caps response to 5-6 sentences
  
- **role-play**:
  - System prompt is HCP-only (first-person, no coaching)
  - No `<coach>` tags expected (may return null)
  - FSM caps to 4 sentences
  
- **product-knowledge**:
  - System prompt focuses on facts and accuracy
  - May include light coaching
  
- **emotional-assessment**:
  - Specialized EI evaluation prompts
  - May return extended EI data if `emitEi=true`

**Code Reference**: `worker.js` lines 362-374 (mode-specific prompt construction)

### disease

**Usage**: Filters facts from FACTS_DB by therapeutic area

**Example**:
```javascript
// Request: { disease: "HIV", ... }
// Worker filters: FACTS_DB.filter(f => f.ta === "HIV")
// Result: Only HIV-related facts included in prompt
```

**Impact**:
- Narrows fact selection to relevant therapeutic area
- Included in system prompt: `Disease: HIV`
- Used for plan generation (via `/plan` endpoint)

**Code Reference**: `worker.js` lines 294-298 (fact filtering)

### persona

**Usage**: Influences HCP simulation behavior (primarily in role-play mode)

**Example Personas**:
- `"difficult"` → Resistant, emotional, argumentative HCP
- `"engaged"` → Collaborative, attentive HCP
- `"indifferent"` → Pleasant but disengaged HCP

**Impact**:
- Included in system prompt: `Persona: difficult`
- LLM adjusts HCP dialogue style based on persona
- No direct code logic; influences LLM behavior

**Code Reference**: `worker.js` lines 365, 371 (persona in prompt)

### goal

**Usage**: Guides conversation objective

**Examples**:
- `"Overcome objections"`
- `"Build confidence"`
- `"Educate on PrEP eligibility"`

**Impact**:
- Included in system prompt: `Goal: Overcome objections`
- LLM tailors guidance to help achieve goal
- No direct code logic; influences LLM behavior

**Code Reference**: `worker.js` lines 365, 371 (goal in prompt)

**Summary**: These fields are primarily used to construct the system prompt that guides the LLM's behavior. The worker itself doesn't implement different logic per mode/disease/persona/goal - it relies on the LLM to interpret and respond appropriately.

## Q4: Does the worker need to support all four modes differently, or is it mode-agnostic?

### Answer: Partially mode-aware

The worker has **light mode awareness** but is mostly **mode-agnostic** in implementation.

### Mode-Specific Behavior

**1. Prompt Engineering** (lines 362-374)
```javascript
const sys = (mode === "role-play")
  ? [/* HCP-only prompt, no coaching */]
  : [/* Coaching prompt with <coach> tags */];
```

- **role-play**: Different system prompt (first-person HCP, no coaching)
- **Other modes**: Same coaching-oriented prompt

**2. Token Limits** (lines 387-388)
```javascript
maxTokens: mode === "sales-simulation" ? 1200 : 900
```

- **sales-simulation**: 1200 tokens (needs space for coaching)
- **Other modes**: 900 tokens

**3. FSM Sentence Capping** (lines 419-422)
```javascript
const fsm = FSM[mode] || FSM["sales-simulation"];
const cap = fsm?.states?.[fsm?.start]?.capSentences || 5;
```

- **sales-simulation**: 5-6 sentences
- **role-play**: 4 sentences
- **Other modes**: Default to sales-simulation FSM

**4. Loop Detection Fallback** (lines 428-432)
```javascript
if (state && candNorm && (candNorm === state.lastNorm)) {
  if (mode === "role-play") {
    reply = "In my clinic, we review history..."; // HCP voice
  } else {
    reply = "Anchor to eligibility..."; // Coaching voice
  }
}
```

- **role-play**: Fallback uses HCP voice
- **Other modes**: Fallback uses coaching voice

### Mode-Agnostic Behavior

**The following applies to ALL modes**:
- Request validation (Content-Type, CORS)
- Fact filtering (by disease/topic)
- Plan generation (via `/plan`)
- Provider API calls (with retries)
- `<coach>` extraction (works for all, but role-play typically doesn't include it)
- Deterministic scoring fallback (if LLM doesn't provide coach)
- Session state tracking (loop prevention)
- Response sanitization

### Recommendation

**Current implementation is sufficient** because:
1. LLM does most of the mode-specific work (guided by system prompt)
2. Worker provides mode-appropriate prompts
3. Widget can handle mode-specific UI rendering

**Potential enhancements**:
- Add mode-specific validation rules
- Implement mode-specific fact selection logic
- Create mode-specific deterministic scoring algorithms

## Q5: How to switch to local fallback text?

### Current Behavior

The widget has a `fallbackText(mode)` function that returns static text per mode:

```javascript
function fallbackText(mode) {
  if (mode === "sales-simulation") {
    return "Keep it concise. Acknowledge the HCP's context...";
  }
  if (mode === "product-knowledge") {
    return "Brief overview: indication, one efficacy point...";
  }
  // etc.
}
```

**Usage**: This is only shown when both worker AND direct model fail completely.

### When Local Fallback is Used

```javascript
if (!replyText) {
  // All attempts failed (worker + direct model)
  replyText = fallbackText(currentMode);
}
```

**Triggers**:
1. Worker call fails (network error, 4xx/5xx)
2. Direct model call fails (network error, timeout)
3. Both return empty/malformed responses

### How to Force Local Fallback (for testing)

**Option 1**: Remove worker URL from config
```json
{
  "workerUrl": "",  // Empty or remove this line
  "apiBase": ""     // Empty or remove this line
}
```

**Option 2**: Set invalid worker URL
```json
{
  "workerUrl": "https://invalid.example.com"
}
```

**Option 3**: Disconnect network (browser DevTools → Network → Offline)

### Recommended Fallback Strategy

**Production**: Always configure a valid worker URL. Fallback is for emergencies only.

**Development**: Use local worker (`wrangler dev`) to avoid fallback and test realistic scenarios.

## Summary

- **Contract**: Documented in `docs/WIDGET-WORKER-CONTRACT.md`
- **Worker vs Direct**: Widget tries worker first, falls back automatically on error
- **Mode/Disease/Persona/Goal**: Used for prompt construction, influences LLM behavior
- **Mode Support**: Worker is mostly mode-agnostic, with light awareness for prompting and limits
- **Local Fallback**: Used when all network paths fail; not recommended for production use

See `docs/ARCHITECTURE.md` for complete system documentation.
