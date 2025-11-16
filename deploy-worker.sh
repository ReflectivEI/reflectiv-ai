#!/bin/bash
# Quick deployment script for Cloudflare Worker
# Usage: ./deploy-worker.sh

set -e

echo "=========================================="
echo "Cloudflare Worker Deployment Script"
echo "=========================================="
echo ""

# Check if we're in the right directory
if [ ! -f "worker.js" ]; then
    echo "❌ Error: worker.js not found. Are you in the repository root?"
    exit 1
fi

if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: wrangler.toml not found. Are you in the repository root?"
    exit 1
fi

echo "✅ Found worker.js and wrangler.toml"
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "⚠️  Wrangler not found. Installing..."
    npm install -g wrangler
fi

echo "✅ Wrangler is available"
echo ""

# Check for authentication
echo "Checking Cloudflare authentication..."
if ! wrangler whoami &> /dev/null; then
    echo "⚠️  Not authenticated with Cloudflare"
    echo ""
    echo "Options:"
    echo "1. Run: wrangler login"
    echo "2. Set CLOUDFLARE_API_TOKEN environment variable"
    echo ""
    read -p "Do you want to login now? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        wrangler login
    else
        echo "❌ Deployment cancelled. Please authenticate first."
        exit 1
    fi
fi

echo "✅ Authenticated with Cloudflare"
echo ""

# Show current state
echo "Current branch: $(git branch --show-current)"
echo "Latest commit: $(git log -1 --oneline)"
echo ""

# Confirm deployment
read -p "Deploy worker to Cloudflare? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🚀 Deploying worker..."
echo ""

# Deploy
wrangler deploy

echo ""
echo "=========================================="
echo "✅ Deployment Complete!"
echo "=========================================="
echo ""
echo "Worker URL: https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
echo ""
echo "Verify deployment:"
echo "  curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health"
echo ""
echo "Test the fix:"
echo '  curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \'
echo '    -H "Content-Type: application/json" \'
echo '    -d '\''{"messages":[{"role":"user","content":"Hello"}],"mode":"sales-coach"}'\'''
echo ""
