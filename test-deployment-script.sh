#!/bin/bash
# Test script to verify deploy-with-verification.sh logic
# This tests the script functions without requiring actual Cloudflare credentials

set -e

echo "Testing deploy-with-verification.sh logic..."
echo ""

# Test 1: Check script exists and is executable
echo "Test 1: Script file checks..."
if [ -f "deploy-with-verification.sh" ]; then
    echo "✅ deploy-with-verification.sh exists"
else
    echo "❌ deploy-with-verification.sh not found"
    exit 1
fi

if [ -x "deploy-with-verification.sh" ]; then
    echo "✅ deploy-with-verification.sh is executable"
else
    echo "❌ deploy-with-verification.sh is not executable"
    exit 1
fi

# Test 2: Syntax check
echo ""
echo "Test 2: Bash syntax validation..."
if bash -n deploy-with-verification.sh; then
    echo "✅ Script syntax is valid"
else
    echo "❌ Script has syntax errors"
    exit 1
fi

# Test 3: Check account ID consistency
echo ""
echo "Test 3: Account ID consistency..."
EXPECTED_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

# Check wrangler.toml
TOML_ACCOUNT_ID=$(grep -E '^account_id' wrangler.toml | cut -d'=' -f2 | tr -d ' "')
if [ "$TOML_ACCOUNT_ID" = "$EXPECTED_ACCOUNT_ID" ]; then
    echo "✅ wrangler.toml has correct account_id"
else
    echo "❌ wrangler.toml account_id mismatch: $TOML_ACCOUNT_ID"
    exit 1
fi

# Check script contains correct account ID
if grep -q "$EXPECTED_ACCOUNT_ID" deploy-with-verification.sh; then
    echo "✅ deploy-with-verification.sh contains correct account_id"
else
    echo "❌ deploy-with-verification.sh missing correct account_id"
    exit 1
fi

# Test 4: Check for required files
echo ""
echo "Test 4: Required files check..."
required_files=(
    "worker.js"
    "wrangler.toml"
    "real_test.js"
    "package.json"
)

for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        echo "✅ $file exists"
    else
        echo "❌ $file missing"
        exit 1
    fi
done

# Test 5: Check documentation exists
echo ""
echo "Test 5: Documentation check..."
if [ -f "CLOUDFLARE_TOKEN_SETUP_GUIDE.md" ]; then
    echo "✅ CLOUDFLARE_TOKEN_SETUP_GUIDE.md exists"
else
    echo "❌ CLOUDFLARE_TOKEN_SETUP_GUIDE.md missing"
    exit 1
fi

if [ -f "DEPLOYMENT_README.md" ]; then
    echo "✅ DEPLOYMENT_README.md exists"
else
    echo "❌ DEPLOYMENT_README.md missing"
    exit 1
fi

# Test 6: Check script contains all required functions
echo ""
echo "Test 6: Script functions check..."
required_functions=(
    "verify_token"
    "check_wrangler_config"
    "deploy_worker"
    "run_phase3_tests"
    "trigger_remediation_protocol"
    "generate_final_report"
)

for func in "${required_functions[@]}"; do
    if grep -q "^${func}()" deploy-with-verification.sh; then
        echo "✅ Function $func exists"
    else
        echo "❌ Function $func missing"
        exit 1
    fi
done

# Test 7: Check remediation protocol components
echo ""
echo "Test 7: Remediation protocol components..."
remediation_sections=(
    "(A) DIAGNOSIS"
    "(B) NEW TOKEN CREATION GUIDE"
    "(C) TOKEN TEMPLATE"
    "(D) VERIFICATION COMMANDS"
    "(E) WAITING FOR NEW TOKEN"
)

for section in "${remediation_sections[@]}"; do
    if grep -q "$section" deploy-with-verification.sh; then
        echo "✅ Section '$section' present"
    else
        echo "❌ Section '$section' missing"
        exit 1
    fi
done

# Test 8: Check real_test.js modes
echo ""
echo "Test 8: Test modes verification..."
required_modes=(
    "sales-coach"
    "emotional-assessment"
    "product-knowledge"
    "role-play"
    "general-knowledge"
)

for mode in "${required_modes[@]}"; do
    if grep -q "$mode" real_test.js; then
        echo "✅ Mode '$mode' tested in real_test.js"
    else
        echo "❌ Mode '$mode' missing from real_test.js"
        exit 1
    fi
done

# Test 9: Check security - no token leakage patterns
echo ""
echo "Test 9: Security checks..."

# Check that script doesn't echo actual token values
# Look for unescaped token variable references (not literal strings like "NEW_TOKEN_HERE")
# We want to catch: echo $CLOUDFLARE_API_TOKEN or echo ${CLOUDFLARE_API_TOKEN}
# But allow: echo "... \$CLOUDFLARE_API_TOKEN ..." or echo "NEW_TOKEN_HERE"
if grep -E 'echo[[:space:]]+.*[^\\]\$\{?CLOUDFLARE_API_TOKEN' deploy-with-verification.sh | grep -v '\".*\\' | grep -q .; then
    echo "❌ Script may leak token via unescaped echo"
    exit 1
else
    echo "✅ No direct token echo found (escaped examples OK)"
fi

# Check for token masking in curl output
if grep -q "suppress token output" deploy-with-verification.sh; then
    echo "✅ Token suppression noted in comments"
else
    echo "⚠️  Consider adding token suppression comments"
fi

# Test 10: Check color codes are defined
echo ""
echo "Test 10: Color codes check..."
color_vars=("RED" "GREEN" "YELLOW" "BLUE" "NC" "BOLD")

for color in "${color_vars[@]}"; do
    if grep -q "^${color}=" deploy-with-verification.sh; then
        echo "✅ Color variable $color defined"
    else
        echo "❌ Color variable $color missing"
        exit 1
    fi
done

# Summary
echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                    ALL TESTS PASSED ✅                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""
echo "The deployment script is properly configured and ready to use."
echo ""
echo "To deploy:"
echo "  1. Export your Cloudflare API token:"
echo "     export CLOUDFLARE_API_TOKEN=\"your-token-here\""
echo "  2. Run the deployment script:"
echo "     ./deploy-with-verification.sh"
echo ""

exit 0
