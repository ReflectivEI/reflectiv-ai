#!/bin/bash
# setup-secrets.sh
# Script to configure Cloudflare Worker secrets for ReflectivAI

set -e

echo "🔐 ReflectivAI Worker - Secret Configuration"
echo "============================================="
echo ""

# Check if wrangler is available
if ! command -v wrangler &> /dev/null && ! command -v npx &> /dev/null; then
    echo "❌ Error: wrangler not found. Please install it first:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Use wrangler command (either global or via npx)
WRANGLER_CMD="wrangler"
if ! command -v wrangler &> /dev/null; then
    WRANGLER_CMD="npx wrangler"
fi

echo "📋 Required Secrets for ReflectivAI Worker:"
echo ""
echo "1. PROVIDER_KEY - Groq API key (required)"
echo "   Format: gsk_..."
echo "   Purpose: Authentication for AI model provider"
echo ""

# Function to set a secret
set_secret() {
    local secret_name=$1
    local description=$2
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Setting: $secret_name"
    echo "Description: $description"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    $WRANGLER_CMD secret put "$secret_name"
    
    if [ $? -eq 0 ]; then
        echo "✅ $secret_name configured successfully"
    else
        echo "❌ Failed to configure $secret_name"
        return 1
    fi
    echo ""
}

# Main execution
echo "🚀 Starting secret configuration..."
echo ""

# Check if user wants to proceed
read -p "Configure PROVIDER_KEY now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    set_secret "PROVIDER_KEY" "Groq API key for AI model access"
else
    echo "⏭️  Skipped PROVIDER_KEY configuration"
    echo ""
    echo "You can configure it manually later with:"
    echo "  $WRANGLER_CMD secret put PROVIDER_KEY"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Secret configuration complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Next Steps:"
echo "1. Verify secrets are set: $WRANGLER_CMD secret list"
echo "2. Deploy your worker: $WRANGLER_CMD deploy"
echo "3. Test the deployment: npm test"
echo ""
