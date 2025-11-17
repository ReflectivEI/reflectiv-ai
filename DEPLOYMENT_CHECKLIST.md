# Cloudflare Worker Deployment Checklist

## Pre-Deployment Requirements

### ✅ Configuration Files Present
- [x] `worker.js` - Worker code exists
- [x] `wrangler.toml` - Configuration file exists
- [x] `.github/workflows/deploy-cloudflare-worker.yml` - GitHub Actions workflow exists

### ❌ Configuration Issues Found

#### 🔴 BLOCKER #1: Missing account_id
**File**: `wrangler.toml` (Line ~10)  
**Current**: `# account_id = "your-account-id-here"` (commented out)  
**Required**: `account_id = "YOUR_CLOUDFLARE_ACCOUNT_ID"`

**How to fix**:
1. Login to https://dash.cloudflare.com
2. Select your account  
3. Copy the "Account ID" from the right sidebar
4. Edit `wrangler.toml` and uncomment the line
5. Replace `"your-account-id-here"` with your actual account ID

#### 🔴 BLOCKER #2: Missing GitHub Secret
**Secret**: `CLOUDFLARE_API_TOKEN`  
**Status**: Not verified (likely missing)  
**Required for**: GitHub Actions automated deployment

**How to fix**:
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click "Create Token"
3. Use template: "Edit Cloudflare Workers"
4. Create and copy the token
5. Go to https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions
6. Add secret: Name=`CLOUDFLARE_API_TOKEN`, Value=(your token)

#### 🟡 RUNTIME REQUIREMENT: Missing PROVIDER_KEY
**Secret**: `PROVIDER_KEY` (Groq API key)  
**Status**: Must be set after deployment  
**Required for**: Worker runtime (AI functionality)

**How to set** (after deployment succeeds):
```bash
wrangler secret put PROVIDER_KEY
# Or via Cloudflare Dashboard → Workers → my-chat-agent-v2 → Settings → Variables
```

## Deployment Methods

### Method 1: GitHub Actions (Recommended)
**Prerequisites**: Fix #1 (account_id) and #2 (API token) above

Steps:
1. Commit the account_id fix to `wrangler.toml`
2. Push to `main` branch (triggers auto-deploy) OR
3. Go to Actions → "Deploy Cloudflare Worker" → "Run workflow"

### Method 2: Manual Deployment
**Prerequisites**: Fix #1 (account_id) above

Steps:
```bash
npm install -g wrangler
wrangler login
wrangler deploy
```

## Post-Deployment Verification

### Step 1: Check DNS
```bash
host my-chat-agent-v2.tonyabdelmalak.workers.dev
```
✅ Success: Shows IP addresses  
❌ Failure: "not found"

### Step 2: Test Health Endpoint
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```
✅ Success: Returns "ok"  
❌ Failure: Connection error or timeout

### Step 3: Test Deep Health (with Provider Key)
```bash
curl "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health?deep=1"
```
✅ Success: Returns JSON with provider status  
⚠️  Warning: Returns without provider status if PROVIDER_KEY not set

### Step 4: Test Chat Endpoint
```bash
curl -X POST https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"test"}],"mode":"sales-coach"}'
```
✅ Success: Returns JSON with reply  
❌ Failure: Error response or missing provider key

### Step 5: Test Widget
1. Open: https://reflectivei.github.io/reflectiv-ai/
2. Click "Explore Platform" or "Open Coach"
3. Type a message
4. Verify response renders

## Quick Reference: Required Values

| Item | Where to Get | Where to Set |
|------|-------------|--------------|
| Account ID | Cloudflare Dashboard → Account ID (right sidebar) | `wrangler.toml` |
| API Token | Cloudflare → Profile → API Tokens | GitHub → Settings → Secrets |
| Provider Key | Groq → API Keys | Cloudflare Worker Secrets |

## Common Issues & Solutions

### "account_id is required"
→ Uncomment and set account_id in wrangler.toml

### "authentication error" 
→ Set CLOUDFLARE_API_TOKEN in GitHub secrets

### "provider key not found" (runtime)
→ Run: `wrangler secret put PROVIDER_KEY`

### "KV namespace not found"
→ Contact repository owner (KV namespace ID is hardcoded)

## Expected Results

After completing all steps:
- ✅ Worker deployed to Cloudflare
- ✅ DNS resolves `my-chat-agent-v2.tonyabdelmalak.workers.dev`
- ✅ Health check returns "ok"
- ✅ Chat endpoint responds with AI replies
- ✅ Widget loads and renders responses

## Estimated Time

- Configuration fixes: 10 minutes
- Deployment: 2 minutes
- DNS propagation: 1-5 minutes
- **Total: ~15-20 minutes**
