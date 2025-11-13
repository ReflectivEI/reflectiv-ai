#!/bin/bash
# Get a working API key from secrets
KEY=$(npx wrangler secret get PROVIDER_KEY --name my-chat-agent-v2 2>&1 | grep -v "Debugger\|wrangler" | tr -d '\n')

if [ -z "$KEY" ]; then
  echo "Failed to get API key"
  exit 1
fi

echo "Testing Groq API directly..."
curl -s -X POST "https://api.groq.com/openai/v1/chat/completions" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "llama-3.1-8b-instant",
    "messages": [{"role": "user", "content": "Say hello"}],
    "temperature": 0.5,
    "max_tokens": 50
  }' | jq .
