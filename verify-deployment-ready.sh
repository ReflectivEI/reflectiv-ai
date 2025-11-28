#!/bin/bash
# Verify that all files are deployment-ready

echo "🔍 Verifying Widget Code is Deployment-Ready..."
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

errors=0
warnings=0

# Check 1: worker.js exists and has health endpoint
echo "📄 Checking worker.js..."
if [ -f "worker.js" ]; then
    if grep -q '"/health"' worker.js; then
        echo -e "${GREEN}✓${NC} worker.js has /health endpoint"
    else
        echo -e "${RED}✗${NC} worker.js missing /health endpoint"
        errors=$((errors + 1))
    fi
    
    if grep -q '"/chat"' worker.js; then
        echo -e "${GREEN}✓${NC} worker.js has /chat endpoint"
    else
        echo -e "${RED}✗${NC} worker.js missing /chat endpoint"
        errors=$((errors + 1))
    fi
    
    if grep -q 'PROVIDER_KEY' worker.js; then
        echo -e "${GREEN}✓${NC} worker.js checks for PROVIDER_KEY"
    else
        echo -e "${YELLOW}⚠${NC} worker.js may not require PROVIDER_KEY"
        warnings=$((warnings + 1))
    fi
else
    echo -e "${RED}✗${NC} worker.js not found"
    errors=$((errors + 1))
fi
echo ""

# Check 2: wrangler.toml configuration
echo "⚙️  Checking wrangler.toml..."
if [ -f "wrangler.toml" ]; then
    if grep -q 'name = "my-chat-agent-v2"' wrangler.toml; then
        echo -e "${GREEN}✓${NC} Worker name configured correctly"
    else
        echo -e "${RED}✗${NC} Worker name mismatch in wrangler.toml"
        errors=$((errors + 1))
    fi
    
    if grep -q 'account_id' wrangler.toml; then
        echo -e "${GREEN}✓${NC} Cloudflare account_id configured"
    else
        echo -e "${RED}✗${NC} account_id missing in wrangler.toml"
        errors=$((errors + 1))
    fi
    
    if grep -q 'main = "worker.js"' wrangler.toml; then
        echo -e "${GREEN}✓${NC} Main file points to worker.js"
    else
        echo -e "${YELLOW}⚠${NC} Main file may not be worker.js"
        warnings=$((warnings + 1))
    fi
else
    echo -e "${RED}✗${NC} wrangler.toml not found"
    errors=$((errors + 1))
fi
echo ""

# Check 3: widget.js frontend
echo "🎨 Checking widget.js..."
if [ -f "widget.js" ]; then
    if grep -q 'window.WORKER_URL' widget.js; then
        echo -e "${GREEN}✓${NC} widget.js uses window.WORKER_URL"
    else
        echo -e "${YELLOW}⚠${NC} widget.js may not use window.WORKER_URL"
        warnings=$((warnings + 1))
    fi
    
    if grep -q '/chat' widget.js; then
        echo -e "${GREEN}✓${NC} widget.js has chat endpoint calls"
    else
        echo -e "${RED}✗${NC} widget.js missing chat endpoint"
        errors=$((errors + 1))
    fi
else
    echo -e "${RED}✗${NC} widget.js not found"
    errors=$((errors + 1))
fi
echo ""

# Check 4: index.html configuration
echo "🌐 Checking index.html..."
if [ -f "index.html" ]; then
    if grep -q 'my-chat-agent-v2.tonyabdelmalak.workers.dev' index.html; then
        echo -e "${GREEN}✓${NC} index.html has correct worker URL"
    else
        echo -e "${RED}✗${NC} index.html worker URL mismatch"
        errors=$((errors + 1))
    fi
    
    if grep -q 'window.WORKER_URL' index.html; then
        echo -e "${GREEN}✓${NC} index.html sets window.WORKER_URL"
    else
        echo -e "${RED}✗${NC} index.html missing window.WORKER_URL"
        errors=$((errors + 1))
    fi
else
    echo -e "${RED}✗${NC} index.html not found"
    errors=$((errors + 1))
fi
echo ""

# Check 5: GitHub Actions workflow
echo "🔄 Checking GitHub Actions workflow..."
if [ -f ".github/workflows/cloudflare-worker.yml" ]; then
    if grep -q 'npx wrangler deploy' .github/workflows/cloudflare-worker.yml; then
        echo -e "${GREEN}✓${NC} Auto-deployment workflow configured"
    else
        echo -e "${YELLOW}⚠${NC} Workflow may not deploy worker"
        warnings=$((warnings + 1))
    fi
    
    if grep -q 'CLOUDFLARE_API_TOKEN' .github/workflows/cloudflare-worker.yml; then
        echo -e "${GREEN}✓${NC} Workflow uses CLOUDFLARE_API_TOKEN secret"
    else
        echo -e "${YELLOW}⚠${NC} Workflow missing CLOUDFLARE_API_TOKEN"
        warnings=$((warnings + 1))
    fi
else
    echo -e "${YELLOW}⚠${NC} No auto-deployment workflow found"
    warnings=$((warnings + 1))
fi
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 Verification Summary"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $errors -eq 0 ] && [ $warnings -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed!${NC}"
    echo ""
    echo "Your code is deployment-ready. Next steps:"
    echo "1. Run: npx wrangler login"
    echo "2. Run: npx wrangler deploy"
    echo "3. Run: npx wrangler secret put PROVIDER_KEY"
    echo "4. Test: curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health"
    exit 0
elif [ $errors -eq 0 ]; then
    echo -e "${YELLOW}⚠️  ${warnings} warning(s) found${NC}"
    echo ""
    echo "Your code is mostly ready. Review warnings above."
    echo "You can still proceed with deployment:"
    echo "1. Run: npx wrangler login"
    echo "2. Run: npx wrangler deploy"
    exit 0
else
    echo -e "${RED}❌ ${errors} error(s) found${NC}"
    if [ $warnings -gt 0 ]; then
        echo -e "${YELLOW}⚠️  ${warnings} warning(s) found${NC}"
    fi
    echo ""
    echo "Fix the errors above before deploying."
    exit 1
fi
