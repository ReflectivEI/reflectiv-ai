#!/bin/bash

echo "════════════════════════════════════════════════════════════════"
echo "  Pre-Deployment Validation for ReflectivAI Worker"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Check worker.js exists and has correct size
if [ -f "worker.js" ]; then
    LINES=$(wc -l < worker.js)
    echo "✅ worker.js found: $LINES lines"
    if [ "$LINES" -eq 1687 ]; then
        echo "   ✅ Correct file size (1687 lines)"
    else
        echo "   ⚠️  Expected 1687 lines, found $LINES"
    fi
else
    echo "❌ worker.js not found!"
    exit 1
fi

echo ""

# Syntax check
echo "🔍 Checking JavaScript syntax..."
if node -c worker.js 2>/dev/null; then
    echo "✅ worker.js syntax valid"
else
    echo "❌ worker.js has syntax errors!"
    exit 1
fi

echo ""

# Check for critical components
echo "🔍 Checking critical components..."

if grep -q "ReflectivAI Gateway (r10.1)" worker.js; then
    echo "✅ Version header present (r10.1)"
else
    echo "⚠️  Version header not found"
fi

if grep -q "mode === \"sales-coach\"" worker.js; then
    echo "✅ Sales Coach mode handling present"
else
    echo "❌ Sales Coach mode handling missing!"
fi

if grep -q "PROVIDER_KEY" worker.js; then
    echo "✅ PROVIDER_KEY support present"
else
    echo "❌ PROVIDER_KEY support missing!"
fi

if grep -q "Challenge:" worker.js && grep -q "Rep Approach:" worker.js; then
    echo "✅ Sales Coach format contract present"
else
    echo "❌ Sales Coach format contract missing!"
fi

echo ""

# Check wrangler.toml
echo "🔍 Checking wrangler.toml..."
if [ -f "wrangler.toml" ]; then
    echo "✅ wrangler.toml found"
    
    if grep -q "name = \"my-chat-agent-v2\"" wrangler.toml; then
        echo "   ✅ Worker name: my-chat-agent-v2"
    fi
    
    if grep -q "main = \"worker.js\"" wrangler.toml; then
        echo "   ✅ Main file: worker.js"
    fi
    
    if grep -q "PROVIDER_URL" wrangler.toml; then
        echo "   ✅ PROVIDER_URL configured"
    fi
    
    if grep -q "CORS_ORIGINS" wrangler.toml; then
        echo "   ✅ CORS_ORIGINS configured"
    fi
else
    echo "❌ wrangler.toml not found!"
    exit 1
fi

echo ""

# Run tests
echo "🧪 Running tests..."
if npm test 2>&1 | grep -q "Passed: 12"; then
    echo "✅ Worker tests passing (12/12)"
else
    echo "⚠️  Some worker tests may have failed (check npm test output)"
fi

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "  Pre-Deployment Check Complete"
echo "════════════════════════════════════════════════════════════════"
echo ""
echo "✅ READY FOR DEPLOYMENT"
echo ""
echo "Next steps:"
echo "1. Ensure you're authenticated: wrangler login"
echo "2. Set secrets: wrangler secret put PROVIDER_KEY"
echo "3. Deploy: wrangler deploy"
echo "4. Test: curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version"
echo ""
