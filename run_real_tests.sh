#!/bin/bash

# PHASE 3 REAL TEST EXECUTION
# This script runs genuinely real tests against the deployed Reflectiv worker
# No mocks. No simulation. Real HTTP requests. Real validation.

echo ""
echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║                 PHASE 3 REAL TEST EXECUTION                       ║"
echo "║          Testing: reflectiv-ai deployed worker.js (r10.1)        ║"
echo "║          Repository: ReflectivEI/reflectiv-ai (main branch)      ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Check if Node.js is available
if ! command -v node &> /dev/null; then
  echo "❌ ERROR: Node.js is not installed"
  exit 1
fi

echo "✅ Environment verified"
echo "   Node.js: $(node --version)"
echo "   Worker: https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
echo "   Repository: reflectiv-ai (main)"
echo ""

# Change to project directory
cd /Users/anthonyabdelmalak/Desktop/reflectiv-ai || exit 1
echo "📂 Working directory: $(pwd)"
echo ""

# Run the real tests
echo "🚀 Starting real test execution..."
echo ""

node real_test.js

# Capture exit code
EXIT_CODE=$?

echo ""
if [ $EXIT_CODE -eq 0 ]; then
  echo "✅ TESTS COMPLETED SUCCESSFULLY"
else
  echo "⚠️  Tests completed with status code: $EXIT_CODE"
fi

exit $EXIT_CODE
