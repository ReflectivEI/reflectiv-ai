# STEP-BY-STEP: Create and Add CLOUDFLARE_API_TOKEN

## What You're Doing
Creating a token that allows GitHub Actions to deploy your worker to Cloudflare.

---

## PART 1: CREATE THE TOKEN IN CLOUDFLARE (5 minutes)

### Step 1: Log into Cloudflare
1. Go to: **https://dash.cloudflare.com**
2. Log in with your Cloudflare account

### Step 2: Navigate to API Tokens
1. Click on your profile icon (top right corner)
2. Click **"My Profile"**
3. In the left sidebar, click **"API Tokens"**
   - OR go directly to: **https://dash.cloudflare.com/profile/api-tokens**

### Step 3: Create the Token
1. Click the **"Create Token"** button (blue button on the right)
2. You'll see a list of templates
3. Find the template called **"Edit Cloudflare Workers"**
4. Click **"Use template"** next to it

### Step 4: Configure Token Permissions (Pre-filled)
The template should already have these settings:
- **Permissions:**
  - Account > Workers Scripts > Edit
  - Account > Workers KV Storage > Edit
- **Account Resources:**
  - Include > [Your Account Name]

**You don't need to change anything unless you want to:**
- Optionally set an expiration date (or leave as "No expiration")
- Optionally restrict to specific IP addresses (not recommended for GitHub Actions)

### Step 5: Create and Copy the Token
1. Scroll to the bottom
2. Click **"Continue to summary"**
3. Review the summary (should say "Edit Cloudflare Workers")
4. Click **"Create Token"**
5. **IMPORTANT:** You'll see your token displayed **ONCE**
6. Click **"Copy"** or manually copy the entire token
   - It will look like: `abc123XYZ...` (about 40 characters)
7. **SAVE IT SOMEWHERE SAFE** (you won't see it again!)

---

## PART 2: ADD THE TOKEN TO GITHUB (2 minutes)

### Step 1: Go to Repository Settings
1. Go to: **https://github.com/ReflectivEI/reflectiv-ai**
2. Click the **"Settings"** tab (top navigation, far right)
   - **Note:** You need to be a repository owner/admin to see this tab

### Step 2: Navigate to Secrets
1. In the left sidebar, look for the **"Security"** section
2. Expand **"Secrets and variables"** (click the arrow/chevron)
3. Click **"Actions"**

You should now see a page titled "Actions secrets and variables"

### Step 3: Create the Secret
1. Click the **"New repository secret"** button (green button, top right)
2. You'll see a form with two fields:

   **Field 1 - Name:**
   ```
   CLOUDFLARE_API_TOKEN
   ```
   ⚠️ **IMPORTANT:** Type it EXACTLY like this (all caps, with underscores)

   **Field 2 - Secret:**
   ```
   [Paste the token you copied from Cloudflare here]
   ```
   Paste the entire token you copied in Part 1, Step 5

3. Click **"Add secret"** (green button at bottom)

### Step 4: Verify
You should now see `CLOUDFLARE_API_TOKEN` listed under "Repository secrets"
- It will show when it was created
- It will NOT show the actual token value (that's normal and secure)

---

## PART 3: DEPLOY THE WORKER (1 minute)

Now that the token is added, you can deploy:

### Option A: Merge This PR (Recommended)
1. Go to this PR
2. Click **"Merge pull request"**
3. The workflow will run automatically and deploy the worker

### Option B: Manual Trigger
1. Go to: **https://github.com/ReflectivEI/reflectiv-ai/actions**
2. Click **"Deploy Cloudflare Worker"** in the left sidebar
3. Click **"Run workflow"** button (right side)
4. Select branch: **main**
5. Click **"Run workflow"** (green button)

### Step 5: Watch the Deployment
1. The workflow will start running
2. Click on the workflow run to see progress
3. You should see:
   - ✅ Checkout code
   - ✅ Validate secrets (now passes!)
   - ✅ Deploy to Cloudflare Workers
   - ✅ Deployment summary

---

## VERIFICATION

After deployment completes, test the worker:

### Test 1: Health Check
Open your browser and go to:
```
https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```
You should see: `ok`

### Test 2: Version Check
```
https://my-chat-agent-v2.tonyabdelmalak.workers.dev/version
```
You should see: `{"version":"r10.1"}`

### Test 3: Chat Widget
1. Go to: **https://reflectivei.github.io**
2. Open the chat widget
3. Send a test message
4. You should get a response (no more "failed to fetch" error!)

---

## TROUBLESHOOTING

### "I don't see the Settings tab"
- You need to be the repository owner or have admin access
- Contact the repository owner to add the secret for you

### "I can't find API Tokens in Cloudflare"
- Make sure you're logged into the correct Cloudflare account
- Try the direct link: https://dash.cloudflare.com/profile/api-tokens

### "The workflow still fails"
- Double-check the secret name is exactly: `CLOUDFLARE_API_TOKEN`
- Make sure you pasted the complete token (no extra spaces)
- Try deleting and re-creating the secret

### "I lost the token"
- You can't recover it, but you can create a new one
- Delete the old token in Cloudflare (for security)
- Create a new token following Part 1 again
- Update the GitHub secret with the new token

---

## SUMMARY CHECKLIST

- [ ] Created CLOUDFLARE_API_TOKEN in Cloudflare dashboard
- [ ] Copied the token (it won't be shown again!)
- [ ] Added token to GitHub repository secrets
- [ ] Secret name is exactly: `CLOUDFLARE_API_TOKEN`
- [ ] Merged this PR or manually triggered workflow
- [ ] Workflow ran successfully
- [ ] Worker health check returns "ok"
- [ ] Chat widget works without errors

---

## LINKS QUICK REFERENCE

| Step | Link |
|------|------|
| Create Token | https://dash.cloudflare.com/profile/api-tokens |
| Add to GitHub | https://github.com/ReflectivEI/reflectiv-ai/settings/secrets/actions |
| Run Workflow | https://github.com/ReflectivEI/reflectiv-ai/actions |
| Test Health | https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health |
| Test Chat | https://reflectivei.github.io |

---

**Need Help?** Reply to this PR with any questions or issues you encounter.
