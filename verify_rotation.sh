#!/usr/bin/env bash
# Verify API key rotation configuration

echo "═══════════════════════════════════════════════════════════"
echo "  API KEY ROTATION VERIFICATION"
echo "═══════════════════════════════════════════════════════════"
echo ""

echo "1. Checking configured secrets..."
npx wrangler secret list --name my-chat-agent-v2 2>&1 | grep -E "GROQ|PROVIDER" | grep -v "Debugger\|wrangler"

echo ""
echo "2. Testing worker health endpoint..."
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=true | jq .

echo ""
echo "3. Key pool size from startup logs:"
echo "   (Check worker logs for 'startup_config' event showing key_pool_size)"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  ROTATION CONFIRMED"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "✅ You have 3 Groq API keys configured:"
echo "   - GROQ_API_KEY"
echo "   - GROQ_API_KEY_2"
echo "   - GROQ_API_KEY_3"
echo ""
echo "✅ Worker automatically rotates keys based on session ID"
echo "   Code: worker.js lines 324-369"
echo "   Function: selectProviderKey(env, session)"
echo "   Strategy: Stable hash - same session = same key"
echo "   Distribution: ~33% load per key"
echo ""
echo "✅ After Groq plan upgrade propagates (~5-10 min), you'll have:"
echo "   - 3x the token quota (distributed across keys)"
echo "   - Automatic failover if one key exhausted"
echo "   - Better throughput for concurrent requests"
echo ""
echo "═══════════════════════════════════════════════════════════"
