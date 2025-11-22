#!/bin/bash

# ReflectivAI Local Test Setup
# This script starts the local Cloudflare Worker for testing

echo "🔬 ReflectivAI Local Test Environment"
echo "====================================="
echo ""

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Wrangler CLI not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Check if secrets are set up
echo "📋 Checking secrets configuration..."
if ! wrangler secret list &> /dev/null; then
    echo "❌ Wrangler not authenticated. Please run:"
    echo "   wrangler auth login"
    exit 1
fi

SECRETS=$(wrangler secret list 2>/dev/null | grep -c "PROVIDER_KEY")
if [ "$SECRETS" -eq 0 ]; then
    echo "❌ No PROVIDER_KEY secrets found. Please set them up:"
    echo "   wrangler secret put PROVIDER_KEY"
    echo "   wrangler secret put PROVIDER_KEY_2 (optional)"
    echo "   wrangler secret put PROVIDER_KEY_3 (optional)"
    exit 1
fi

echo "✅ Secrets configured ($SECRETS found)"
echo ""

# Start the local server
echo "🚀 Starting local Cloudflare Worker..."
echo "📍 Local endpoint: http://localhost:8787"
echo "🌐 Test interface: file://$(pwd)/local-test-interface.html"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

wrangler dev --port 8787