# ReflectivAI Architecture Documentation

## System Overview

ReflectivAI is a coaching platform for pharmaceutical sales representatives, featuring:
- **Interactive chat widget** for multi-mode coaching (sales simulation, role-play, product knowledge, emotional assessment)
- **Cloudflare Worker backend** for prompt engineering, fact management, and LLM integration
- **Deterministic scoring** with fallback mechanisms
- **Session state management** via Cloudflare KV

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        User Browser                          │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  widget.js (ReflectivAI Chat Widget)                   │ │
│  │  - Modes: sales-simulation, role-play, etc.            │ │
│  │  - UI rendering & conversation management              │ │
│  │  - Fallback handling                                   │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ POST /chat
                    │ {mode, user, history, disease, persona, goal, session}
                    ↓
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Worker (worker.js)                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Endpoints:                                             │ │
│  │  - POST /chat    (main chat handler)                   │ │
│  │  - POST /plan    (fact selection)                      │ │
│  │  - POST /facts   (fact retrieval)                      │ │
│  │  - GET  /health  (health check)                        │ │
│  │  - GET  /version (version info)                        │ │
│  │  - GET  /debug/ei (EI debug info)                      │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Logic:                                                 │ │
│  │  - Prompt engineering (system prompts, facts, FSM)     │ │
│  │  - Coach extraction from <coach>{...}</coach> tags     │ │
│  │  - Deterministic scoring fallback                      │ │
│  │  - Session state tracking (KV)                         │ │
│  │  - Loop detection & prevention                         │ │
│  └────────────────────────────────────────────────────────┘ │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    │ POST /v1/chat/completions
                    │ {model, messages, temperature, max_tokens}
                    ↓
┌─────────────────────────────────────────────────────────────┐
│        LLM Provider (Groq, OpenAI, Anthropic, etc.)          │
│  - Returns raw text response                                 │
│  - May include <coach>{...}</coach> tags for structured data│
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Primary Path: Widget → Worker → LLM

1. **User Input**
   - User types message in widget
   - Widget constructs payload with mode, history, disease, persona, goal
   
2. **Widget → Worker**
   - POST to `{workerUrl}/chat` with JSON payload
   - Worker validates Content-Type, CORS origin
   
3. **Worker Processing**
   - Calls `/plan` internally (or uses provided plan) to select relevant facts
   - Constructs system prompt with facts, references, and mode-specific instructions
   - Appends conversation history (last 18 messages)
   - Adds user's current message
   
4. **Worker → LLM Provider**
   - POST to provider API (e.g., Groq) with messages array
   - Retries up to 3 times on failure (with backoff)
   - For sales-simulation mode: expects response with `<coach>{...}</coach>` tags
   
5. **LLM → Worker**
   - Returns raw text (may include coach tags)
   - Worker extracts coach JSON from tags
   - Sanitizes response (removes code blocks, headers, etc.)
   
6. **Worker → Widget**
   - Returns JSON: `{reply, coach, plan}`
   - Widget displays reply and coach feedback
   
7. **Widget Display**
   - Renders reply as chat message
   - Shows coach scores, feedback, suggestions (if present)
   - Updates conversation history

### Fallback Path: Widget → Direct Model

When worker is unavailable or misconfigured:

1. Widget catches error from worker
2. Falls back to `callModel(messages)` which directly calls apiBase
3. Constructs messages with system prompt from local config
4. Returns raw text (no structured coach object)
5. Displays as chat message

## Configuration

### Widget Configuration Files

**Primary**: `config.json` or `assets/chat/config.json`

```json
{
  "apiBase": "https://my-worker.workers.dev",
  "workerUrl": "https://my-worker.workers.dev",
  "stream": false,
  "modes": ["emotional-assessment", "product-knowledge", "sales-simulation", "role-play"],
  "defaultMode": "sales-simulation",
  "scenariosUrl": "assets/chat/data/scenarios.merged.json"
}
```

**Key Decisions**:
- `workerUrl` / `apiBase`: If set, widget uses worker; if empty, uses direct fallback
- `stream`: `false` = standard fetch, `true` = SSE streaming (limited support)
- Widget automatically strips `/chat` suffix from base URL

### Worker Configuration

**File**: `wrangler.toml`

```toml
[vars]
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
PROVIDER_MODEL = "llama-3.1-70b-versatile"
MAX_OUTPUT_TOKENS = "1400"
CORS_ORIGINS = "https://example.com,https://app.example.com"

[[kv_namespaces]]
binding = "SESS"
id = "..."
```

**Secrets** (via `wrangler secret put`):
- `PROVIDER_KEY`: API key for LLM provider

**Key Decisions**:
- Worker must have valid `PROVIDER_URL`, `PROVIDER_MODEL`, `PROVIDER_KEY` to function
- `CORS_ORIGINS` must include the widget's origin
- `SESS` KV namespace is optional but recommended for state tracking

## Mode Behaviors

### sales-simulation
- **Purpose**: Coach sales reps on HCP interactions
- **Prompt**: Expects guidance + `<coach>{...}</coach>` with scores
- **Response**: Actionable feedback, scores (0-5 scale), suggested phrasing
- **FSM**: Caps responses to 5-6 sentences

### role-play
- **Purpose**: Simulate HCP responses (first-person)
- **Prompt**: HCP persona only, no coaching instructions
- **Response**: Natural dialogue from HCP perspective
- **FSM**: Caps to 4 sentences
- **Note**: Widget may post-process to enforce HCP-only voice

### product-knowledge
- **Purpose**: Factual Q&A about product/disease
- **Prompt**: Fact-based, label-aligned guidance
- **Response**: Accurate information with citations
- **Coaching**: Light (may include suggestions)

### emotional-assessment
- **Purpose**: Evaluate EI (empathy, stress)
- **Prompt**: Specialized persona interactions
- **Response**: EI scores and insights
- **Note**: May use `emitEi=true` flag for extended data

## Error Handling Strategy

### Worker Errors

| Error | Status | Response | Cause |
|-------|--------|----------|-------|
| Provider API failure | 502 | `{error: "upstream_error"}` | LLM provider down/misconfigured |
| Missing Content-Type | 415 | `{error: "unsupported_media_type"}` | Request missing `application/json` |
| Invalid plan | 422 | `{error: "invalid_plan"}` | Plan validation failed |
| No facts found | 422 | `{error: "no_facts_for_request"}` | No matching facts (if REQUIRE_FACTS=true) |
| Server error | 500 | `{error: "server_error"}` | Unexpected worker error |

### Widget Fallback Logic

```javascript
try {
  const data = await jfetch("/chat", payload);
  if (data && data.reply) {
    // Use worker response
  } else {
    // Fall back to direct model
  }
} catch (e) {
  // Worker unavailable, fall back to direct model
}
```

**Why fallback?**
- Ensures widget continues to function even if worker is down
- Graceful degradation: direct model provides basic responses
- Trade-off: lose structured coaching, but maintain conversation

## Security Measures

1. **No Secrets in Code**
   - All API keys via environment variables (`env.PROVIDER_KEY`)
   - Widget config files contain URLs only, no keys
   
2. **CORS Validation**
   - Worker validates `Origin` header against `CORS_ORIGINS` allowlist
   - Rejects requests from unauthorized origins
   
3. **Content-Type Enforcement**
   - Worker requires `application/json`
   - Prevents CSRF and other content-type attacks
   
4. **Input Sanitization**
   - Worker sanitizes LLM output (removes code blocks, limits length)
   - Widget sanitizes user input before display
   
5. **Rate Limiting**
   - Handled by Cloudflare platform (not in worker code)
   - Can be configured via Cloudflare dashboard

## State Management

### Session Tracking (Cloudflare KV)

**Purpose**: Track conversation state to prevent loops and duplicates

**Storage**:
```javascript
// Key: `state:${session}`
{
  lastNorm: "normalized text of last reply",
  fsm: { /* finite state machine data */ }
}
```

**Logic**:
- Before sending response, worker normalizes it and compares to `lastNorm`
- If identical, generates variation to prevent loops
- TTL: 12 hours (session expires)

**Note**: KV is optional; if not configured, loop detection is skipped

## Testing Strategy

### Unit Tests (`worker.test.js`)
- Tests all endpoints (health, version, debug/ei)
- Validates error handling (wrong Content-Type, invalid JSON)
- Checks CORS headers

### Contract Tests (`test-chat-contract.js`)
- Validates widget-worker integration contract
- Tests all 4 modes
- Checks request/response structure
- Verifies error codes (415, 502, etc.)

### Running Tests
```bash
npm test              # All tests
npm run test:worker   # Worker unit tests only
npm run test:contract # Contract tests only
```

## Deployment

### Local Development

1. **Start worker locally**:
   ```bash
   wrangler dev
   ```

2. **Update widget config**:
   ```json
   {
     "workerUrl": "http://localhost:8787"
   }
   ```

3. **Serve widget**:
   ```bash
   python -m http.server 8000
   # or use any static file server
   ```

### Production Deployment

1. **Deploy worker**:
   ```bash
   wrangler deploy
   ```

2. **Set secrets**:
   ```bash
   wrangler secret put PROVIDER_KEY
   ```

3. **Update widget config**:
   ```json
   {
     "workerUrl": "https://my-worker.workers.dev"
   }
   ```

4. **Deploy widget** (to GitHub Pages, Netlify, etc.)

## Troubleshooting

### Widget shows "400 Bad Request"
- **Old issue**: Worker was returning 400 for provider failures
- **Fix**: Worker now returns 502 (Bad Gateway) for upstream errors
- **Widget behavior**: Falls back to direct model automatically

### Widget shows "502 Bad Gateway"
- **Cause**: Worker can't reach LLM provider
- **Check**: `PROVIDER_URL`, `PROVIDER_KEY` in wrangler.toml/secrets
- **Widget behavior**: Falls back to direct model automatically

### Widget shows "415 Unsupported Media Type"
- **Cause**: Missing `Content-Type: application/json` header
- **Fix**: Widget should always send this header (check `jfetch` function)

### Worker not returning coach object
- **Cause**: LLM didn't include `<coach>{...}</coach>` tags
- **Fallback**: Worker generates deterministic scores
- **Check**: Prompt engineering in worker.js (lines 350-374)

### CORS errors in browser console
- **Cause**: Widget origin not in `CORS_ORIGINS`
- **Fix**: Add origin to wrangler.toml, redeploy worker

## Future Enhancements

1. **SSE Streaming**: Full support for streaming responses
2. **Advanced State Machine**: Per-mode FSM tracking
3. **Fact Versioning**: Track which facts were used in each response
4. **Analytics**: Log coaching sessions for improvement tracking
5. **Multi-Provider Support**: Fallback to secondary LLM provider

## References

- **Contract Spec**: `docs/WIDGET-WORKER-CONTRACT.md`
- **Worker Code**: `worker.js`
- **Widget Code**: `widget.js`
- **Tests**: `worker.test.js`, `test-chat-contract.js`
- **Wrangler Docs**: https://developers.cloudflare.com/workers/wrangler/
