# Deploy Cloudflare Worker - Quick Guide

Since you have `CLOUDFLARE_API_TOKEN` already set up in GitHub Secrets, you have multiple deployment options:

## Option 1: GitHub Actions (Recommended) ✅

I've created `.github/workflows/deploy-cloudflare-worker.yml` for you.

### To deploy via GitHub Actions:

1. **Go to GitHub Actions:**
   - Navigate to: https://github.com/ReflectivEI/reflectiv-ai/actions
   - Click on **"Deploy Cloudflare Worker"** workflow

2. **Run workflow manually:**
   - Click **"Run workflow"** button (top right)
   - Select branch: `copilot/revert-commit-f9da219` 
   - Click **"Run workflow"**

3. **Wait for deployment:**
   - Workflow will install dependencies and deploy
   - Takes ~1-2 minutes
   - Check logs for confirmation

### Auto-deployment:
Once this branch is merged to `main`, the workflow will automatically deploy on any changes to:
- `worker.js`
- `wrangler.toml`

## Option 2: Local Deployment 🖥️

If you prefer to deploy from your local machine:

```bash
# Navigate to repository
cd /path/to/reflectiv-ai

# Checkout the branch with the fix
git checkout copilot/revert-commit-f9da219
git pull origin copilot/revert-commit-f9da219

# Deploy using wrangler
npx wrangler deploy
```

Wrangler will use your local Cloudflare credentials or you can export the token:
```bash
export CLOUDFLARE_API_TOKEN="your-token"
npx wrangler deploy
```

## Option 3: Merge to Main

If you merge this PR to `main`, the workflow will automatically deploy.

## Verification After Deployment

Once deployed, verify the fix is working:

### Test 1: Health Check
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```
Expected: `"ok"` or `{"ok":true}`

### Test 2: Chat without scenario (should work now)
```bash
curl -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
  -H "Content-Type: application/json" \
  -H "Origin: https://reflectivei.github.io" \
  -d '{
    "mode": "sales-coach",
    "user": "What is PrEP?",
    "history": [],
    "disease": "",
    "persona": "",
    "goal": ""
  }'
```
Expected: HTTP 200 with AI response (NOT HTTP 400)

### Test 3: Use the widget
- Go to https://reflectivei.github.io
- Try sending a message without selecting a scenario
- Should work without HTTP 400 error

## Troubleshooting

If deployment fails:
1. Check GitHub Actions logs for error messages
2. Verify `CLOUDFLARE_API_TOKEN` secret is correctly set
3. Ensure token has "Edit Cloudflare Workers" permissions
4. Check `wrangler.toml` has correct account_id

---

## Quick Command Reference

| Action | Command |
|--------|---------|
| Deploy via Actions | Go to Actions → Deploy Cloudflare Worker → Run workflow |
| Deploy locally | `npx wrangler deploy` |
| Check deployment | `curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health` |
| View logs | Actions tab → Latest workflow run |

---

**Next Step:** Choose Option 1 (GitHub Actions) and trigger the workflow to deploy the fix.
