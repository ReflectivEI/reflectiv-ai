# Implementation Summary: EI Debug Endpoints and Error Handling

## Changes Made

This implementation adds JSON error handling and EI (Emotional Intelligence) flag debugging to the ReflectivAI Gateway Worker.

### 1. Enhanced Error Handling for POST /chat

**Location:** `worker.js` - `postChat()` function

**Changes:**
- Wrapped the entire handler in a try/catch block
- Added Content-Type validation at the start of the function
- Returns proper JSON error responses (status 400) with structure: `{ error: "bad_request", message: "error message" }`
- Returns 415 Unsupported Media Type when Content-Type is not `application/json`
- No stack traces are included in error responses (security best practice)

**Example Error Responses:**
```json
// Wrong Content-Type
{ "error": "unsupported_media_type", "message": "Content-Type must be application/json" }

// Other errors during processing
{ "error": "bad_request", "message": "Failed to parse..." }
```

### 2. EI Flag Configuration Helper

**Location:** `worker.js` - `getEiFlag()` function

**Purpose:** Centralized function to determine if EI data should be emitted in responses.

**Checks (in order):**
1. Query parameter `emitEi` = "1" or "true"
2. Header `x-emit-ei` = "1" or "true"
3. Environment variable `EMIT_EI` or `emitEi` = "true"

**Returns:** Boolean indicating whether EI data should be included

### 3. Debug Endpoint: GET /debug/ei

**Location:** `worker.js` - `getDebugEi()` function

**Purpose:** Provides visibility into EI flag configuration for debugging.

**Response Structure:**
```json
{
  "queryFlag": false,
  "headerFlag": false,
  "envFlag": true,
  "modeAllowed": ["sales-simulation"],
  "time": "2025-11-02T21:02:28.946Z"
}
```

**Fields:**
- `queryFlag`: Whether the query parameter indicates EI should be enabled
- `headerFlag`: Whether the header indicates EI should be enabled
- `envFlag`: Whether the environment variable indicates EI should be enabled
- `modeAllowed`: Array of modes that support EI emission
- `time`: ISO timestamp of the request

**CORS:** Respects the same CORS configuration as other endpoints

**No PHI:** This endpoint does not expose any Protected Health Information

### 4. EI Data in Chat Responses

**Location:** `worker.js` - `postChat()` function (response building)

**Change:** When `getEiFlag()` returns true, the response includes an additional `_coach` field:

```json
{
  "reply": "...",
  "coach": { /* existing coach data */ },
  "plan": { "id": "..." },
  "_coach": {
    "ei": {
      "scores": {
        "accuracy": 4,
        "compliance": 4,
        "discovery": 3,
        "clarity": 4,
        "objection_handling": 3,
        "empathy": 3
      }
    }
  }
}
```

The `_coach.ei.scores` object contains the emotional intelligence scoring breakdown.

### 5. Unit Tests

**Location:** `worker.test.js`

**Test Coverage:**
- ✓ GET /debug/ei returns correct structure (200 status)
- ✓ Query parameter `emitEi=true` sets queryFlag
- ✓ Query parameter `emitEi=1` sets queryFlag
- ✓ Header `x-emit-ei=true` sets headerFlag
- ✓ Environment variable `EMIT_EI=true` sets envFlag
- ✓ POST /chat returns 415 for wrong Content-Type
- ✓ POST /chat handles invalid JSON gracefully
- ✓ Existing endpoints (health, version) still work
- ✓ 404 for unknown endpoints

**Running Tests:**
```bash
npm test
```

### 6. Documentation Updates

**Location:** `worker.js` - Header comment

Updated the endpoint list and added documentation for the new `EMIT_EI`/`emitEi` environment variable.

## Testing the Changes

### Test /debug/ei endpoint:
```javascript
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/debug/ei?emitEi=true', {
  method: 'GET'
}).then(r => r.json()).then(console.log);
```

### Test /chat with EI flag via query parameter:
```javascript
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat?emitEi=true', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'accept': 'application/json',
    'x-emit-ei': 'true'
  },
  body: JSON.stringify({
    mode: 'sales-simulation',
    stream: false,
    session_id: 'manual-test',
    site_tag: 'reflectivai',
    messages: [
      { role: 'system', content: 'coach-v2 protocol' },
      { role: 'user', content: 'start simulation' }
    ]
  })
}).then(r => r.json()).then(console.log);
```

### Test error handling with wrong Content-Type:
```javascript
fetch('https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat', {
  method: 'POST',
  headers: {
    'content-type': 'text/plain'
  },
  body: 'test'
}).then(async r => ({
  status: r.status,
  body: await r.json()
})).then(console.log);
```

## Files Modified

1. `worker.js` - Core worker implementation
   - Added `getEiFlag()` helper
   - Added `getDebugEi()` endpoint handler
   - Enhanced `postChat()` with error handling and EI data
   - Updated header documentation

## Files Added

1. `worker.test.js` - Unit tests
2. `package.json` - NPM configuration for ES modules and test script
3. `.gitignore` - Git ignore file for node_modules

## Security Considerations

- ✓ No stack traces exposed in error responses
- ✓ Content-Type validation prevents injection attacks
- ✓ /debug/ei endpoint contains no PHI or sensitive data
- ✓ CORS properly enforced on all endpoints
- ✓ EI flag can be controlled via environment variables (production setting)

## Deployment Notes

To enable EI data globally, set the environment variable in `wrangler.toml`:
```toml
[vars]
EMIT_EI = "true"
```

Or enable per-request using query parameter `?emitEi=true` or header `x-emit-ei: true`.
