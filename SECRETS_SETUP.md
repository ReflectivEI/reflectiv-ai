# Cloudflare Worker Secrets Setup

This guide explains how to configure secrets for the ReflectivAI Cloudflare Worker.

## Overview

Secrets are encrypted environment variables that store sensitive data like API keys. They are:
- ✅ Encrypted at rest
- ✅ Never exposed in logs or code
- ✅ Only accessible at runtime by your worker
- ✅ Not stored in `wrangler.toml` or version control

---

## Required Secrets

### 1. PROVIDER_KEY (Required)

**Purpose:** Authentication key for Groq AI API  
**Format:** `gsk_...` (starts with "gsk_")  
**Get Key:** [https://console.groq.com/keys](https://console.groq.com/keys)

---

## Setup Methods

### Method 1: Automated Script (Recommended)

```bash
# Make the script executable
chmod +x setup-secrets.sh

# Run the setup script
./setup-secrets.sh
```

The script will guide you through configuring all required secrets.

---

### Method 2: Manual Configuration

#### Step 1: Install Wrangler (if not already installed)

```bash
npm install -g wrangler
```

Or use via npx (no installation needed):
```bash
npx wrangler --version
```

#### Step 2: Login to Cloudflare

```bash
wrangler login
```

This will open your browser to authenticate with Cloudflare.

#### Step 3: Set PROVIDER_KEY

```bash
wrangler secret put PROVIDER_KEY
```

When prompted, paste your Groq API key and press Enter.

---

## Verification

### List Current Secrets

```bash
wrangler secret list
```

Expected output:
```
Secret Name    
─────────────  
PROVIDER_KEY   
```

### Test the Configuration

```bash
# Deploy the worker
wrangler deploy

# Run tests
npm test
```

---

## Updating Secrets

To update an existing secret, simply run the `put` command again:

```bash
wrangler secret put PROVIDER_KEY
```

Enter the new value when prompted.

---

## Deleting Secrets

To remove a secret:

```bash
wrangler secret delete PROVIDER_KEY
```

⚠️ **Warning:** Deleting PROVIDER_KEY will cause the worker to return 500 errors.

---

## Security Best Practices

### ✅ DO:
- Keep your API keys private
- Rotate keys regularly (every 90 days recommended)
- Use different keys for development and production
- Monitor API usage in Groq dashboard
- Set up billing alerts

### ❌ DON'T:
- Commit secrets to git
- Share keys in chat/email
- Use production keys in development
- Store keys in `wrangler.toml` [vars] section
- Expose keys in client-side code

---

## Troubleshooting

### "wrangler: command not found"

**Solution 1:** Install globally
```bash
npm install -g wrangler
```

**Solution 2:** Use npx
```bash
npx wrangler secret put PROVIDER_KEY
```

### "Not authenticated"

**Solution:** Login to Cloudflare
```bash
wrangler login
```

### "Worker returns 500 errors after deployment"

**Cause:** PROVIDER_KEY not set or invalid

**Solution:**
```bash
# Verify secret is set
wrangler secret list

# If missing, set it
wrangler secret put PROVIDER_KEY

# Verify key format (should start with "gsk_")
```

### "API key invalid" in logs

**Cause:** Expired or incorrect API key

**Solution:**
1. Get a new key from [Groq Console](https://console.groq.com/keys)
2. Update the secret:
   ```bash
   wrangler secret put PROVIDER_KEY
   ```
3. Redeploy:
   ```bash
   wrangler deploy
   ```

---

## Environment-Specific Secrets

If you need different secrets for different environments:

### Development
```bash
wrangler secret put PROVIDER_KEY --env dev
```

### Production
```bash
wrangler secret put PROVIDER_KEY --env production
```

Update `wrangler.toml` to define environments:
```toml
[env.dev]
name = "my-chat-agent-v2-dev"

[env.production]
name = "my-chat-agent-v2"
```

---

## Getting Your Groq API Key

1. Go to [https://console.groq.com](https://console.groq.com)
2. Sign up or log in
3. Navigate to **API Keys** section
4. Click **Create API Key**
5. Give it a descriptive name (e.g., "ReflectivAI Production")
6. Copy the key (starts with `gsk_...`)
7. Use it when setting up PROVIDER_KEY secret

⚠️ **Important:** The key is only shown once. Save it securely!

---

## Quick Reference

```bash
# List secrets
wrangler secret list

# Add/update secret
wrangler secret put PROVIDER_KEY

# Delete secret
wrangler secret delete PROVIDER_KEY

# Deploy worker
wrangler deploy

# View worker logs
wrangler tail

# Test locally (uses mock env vars)
npm test
```

---

## Support

If you encounter issues:

1. **Check Cloudflare Worker Logs:**
   ```bash
   wrangler tail
   ```

2. **Verify secret is set:**
   ```bash
   wrangler secret list
   ```

3. **Check worker.js expects the secret:**
   The worker checks for `env.PROVIDER_KEY` on line ~415

4. **Review documentation:**
   - [Cloudflare Workers Secrets](https://developers.cloudflare.com/workers/configuration/secrets/)
   - [Wrangler Commands](https://developers.cloudflare.com/workers/wrangler/commands/)

---

*Last Updated: November 10, 2025*
