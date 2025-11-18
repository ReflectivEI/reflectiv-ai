# Getting Started with ReflectivAI

**Complete beginner?** This guide walks you through everything.

## What You Need

- ☐ A computer with internet
- ☐ Command line / Terminal access
- ☐ Git installed
- ☐ Node.js installed (for npm)
- ☐ 10-15 minutes

## Step-by-Step Setup

### 1. Get the Code

```bash
# Clone the repository
git clone https://github.com/ReflectivEI/reflectiv-ai.git
cd reflectiv-ai
```

✅ **Checkpoint:** You should see files like `worker.js`, `widget.js`, `index.html`

### 2. Get a GROQ API Key

This is your AI provider - it's free to start.

1. Go to: https://console.groq.com/
2. Sign up (use Google or email)
3. Click "API Keys" in sidebar
4. Click "Create API Key"
5. Give it a name: "ReflectivAI"
6. Copy the key (starts with `gsk_...`)
7. Save it somewhere safe

✅ **Checkpoint:** You have a key starting with `gsk_`

### 3. Choose Your Deployment

**Pick ONE** - we recommend Cloudflare:

#### Option A: Cloudflare Workers (Recommended)

```bash
# Install Wrangler
npm install -g wrangler

# Login to Cloudflare (creates free account if needed)
wrangler login

# Set your API key
wrangler secret put PROVIDER_KEY
# Paste your GROQ key when prompted

# Deploy
wrangler deploy
```

✅ **Checkpoint:** You see: `Published my-chat-agent-v2`

#### Option B: Vercel

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy (follow prompts)
vercel

# After deploy, set environment variables:
# Go to: https://vercel.com/dashboard
# Click your project → Settings → Environment Variables
# Add: PROVIDER_KEY = your-groq-key
# Add: CORS_ORIGINS = https://your-app.vercel.app

# Redeploy to apply env vars
vercel --prod
```

✅ **Checkpoint:** You see: `Production: https://your-app.vercel.app`

### 4. Test the Backend

**For Cloudflare:**
```bash
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
# Should return: ok
```

**For Vercel:**
```bash
curl https://your-app.vercel.app/api/chat
# Should return 405 (not 404) - this is good!
```

✅ **Checkpoint:** Health check works OR chat endpoint exists (not 404)

### 5. Test the Frontend

**GitHub Pages** (auto-deployed):
1. Open: https://reflectivei.github.io/reflectiv-ai/
2. Click "Explore Platform"
3. Select "Sales Coach"
4. Type: "Tell me about HIV prevention"
5. Should get a response in 2-5 seconds

✅ **Checkpoint:** You get an AI response

**Local testing:**
```bash
# Start a local web server
python -m http.server 8000
# Or: python3 -m http.server 8000
# Or: npx serve

# Open browser to:
http://localhost:8000
```

✅ **Checkpoint:** Page loads and chat works

---

## Troubleshooting

### Problem: "command not found: wrangler"

**Fix:**
```bash
npm install -g wrangler

# If that fails, try:
npm install -g npm@latest
npm install -g wrangler
```

### Problem: "command not found: vercel"

**Fix:**
```bash
npm install -g vercel
```

### Problem: "command not found: npm"

You need to install Node.js first:
- Download from: https://nodejs.org/
- Install the LTS version
- Restart your terminal
- Try again

### Problem: Health check returns error

**Causes:**
1. PROVIDER_KEY not set
2. API key is invalid
3. Worker not deployed

**Fix:**
```bash
# Set/reset the API key
wrangler secret put PROVIDER_KEY

# Redeploy
wrangler deploy

# Test again
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

### Problem: Frontend shows "Still working..." forever

**Causes:**
1. Backend not deployed
2. Wrong backend URL
3. CORS issue

**Debug:**
1. Open browser DevTools (F12)
2. Go to Console tab
3. Look for errors
4. Go to Network tab
5. Look for failed requests (red)

**Common fixes:**
- Backend not deployed → Deploy it
- CORS error → Add your domain to CORS_ORIGINS in wrangler.toml
- 404 error → Backend URL is wrong in widget.js

### Problem: "provider_http_401"

**Cause:** GROQ API key is wrong or not set

**Fix:**
```bash
# For Cloudflare:
wrangler secret put PROVIDER_KEY
# Enter your GROQ key

# For Vercel:
# Set in dashboard → Environment Variables → PROVIDER_KEY
```

---

## What's Next?

### Test All Features

1. **Sales Coach** - Get AI feedback with scores
2. **Role Play** - Practice with HCP personas
3. **Emotional Intelligence** - EI assessment
4. **Product Knowledge** - Test on diseases
5. **General Knowledge** - General Q&A

### Customize

- Edit `wrangler.toml` to change settings
- Edit `widget.js` to modify the UI
- Edit `worker.js` to change AI behavior
- Add your own facts to the database

### Learn More

- Read [README.md](README.md) for full documentation
- See [DEPLOYMENT_GUIDE.md](DEPLOYMENT_GUIDE.md) for advanced setup
- Check [TROUBLESHOOTING_404.md](TROUBLESHOOTING_404.md) for Vercel issues
- Review [QUICKSTART.md](QUICKSTART.md) for fast deployment

---

## Success Checklist

Before you're done, verify:

- [ ] Backend deployed (Cloudflare or Vercel)
- [ ] Health check returns "ok" (or API route exists)
- [ ] GROQ API key is set as environment variable
- [ ] Frontend loads (GitHub Pages or local)
- [ ] Can send messages and get responses
- [ ] No errors in browser console
- [ ] All 5 modes work

**If all checked: You're ready to use ReflectivAI! 🎉**

---

## Quick Commands Reference

### Cloudflare
```bash
# Deploy
wrangler deploy

# Check logs
wrangler tail

# Update secret
wrangler secret put PROVIDER_KEY

# Check deployment
curl https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
```

### Vercel
```bash
# Deploy
vercel --prod

# Check deployments
vercel ls

# View logs
vercel logs

# Test endpoint
curl https://your-app.vercel.app/api/chat
```

### Git
```bash
# Get latest code
git pull

# See changes
git status

# Undo local changes
git checkout .
```

---

## Help & Support

**Still stuck?**

1. Check [QUICKSTART.md](QUICKSTART.md) - 5 minute setup
2. Check [TROUBLESHOOTING_404.md](TROUBLESHOOTING_404.md) - Vercel issues
3. Check [README.md](README.md) - Full documentation
4. Open an issue on GitHub
5. Check existing issues/discussions

**Most common issue:** PROVIDER_KEY not set  
**Most common fix:** `wrangler secret put PROVIDER_KEY`

---

**Remember:** The system works. If it's not working, it's a configuration issue, not a code issue.
