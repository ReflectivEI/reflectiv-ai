#!/bin/bash
# Example usage demonstration of deploy-with-verification.sh
# This shows how to use the deployment script in various scenarios

echo "═══════════════════════════════════════════════════════════════"
echo "  ReflectivAI Deployment Script - Usage Examples"
echo "═══════════════════════════════════════════════════════════════"
echo ""

cat << 'EOF'
SCENARIO 1: First-Time Deployment
══════════════════════════════════════════════════════════════

Step 1: Create Cloudflare API Token
------------------------------------
Visit: https://dash.cloudflare.com/profile/api-tokens
Click "Create Token" → "Create Custom Token"

Required permissions:
  • Account → Workers Scripts → Read, Edit
  • Account → Workers KV Storage → Read, Edit
  
Account scope:
  • Specific account: 59fea97fab54fbd4d4168ccaa1fa3410

Step 2: Export Token
--------------------
$ export CLOUDFLARE_API_TOKEN="your-actual-token-here"
$ export CLOUDFLARE_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

Step 3: Run Deployment
----------------------
$ ./deploy-with-verification.sh

Expected output:
  ╔══════════════════════════════════════════════════════════════════╗
  ║ ReflectivAI - Cloudflare Worker Deployment + Auth Repair Agent   ║
  ╚══════════════════════════════════════════════════════════════════╝
  
  ▶ Verifying Cloudflare API token...
  ✅ Token verified successfully
  
  ▶ Checking wrangler.toml configuration...
  ✅ Account ID matches: 59fea97fab54fbd4d4168ccaa1fa3410
  
  ▶ Deploying worker with wrangler...
  ✅ Worker deployed successfully
  
  ▶ Running Phase 3 tests (real_test.js)...
  ✅ All Phase 3 tests passed!
  
  ╔══════════════════════════════════════════════════════════════════╗
  ║ FINAL ENGINEERING REPORT                                          ║
  ╚══════════════════════════════════════════════════════════════════╝


══════════════════════════════════════════════════════════════
SCENARIO 2: Token Expired or Invalid
══════════════════════════════════════════════════════════════

$ ./deploy-with-verification.sh

What happens:
  ▶ Verifying Cloudflare API token...
  ❌ Token verification failed
  
  ╔══════════════════════════════════════════════════════════════════╗
  ║ BACKUP TOKEN REMEDIATION PROTOCOL ACTIVATED                       ║
  ╚══════════════════════════════════════════════════════════════════╝
  
  (A) DIAGNOSIS
  ═════════════
  Failure Reason: Token verification API returned success: false
  
  Common Causes:
    1. Wrong Cloudflare account selected
    2. Insufficient permission scopes on token
    3. Missing 'Workers Scripts' permission (Read + Edit)
    ...
  
  (B) NEW TOKEN CREATION GUIDE
  ════════════════════════════
  Follow these steps to create a new API Token:
    1. Go to: https://dash.cloudflare.com/profile/api-tokens
    2. Click 'Create Token'
    ...
  
  (C) TOKEN TEMPLATE
  ═══════════════════
  [Shows exact configuration needed]
  
  (D) VERIFICATION COMMANDS
  ═════════════════════════
  $ export CLOUDFLARE_API_TOKEN="NEW_TOKEN_HERE"
  $ curl -s "https://api.cloudflare.com/..." \
       -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
  
  (E) WAITING FOR NEW TOKEN
  ═════════════════════════
  Press ENTER when you have exported the new token to continue...

Action: Create new token, export it, press ENTER
Result: Script automatically continues with deployment


══════════════════════════════════════════════════════════════
SCENARIO 3: Tests Fail After Deployment
══════════════════════════════════════════════════════════════

$ ./deploy-with-verification.sh

What happens:
  ✅ Token verified
  ✅ Worker deployed
  
  ▶ Running Phase 3 tests (real_test.js)...
  
  TEST: SALES-COACH: No <coach> block leak
  ❌ FAILED - HTTP 401
  
What the script does:
  • Detects auth error in test output (401/403)
  • Triggers Backup Token Remediation Protocol
  • Guides you to create new token
  • Auto-retries after new token is set

Fix:
  1. Follow remediation protocol
  2. Create new token with proper permissions
  3. Export new token
  4. Script continues automatically


══════════════════════════════════════════════════════════════
SCENARIO 4: Manual Verification Without Full Deployment
══════════════════════════════════════════════════════════════

Just want to verify your token?

$ export CLOUDFLARE_API_TOKEN="your-token"
$ curl -s "https://api.cloudflare.com/client/v4/accounts/59fea97fab54fbd4d4168ccaa1fa3410/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" | jq

Expected output:
{
  "success": true,
  "errors": [],
  "messages": [
    {
      "code": 10000,
      "message": "This API Token is valid and active"
    }
  ]
}


══════════════════════════════════════════════════════════════
SCENARIO 5: Deploy Without Running Tests
══════════════════════════════════════════════════════════════

If you want to deploy but skip tests:

$ export CLOUDFLARE_API_TOKEN="your-token"
$ npx wrangler deploy

Then run tests separately:
$ node real_test.js


══════════════════════════════════════════════════════════════
SCENARIO 6: Check Deployment Health
══════════════════════════════════════════════════════════════

After deployment:

# Basic health check
$ curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
ok

# Deep health check (includes provider test)
$ curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=true
{
  "ok": true,
  "time": 1700000000000,
  "key_pool": 3,
  "provider": {
    "ok": true,
    "status": 200
  }
}

# Check worker version
$ curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
{"version":"r10.1"}


══════════════════════════════════════════════════════════════
SCENARIO 7: Test Individual Mode
══════════════════════════════════════════════════════════════

Test sales-coach mode:
$ curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "sales-coach",
    "messages": [
      {
        "role": "user",
        "content": "How should I position the benefit-risk profile?"
      }
    ],
    "session": "test-session-1"
  }'

Test emotional-assessment mode:
$ curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{
    "mode": "emotional-assessment",
    "messages": [
      {
        "role": "user",
        "content": "I felt defensive when the doctor questioned me."
      }
    ],
    "session": "test-session-2"
  }'


══════════════════════════════════════════════════════════════
SCENARIO 8: View Worker Logs
══════════════════════════════════════════════════════════════

Real-time log streaming:
$ npx wrangler tail

Filter for errors only:
$ npx wrangler tail --status error

Sample output:
2024-11-21T22:30:15Z  POST /chat 200 OK (142ms)
2024-11-21T22:30:16Z  { mode: 'sales-coach', session: 'abc123' }


══════════════════════════════════════════════════════════════
SCENARIO 9: Troubleshoot Deployment Issues
══════════════════════════════════════════════════════════════

Issue: "Account not found"
Fix: Check account ID in wrangler.toml
$ grep account_id wrangler.toml
Should show: account_id = "59fea97fab54fbd4d4168ccaa1fa3410"

Issue: "Permission denied"
Fix: Token needs more permissions
→ Script will auto-trigger Remediation Protocol

Issue: "wrangler command not found"
Fix: Install wrangler
$ npm install -g wrangler
Or use npx:
$ npx wrangler deploy


══════════════════════════════════════════════════════════════
SCENARIO 10: CI/CD Integration
══════════════════════════════════════════════════════════════

In GitHub Actions or other CI:

name: Deploy Worker
on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Deploy to Cloudflare
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: "59fea97fab54fbd4d4168ccaa1fa3410"
        run: |
          chmod +x deploy-with-verification.sh
          ./deploy-with-verification.sh


══════════════════════════════════════════════════════════════
Common Commands Reference
══════════════════════════════════════════════════════════════

Set environment:
  $ export CLOUDFLARE_API_TOKEN="..."
  $ export CLOUDFLARE_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

Full deployment with tests:
  $ ./deploy-with-verification.sh

Deploy only:
  $ npx wrangler deploy

Run tests only:
  $ node real_test.js

Check health:
  $ curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

View logs:
  $ npx wrangler tail

List deployments:
  $ npx wrangler deployments list

Rollback:
  $ npx wrangler rollback [deployment-id]


══════════════════════════════════════════════════════════════
Documentation Files
══════════════════════════════════════════════════════════════

• deploy-with-verification.sh
  → Main deployment automation script

• CLOUDFLARE_TOKEN_SETUP_GUIDE.md
  → Detailed guide for creating API tokens

• DEPLOYMENT_README.md
  → Complete deployment documentation

• real_test.js
  → Phase 3 test suite (all 5 modes)

• test-deployment-script.sh
  → Validation tests for deployment script

• worker.js
  → Main worker implementation

• wrangler.toml
  → Worker configuration


══════════════════════════════════════════════════════════════
Support & Resources
══════════════════════════════════════════════════════════════

Cloudflare Workers Docs:
  https://developers.cloudflare.com/workers/

API Token Management:
  https://dash.cloudflare.com/profile/api-tokens

Wrangler CLI Docs:
  https://developers.cloudflare.com/workers/wrangler/

Worker Dashboard:
  https://dash.cloudflare.com/

Worker URL:
  https://my-chat-agent-v2.tonyabdelmalak.workers.dev


══════════════════════════════════════════════════════════════

EOF

echo ""
echo "For more details, see:"
echo "  • DEPLOYMENT_README.md - Complete documentation"
echo "  • CLOUDFLARE_TOKEN_SETUP_GUIDE.md - Token setup guide"
echo ""
