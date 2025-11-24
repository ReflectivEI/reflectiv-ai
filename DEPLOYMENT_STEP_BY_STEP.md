# Step-by-Step Deployment Guide

## Your Questions Answered

### Q: Do I run the command in the repo root directory?
**A: YES!** You must be in the repository root directory (where you cloned reflectiv-ai).

### Q: Which token do I use?
**A: Use the "GitHub Actions – Workers Deploy" token.**

---

## Complete Deployment Steps

### Step 1: Open Terminal and Navigate to Repository

```bash
# Navigate to your repository root
# Replace /path/to/reflectiv-ai with your actual path
cd /path/to/reflectiv-ai
```

**Example paths:**
- macOS/Linux: `cd ~/projects/reflectiv-ai` or `cd ~/Documents/reflectiv-ai`
- Windows: `cd C:\Users\YourName\Documents\reflectiv-ai`

### Step 2: Verify You're in the Right Place

```bash
# This should show both files:
ls wrangler.toml worker.js
```

**Expected output:**
```
wrangler.toml  worker.js
```

If you see "No such file or directory", you're in the wrong folder. Navigate to the correct folder first.

### Step 3: Get Your Cloudflare Token Value

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Find the token named **"GitHub Actions – Workers Deploy"**
3. Click "View" or the token name
4. **Copy the token value** (it's a long string starting with letters/numbers)

### Step 4: Set the Token and Deploy

**OPTION A: One-line approach (recommended)**

```bash
# Replace YOUR_TOKEN_HERE with the actual token value you copied
CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE" npx wrangler deploy
```

**OPTION B: Two-step approach**

```bash
# Step 1: Set the token
export CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE"

# Step 2: Deploy
npx wrangler deploy
```

### Step 5: Add the Groq API Key Secret

```bash
npx wrangler secret put PROVIDER_KEY
```

When prompted, paste your Groq API key (starts with `gsk_`) and press Enter.

### Step 6: Verify Deployment

```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

**Expected response:** `ok`

---

## Complete Example (Copy-Paste Ready)

Here's what it looks like all together:

```bash
# 1. Navigate to repository
cd ~/projects/reflectiv-ai

# 2. Verify location
ls wrangler.toml worker.js

# 3. Deploy (replace YOUR_TOKEN_HERE with actual token)
CLOUDFLARE_API_TOKEN="YOUR_TOKEN_HERE" npx wrangler deploy

# 4. Add secret
npx wrangler secret put PROVIDER_KEY
# (paste Groq API key when prompted)

# 5. Verify
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

---

## Troubleshooting

### Error: "Missing entry-point"
**Cause:** You're not in the repository root directory.
**Fix:** Run `cd /path/to/reflectiv-ai` first, then verify with `ls wrangler.toml worker.js`

### Error: "Authentication error" or "Invalid token"
**Cause:** Wrong token or typo in token value.
**Fix:** 
1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Find "GitHub Actions – Workers Deploy" token
3. Copy the ENTIRE token value (no spaces, no quotes when copying)
4. Try again

### Error: "Account ID not found"
**Cause:** Token doesn't have access to the account.
**Fix:** Use the "GitHub Actions – Workers Deploy" token which has "All accounts" access.

---

## What Each Token Is For

You have 3 tokens. Here's which one to use:

| Token Name | Use For | Use This? |
|------------|---------|-----------|
| **GitHub Actions – Workers Deploy** | Deploying workers from command line or GitHub Actions | ✅ **YES - USE THIS ONE** |
| Edit Cloudflare Workers | General worker editing | ⚠️ Also works, but GitHub Actions token is better |
| my-chat-agent build token | Special configurations (D1, Queues, etc.) | ❌ No - overkill for this task |

---

## Summary

1. **Where:** Run commands in repository root (`cd /path/to/reflectiv-ai`)
2. **Which token:** "GitHub Actions – Workers Deploy" 
3. **How to use token:** Copy token value, paste it replacing `YOUR_TOKEN_HERE` in the command
4. **What happens:** Worker deploys to Cloudflare, widget works immediately

**Time needed:** 5 minutes

**After deployment:** Open https://reflectivei.github.io/reflectiv-ai/ and the widget will work!
