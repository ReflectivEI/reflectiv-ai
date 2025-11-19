# ReflectivAI - AI Sales Enablement Platform

[![Deploy Status](https://img.shields.io/badge/deploy-ready-success)](https://reflectiv-ai-1z6a.vercel.app)
[![Workflows](https://img.shields.io/badge/workflows-passing-success)](.github/workflows)

AI-powered sales coaching platform for life sciences with emotional intelligence features.

## 🚀 Quick Start

### Live Demo
- **Production**: https://reflectivei.github.io/reflectiv-ai/
- **Vercel**: https://reflectiv-ai-1z6a.vercel.app

### Features
- **Sales Coach**: AI-powered sales simulation with real-time coaching feedback
- **Role Play**: Practice conversations with AI HCP personas
- **Product Knowledge**: Q&A about products and therapeutic areas
- **Emotional Intelligence**: EI assessment and coaching
- **General Assistant**: General purpose AI assistant

## 🚀 Deployment

### Deploy to Vercel (READY NOW!)

1. **Set Environment Variables** in Vercel Dashboard:
   ```
   PROVIDER_KEY=<your-groq-api-key>
   CORS_ORIGINS=https://reflectiv-ai-1z6a.vercel.app,https://reflectivei.github.io
   ```

2. **Merge PR #125** - Contains critical vercel.json fix

3. **Verify**: Visit your Vercel URL and test the chat widget

See **[DEPLOYMENT_STATUS_FINAL.md](DEPLOYMENT_STATUS_FINAL.md)** for detailed deployment instructions.

## 🐛 Troubleshooting

### Widget doesn't load
- Check browser console (F12) for errors
- Verify widget.js loads successfully

### Chat doesn't respond  
- **Most common**: PROVIDER_KEY not set in Vercel environment variables
- Check CORS configuration
- Verify backend is accessible

See **[DEPLOYMENT_STATUS_FINAL.md](DEPLOYMENT_STATUS_FINAL.md)** for complete troubleshooting guide.

---

**Status**: ✅ Ready to deploy - all workflows passing, vercel.json fixed
**Last Updated**: November 18, 2025
