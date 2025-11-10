#!/bin/bash
# Fix PROVIDER_KEY secret for my-chat-agent-v2

echo "==========================================
🔑 GROQ API KEY SETUP FOR WORKER
==========================================

This script will set up your Groq API key for the Cloudflare Worker.

Please have your Groq API key ready. You can find it at:
https://console.groq.com/keys

Press Enter to continue..."
read

echo ""
echo "Please paste your Groq API key and press Enter:"
echo "(The key will be hidden for security)"
read -s GROQ_API_KEY

echo ""
echo "Setting PROVIDER_KEY secret..."

cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai

echo "$GROQ_API_KEY" | npx wrangler secret put PROVIDER_KEY --name my-chat-agent-v2

echo ""
echo "✅ Secret has been set!"
echo ""
echo "Now testing the worker..."
echo ""

sleep 2

curl -s -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{"mode":"sales-simulation","user":"What is PrEP?","history":[],"disease":"HIV","session":"test"}' \
  | python3 -m json.tool | head -40

echo ""
echo "==========================================
If you see a proper response above (not an error), your AI is working!
If you see an error, please share the output with me.
==========================================
"
