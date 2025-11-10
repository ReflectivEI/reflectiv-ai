#!/bin/bash
echo "�� QUICK AI TEST"
echo "════════════════════════════════════════════════════════"
echo ""

echo "1. Testing worker health..."
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
echo -e "\n"

echo "2. Testing AI response..."
curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"What is PrEP?","history":[],"disease":"HIV","session":"test"}' \
  | python3 -c "
import json, sys
r = json.load(sys.stdin)
if 'reply' in r:
    print('✅ AI IS WORKING!')
    print(f'   Response: {r[\"reply\"][:200]}...')
    print(f'   Accuracy: {r.get(\"coach\",{}).get(\"scores\",{}).get(\"accuracy\")}/5')
else:
    print('❌ Error:', r.get('error'))
"

echo ""
echo "════════════════════════════════════════════════════════"
echo "Done! Your AI is ready to use at:"
echo "https://reflectivei.github.io/reflectiv-ai"
echo "════════════════════════════════════════════════════════"
