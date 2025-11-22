# Cloudflare Worker Deployment Fix

## Problem
The Cloudflare Worker deployment via GitHub Actions is failing with error:
```
✘ [ERROR] In a non-interactive environment, it's necessary to set a 
CLOUDFLARE_API_TOKEN environment variable for wrangler to work.
```

## Root Cause
The `CLOUDFLARE_API_TOKEN` secret is **not set** in GitHub repository secrets.

## Solution

### Step 1: Create Cloudflare API Token

1. **Go to Cloudflare Dashboard:**
   - Navigate to: https://dash.cloudflare.com/profile/api-tokens
   - Click **"Create Token"**

2. **Use the Workers Template:**
   - Select **"Edit Cloudflare Workers"** template
   - This automatically configures the correct permissions

3. **Configure Permissions:**
   - **Account Resources:** Select your account
   - **Zone Resources:** Include all zones (or specific ones)
   - **Permissions:** Should include:
     - Account > Cloudflare Workers Scripts > Edit
     - Account > Workers KV Storage > Edit
     - Zone > Workers Routes > Edit (optional)

4. **Create and Copy Token:**
   - Click **"Continue to summary"**
   - Click **"Create Token"**
   - **⚠️ IMPORTANT:** Copy the token immediately - you won't see it again!

### Step 2: Add Token to GitHub Repository

1. **Navigate to Repository Settings:**
   - Go to: https://github.com/ReflectivEI/reflectiv-ai
   - Click the **"Settings"** tab

2. **Access Secrets:**
   - In the left sidebar, expand **"Secrets and variables"**
   - Click **"Actions"**

3. **Create New Secret:**
   - Click **"New repository secret"** button
   - **Name:** `CLOUDFLARE_API_TOKEN` (exactly this name, case-sensitive)
   - **Value:** Paste the token you copied
   - Click **"Add secret"**

4. **Verify Secret:**
   - You should see `CLOUDFLARE_API_TOKEN` listed under "Repository secrets"
   - It will show the date created and last updated

### Step 3: Deploy

After adding the secret, you have two options:

#### Option A: Automatic Deployment (Recommended)
The workflow is configured to deploy automatically when changes are pushed to the `main` branch affecting:
- `worker.js`
- `wrangler.toml`

Simply merge this PR to `main` and the deployment will trigger automatically.

#### Option B: Manual Deployment
1. Go to: https://github.com/ReflectivEI/reflectiv-ai/actions
2. Select **"Deploy Cloudflare Worker"** workflow
3. Click **"Run workflow"**
4. Select the `main` branch
5. Click **"Run workflow"**

### Step 4: Verify Deployment

Once the workflow completes successfully:

1. **Check Health Endpoint:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
   ```
   Expected response: `ok` or `{"ok":true}`

2. **Check Version:**
   ```bash
   curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
   ```
   Expected response: `{"version":"r10.1"}`

3. **Test Chat Endpoint:**
   ```bash
   curl -X POST "https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat" \
     -H "Content-Type: application/json" \
     -H "Origin: https://reflectivei.github.io" \
     -d '{
       "mode": "sales-coach",
       "user": "Hello",
       "history": []
     }'
   ```

## What Changed in This Fix

1. **Updated GitHub Actions Workflow** (`.github/workflows/deploy-cloudflare-worker.yml`):
   - Added secret validation step that provides clear error messages
   - Changed from manual `wrangler` installation to official `cloudflare/wrangler-action@v3`
   - Removed unnecessary Node.js setup step
   - Added better error messages guiding users to set up the secret

2. **Updated wrangler.toml**:
   - Added comments about optional `account_id` configuration
   - Documented how to find the account_id if needed

3. **Added This Documentation**:
   - Clear step-by-step guide to fix the issue
   - Verification steps to ensure deployment works

## Why This Fix Works

1. **Secret Validation**: The workflow now explicitly checks if the secret exists before attempting deployment, providing clear guidance
2. **Official Action**: Using `cloudflare/wrangler-action@v3` is the recommended approach and handles authentication more reliably
3. **Better Error Messages**: Users get actionable guidance instead of cryptic errors

## Troubleshooting

### "CLOUDFLARE_API_TOKEN secret is not set" Error
**Solution:** Follow Step 2 above to add the secret to GitHub repository settings.

### "Token authentication error" 
**Solutions:**
- Verify the token has "Edit Cloudflare Workers" permissions
- Check the token hasn't expired
- Ensure you copied the complete token (no extra spaces)

### "Account ID not found"
**Solution:** Add `account_id` to `wrangler.toml`:
```toml
account_id = "your-account-id-here"
```
Find your account ID at: https://dash.cloudflare.com (select your account, see "Account ID" in sidebar)

### Deployment Succeeds but Worker Not Updated
**Solutions:**
- Clear browser cache and reload
- Check worker logs in Cloudflare dashboard
- Verify the correct worker name in `wrangler.toml` matches your Cloudflare dashboard

## Additional Resources

- [Cloudflare API Token Documentation](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Wrangler Action Documentation](https://github.com/cloudflare/wrangler-action)
- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- See also: `GITHUB_SECRETS_SETUP.md` in this repository

## Security Best Practices

✅ **DO:**
- Rotate API tokens periodically (every 90 days recommended)
- Use minimal required permissions for tokens
- Store tokens only in GitHub Secrets (never in code)
- Use different tokens for different environments if possible

❌ **DON'T:**
- Commit tokens to code or configuration files
- Share tokens in chat, email, or documentation
- Use tokens with excessive permissions
- Store tokens in plain text anywhere

---

**Status:** This fix has been applied to the workflow. The deployment will work once the `CLOUDFLARE_API_TOKEN` secret is added to the repository settings.
