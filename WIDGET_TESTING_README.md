# Widget Testing - Local Server Setup

## Overview

This local test server enables comprehensive testing of the ReflectivAI widget with **real HTTP calls** (no fake tests).

## Server Components

### 1. `local-test-server.js` - Local Development Server
- **Port**: 8080 (configurable)
- **Purpose**: Serve widget files and handle API requests
- **Modes**: 
  - **Proxy Mode** (default) - Forwards to real Cloudflare Worker
  - **Mock Mode** - Uses simulated responses for offline testing

### 2. `widget-test.html` - Interactive Browser Test Page
- Browser-based UI for manual testing
- Test different modes interactively
- View real-time results

### 3. `widget-integration-tests.js` - Automated Test Suite
- Command-line test runner
- Tests all widget modes with real HTTP calls
- Validates responses against expected formats

## Quick Start

### Option 1: With Mock Responses (Offline Testing)
```bash
# Start server in mock mode
node local-test-server.js --mock

# In browser, visit:
http://localhost:8080/widget-test.html

# Or run automated tests:
node widget-integration-tests.js
```

### Option 2: With Real Worker (Online Testing)
```bash
# Start server in proxy mode (forwards to real worker)
node local-test-server.js

# Tests will hit the real Cloudflare Worker
node widget-integration-tests.js
```

## Usage Examples

### Start the Server
```bash
# Default (proxy mode, port 8080)
node local-test-server.js

# Mock mode for offline testing
node local-test-server.js --mock

# Custom port
node local-test-server.js --port=3000

# Mock mode with custom port
node local-test-server.js --mock --port=3000
```

### Run Automated Tests
```bash
# Test against local server
node widget-integration-tests.js

# Test with verbose output
node widget-integration-tests.js --verbose

# Test against custom endpoint
node widget-integration-tests.js --endpoint=http://localhost:3000/chat
```

### Browser Testing
1. Start the server: `node local-test-server.js --mock`
2. Open: `http://localhost:8080/widget-test.html`
3. Use the UI to:
   - Select a mode
   - Enter a test message
   - Run individual tests or all tests
   - View real-time results

## What Gets Tested

### Modes Tested (Real mode keys from widget.js)
- ✅ `sales-coach` - Sales coaching with scoring
- ✅ `role-play` - HCP role-play scenarios
- ✅ `emotional-assessment` - Emotional intelligence feedback
- ✅ `product-knowledge` - Product information queries
- ✅ `general-knowledge` - General assistant mode

### Response Validation
- ✅ HTTP status codes
- ✅ Reply field presence
- ✅ Mode-specific fields (coach, plan, etc.)
- ✅ Response structure
- ✅ Response timing

## Testing Principles

Following `TESTING_GUARDRAILS.md`:
- ✅ Real HTTP calls only (no mocks in tests)
- ✅ Real mode keys from widget.js
- ✅ Actual response validation
- ✅ No theoretical/simulated results
- ❌ No fake test data
- ❌ No imaginary scenarios

## Server Endpoints

The local server provides:

- `GET /` - Serves widget-test.html
- `GET /health` - Health check endpoint
- `POST /chat` - Chat API endpoint (proxy or mock)
- `GET /widget.js` - Widget JavaScript
- `GET /widget.css` - Widget styles
- `GET /widget-test.html` - Test page

## Troubleshooting

### Server won't start
```bash
# Check if port is in use
lsof -i :8080

# Use different port
node local-test-server.js --port=3000
```

### Tests fail with connection refused
```bash
# Make sure server is running first
node local-test-server.js --mock

# Then run tests in another terminal
node widget-integration-tests.js
```

### Worker unavailable
```bash
# Use mock mode for offline testing
node local-test-server.js --mock
```

## Example Output

### Server Start
```
╔════════════════════════════════════════════════════════════════════╗
║  ReflectivAI Widget - Local Test Server                           ║
╚════════════════════════════════════════════════════════════════════╝

  🌐 Server running at: http://localhost:8080
  📝 Test page: http://localhost:8080/widget-test.html
  🔧 Mode: MOCK (offline)
  🎯 Worker URL: https://my-chat-agent-v2.tonyabdelmalak.workers.dev

  Press Ctrl+C to stop

═══════════════════════════════════════════════════════════════════
```

### Test Results
```
Test WGT-SC-01: Sales coach with PrEP question
──────────────────────────────────────────────────────────────────
Mode: sales-coach
Message: "How should I approach an HCP about PrEP for HIV prevention?"

Response time: 245ms
HTTP Status: 200

Validations:
  ✓ HTTP 200 OK
  ✓ Reply field present
  ✓ Coach data present (as expected)
    Overall score: 4

✅ PASSED - WGT-SC-01
```
