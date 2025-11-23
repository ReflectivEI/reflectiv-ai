# Round-Robin API Key Rotation - Implementation Details

## Overview
The worker now uses **true round-robin rotation** to distribute API requests evenly across all configured Groq API keys.

## How It Works

### Before (Session-Based Hashing)
```javascript
const idx = hashString(session) % pool.length;
```
- Used session ID to pick a key
- Same session → same key
- Unpredictable distribution
- **Result:** One key got 3,500 calls while others got 0-132

### After (Round-Robin)
```javascript
const idx = globalThis._keyRotationIndex % availablePool.length;
globalThis._keyRotationIndex = (globalThis._keyRotationIndex + 1) % 1000000;
```
- Each request gets the **next key in sequence**
- Key 1 → Key 2 → Key 3 → Key 4 → Key 1 → ...
- Perfect distribution
- **Result:** All 4 keys will get ~25% of traffic each

## Expected Distribution

With 4 keys and 1000 requests:
- `gsk_...yX4U`: ~250 requests (25%)
- `gsk_...BlNY`: ~250 requests (25%)
- `gsk_...hZWQ`: ~250 requests (25%)
- `gsk_...jpFi`: ~250 requests (25%)

## Failover Behavior

When a key is rate-limited:
1. Request 1: Tries Key 1 → 429 rate limit → Tries Key 2 → Success
2. Request 2: Tries Key 2 → Success
3. Request 3: Tries Key 3 → Success
4. Request 4: Tries Key 4 → Success
5. Request 5: Tries Key 1 → Still rate-limited → Tries Key 2 → Success

The rotation continues normally, but rate-limited keys are automatically skipped.

## Monitoring

### Check Distribution in Groq Dashboard
After deployment, all 4 keys should show roughly equal usage:
```
Groq API Key 1:     ~250 calls (25%)
Groq API Key 2:     ~250 calls (25%)
Groq API Key 3:     ~250 calls (25%)
Groq API Key 4:     ~250 calls (25%)
```

### Worker Logs (DEBUG_MODE=true)
```json
{
  "event": "round_robin_select",
  "index": 0,
  "pool_size": 4,
  "excluded_count": 0,
  "key_prefix": "gsk_1234..."
}
```

Next request:
```json
{
  "event": "round_robin_select",
  "index": 1,
  "pool_size": 4,
  "excluded_count": 0,
  "key_prefix": "gsk_5678..."
}
```

## Benefits

### 1. Perfect Load Distribution
- No more "hot" keys getting overused
- All keys share the load equally
- Better utilization of your API quota

### 2. Better Rate Limit Handling
- If Key 1 hits rate limit, requests automatically go to Keys 2, 3, 4
- System keeps working as long as ANY key is available
- Only fails when ALL keys are rate-limited

### 3. Predictable Behavior
- Easy to understand: Key 1 → Key 2 → Key 3 → Key 4 → repeat
- Easy to debug: Logs show exact sequence
- Easy to monitor: Groq dashboard shows even distribution

## Implementation Details

### Global Counter
```javascript
if (typeof globalThis._keyRotationIndex === 'undefined') {
  globalThis._keyRotationIndex = 0;
}
```
- Uses `globalThis` to persist across requests
- Resets after 1,000,000 requests to prevent overflow
- Thread-safe in Cloudflare Workers (single-threaded execution)

### Excluded Keys Handling
```javascript
const availablePool = pool.filter(key => !excludeKeys.includes(key));
```
- Rate-limited keys are excluded from the pool
- Rotation continues with remaining keys
- If all keys excluded, falls back to trying any key (better than failing)

## Comparison with Other Strategies

| Strategy | Distribution | Stickiness | Failover |
|----------|-------------|------------|----------|
| **Round-Robin** (current) | ✅ Perfect (25% each) | ❌ No | ✅ Yes |
| Session Hash (previous) | ❌ Unpredictable | ✅ Yes | ❌ No |
| Random | ⚠️ Good (random variation) | ❌ No | ⚠️ Manual |
| Sticky with Fallback | ❌ Poor (one key gets most) | ✅ Yes | ⚠️ Manual |

## Why Round-Robin is Best Here

1. **No session affinity needed** - Widget doesn't require same key per session
2. **Rate limits are per-key** - Even distribution prevents any key from hitting limit
3. **Simple and predictable** - Easy to understand, debug, and monitor
4. **Automatic failover** - Built-in rate limit handling

## Testing

### Test Round-Robin Distribution
```bash
# Enable debug mode to see key selection
# In Cloudflare Dashboard: Add variable DEBUG_MODE = "true"

# Watch logs
npx wrangler tail my-chat-agent-v2

# Send test requests (from another terminal)
for i in {1..10}; do
  curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
    -H "Content-Type: application/json" \
    -d '{"mode":"general-knowledge","user":"test '$i'","history":[]}'
  echo ""
done
```

You should see logs cycling through key indices: 0, 1, 2, 3, 0, 1, 2, 3...

### Verify in Groq Dashboard
After 1 hour of production traffic:
1. Go to https://console.groq.com/keys
2. Check "API Calls" for each key
3. All 4 should have roughly equal counts

## Deployment

This change is backward compatible and requires no configuration changes:
```bash
npx wrangler deploy
```

The round-robin rotation will start immediately upon deployment.
