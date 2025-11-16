# GitHub Secrets Setup for Cloudflare Deployment

## Step-by-Step Guide

### 1. Create Cloudflare API Token

1. **Go to Cloudflare Dashboard:**
   - Navigate to: https://dash.cloudflare.com/profile/api-tokens
   - Click **"Create Token"**

2. **Use the Workers Template:**
   - Select **"Edit Cloudflare Workers"** template
   - Or click "Create Custom Token" for more control

3. **Configure Permissions:**
   - **Account Resources:** Select your account
   - **Zone Resources:** Include all zones (or specific ones)
   - **Permissions:** Ensure these are included:
     - Account > Cloudflare Workers Scripts > Edit
     - Account > Workers KV Storage > Edit (if using KV)
     - Zone > Workers Routes > Edit (if using routes)

4. **Set Token Lifetime:**
   - Recommended: No expiration (for automation)
   - Or set a far future date and set reminder to renew

5. **Create and Copy Token:**
   - Click **"Continue to summary"**
   - Click **"Create Token"**
   - **IMPORTANT:** Copy the token immediately - you won't see it again!

### 2. Add Token to GitHub Repository

1. **Navigate to Repository Settings:**
   - Go to: https://github.com/ReflectivEI/reflectiv-ai
   - Click the **"Settings"** tab (top right)

2. **Access Secrets:**
   - In the left sidebar, find **"Security"** section
   - Click **"Secrets and variables"**
   - Click **"Actions"**

3. **Create New Secret:**
   - Click **"New repository secret"** button
   - **Name:** `CLOUDFLARE_API_TOKEN` (exactly this name)
   - **Value:** Paste the token you copied
   - Click **"Add secret"**

### 3. Verify Secret is Added

You should see `CLOUDFLARE_API_TOKEN` listed under "Repository secrets" with a green checkmark.

### 4. Create GitHub Actions Workflow (Optional)

For automated deployments, create `.github/workflows/deploy-worker.yml`:

```yaml
name: Deploy Cloudflare Worker

on:
  push:
    branches:
      - main
    paths:
      - 'worker.js'
      - 'wrangler.toml'
  workflow_dispatch:  # Allows manual trigger

jobs:
  deploy:
    runs-on: ubuntu-latest
    name: Deploy to Cloudflare Workers
    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'

      - name: Deploy to Cloudflare Workers
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### 5. Using the Secret in This Session

Once the secret is added, I can access it in GitHub Actions workflows. For immediate deployment, you can:

**Option A: Trigger Manual Workflow**
- Go to Actions tab → Select workflow → Click "Run workflow"

**Option B: Deploy Locally (Recommended for now)**
```bash
cd /home/runner/work/reflectiv-ai/reflectiv-ai
npx wrangler deploy
```

Wrangler will use your local credentials or prompt for login.

### 6. Security Best Practices

✅ **DO:**
- Rotate tokens periodically
- Use minimal required permissions
- Store only in GitHub Secrets (never in code)
- Use different tokens for dev/prod if possible

❌ **DON'T:**
- Commit tokens to code
- Share tokens in chat/email
- Use overly permissive tokens
- Store in plain text files

### 7. Troubleshooting

**If deployment fails:**
1. Verify token has correct permissions
2. Check token hasn't expired
3. Ensure secret name is exactly `CLOUDFLARE_API_TOKEN`
4. Check wrangler.toml has correct account_id and name

**Check token permissions:**
```bash
# This command shows what the token can access
npx wrangler whoami
```

---

## Quick Reference

| Item | Value |
|------|-------|
| Secret Name | `CLOUDFLARE_API_TOKEN` |
| Location | Repository Settings → Secrets and variables → Actions |
| Token Source | https://dash.cloudflare.com/profile/api-tokens |
| Template | "Edit Cloudflare Workers" |

---

**Next Steps:**
1. ✅ Create token at Cloudflare
2. ✅ Add as GitHub secret
3. ✅ Deploy manually for now: `npx wrangler deploy`
4. ⏭️ (Optional) Set up GitHub Actions workflow for auto-deployment
