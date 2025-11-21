# Deployment Architecture - Cloudflare Workers Only

## Overview

ReflectivAI uses **Cloudflare Workers only** for backend deployment. Vercel is NOT used.

## Backend: Cloudflare Workers

- **Worker Name**: `my-chat-agent-v2`
- **URL**: `https://my-chat-agent-v2.tonyabdelmalak.workers.dev`
- **Configuration**: `wrangler.toml`
- **Deployment**: Via Cloudflare Wrangler CLI or GitHub Actions workflow

### Supported Modes

All 5 coaching modes are fully supported and wired to the Cloudflare Workers backend:

1. **sales-coach** - Sales coaching with structured feedback
2. **role-play** - HCP-Rep role-playing scenarios
3. **emotional-assessment** - EI scoring and feedback
4. **product-knowledge** - Product information and clinical data
5. **general-knowledge** - General purpose assistant

### Endpoints

- `POST /chat` - Main chat endpoint for all 5 modes
- `GET /health` - Health check endpoint
- `HEAD /health` - Quick health check
- `GET /health?deep=1` - Deep health check with provider verification
- `POST /coach-metrics` - Metrics collection

## Frontend: GitHub Pages

- **URL**: `https://reflectivei.github.io/reflectiv-ai/`
- **Deployment**: Via GitHub Actions workflow (`.github/workflows/pages.yml`)
- **Static Files**: `index.html`, `widget.js`, `widget.css`, etc.

## Deployment Workflows

### 1. Cloudflare Workers Deployment

File: `.github/workflows/cloudflare-worker.yml`

Deploys the worker to Cloudflare on push to `main` branch.

**Required Secret**: `CLOUDFLARE_API_TOKEN`

### 2. GitHub Pages Deployment

File: `.github/workflows/pages.yml`

Deploys static frontend to GitHub Pages on push to `main` branch.

### 3. CI/CD Pipeline

File: `.github/workflows/reflectivai-ci.yml`

Runs linting, syntax checks, and integration tests on PRs.

## Local Development

### Deploy Worker Manually

```bash
# Install wrangler
npm install -g wrangler

# Login to Cloudflare
wrangler login

# Deploy worker
wrangler deploy
```

### Test All 5 Modes

```bash
# Run the 5-mode test
node test-5-modes-cloudflare.js
```

## Configuration

### Cloudflare Worker Environment Variables

Configured in `wrangler.toml`:

- `PROVIDER` - AI provider (groq)
- `PROVIDER_URL` - Provider API URL
- `PROVIDER_MODEL` - Model name
- `MAX_OUTPUT_TOKENS` - Maximum output tokens
- `CORS_ORIGINS` - Allowed CORS origins

### Secrets

Set via Wrangler CLI:

```bash
wrangler secret put PROVIDER_KEY
```

## Why Cloudflare Workers Only?

1. **Performance**: Edge computing with global distribution
2. **Scalability**: Automatic scaling with no rate limits from platform
3. **Cost**: Pay-per-use model with generous free tier
4. **Simplicity**: Single backend platform to manage
5. **No Vercel Rate Limits**: Eliminated deployment rate limit issues

## Vercel Removal

The following files were removed to eliminate Vercel integration:

- `vercel.json` - Vercel configuration
- `.vercelignore` - Vercel ignore patterns

These files are now blocked in `.gitignore` to prevent accidental re-addition.
