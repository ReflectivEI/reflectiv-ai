#!/bin/bash

# Exit on error, undefined variables, and pipe failures
set -euo pipefail

# CORS Testing Script for my-chat-agent-v2 Worker
# Tests both preflight (OPTIONS) and actual requests with different origins

WORKER_URL="https://my-chat-agent-v2.tonyabdelmalak.workers.dev"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== CORS Testing Script for Worker ===${NC}\n"

# Test 1: GitHub Pages Origin (Production)
echo -e "${YELLOW}Test 1: OPTIONS Preflight - GitHub Pages Origin${NC}"
ORIGIN="https://reflectivei.github.io"
echo "Origin: $ORIGIN"
echo "Command: curl -i -X OPTIONS \"$WORKER_URL/chat\" -H \"Origin: $ORIGIN\" -H \"Access-Control-Request-Method: POST\""
echo ""
curl -i -X OPTIONS "$WORKER_URL/chat" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, Authorization" 2>&1 | grep -E "HTTP|Access-Control"
echo ""

# Test 2: Localhost Origin (Development)
echo -e "${YELLOW}Test 2: OPTIONS Preflight - Localhost Origin${NC}"
ORIGIN="http://localhost:3000"
echo "Origin: $ORIGIN"
echo "Command: curl -i -X OPTIONS \"$WORKER_URL/chat\" -H \"Origin: $ORIGIN\" -H \"Access-Control-Request-Method: POST\""
echo ""
curl -i -X OPTIONS "$WORKER_URL/chat" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" 2>&1 | grep -E "HTTP|Access-Control"
echo ""

# Test 3: Actual POST Request with GitHub Pages Origin
echo -e "${YELLOW}Test 3: POST Request - GitHub Pages Origin${NC}"
ORIGIN="https://reflectivei.github.io"
echo "Origin: $ORIGIN"
echo "Command: curl -i -X POST \"$WORKER_URL/chat\" -H \"Origin: $ORIGIN\" -H \"Content-Type: application/json\" -d '{...}'"
echo ""
curl -i -X POST "$WORKER_URL/chat" \
  -H "Origin: $ORIGIN" \
  -H "Content-Type: application/json" \
  -d '{"mode":"sales-coach","user":"Hello, how can I help?","history":[]}' 2>&1 | head -25 | grep -E "HTTP|Access-Control|Content-Type"
echo ""

# Test 4: Actual GET Request to /health
echo -e "${YELLOW}Test 4: GET /health - GitHub Pages Origin${NC}"
ORIGIN="https://reflectivei.github.io"
echo "Origin: $ORIGIN"
echo "Command: curl -i -X GET \"$WORKER_URL/health\" -H \"Origin: $ORIGIN\""
echo ""
curl -i -X GET "$WORKER_URL/health" \
  -H "Origin: $ORIGIN" 2>&1 | grep -E "HTTP|Access-Control|^ok"
echo ""

# Test 5: Denied Origin (should return null)
echo -e "${YELLOW}Test 5: OPTIONS Preflight - Denied Origin (should return null)${NC}"
ORIGIN="https://evil.com"
echo "Origin: $ORIGIN"
echo "Command: curl -i -X OPTIONS \"$WORKER_URL/chat\" -H \"Origin: $ORIGIN\" -H \"Access-Control-Request-Method: POST\""
echo ""
curl -i -X OPTIONS "$WORKER_URL/chat" \
  -H "Origin: $ORIGIN" \
  -H "Access-Control-Request-Method: POST" 2>&1 | grep -E "HTTP|Access-Control"
echo ""

# Test 6: No Origin Header (should return wildcard *)
echo -e "${YELLOW}Test 6: OPTIONS Preflight - No Origin Header (should return *)${NC}"
echo "Origin: (none)"
echo "Command: curl -i -X OPTIONS \"$WORKER_URL/chat\" -H \"Access-Control-Request-Method: POST\""
echo ""
curl -i -X OPTIONS "$WORKER_URL/chat" \
  -H "Access-Control-Request-Method: POST" 2>&1 | grep -E "HTTP|Access-Control"
echo ""

echo -e "${GREEN}=== Testing Complete ===${NC}\n"
echo "Expected Results:"
echo "  Test 1-4: Access-Control-Allow-Origin should match the Origin header"
echo "  Test 5: Access-Control-Allow-Origin should be 'null' (denied)"
echo "  Test 6: Access-Control-Allow-Origin should be '*' (wildcard)"
echo ""
echo "If you see different results, check:"
echo "  1. Has the worker been deployed with updated CORS_ORIGINS?"
echo "  2. Check worker logs for CORS_DENY warnings"
echo "  3. Verify origin is in CORS_ORIGINS list in wrangler.toml"
