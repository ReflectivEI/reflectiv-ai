# How to Get a Cloudflare API Token (Token Not Visible)

## The Problem

Cloudflare hides API token values after creation for security. You can't retrieve old tokens - you must create a new one or regenerate an existing one.

## Solution: Create a New Token (5 minutes)

### Step 1: Go to Cloudflare API Tokens Page

https://dash.cloudflare.com/profile/api-tokens

### Step 2: Create New Token

1. Click the **"Create Token"** button (blue button on the right)

### Step 3: Use the "Edit Cloudflare Workers" Template

1. Scroll down to **"Edit Cloudflare Workers"** template
2. Click **"Use template"** button

### Step 4: Configure Permissions (Optional - Template is Already Correct)

The template already has the right permissions. You can use it as-is or customize:

**Account Resources:**
- Account → Workers Scripts → Edit ✅
- Account → Workers KV Storage → Edit ✅

**Zone Resources:**
- Zone → Workers Routes → Edit ✅

**Account Selection:**
- Select "All accounts" or your specific account

### Step 5: Create the Token

1. Scroll to bottom
2. Click **"Continue to summary"**
3. Review permissions
4. Click **"Create Token"**

### Step 6: COPY THE TOKEN NOW (Critical!)

⚠️ **IMPORTANT:** You will only see the token value ONCE.

1. You'll see a screen showing your new token
2. Click **"Copy"** button or manually copy the entire token string
3. **SAVE IT SOMEWHERE SAFE** (password manager, secure note, etc.)

The token looks like this:
```
abc123xyz789...long_string_of_letters_and_numbers
```

### Step 7: Use the Token to Deploy

Now you can deploy using the token you just copied:

```bash
# Navigate to repository root
cd /path/to/reflectiv-ai

# Deploy with the token you just copied
CLOUDFLARE_API_TOKEN="paste-token-here" npx wrangler deploy

# Add Groq API key secret
npx wrangler secret put PROVIDER_KEY
```

---

## Alternative: Regenerate Existing Token

If you want to use one of your existing tokens:

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Find the token you want to use (e.g., "GitHub Actions – Workers Deploy")
3. Click **"Roll"** button next to the token
4. Click **"Confirm"** 
5. **Copy the new token value** (this invalidates the old one)
6. Use it in the deployment command

---

## Which Token Should I Create/Use?

**Any of these will work:**

1. **Create new "Edit Cloudflare Workers"** template ← **Easiest option**
2. Regenerate "GitHub Actions – Workers Deploy" token
3. Regenerate "Edit Cloudflare Workers" token

All have the necessary permissions to deploy the worker.

---

## Complete Deployment Example with New Token

```bash
# Step 1: Create token at https://dash.cloudflare.com/profile/api-tokens
# - Click "Create Token"
# - Use "Edit Cloudflare Workers" template
# - Copy the token value

# Step 2: Navigate to repository
cd ~/projects/reflectiv-ai

# Step 3: Verify location
ls wrangler.toml worker.js

# Step 4: Deploy (paste your new token)
CLOUDFLARE_API_TOKEN="your-new-token-here" npx wrangler deploy

# Step 5: Add Groq API secret
npx wrangler secret put PROVIDER_KEY
# (paste Groq API key when prompted)

# Step 6: Verify deployment
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

---

## Security Note

**Never share or commit your API token!**
- Don't paste it in public places
- Don't commit it to git
- Store it securely (password manager recommended)
- If you accidentally expose it, roll/regenerate it immediately

---

## Summary

1. ✅ You **cannot** retrieve old token values
2. ✅ You **must** create a new token or regenerate an existing one
3. ✅ Copy the token value immediately when shown
4. ✅ Use the "Edit Cloudflare Workers" template (easiest)
5. ✅ Deploy immediately with the new token
