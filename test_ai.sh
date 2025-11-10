#!/bin/bash

echo "════════════════════════════════════════════════════════"
echo "🧪 COMPREHENSIVE AI WORKER TESTS"
echo "════════════════════════════════════════════════════════"
echo ""

echo "✓ TEST 1: Health Check"
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
echo -e "\n"

echo "✓ TEST 2: Version"
curl -s https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
echo -e "\n"

echo "✓ TEST 3: CORS Headers"
curl -s -I -X OPTIONS https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat -H "Origin: https://reflectivei.github.io" 2>&1 | grep -i access-control | head -4
echo ""

echo "✓ TEST 4: AI Response"
curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"What is PrEP?","history":[],"disease":"HIV","session":"t1"}' \
  | python3 -c "import json,sys; r=json.load(sys.stdin); print('Reply:', r.get('reply','')[:200]); print('Scores:', r.get('coach',{}).get('scores',{}))"
echo ""

echo "✓ TEST 5: Plan Generation"
curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/plan \
  -H "Content-Type: application/json" \
  -d '{"disease":"HIV"}' \
  | python3 -c "import json,sys; p=json.load(sys.stdin); print('Plan ID:', p.get('planId')); print('Facts:', len(p.get('facts',[])))"
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ ALL TESTS COMPLETE"
echo "════════════════════════════════════════════════════════"
