# Widget-Worker Contract Documentation

## Overview

This document defines the contract between the ReflectivAI chat widget (`widget.js`) and the Cloudflare Worker backend (`worker.js`).

## Architecture Decision

**Primary Path**: Widget → Cloudflare Worker → LLM Provider → Widget

**Fallback Path**: Widget → Direct Model Call (when worker is unavailable)

The widget should attempt to use the Cloudflare Worker first, as it provides:
- Centralized prompt engineering and fact management
- Deterministic scoring fallbacks
- Session state management (via KV storage)
- CORS and security handling

## Endpoints

### POST /chat

Primary endpoint for chat interactions across all modes.

#### Request Format

```json
{
  "mode": "sales-simulation" | "role-play" | "product-knowledge" | "emotional-assessment",
  "user": "User's message text",
  "history": [
    { "role": "user" | "assistant", "content": "message text" }
  ],
  "disease": "Disease/therapeutic area (e.g., 'HIV')",
  "persona": "HCP persona key (e.g., 'difficult', 'engaged', 'indifferent')",
  "goal": "Session goal description",
  "session": "Session identifier (format: 'web-<random>' or custom)",
  
  // Optional fields
  "plan": { /* pre-computed plan object */ },
  "planId": "existing-plan-id"
}
```

**Field Descriptions:**

- `mode` (required): Determines the coaching style and response format
- `user` (required): The user's current message
- `history` (optional): Previous conversation messages (last 18 used)
- `disease` (optional): Filters facts and tailors prompts
- `persona` (optional): Influences HCP simulation behavior
- `goal` (optional): Used in prompt construction
- `session` (optional): Enables state tracking; defaults to "anon"
- `plan` / `planId` (optional): Reuse existing plan; otherwise auto-generated

#### Response Format (Success - 200 OK)

```json
{
  "reply": "Assistant's response text",
  "coach": {
    "overall": 85,
    "scores": {
      "accuracy": 4,
      "empathy": 3,
      "clarity": 5,
      "compliance": 4,
      "discovery": 3,
      "objection_handling": 4
    },
    "worked": ["Strength 1", "Strength 2"],
    "improve": ["Improvement 1", "Improvement 2"],
    "phrasing": "Suggested phrasing example",
    "feedback": "Overall feedback text",
    "context": {
      "rep_question": "User's question",
      "hcp_reply": "HCP's response"
    }
  },
  "plan": {
    "id": "plan-identifier"
  }
}
```

**Field Descriptions:**

- `reply` (string, required): The assistant's response text
- `coach` (object, optional): Coaching feedback (null for role-play mode typically)
  - `overall` (number): 0-100 aggregate score
  - `scores` (object): Individual dimension scores (0-5 scale)
  - `worked` (array): What the user did well
  - `improve` (array): Suggestions for improvement
  - `phrasing` (string): Example of better phrasing
  - `feedback` (string): Overall feedback summary
  - `context` (object): Conversation context for reference
- `plan` (object, optional): Reference to the plan used

#### Error Responses

**502 Bad Gateway** - Provider/upstream API failure:
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

**500 Internal Server Error** - Unexpected server error:
```json
{
  "error": "server_error",
  "detail": "Error description"
}
```

## Configuration

### Widget Configuration (`config.json` or `assets/chat/config.json`)

```json
{
  "apiBase": "https://my-worker.workers.dev",
  "workerUrl": "https://my-worker.workers.dev",
  "stream": false,
  "modes": ["emotional-assessment", "product-knowledge", "sales-simulation", "role-play"],
  "defaultMode": "sales-simulation"
}
```

**Key Fields:**
- `apiBase` / `workerUrl`: Worker base URL (widget strips `/chat` if present)
- `stream`: Set to `false` for standard fetch; `true` for SSE (not yet fully supported)
- `modes`: Allowed modes for the widget
- `defaultMode`: Initial mode on widget load

### Worker Configuration (`wrangler.toml`)

```toml
[vars]
PROVIDER_URL = "https://api.groq.com/openai/v1/chat/completions"
PROVIDER_MODEL = "llama-3.1-70b-versatile"
MAX_OUTPUT_TOKENS = "1400"
CORS_ORIGINS = "https://example.com,https://app.example.com"
```

**Secrets (via wrangler secret put):**
- `PROVIDER_KEY`: Bearer token for the LLM provider API

## Mode Behaviors

### sales-simulation
- Returns coaching feedback with scores
- Includes `<coach>{...}</coach>` tags in LLM response (extracted by worker)
- Provides actionable guidance and suggested phrasing

### role-play  
- HCP persona simulation (first-person only)
- No coaching feedback (coach object may be null)
- Focused on realistic dialogue

### product-knowledge
- Factual Q&A about product/disease
- May include light coaching on messaging
- Emphasizes accuracy and compliance

### emotional-assessment
- EI (Emotional Intelligence) evaluation
- Analyzes empathy, stress levels
- Specialized persona interactions

## Widget Decision Tree

```
1. Is workerUrl/apiBase configured?
   NO → Use direct model fallback
   YES → Continue to 2

2. POST to {workerUrl}/chat with payload
   SUCCESS (200) → Parse response.reply and response.coach
   FAILURE (4xx/5xx) → Log error, try direct fallback

3. Direct fallback: callModel(messages)
   - Constructs messages with system prompt
   - Calls model directly (if apiBase is model endpoint)
   - Returns raw text (no structured coach object)
```

## Security Guidelines

1. **No secrets in code**: All API keys via environment variables or Wrangler secrets
2. **CORS**: Worker validates Origin header against CORS_ORIGINS allowlist
3. **Content-Type validation**: Worker requires `application/json`
4. **Input sanitization**: Worker sanitizes LLM output to remove code blocks, headers
5. **Rate limiting**: Implemented via Cloudflare (not in worker code)

## Testing the Contract

Run contract tests:
```bash
npm test
```

Manual test with curl:
```bash
curl -X POST https://my-worker.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://myapp.com" \
  -d '{
    "mode": "sales-simulation",
    "user": "How do I explain PrEP eligibility?",
    "history": [],
    "disease": "HIV",
    "persona": "engaged",
    "goal": "Build confidence",
    "session": "test-123"
  }'
```

Expected response includes `reply` and `coach` fields.

## Changelog

- **2025-01-08**: Initial contract documentation created
- Contract validated against widget.js (lines 2245-2253) and worker.js (lines 326-465)
