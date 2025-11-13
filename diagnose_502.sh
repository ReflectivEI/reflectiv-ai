#!/usr/bin/env bash
# Quick diagnosis script for 502 debugging

echo "=== Worker Health Check ==="
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health | jq . || echo "Health check failed"

echo -e "\n=== Worker Version ==="
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version | jq .

echo -e "\n=== Test Chat Endpoint ==="
curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"Quick test"}],"session":"diag-'$(date +%s)'"}' \
  | jq -r '.reply | length' | awk '{print "Reply length: " $1 " chars"}'

echo -e "\n=== CORS Preflight Test ==="
curl -I -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Origin: https://reflectivei.github.io" \
  -H "Access-Control-Request-Method: POST" \
  | grep -i "access-control"

echo -e "\n=== Recent Worker Logs (last 20 lines) ==="
tail -20 tail_logs.txt | grep -v "tlsClient" | grep -v "colo\|asn\|country" || echo "(no recent logs)"

echo -e "\n=== Diagnosis ==="
echo "If all above tests pass but browser shows 502:"
echo "1. Clear browser cache (Cmd+Shift+R won't clear service workers)"
echo "2. DevTools → Application → Service Workers → Unregister all"
echo "3. DevTools → Application → Storage → Clear site data"
echo "4. Close/reopen browser tab"
echo "5. Try incognito mode"
echo "6. Check Cloudflare status: https://www.cloudflarestatus.com/"
