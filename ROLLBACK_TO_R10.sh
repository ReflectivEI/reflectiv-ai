#!/bin/bash
# ROLLBACK_TO_R10.sh
# Quick rollback to working r10.1 worker (no KV required)

set -e

echo "🔄 Rolling back to r10.1 worker (simpler, no KV needed)"
echo ""

# Restore r10.1
cp worker-r10.1-backup.js worker.js
cp wrangler-r10.1-backup.toml wrangler.toml

echo "✅ Files restored"
echo ""
echo "⚠️  IMPORTANT: You must deploy manually from Cloudflare dashboard"
echo ""
echo "Steps:"
echo "1. Go to: https://dash.cloudflare.com/"
echo "2. Select 'Workers & Pages'"
echo "3. Click 'my-chat-agent-v2'"
echo "4. Click 'Edit Code'"
echo "5. Copy contents of worker.js"
echo "6. Paste into editor"
echo "7. Click 'Save and Deploy'"
echo ""
echo "Or wait for automated deployment if you have CI/CD set up."
