# ReflectivAI Widget Refactor

## Overview

This repository contains a refactored modular widget architecture for the ReflectivAI sales coaching platform. The refactor splits the monolithic `widget.js` into mode-specific modules with improved latency, CSP hardening, and strict 4-section formatting for Sales Simulation mode.

## Directory Structure

```
reflectiv-ai/
├── apps/
│   ├── site/
│   │   ├── index.html           # Main HTML (with new widget loading)
│   │   ├── assets/
│   │   │   ├── css/
│   │   │   │   └── widget.css   # Themed with CSS vars
│   │   │   └── prompts/
│   │   │       ├── emotional-assessment.md
│   │   │       ├── product-knowledge.md
│   │   │       ├── sales-simulation.md
│   │   │       ├── role-play.md
│   │   │       └── system.md
│   │   └── widget/
│   │       ├── main.js           # Entry point with feature flag
│   │       ├── core/
│   │       │   ├── bus.js       # Event bus for components
│   │       │   ├── api.js       # Network layer (timeout/retry/abort)
│   │       │   ├── ui.js        # Pure DOM helpers
│   │       │   └── guards.js    # Schema validation
│   │       └── modes/
│   │           ├── emotional-assessment/
│   │           │   ├── renderer.js
│   │           │   ├── scoring.json
│   │           │   └── ui.json
│   │           ├── product-knowledge/
│   │           │   ├── renderer.js
│   │           │   ├── scoring.json
│   │           │   └── ui.json
│   │           ├── sales-simulation/
│   │           │   ├── renderer.js  # 4-section renderer
│   │           │   ├── scoring.json
│   │           │   └── ui.json
│   │           └── role-play/
│   │               ├── renderer.js
│   │               ├── scoring.json
│   │               └── ui.json
│   └── worker/
│       ├── worker.js            # Cloudflare Worker
│       └── wrangler.toml
├── tools/
│   ├── scripts/
│   │   └── dev-server.mjs       # Local dev server
│   └── tests/
│       └── leakage.spec.mjs     # Mode isolation & format tests
├── index.html                   # Root HTML (updated to use new structure)
├── widget.js                    # Legacy fallback widget
└── widget.css                   # Legacy CSS (kept for compatibility)
```

## Key Features

### 1. Modular Architecture
- **Core modules**: Event bus, API layer, UI helpers, schema guards
- **Mode-specific renderers**: Each mode has its own rendering logic
- **Dynamic loading**: Modes loaded on-demand as ES6 modules

### 2. Sales Simulation 4-Section Format
The sales-simulation renderer strictly enforces four sections in order:
1. **Challenge**: Key challenge or objection
2. **Rep Approach**: Evaluation of rep's strategy
3. **Impact**: Assessment of response impact
4. **Suggested Phrasing**: Specific phrases to use

**Never drops "Suggested Phrasing"** - validates and auto-retries if missing.

### 3. Latency Optimizations
- **Preload critical resources**: config.json and scenarios.merged.json via `<link rel="preload">`
- **Debounced input**: 300ms debounce on textarea to reduce layout thrash
- **RAF batching**: DOM updates batched via `requestAnimationFrame`
- **Fast-fail UI**: 8-second timeout with retry button
- **Exponential backoff**: 3 retries with 600ms, 1.2s, 2.4s delays
- **Fetch timeouts**: 10s default with abort signals
- **EventSource support**: Ready for SSE streaming (Worker upgrade needed)

### 4. CSP Hardening
Enhanced Content Security Policy:
- Worker origin explicitly allowed
- EventSource/SSE support via `connect-src`
- Strict `worker-src` for web workers
- Tailwind CDN and Google Fonts permitted

### 5. CSS Variables
Themed with standardized CSS vars:
- `--accent`: #20bfa9 (teal)
- `--radius`: 12px
- `--ink`: #1e2a3a (dark text)
- `--line`: #d9e3ef (borders)
- `--soft`: #ecf3fb (backgrounds)

### 6. Feature Flag
Control which widget version to use:
```javascript
window.REFLECTIV_USE_NEW_WIDGET = true; // false for legacy widget.js
```

## Development

### Run Tests
```bash
node tools/tests/leakage.spec.mjs
```

Tests validate:
- 4-section schema enforcement
- Missing section detection
- JSON and labeled text parsing
- Mode isolation
- Auto-retry logic

### Start Dev Server
```bash
node tools/scripts/dev-server.mjs 3000
```
Then open http://localhost:3000/

### Manual Testing
1. Open the coach modal
2. Select "Sales Simulation" mode
3. Send a test message
4. Verify response contains all 4 sections:
   - Challenge
   - Rep Approach
   - Impact
   - Suggested Phrasing

### Test with Legacy Widget
Set feature flag to false:
```javascript
window.REFLECTIV_USE_NEW_WIDGET = false;
```

## API Layer

### Network Features
- **Timeout**: 10s default per request
- **Retries**: 3 attempts with exponential backoff
- **Abort signals**: Clean cancellation support
- **Error handling**: Graceful fallbacks

### Event Bus
Components communicate via events:
- `api:request` - Request started
- `api:response` - Response received
- `api:retry` - Retry attempt
- `guards:validate` - Validation result
- `guards:invalid` - Invalid response
- `widget:mounted` - Widget initialized

## Schema Validation

### Guards Module
Validates responses before rendering:
```javascript
import { guardedValidate } from './core/guards.js';

const result = guardedValidate(response, 'sales-simulation');
if (!result.valid) {
  // Auto-retry with corrective hint
  if (result.shouldRetry) {
    conversation.push({ role: 'system', content: result.hint });
    // Re-send request
  }
}
```

### Validation Rules
- Sales Simulation: Requires all 4 sections
- Other modes: Pass-through (no validation)
- Max retries: 1 (prevents infinite loops)
- Corrective hints: Tells LLM which sections are missing

## CSS Theming

All styles use CSS variables for easy theming:
```css
:root {
  --accent: #20bfa9;
  --radius: 12px;
  --ink: #1e2a3a;
  --line: #d9e3ef;
  --soft: #ecf3fb;
}
```

Override in your own stylesheet or inline to customize appearance.

## Browser Support

- Modern browsers with ES6 module support
- EventSource API (for streaming, optional)
- `requestAnimationFrame` for smooth rendering
- Fallback to legacy widget for older browsers

## Deployment

### GitHub Pages
The current structure works with GitHub Pages:
1. Root `index.html` serves main site
2. New widget modules loaded as ES6 modules
3. Legacy widget.js provides fallback

### Cloudflare Worker
Worker files in `apps/worker/`:
```bash
cd apps/worker
wrangler publish
```

## Migration Guide

### From Legacy Widget
1. Keep `widget.js` in place (fallback)
2. Set `window.REFLECTIV_USE_NEW_WIDGET = true`
3. Load new CSS: `apps/site/assets/css/widget.css`
4. Load main.js: `<script type="module" src="apps/site/widget/main.js"></script>`

### Gradual Rollout
Use feature flag for A/B testing:
```javascript
// Roll out to 50% of users
window.REFLECTIV_USE_NEW_WIDGET = Math.random() < 0.5;
```

## Troubleshooting

### Widget doesn't load
- Check browser console for module loading errors
- Verify CSP allows `script-src 'self'`
- Ensure files served with correct MIME types

### Missing sections in Sales Simulation
- Check `guards:invalid` events in console
- Verify Worker returns all 4 sections
- Review auto-retry logs

### Styling issues
- Confirm CSS loaded from correct path
- Check CSS variable overrides
- Verify no conflicting global styles

## Contributing

### Adding New Modes
1. Create folder in `apps/site/widget/modes/[mode-name]/`
2. Add `renderer.js`, `scoring.json`, `ui.json`
3. Implement render function matching naming convention
4. Add mode to selector in `main.js`

### Adding Tests
Add tests to `tools/tests/leakage.spec.mjs`:
```javascript
runner.test('my test name', () => {
  // test code
  assert(condition, 'message');
});
```

## Performance Metrics

Expected improvements over legacy widget:
- **First paint**: ~15% faster (preloading)
- **Input responsiveness**: ~300ms debounce eliminates jank
- **Render time**: RAF batching reduces forced reflows
- **Failed request recovery**: 8s timeout vs. hanging indefinitely

## Security

### CSP Policy
Strict Content Security Policy:
- No inline scripts (except config blocks)
- Worker origins explicitly allowed
- External resources limited to Tailwind CDN, Google Fonts

### Validation
- Client-side schema validation prevents malformed data
- Server-side validation in Worker (unchanged)
- No eval() or Function() constructors

## License

[Add license information]

## Support

For issues or questions:
- Open GitHub issue
- Review test suite for examples
- Check browser console for detailed logs
