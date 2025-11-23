# ReflectivAI - AI Sales Enablement for Life Sciences

A comprehensive AI-powered sales coaching platform designed specifically for life sciences and pharmaceutical sales teams.

## Overview

ReflectivAI provides AI-driven coaching across multiple modes:
- **Sales Coach**: Real-time guidance for HCP interactions
- **Role Play**: Practice scenarios with AI HCPs
- **Product Knowledge**: Therapeutic area expertise
- **Emotional Assessment**: EI-based communication coaching
- **General Knowledge**: Broader Q&A support

## Development Setup

### Prerequisites
- Node.js 16+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build Tailwind CSS
npm run build:css
```

### Build Scripts

```bash
# Build production CSS (required before deployment)
npm run build:css

# Watch for CSS changes during development
npm run watch:css

# Run tests
npm test
npm run test:all
```

### Local Development

```bash
# Start a local server (Python)
python3 -m http.server 8000

# Or use any static file server
# Navigate to http://localhost:8000
```

## Deployment

### GitHub Pages
The site automatically deploys to GitHub Pages on push to `main` branch via `.github/workflows/pages.yml`.

**Important**: Always run `npm run build:css` before committing if you've modified Tailwind classes.

### Cloudflare Worker
The backend API is deployed as a Cloudflare Worker. See `worker.js` for implementation.

Required environment variables:
- `PROVIDER_URL`: AI provider API endpoint (e.g., Groq API)
- `PROVIDER_MODEL`: Model name (e.g., llama-3.3-70b-versatile)
- `PROVIDER_KEY`: API authentication key
- `CORS_ORIGINS`: Comma-separated allowed origins

## Project Structure

```
.
├── index.html              # Main landing page
├── widget.js               # Chat widget & coaching logic
├── worker.js               # Cloudflare Worker (backend API)
├── dist/
│   └── tailwind.min.css   # Compiled Tailwind CSS (committed)
├── src/
│   └── tailwind.css       # Tailwind source file
├── assets/
│   └── chat/              # Coaching configs, personas, knowledge base
├── tests/                 # Test files
└── .github/workflows/     # CI/CD workflows
```

## CSS Build System

This project uses **Tailwind CSS v4** with PostCSS:

1. Source file: `src/tailwind.css` (contains @tailwind directives + custom styles)
2. Build output: `dist/tailwind.min.css` (committed to repo)
3. Configuration: `tailwind.config.js` and `postcss.config.js`

**Important**: The `dist/` directory is committed to the repository so GitHub Pages can serve the compiled CSS. Always rebuild CSS before committing changes to Tailwind classes.

## Troubleshooting

### Tailwind styles not working
- Run `npm run build:css` to rebuild the CSS
- Check that `dist/tailwind.min.css` exists
- Verify `index.html` references the correct CSS file

### 502 Errors from Cloudflare Worker
- Check Cloudflare Worker logs in dashboard
- Verify environment variables are set correctly
- Test AI provider API health
- Check worker resource usage and limits

### Console Errors
- Hard refresh: Ctrl+Shift+R (Windows/Linux) or Cmd+Shift+R (Mac)
- Clear browser cache
- Try incognito/private browsing mode
- Check browser console for specific error messages

## Contributing

1. Create a feature branch
2. Make your changes
3. Run `npm run build:css` if you modified Tailwind classes
4. Test locally
5. Submit a pull request

## License

Proprietary - ReflectivEI

## Support

For issues or questions, please contact the ReflectivAI team.
