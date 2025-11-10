#!/bin/bash
echo "════════════════════════════════════════════════════════"
echo "🧠 DETAILED AI LOGIC & REASONING TESTS"
echo "════════════════════════════════════════════════════════"
echo ""

echo "✓ TEST 6: Multi-turn Medical Conversation"
RESP=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"What about renal safety?","history":[{"role":"user","content":"Descovy?"},{"role":"assistant","content":"Descovy is for PrEP"}],"disease":"HIV","session":"t6"}')
echo "$RESP" | python3 -c "import json,sys; r=json.load(sys.stdin); print('  Context aware:', len(r.get('history',[])) > 0 or 'renal' in r.get('reply','').lower()); print('  Reply:', r.get('reply','')[:180]+'...'); print('  Scores:', r.get('coach',{}).get('scores',{}))"
echo ""

echo "✓ TEST 7: Widget Message Format Compatibility"
RESP=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"What is HIV PrEP eligibility?"}],"mode":"sales-simulation","disease":"HIV"}')
echo "$RESP" | python3 -c "import json,sys; r=json.load(sys.stdin); print('  Widget format works:', 'reply' in r); print('  Has coaching:', 'coach' in r); print('  Reply preview:', r.get('reply','')[:150])"
echo ""

echo "✓ TEST 8: Fact-Based Medical Guidance"
RESP=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"Explain PrEP safety monitoring","history":[],"disease":"HIV","session":"t8"}')
echo "$RESP" | python3 -c "import json,sys; r=json.load(sys.stdin); reply=r.get('reply',''); print('  Uses fact IDs:', '[HIV-' in reply); print('  Mentions safety:', 'safety' in reply.lower() or 'renal' in reply.lower() or 'egfr' in reply.lower()); print('  Accuracy:', r.get('coach',{}).get('scores',{}).get('accuracy'), '/5')"
echo ""

echo "✓ TEST 9: Coaching Quality Metrics"
RESP=$(curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"How do I discuss Descovy with an HCP?","history":[],"disease":"HIV","session":"t9"}')
echo "$RESP" | python3 -c "import json,sys; r=json.load(sys.stdin); c=r.get('coach',{}); s=c.get('scores',{}); print('  All scores present:', len(s) >= 6); print('  Scores:', s); print('  Has worked/improve:', 'worked' in c and 'improve' in c); print('  Has phrasing:', 'phrasing' in c)"
echo ""

echo "✓ TEST 10: Full Response Structure"
curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-simulation","user":"Tell me about Descovy dosing","history":[],"disease":"HIV","session":"t10"}' \
  | python3 -m json.tool | head -45
echo ""

echo "════════════════════════════════════════════════════════"
echo "✅ ALL DETAILED TESTS COMPLETE"
echo "════════════════════════════════════════════════════════"
