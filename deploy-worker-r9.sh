#!/bin/bash
# deploy-worker-r9.sh
# Complete deployment script for r9 worker

set -e

echo "🚀 Cloudflare Worker R9 Deployment Script"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command -v npx &> /dev/null; then
    echo -e "${RED}❌ npx not found. Please install Node.js first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} npx found"

# Check if wrangler is accessible
if ! npx wrangler --version &> /dev/null; then
    echo -e "${RED}❌ Unable to run wrangler${NC}"
    exit 1
fi

echo -e "${GREEN}✓${NC} wrangler accessible"
echo ""

# Step 1: KV Namespace
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 1: KV Namespace Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "The r9 worker requires a KV namespace for session storage."
echo ""

read -p "Do you already have a KV namespace ID? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo ""
    echo "Creating new KV namespace..."
    echo ""
    echo -e "${YELLOW}Run this command and copy the ID:${NC}"
    echo "npx wrangler kv:namespace create \"SESS\""
    echo ""
    echo "Then update wrangler-r9.toml with the ID:"
    echo "id = \"your-namespace-id-here\""
    echo ""
    read -p "Press Enter when done..."
fi

echo -e "${GREEN}✓${NC} KV namespace configured"
echo ""

# Step 2: Secrets Configuration
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 2: Configure GROQ API Keys"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "You need at least 1 GROQ API key. You can add up to 3 for rotation."
echo "Get keys from: https://console.groq.com/keys"
echo ""

read -p "Configure GROQ_KEY_1 now? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx wrangler secret put GROQ_KEY_1 --config wrangler-r9.toml
    echo -e "${GREEN}✓${NC} GROQ_KEY_1 configured"
else
    echo -e "${YELLOW}⚠${NC}  Skipped GROQ_KEY_1 (required for deployment)"
fi

echo ""
read -p "Configure GROQ_KEY_2 (optional)? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx wrangler secret put GROQ_KEY_2 --config wrangler-r9.toml
    echo -e "${GREEN}✓${NC} GROQ_KEY_2 configured"
fi

echo ""
read -p "Configure GROQ_KEY_3 (optional)? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    npx wrangler secret put GROQ_KEY_3 --config wrangler-r9.toml
    echo -e "${GREEN}✓${NC} GROQ_KEY_3 configured"
fi

echo ""

# Step 3: Deployment Choice
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 3: Deployment Strategy"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Choose deployment option:"
echo "  1) Replace existing worker (RECOMMENDED for production)"
echo "  2) Deploy as new worker (safer for testing)"
echo "  3) Skip deployment"
echo ""

read -p "Enter choice (1-3): " -n 1 -r DEPLOY_CHOICE
echo ""
echo ""

case $DEPLOY_CHOICE in
    1)
        echo "📦 Backing up existing worker..."
        if [ -f "worker.js" ]; then
            cp worker.js worker-r10.1-backup.js
            echo -e "${GREEN}✓${NC} Backed up worker.js → worker-r10.1-backup.js"
        fi
        if [ -f "wrangler.toml" ]; then
            cp wrangler.toml wrangler-r10.1-backup.toml
            echo -e "${GREEN}✓${NC} Backed up wrangler.toml → wrangler-r10.1-backup.toml"
        fi
        
        echo ""
        echo "📦 Deploying r9 worker..."
        cp worker-r9.js worker.js
        cp wrangler-r9.toml wrangler.toml
        
        npx wrangler deploy
        
        WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
        echo ""
        echo -e "${GREEN}✓${NC} Worker deployed successfully!"
        ;;
        
    2)
        echo "📝 Edit wrangler-r9.toml and change the worker name:"
        echo "   name = \"my-chat-agent-v3\""
        echo ""
        read -p "Press Enter when ready to deploy..."
        
        npx wrangler deploy --config wrangler-r9.toml
        
        # Try to extract worker name from wrangler-r9.toml
        WORKER_NAME=$(grep "^name" wrangler-r9.toml | cut -d'"' -f2)
        WORKER_URL="https://${WORKER_NAME}.tonyabdelmalak.workers.dev"
        echo ""
        echo -e "${GREEN}✓${NC} Worker deployed as new instance!"
        ;;
        
    3)
        echo -e "${YELLOW}⚠${NC}  Deployment skipped"
        WORKER_URL="<your-worker-url>"
        ;;
        
    *)
        echo -e "${RED}❌ Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# Step 4: Testing
if [ "$DEPLOY_CHOICE" != "3" ]; then
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "Step 4: Testing Deployment"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    echo "Testing health endpoint..."
    curl -s "${WORKER_URL}/health" | jq '.' || echo "Response received (jq not installed)"
    echo ""
    
    echo "Testing version endpoint..."
    curl -s "${WORKER_URL}/version" | jq '.' || echo "Response received (jq not installed)"
    echo ""
fi

# Step 5: Frontend Update
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Step 5: Update Frontend"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Update index.html with your worker URL:"
echo ""
echo "  const BASE = '${WORKER_URL}';"
echo "  window.WORKER_URL = BASE;"
echo ""

read -p "Update index.html automatically? (y/n): " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    if [ -f "index.html" ]; then
        # Backup
        cp index.html index.html.backup
        
        # Update WORKER_URL in index.html
        sed -i.bak "s|const BASE = '.*';|const BASE = '${WORKER_URL}';|g" index.html
        
        echo -e "${GREEN}✓${NC} index.html updated (backup saved as index.html.backup)"
    else
        echo -e "${YELLOW}⚠${NC}  index.html not found in current directory"
    fi
fi

echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 Deployment Complete!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Worker URL: ${WORKER_URL}"
echo ""
echo "📝 Next Steps:"
echo "1. Test the /chat endpoint from your frontend"
echo "2. Monitor logs: npx wrangler tail"
echo "3. Check analytics in Cloudflare dashboard"
echo ""
echo "📚 Documentation:"
echo "- Integration guide: CLOUDFLARE_INTEGRATION.md"
echo "- Secrets setup: SECRETS_SETUP.md"
echo "- Quick reference: QUICK_REFERENCE.md"
echo ""
echo "🔧 Useful Commands:"
echo "  npx wrangler tail                 # View logs"
echo "  npx wrangler secret list          # List secrets"
echo "  npx wrangler kv:namespace list    # List KV namespaces"
echo ""
