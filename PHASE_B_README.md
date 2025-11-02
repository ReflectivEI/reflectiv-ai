# Phase B: EI Payload Implementation

This document describes the Phase B implementation for emitting deterministic Emotional Intelligence (EI) payloads in sales-simulation mode.

## Overview

Phase B adds EI scoring capabilities to the ReflectivAI Gateway, providing insights into emotional intelligence dimensions of sales conversations.

## Architecture

The codebase has been refactored from a monolithic `worker.js` to a modular TypeScript structure:

```
src/
├── worker.ts           # Main entry point
├── types.ts            # TypeScript type definitions
├── config.ts           # Configuration management (emitEi flag)
├── helpers.ts          # Common utilities
├── data.ts             # Static data (facts, FSM)
├── session.ts          # Session state management
├── provider.ts         # LLM provider integration
├── metrics.ts          # Metrics collection
├── schema/
│   └── coach.json      # JSON schema for coach payload with EI
├── ei/
│   └── eiRules.ts      # Deterministic EI scoring heuristics
├── utils/
│   └── redact.ts       # PHI/PII redaction utilities
└── routes/
    ├── facts.ts        # /facts endpoint
    ├── plan.ts         # /plan endpoint
    └── chat.ts         # /chat endpoint (with EI support)
```

## Features

### 1. Feature Flag: `emitEi`

The `emitEi` flag controls whether EI payloads are computed and attached to responses.

**Default**: `false`

**Activation methods**:
- Query parameter: `?emitEi=true`
- Header: `X-Emit-EI: true`

**Implementation**: See `src/config.ts`

### 2. EI Schema

The EI payload is defined in `src/schema/coach.json` and includes:

```json
{
  "ei": {
    "overall": 0-100,
    "scores": {
      "confidence": 0-5,
      "active_listening": 0-5,
      "rapport": 0-5,
      "adaptability": 0-5,
      "persistence": 0-5
    },
    "insights": ["..."],
    "recommendations": ["..."]
  }
}
```

### 3. Deterministic EI Computation

EI scores are computed using heuristic analysis of conversation patterns:

**Confidence**: Based on fact references, assertive language, and hedging patterns
**Active Listening**: Based on acknowledgment and reflection of user concerns
**Rapport**: Based on empathetic and collaborative language
**Adaptability**: Based on question usage and conditional language
**Persistence**: Based on follow-up questions and action-oriented language

**Implementation**: See `src/ei/eiRules.ts`

### 4. JSON and SSE Support

The `/chat` endpoint supports both JSON and Server-Sent Events (SSE):

**JSON Response** (default):
```bash
curl -X POST https://worker.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"user": "...", "mode": "sales-simulation"}' \
  ?emitEi=true
```

**SSE Response**:
```bash
curl -X POST https://worker.dev/chat \
  -H "Accept: text/event-stream" \
  -H "Content-Type: application/json" \
  -d '{"user": "...", "mode": "sales-simulation"}' \
  ?emitEi=true
```

SSE events:
- `coach.partial`: Delta updates during processing
- `coach.final`: Complete response with EI payload

**Implementation**: See `src/routes/chat.ts`

### 5. Metrics

Basic metrics are collected without logging PHI/PII:

**Counters**:
- `chat_requests_total`
- `chat_requests_sales-simulation`
- `chat_requests_with_ei`
- `ei_computations_total`
- `provider_calls_success`/`provider_calls_failure`

**Histograms**:
- `chat_request_duration_ms`
- `ei_score`
- `ei_computation_duration_ms`
- `provider_call_duration_ms`

**Endpoint**: `GET /metrics`

**Implementation**: See `src/metrics.ts`

### 6. PHI/PII Protection

All logging utilities redact sensitive information:
- Email addresses → `[EMAIL]`
- Phone numbers → `[PHONE]`
- SSN patterns → `[SSN]`
- Date patterns → `[DATE]`

**Implementation**: See `src/utils/redact.ts`

## API Examples

### Enable EI via Query Parameter

```bash
curl -X POST https://worker.dev/chat?emitEi=true \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "Tell me about PrEP eligibility",
    "disease": "HIV",
    "persona": "Primary Care Physician",
    "goal": "Educate on PrEP"
  }'
```

### Enable EI via Header

```bash
curl -X POST https://worker.dev/chat \
  -H "Content-Type: application/json" \
  -H "X-Emit-EI: true" \
  -d '{
    "mode": "sales-simulation",
    "user": "What are the safety considerations?",
    "disease": "HIV"
  }'
```

### Response with EI Payload

```json
{
  "reply": "For PrEP, assess renal function...",
  "coach": {
    "overall": 85,
    "scores": {
      "accuracy": 4,
      "compliance": 4,
      "discovery": 4,
      "clarity": 4,
      "objection_handling": 3,
      "empathy": 4
    },
    "worked": ["Tied guidance to facts"],
    "improve": ["End with one specific discovery question"],
    "phrasing": "Would confirming eGFR help?",
    "feedback": "Stay concise...",
    "context": {
      "rep_question": "What are the safety considerations?",
      "hcp_reply": "For PrEP, assess renal function..."
    },
    "ei": {
      "overall": 78,
      "scores": {
        "confidence": 4.2,
        "active_listening": 3.8,
        "rapport": 4.0,
        "adaptability": 3.5,
        "persistence": 3.7
      },
      "insights": [
        "Strong knowledge-based confidence demonstrated",
        "Empathetic and collaborative tone maintained"
      ],
      "recommendations": [
        "End with a discovery question to show flexibility"
      ]
    }
  },
  "plan": {
    "id": "abc123..."
  }
}
```

## Build and Deploy

### Local Development

```bash
# Install dependencies
npm install

# Type check (optional - wrangler does this automatically)
npm run type-check

# Local development (wrangler bundles TypeScript on-the-fly)
npm run dev
```

### Deploy to Cloudflare

```bash
# Wrangler handles TypeScript compilation and bundling automatically
npm run deploy
```

## Testing

The EI computation is deterministic and reproducible. Test cases:

1. **High confidence**: Reply with multiple fact references and assertive language
2. **High active listening**: Reply that acknowledges and references user's specific concerns
3. **High rapport**: Reply with empathetic language ("understand", "appreciate")
4. **High adaptability**: Reply ending with a discovery question
5. **High persistence**: Reply with specific next steps and timeframes

## Integration Notes

### Frontend Integration

To request EI payloads from the frontend:

```javascript
// Add query parameter
const response = await fetch('/chat?emitEi=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: '...', mode: 'sales-simulation' })
});

// Or add header
const response = await fetch('/chat', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'X-Emit-EI': 'true'
  },
  body: JSON.stringify({ user: '...', mode: 'sales-simulation' })
});

const data = await response.json();
if (data.coach?.ei) {
  console.log('EI Overall:', data.coach.ei.overall);
  console.log('EI Scores:', data.coach.ei.scores);
}
```

### SSE Integration

```javascript
const eventSource = new EventSource('/chat?emitEi=true', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ user: '...', mode: 'sales-simulation' })
});

eventSource.addEventListener('coach.partial', (event) => {
  const data = JSON.parse(event.data);
  console.log('Progress:', data.progress);
});

eventSource.addEventListener('coach.final', (event) => {
  const data = JSON.parse(event.data);
  console.log('Final reply:', data.reply);
  console.log('EI:', data.coach?.ei);
  eventSource.close();
});
```

## Backward Compatibility

- When `emitEi=false` (default), the `ei` field is NOT included in the response
- Existing clients will continue to work without changes
- The `/facts`, `/plan`, `/health`, `/version` endpoints are unchanged
- The coach payload structure is extended but backward compatible

## Security Considerations

1. **No PHI/PII in logs**: All text is redacted before logging
2. **No PHI/PII in metrics**: Only aggregate counts and durations are tracked
3. **Feature flag control**: EI computation can be disabled per-request
4. **Schema validation**: Coach and EI payloads are validated before sending

## Performance

- EI computation adds ~5-15ms to response time
- Deterministic algorithm (no additional LLM calls)
- Metrics collection has minimal overhead (<1ms)
- SSE streaming allows progressive rendering

## Future Enhancements

Potential improvements for future phases:

1. **ML-based EI**: Train models on conversation data for more nuanced scoring
2. **Real-time EI**: Stream EI scores as conversation progresses
3. **EI trends**: Track EI metrics over multiple conversations
4. **Custom EI dimensions**: Allow configuration of EI scoring criteria
5. **EI coaching**: Provide real-time suggestions based on EI analysis
