# ReflectivAI Formatting Pipeline

This document describes the centralized parsing and formatting system for ReflectivAI.

## Architecture

### Parser Modules (`assets/chat/core/parsers/`)

- **`bullets.cjs`**: Bullet parsing utilities (parseSalesCoachBullets)
- **`sections.cjs`**: Section extraction utilities (extractLabeledSection, escapeRegExp)
- **`normalize.cjs`**: Text normalization utilities (normalizeGuidanceLabels)
- **`citations.cjs`**: Citation processing utilities (convertCitations, esc)
- **`index.cjs`**: Unified exports for all parsing functions

### Contract Definitions (`assets/chat/core/contracts/`)

- **`salesCoach.cjs`**: Sales Coach mode contract (sections, bullets, citations, error messages)
- **`rolePlay.cjs`**: Role Play mode contract (leak patterns, sanitization rules)
- **`productKnowledge.cjs`**: Product Knowledge mode contract (citation/reference rules)
- **`emotionalAssessment.cjs`**: Emotional Assessment mode contract (minimal, EI-focused)
- **`generalKnowledge.cjs`**: General Knowledge mode contract (basic markdown)

## Testing

Run the full test suite:

```bash
npm run test:phase2
```

Individual suites:

- `npm run test:parsing`: Edge-case bullet/section parsing
- `npm run test:cross-mode`: Cross-mode stability
- `npm run test:parsers`: Parser module unit tests
- `npm run test:integration`: End-to-end integration tests

## Adding a New Mode

1. Create a contract file in `assets/chat/core/contracts/<mode>.cjs`
2. Define required sections, validation rules, error messages
3. Update `widget.js` formatting logic to use the contract
4. Add mode-specific tests

## Maintenance

When modifying parsing logic:

1. Update the parser modules first
2. Update contracts if validation rules change
3. Run full test suite
4. Test in-browser for all modes

## Bundling Strategy

Parser and contract modules are currently implemented as inline functions within `widget.js` for browser compatibility. The separate `.cjs` files are used only for Node.js testing.

**Deferred Bundling**: No bundling implemented due to static GitHub Pages deployment and IIFE structure. Future bundling could be considered if:
- Switching to a build pipeline
- Loading modules dynamically in browser
- Performance issues arise from inline code size

## CI Integration

Tests are integrated into GitHub Actions via `.github/workflows/tests.yml`:
- Runs on push/PR to main
- Executes full Phase 2 test suite
- Fails CI on any test failure

## Debug Mode

Add `?debug=true` to the URL to enable verbose console logging for:
- Parser inputs/outputs
- Formatting decisions
- Cache hits/misses

This is disabled by default to avoid cluttering production logs.
