# EI Schema Alignment - Testing Guide

## Overview
This document demonstrates the new EI schema alignment feature that maps deterministic EI scores to legacy frontend keys while maintaining backward compatibility.

## Feature Flag: `emitEi`
The `/chat` endpoint now supports an optional query parameter `?emitEi=true` to enable EI score emission.

### Behavior Rules
1. **With `emitEi=true` and `mode=sales-simulation`**: Full EI scores included
2. **With `emitEi=false` or missing**: No EI scores in response
3. **With `emitEi=true` but `mode!=sales-simulation`**: No EI scores in response

## Schema Mapping

### New → Legacy Mapping
```
confidence       → compliance
active_listening → discovery
rapport          → empathy
adaptability     → clarity
persistence      → accuracy
```

## Test Scenarios

### Test 1: EI Enabled (emitEi=true, sales-simulation)
```bash
curl -X POST "http://localhost:8787/chat?emitEi=true" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "How do I identify PrEP candidates?",
    "disease": "HIV",
    "persona": "Busy Community Physician",
    "goal": "Initiate PrEP discussion"
  }'
```

**Expected Response Structure:**
```json
{
  "reply": "...",
  "coach": {
    "overall": 85,
    "scores": {
      "empathy": 4,
      "discovery": 5,
      "compliance": 5,
      "clarity": 5,
      "accuracy": 5
    },
    "scores_v2": {
      "confidence": 5,
      "active_listening": 5,
      "rapport": 4,
      "adaptability": 5,
      "persistence": 5
    },
    "worked": ["..."],
    "improve": ["..."],
    "phrasing": "...",
    "feedback": "...",
    "context": {...}
  },
  "plan": {...}
}
```

### Test 2: EI Disabled (emitEi=false or missing)
```bash
curl -X POST "http://localhost:8787/chat" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-simulation",
    "user": "How do I identify PrEP candidates?",
    "disease": "HIV"
  }'
```

**Expected Response Structure:**
```json
{
  "reply": "...",
  "coach": {
    "overall": 85,
    "worked": ["..."],
    "improve": ["..."],
    "phrasing": "...",
    "feedback": "...",
    "context": {...}
  },
  "plan": {...}
}
```
*Note: No `scores` or `scores_v2` fields present*

### Test 3: EI with Role-Play Mode (should be disabled)
```bash
curl -X POST "http://localhost:8787/chat?emitEi=true" \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "role-play",
    "user": "Tell me about PrEP eligibility",
    "disease": "HIV"
  }'
```

**Expected Response Structure:**
```json
{
  "reply": "...",
  "coach": {
    "overall": 85,
    "worked": ["..."],
    "improve": ["..."],
    "context": {...}
  },
  "plan": {...}
}
```
*Note: No EI scores even though emitEi=true, because mode is not sales-simulation*

## EI Scoring Algorithm

### New Deterministic Dimensions

#### 1. Confidence (1-5)
- **Base**: 3
- **+1**: Has at least one fact citation
- **+1**: Has multiple fact citations
- **Measures**: Assertiveness and factual backing

#### 2. Active Listening (1-5)
- **Base**: 2
- **+2**: Ends with a question
- **+1**: Contains empathy signals
- **Measures**: Engagement and inquiry

#### 3. Rapport (1-5)
- **Base**: 2
- **+2**: Contains empathy phrases (e.g., "I understand", "I appreciate")
- **+1**: Optimal word count (50-150 words)
- **Measures**: Connection and tone

#### 4. Adaptability (1-5)
- **Base**: 3
- **+1**: Contains actionable suggestions
- **+1**: Ends with a question
- **Measures**: Flexibility and options

#### 5. Persistence (1-5)
- **Base**: 2
- **+2**: Has fact citations
- **+1**: Contains actionable suggestions
- **Measures**: Follow-through and commitment

### Empathy Signal Patterns
- "I understand"
- "I appreciate" / "appreciate"
- "given your"
- "thanks for"
- "I hear" / "I hear you"
- "it sounds like"
- "you mentioned"

### Actionable Patterns
- "would you"
- "could you"
- "can you"
- "consider"
- "try"
- "help"
- "start"
- "begin"

## Frontend Integration

The frontend (ReflectivAI widget) expects the legacy 5-key schema:
- `empathy`
- `discovery`
- `compliance`
- `clarity`
- `accuracy`

With this implementation, the frontend requires **no code changes** - it continues to receive the expected legacy keys while the worker internally uses the new deterministic scoring algorithm.

### Widget Usage
```javascript
// Frontend should append the flag when making requests:
fetch('/chat?emitEi=true', {
  method: 'POST',
  body: JSON.stringify({
    mode: 'sales-simulation',
    user: userMessage,
    ...
  })
})
```

## Backward Compatibility

### Old Behavior
```json
{
  "scores": {
    "accuracy": 4,
    "compliance": 4,
    "discovery": 3,
    "clarity": 4,
    "objection_handling": 3,
    "empathy": 3
  }
}
```

### New Behavior
```json
{
  "scores": {
    "empathy": 4,
    "discovery": 5,
    "compliance": 5,
    "clarity": 5,
    "accuracy": 5
  },
  "scores_v2": {
    "confidence": 5,
    "active_listening": 5,
    "rapport": 4,
    "adaptability": 5,
    "persistence": 5
  }
}
```

**Key Changes:**
1. Legacy `scores` now contains dynamically computed values (not hardcoded)
2. `scores_v2` provides the raw new dimensions for diagnostics
3. Removed `objection_handling` from legacy scores (not part of core 5 dimensions)
4. Both score sets only appear when `emitEi=true` and `mode=sales-simulation`

## Validation

To validate the implementation:

1. **Start dev server**: `wrangler dev --local`
2. **Test health**: `curl http://localhost:8787/health`
3. **Test with EI**: Use Test 1 above
4. **Test without EI**: Use Test 2 above
5. **Test mode filtering**: Use Test 3 above

Expected outcomes:
- ✅ All 5 legacy keys present when enabled
- ✅ scores_v2 shows new dimensions
- ✅ Mapping is correct (confidence→compliance, etc.)
- ✅ No scores when flag is false or mode is role-play
- ✅ Dynamic values based on reply content
