# ReflectivAI - Deployment Automation

This directory contains automated deployment tooling for the ReflectivAI Cloudflare Worker with built-in authentication repair and comprehensive testing.

## Quick Start

### Prerequisites

1. Cloudflare API Token with proper permissions (see [Token Setup Guide](./CLOUDFLARE_TOKEN_SETUP_GUIDE.md))
2. Node.js installed
3. Access to account `59fea97fab54fbd4d4168ccaa1fa3410`

### One-Command Deployment

```bash
# Set your token
export CLOUDFLARE_API_TOKEN="your-token-here"
export CLOUDFLARE_ACCOUNT_ID="59fea97fab54fbd4d4168ccaa1fa3410"

# Run complete deployment + testing
./deploy-with-verification.sh
```

## What This Does

The `deploy-with-verification.sh` script performs a complete deployment lifecycle:

### 1. Environment Initialization ✅
- Validates repository structure
- Checks for required files
- Sets up environment variables

### 2. Token Verification ✅
- Tests Cloudflare API token validity
- Verifies permissions and scopes
- Checks account access

### 3. Configuration Check ✅
- Validates `wrangler.toml` settings
- Verifies account ID matches
- Auto-corrects configuration issues

### 4. Worker Deployment ✅
- Deploys worker using Wrangler
- Monitors deployment status
- Reports deployment URL

### 5. Phase 3 Testing ✅
Runs comprehensive tests across all 5 modes:
- **sales-coach**: Validates no `<coach>` block leakage
- **emotional-assessment**: Ensures responses end with questions
- **product-knowledge**: Verifies citations are present
- **role-play**: Checks HCP voice consistency
- **general-knowledge**: Confirms no mode structure leakage

### 6. Final Engineering Report ✅
Generates detailed report including:
- Token status
- Deployment status
- Test results per mode
- Fixes applied
- Remaining blockers
- Next steps

## Backup Token Remediation Protocol

If authentication fails at any stage, the script automatically triggers the **Backup Token Remediation Protocol**:

### Protocol Steps

1. **Diagnosis**: Identifies specific failure reason
   - Wrong account
   - Insufficient permissions
   - Missing scopes
   - Expired token
   - Using Global API Key instead of Token

2. **Token Creation Guide**: Step-by-step UI instructions
   - Required permissions
   - Account scope settings
   - Security best practices

3. **Token Template**: Reference configuration
   - Exact permission requirements
   - Account ID specification
   - Zone configuration

4. **Verification Commands**: Ready-to-use commands
   - Token export instructions
   - Verification curl command
   - Deployment retry command

5. **Interactive Pause**: Waits for user action
   - User creates new token
   - User exports to environment
   - Script auto-continues after confirmation

## Testing

### Run Full Test Suite
```bash
node real_test.js
```

### Test Individual Modes
```bash
# Test sales-coach mode
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","messages":[{"role":"user","content":"How do I position this product?"}]}'

# Test emotional-assessment mode
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"mode":"emotional-assessment","messages":[{"role":"user","content":"I felt defensive."}]}'
```

### Check Worker Health
```bash
# Basic health check
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health

# Deep health check (with provider test)
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=true
```

## Configuration Files

### `wrangler.toml`
Main worker configuration:
```toml
name = "my-chat-agent-v2"
account_id = "59fea97fab54fbd4d4168ccaa1fa3410"
compatibility_date = "2024-11-12"
```

Key settings:
- **account_id**: Must match `59fea97fab54fbd4d4168ccaa1fa3410`
- **name**: Worker identifier
- **routes**: Custom domain routing
- **vars**: Environment variables (CORS, provider settings)
- **kv_namespaces**: Session storage

### `worker.js`
Worker implementation with:
- 5 mode routing (sales-coach, role-play, product-knowledge, emotional-assessment, general-knowledge)
- CORS handling
- Rate limiting
- Provider rotation
- Session management via KV

### `real_test.js`
Phase 3 test suite:
- Tests all 5 modes against deployed worker
- Validates mode-specific formatting
- Checks for regression issues
- Generates pass/fail report

## Troubleshooting

### Deployment Fails

**Error**: `Authentication error`
```bash
# Re-verify your token
curl -s "https://api.cloudflare.com/client/v4/accounts/59fea97fab54fbd4d4168ccaa1fa3410/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# If fails, create new token (see Token Setup Guide)
```

**Error**: `Account not found`
```bash
# Check account ID in wrangler.toml
grep account_id wrangler.toml

# Should show: account_id = "59fea97fab54fbd4d4168ccaa1fa3410"
```

**Error**: `Permission denied`
```bash
# Token needs these permissions:
# - Workers Scripts: Read, Edit
# - Workers KV Storage: Read, Edit
# Create new token with proper permissions
```

### Tests Fail

**All tests return 401/403**
- Token issue - run token verification
- Worker not deployed - check deployment logs

**Specific mode fails**
- Check worker logs: `wrangler tail`
- Review test output for specific validation failures
- Compare with expected behavior in test file

**Tests timeout**
- Worker may not be responding
- Check worker health: `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health`
- Review worker logs for errors

### Token Issues

**Token expired**
```bash
# Create new token and export
export CLOUDFLARE_API_TOKEN="new-token-here"

# Re-run deployment
./deploy-with-verification.sh
```

**Wrong permissions**
- Remediation Protocol will trigger automatically
- Follow the step-by-step guide to create proper token
- Required: Workers Scripts (Read+Edit), Workers KV Storage (Read+Edit)

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `deploy-with-verification.sh` | **Main deployment script** - full automation with auth repair |
| `deploy-worker.sh` | Simple deployment (legacy) |
| `real_test.js` | Phase 3 test suite - all 5 modes |
| `CLOUDFLARE_TOKEN_SETUP_GUIDE.md` | Detailed token creation guide |

## Manual Deployment (Alternative)

If you prefer manual steps:

```bash
# 1. Verify token
curl -s "https://api.cloudflare.com/client/v4/accounts/59fea97fab54fbd4d4168ccaa1fa3410/tokens/verify" \
     -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"

# 2. Deploy worker
npx wrangler deploy

# 3. Run tests
node real_test.js

# 4. Check health
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

## Security Notes

⚠️ **NEVER**:
- Commit tokens to git
- Echo tokens in logs
- Share tokens in chat/email
- Use Global API Keys (use API Tokens)

✅ **ALWAYS**:
- Use environment variables
- Rotate tokens regularly
- Use minimal required permissions
- Set token expiration dates
- Monitor token usage

## Support Resources

- **Token Setup**: [CLOUDFLARE_TOKEN_SETUP_GUIDE.md](./CLOUDFLARE_TOKEN_SETUP_GUIDE.md)
- **Cloudflare Docs**: [Workers Documentation](https://developers.cloudflare.com/workers/)
- **Wrangler Docs**: [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/)
- **API Docs**: [Cloudflare API](https://developers.cloudflare.com/api/)

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deployment Flow                           │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Environment Check                                        │
│     ├─ Validate files exist                                  │
│     └─ Set environment variables                             │
│                                                               │
│  2. Token Verification                                       │
│     ├─ Call Cloudflare API                                   │
│     ├─ Check success status                                  │
│     └─ [FAIL] → Remediation Protocol                         │
│                                                               │
│  3. Config Validation                                        │
│     ├─ Check account_id                                      │
│     ├─ Auto-fix if needed                                    │
│     └─ Verify worker settings                                │
│                                                               │
│  4. Deploy Worker                                            │
│     ├─ Run: npx wrangler deploy                              │
│     ├─ Monitor output                                        │
│     └─ [FAIL] → Remediation Protocol                         │
│                                                               │
│  5. Run Phase 3 Tests                                        │
│     ├─ Execute: node real_test.js                            │
│     ├─ Test all 5 modes                                      │
│     ├─ Validate responses                                    │
│     └─ [FAIL] → Diagnose & Report                            │
│                                                               │
│  6. Generate Report                                          │
│     ├─ Token status                                          │
│     ├─ Deployment status                                     │
│     ├─ Test results per mode                                 │
│     ├─ Fixes applied                                         │
│     └─ Next steps                                            │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | All tests passed - deployment successful |
| 1 | Tests failed or deployment issue - see report |

## Contributing

When making changes:

1. Test locally first
2. Run full test suite
3. Verify all 5 modes work
4. Update documentation
5. Run deployment script end-to-end

---

**Worker URL**: https://my-chat-agent-v2.tonyabdelmalak.workers.dev  
**Account ID**: 59fea97fab54fbd4d4168ccaa1fa3410  
**Last Updated**: 2025-11-21
