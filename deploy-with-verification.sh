#!/bin/bash
# ReflectivAI - Cloudflare Worker Deployment + Auth Repair Agent
# Complete automation for token verification, deployment, and testing
# With Backup Token Remediation Protocol

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"
WORKER_NAME="my-chat-agent-v2"
WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

# Logging functions
log_header() {
    echo ""
    echo -e "${BOLD}╔══════════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${BOLD}║ $1${NC}"
    echo -e "${BOLD}╚══════════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

log_step() {
    echo -e "${BLUE}▶ $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_info() {
    echo -e "  $1"
}

# Backup Token Remediation Protocol
trigger_remediation_protocol() {
    local failure_reason="$1"
    
    log_header "BACKUP TOKEN REMEDIATION PROTOCOL ACTIVATED"
    
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo -e "${YELLOW}  AUTH FAILURE DETECTED - TOKEN REMEDIATION REQUIRED${NC}"
    echo -e "${YELLOW}═══════════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # (A) Human-readable diagnosis
    log_header "(A) DIAGNOSIS"
    
    echo -e "${BOLD}Failure Reason:${NC} $failure_reason"
    echo ""
    echo -e "${BOLD}Common Causes:${NC}"
    echo "  1. Wrong Cloudflare account selected"
    echo "  2. Insufficient permission scopes on token"
    echo "  3. Missing 'Workers Scripts' permission (Read + Edit)"
    echo "  4. Missing 'Workers KV Storage' permission (Read + Edit)"
    echo "  5. Using Global API Key instead of API Token"
    echo "  6. Token expired or revoked"
    echo "  7. Token not scoped to the correct account"
    echo ""
    
    # (B) Step-by-step token creation guide
    log_header "(B) NEW TOKEN CREATION GUIDE"
    
    echo -e "${BOLD}Follow these steps to create a new API Token:${NC}"
    echo ""
    echo "  1. Go to: https://dash.cloudflare.com/profile/api-tokens"
    echo ""
    echo "  2. Click '${BOLD}Create Token${NC}'"
    echo ""
    echo "  3. Click '${BOLD}Create Custom Token${NC}' (or use a template)"
    echo ""
    echo "  4. Configure the token with these settings:"
    echo ""
    echo "     ${BOLD}Token Name:${NC}"
    echo "       reflectivai-worker-deploy"
    echo ""
    echo "     ${BOLD}Permissions:${NC}"
    echo "       Account → Workers Scripts → Read, Edit"
    echo "       Account → Workers KV Storage → Read, Edit"
    echo "       Account → R2 Storage → Read, Edit (optional, if using R2)"
    echo ""
    echo "     ${BOLD}Account Resources:${NC}"
    echo "       Specific account → ${ACCOUNT_ID}"
    echo ""
    echo "     ${BOLD}Zone Resources:${NC}"
    echo "       All zones (or specific zones if preferred)"
    echo ""
    echo "  5. Click '${BOLD}Continue to summary${NC}'"
    echo ""
    echo "  6. Review the permissions and click '${BOLD}Create Token${NC}'"
    echo ""
    echo "  7. ${BOLD}COPY THE TOKEN${NC} - you won't be able to see it again!"
    echo ""
    
    # (C) Token template
    log_header "(C) TOKEN TEMPLATE (for reference)"
    
    cat << 'EOF'
  Token Configuration:
  ┌─────────────────────────────────────────────────────────┐
  │ Token Name: reflectivai-worker-deploy                   │
  │                                                           │
  │ Permissions:                                              │
  │   ✓ Account → Workers Scripts → Read, Edit               │
  │   ✓ Account → Workers KV Storage → Read, Edit            │
  │   ✓ Account → R2 Storage → Read, Edit (optional)         │
  │                                                           │
  │ Account Resources:                                        │
  │   ✓ Include → Specific account                           │
  │     Account: 59fea97fab54fbd4d4168ccaa1fa3410            │
  │                                                           │
  │ Zone Resources:                                           │
  │   ✓ Include → All zones                                  │
  │                                                           │
  │ Client IP Address Filtering:                              │
  │   ✓ Is not in (optional - for security)                  │
  │                                                           │
  │ TTL:                                                      │
  │   ✓ Start Date: (today)                                  │
  │   ✓ End Date: (recommend 1 year or less)                 │
  └─────────────────────────────────────────────────────────┘
EOF
    echo ""
    
    # (D) Verification command
    log_header "(D) VERIFICATION COMMANDS"
    
    echo -e "${BOLD}After creating your token, run these commands:${NC}"
    echo ""
    echo "  # Export the new token (replace NEW_TOKEN_HERE with your actual token)"
    echo "  ${BOLD}export CLOUDFLARE_API_TOKEN=\"NEW_TOKEN_HERE\"${NC}"
    echo "  ${BOLD}export CLOUDFLARE_ACCOUNT_ID=\"${ACCOUNT_ID}\"${NC}"
    echo ""
    echo "  # Verify the token works"
    echo "  ${BOLD}curl -s \"https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens/verify\" \\${NC}"
    echo "  ${BOLD}       -H \"Authorization: Bearer \$CLOUDFLARE_API_TOKEN\"${NC}"
    echo ""
    echo "  # If verification succeeds, re-run this script"
    echo "  ${BOLD}./deploy-with-verification.sh${NC}"
    echo ""
    
    # (E) Pause for user action
    log_header "(E) WAITING FOR NEW TOKEN"
    
    echo -e "${YELLOW}This script will now pause. Please:${NC}"
    echo ""
    echo "  1. Create a new token using the guide above"
    echo "  2. Export it in your terminal:"
    echo "     ${BOLD}export CLOUDFLARE_API_TOKEN=\"your-new-token-here\"${NC}"
    echo "  3. Come back to this terminal"
    echo ""
    
    read -p "Press ENTER when you have exported the new token to continue..."
    echo ""
    
    # Continue automatically after user confirms
    log_info "Attempting to verify new token..."
    echo ""
    
    # Re-run token verification
    if verify_token; then
        log_success "New token verified successfully!"
        log_info "Continuing with deployment..."
        return 0
    else
        log_error "New token verification failed"
        log_warning "Please check your token and try again"
        return 1
    fi
}

# Function to verify Cloudflare API token
verify_token() {
    log_step "Verifying Cloudflare API token..."
    
    if [ -z "$CLOUDFLARE_API_TOKEN" ]; then
        log_error "CLOUDFLARE_API_TOKEN not set"
        log_info "Please export your token:"
        log_info "  export CLOUDFLARE_API_TOKEN=\"your-token-here\""
        return 1
    fi
    
    # Make verification request (suppress token output)
    local verify_response
    verify_response=$(curl -s "https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/tokens/verify" \
         -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" 2>&1)
    
    # Extract only safe fields (no token data)
    local success=$(echo "$verify_response" | grep -o '"success":[^,]*' | cut -d':' -f2 | tr -d ' ')
    
    if [ "$success" = "true" ]; then
        log_success "Token verified successfully"
        
        # Extract and display safe information only
        local messages=$(echo "$verify_response" | grep -o '"messages":\[[^]]*\]')
        if [ ! -z "$messages" ]; then
            log_info "Token status: Active and valid"
        fi
        return 0
    else
        log_error "Token verification failed"
        
        # Extract error information (without revealing token)
        local errors=$(echo "$verify_response" | grep -o '"errors":\[[^]]*\]' | head -1)
        if [ ! -z "$errors" ]; then
            log_info "Error details: $errors"
        fi
        
        # Trigger remediation protocol
        trigger_remediation_protocol "Token verification API returned success: false"
        return $?
    fi
}

# Function to check wrangler.toml configuration
check_wrangler_config() {
    log_step "Checking wrangler.toml configuration..."
    
    if [ ! -f "wrangler.toml" ]; then
        log_error "wrangler.toml not found"
        return 1
    fi
    
    # Check account_id
    local config_account_id=$(grep -E '^account_id' wrangler.toml | cut -d'=' -f2 | tr -d ' "')
    
    if [ "$config_account_id" != "$ACCOUNT_ID" ]; then
        log_error "Account ID mismatch in wrangler.toml"
        log_info "Expected: $ACCOUNT_ID"
        log_info "Found: $config_account_id"
        
        log_warning "Attempting to fix wrangler.toml..."
        sed -i "s/account_id = .*/account_id = \"$ACCOUNT_ID\"/" wrangler.toml
        
        local new_account_id=$(grep -E '^account_id' wrangler.toml | cut -d'=' -f2 | tr -d ' "')
        if [ "$new_account_id" = "$ACCOUNT_ID" ]; then
            log_success "Fixed account_id in wrangler.toml"
        else
            log_error "Failed to fix account_id"
            return 1
        fi
    else
        log_success "Account ID matches: $ACCOUNT_ID"
    fi
    
    # Check worker name
    local config_name=$(grep -E '^name' wrangler.toml | cut -d'=' -f2 | tr -d ' "')
    log_info "Worker name: $config_name"
    
    # Check compatibility date
    local compat_date=$(grep -E '^compatibility_date' wrangler.toml | cut -d'=' -f2 | tr -d ' "')
    log_info "Compatibility date: $compat_date"
    
    log_success "wrangler.toml configuration verified"
    return 0
}

# Function to deploy worker
deploy_worker() {
    log_step "Deploying worker with wrangler..."
    
    # Check if wrangler is available
    if ! command -v wrangler &> /dev/null; then
        log_warning "Wrangler not found, installing via npx..."
        WRANGLER_CMD="npx wrangler"
    else
        WRANGLER_CMD="wrangler"
    fi
    
    # Deploy
    local deploy_output
    if deploy_output=$($WRANGLER_CMD deploy 2>&1); then
        log_success "Worker deployed successfully"
        echo "$deploy_output" | grep -E "(Published|Deployed|https://)" || true
        return 0
    else
        log_error "Deployment failed"
        echo "$deploy_output"
        
        # Check for auth errors
        if echo "$deploy_output" | grep -qi "authentication\|unauthorized\|forbidden\|permission"; then
            trigger_remediation_protocol "Deployment failed with authentication/permission error"
            return $?
        fi
        
        return 1
    fi
}

# Function to run Phase 3 tests
run_phase3_tests() {
    log_step "Running Phase 3 tests (real_test.js)..."
    
    if [ ! -f "real_test.js" ]; then
        log_error "real_test.js not found"
        return 1
    fi
    
    # Run tests and capture output
    local test_output
    local test_exit_code
    
    if test_output=$(node real_test.js 2>&1); then
        test_exit_code=0
    else
        test_exit_code=$?
    fi
    
    echo "$test_output"
    
    # Store results
    echo "$test_output" > /tmp/phase3_test_results.txt
    
    # Analyze results
    local tests_passed=$(echo "$test_output" | grep -o "Tests Passed: [0-9]*" | grep -o "[0-9]*")
    local tests_failed=$(echo "$test_output" | grep -o "Tests Failed: [0-9]*" | grep -o "[0-9]*")
    
    if [ "$test_exit_code" -eq 0 ] && [ "${tests_failed:-0}" -eq 0 ]; then
        log_success "All Phase 3 tests passed!"
        return 0
    else
        log_warning "Some tests failed or had issues"
        
        # Check for auth errors in test output
        if echo "$test_output" | grep -qi "401\|403\|unauthorized\|forbidden"; then
            log_error "Tests failed with authentication errors"
            trigger_remediation_protocol "Phase 3 tests failed with auth errors"
            return $?
        fi
        
        return 1
    fi
}

# Function to generate final report
generate_final_report() {
    local token_status="$1"
    local deployment_status="$2"
    local test_status="$3"
    
    log_header "FINAL ENGINEERING REPORT"
    
    echo -e "${BOLD}1. Token Verification:${NC}"
    echo "   Status: $token_status"
    echo ""
    
    echo -e "${BOLD}2. Deployment Status:${NC}"
    echo "   Status: $deployment_status"
    if [ "$deployment_status" = "✅ SUCCESS" ]; then
        echo "   Worker URL: $WORKER_URL"
    fi
    echo ""
    
    echo -e "${BOLD}3. Phase 3 Test Results:${NC}"
    echo "   Status: $test_status"
    if [ -f /tmp/phase3_test_results.txt ]; then
        echo ""
        echo "   Test Summary:"
        grep -E "Tests Passed:|Tests Failed:|Pass Rate:" /tmp/phase3_test_results.txt | sed 's/^/   /'
    fi
    echo ""
    
    echo -e "${BOLD}4. Test Mode Results:${NC}"
    if [ -f /tmp/phase3_test_results.txt ]; then
        echo "   • sales-coach:            $(grep -c "SALES-COACH.*PASSED" /tmp/phase3_test_results.txt && echo "✅" || echo "❌")"
        echo "   • emotional-assessment:   $(grep -c "EMOTIONAL-ASSESSMENT.*PASSED" /tmp/phase3_test_results.txt && echo "✅" || echo "❌")"
        echo "   • product-knowledge:      $(grep -c "PRODUCT-KNOWLEDGE.*PASSED" /tmp/phase3_test_results.txt && echo "✅" || echo "❌")"
        echo "   • role-play:              $(grep -c "ROLE-PLAY.*PASSED" /tmp/phase3_test_results.txt && echo "✅" || echo "❌")"
        echo "   • general-knowledge:      $(grep -c "GENERAL-KNOWLEDGE.*PASSED" /tmp/phase3_test_results.txt && echo "✅" || echo "❌")"
    else
        echo "   (Tests not run)"
    fi
    echo ""
    
    echo -e "${BOLD}5. Fixes Applied:${NC}"
    echo "   • Account ID verification and auto-correction in wrangler.toml"
    echo "   • Automated token verification with detailed error reporting"
    echo "   • Comprehensive test suite execution with mode-specific validation"
    echo ""
    
    echo -e "${BOLD}6. Remaining Blockers:${NC}"
    if [ "$deployment_status" != "✅ SUCCESS" ] || [ "$test_status" != "✅ SUCCESS" ]; then
        echo "   ⚠️  Deployment or tests incomplete - see details above"
        echo "   Action required: Review logs and address any auth/config issues"
    else
        echo "   ✅ None - all systems operational"
    fi
    echo ""
    
    echo -e "${BOLD}7. Next Steps:${NC}"
    if [ "$test_status" = "✅ SUCCESS" ]; then
        echo "   ✅ Deployment complete and validated"
        echo "   • Monitor worker at: $WORKER_URL/health"
        echo "   • View logs: wrangler tail"
        echo "   • Test live: $WORKER_URL/chat"
    else
        echo "   • Review test failures and fix any issues"
        echo "   • Re-run tests: node real_test.js"
        echo "   • Check worker logs: wrangler tail"
    fi
    echo ""
}

# Main execution flow
main() {
    log_header "ReflectivAI - Cloudflare Worker Deployment + Auth Repair Agent"
    
    echo "Account ID: $ACCOUNT_ID"
    echo "Worker Name: $WORKER_NAME"
    echo "Worker URL: $WORKER_URL"
    echo "Date: $(date -u +"%Y-%m-%d %H:%M:%S UTC")"
    echo ""
    
    # Initialize status variables
    local token_status="❌ FAILED"
    local deployment_status="❌ FAILED"
    local test_status="❌ FAILED"
    
    # Step 0: Hard rules check
    log_header "STEP 0: Environment Initialization"
    
    if [ ! -f "worker.js" ]; then
        log_error "worker.js not found - are you in the repository root?"
        exit 1
    fi
    
    if [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
        log_warning "CLOUDFLARE_ACCOUNT_ID not set, setting it now..."
        export CLOUDFLARE_ACCOUNT_ID="$ACCOUNT_ID"
    fi
    
    log_success "Environment initialized"
    echo ""
    
    # Step 1: Token verification
    log_header "STEP 1: Token Verification"
    
    if verify_token; then
        token_status="✅ SUCCESS"
    else
        log_error "Token verification failed - cannot proceed"
        generate_final_report "$token_status" "$deployment_status" "$test_status"
        exit 1
    fi
    echo ""
    
    # Step 2: Configuration check
    log_header "STEP 2: Configuration Verification"
    
    if ! check_wrangler_config; then
        log_error "Configuration check failed"
        generate_final_report "$token_status" "$deployment_status" "$test_status"
        exit 1
    fi
    echo ""
    
    # Step 3: Deployment
    log_header "STEP 3: Worker Deployment"
    
    if deploy_worker; then
        deployment_status="✅ SUCCESS"
    else
        log_error "Deployment failed - cannot run tests"
        generate_final_report "$token_status" "$deployment_status" "$test_status"
        exit 1
    fi
    echo ""
    
    # Brief pause to let deployment propagate
    log_info "Waiting 5 seconds for deployment to propagate..."
    sleep 5
    echo ""
    
    # Step 4: Phase 3 tests
    log_header "STEP 4: Phase 3 Test Execution"
    
    if run_phase3_tests; then
        test_status="✅ SUCCESS"
    else
        test_status="⚠️  PARTIAL/FAILED"
    fi
    echo ""
    
    # Step 5: Final report
    generate_final_report "$token_status" "$deployment_status" "$test_status"
    
    # Exit with appropriate code
    if [ "$test_status" = "✅ SUCCESS" ]; then
        exit 0
    else
        exit 1
    fi
}

# Run main
main "$@"
