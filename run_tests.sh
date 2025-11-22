#!/bin/bash

echo "=========================================="
echo "PHASE 3 TEST SUITE"
echo "=========================================="
echo ""

# Test 1: Local validation (5 quick tests)
echo "STEP 1: Running local tests (5 modes)..."
echo "Command: node tests/phase3_local_test.js"
echo ""

PHASE3_THROTTLE_MS=3000 node tests/phase3_local_test.js
LOCAL_EXIT=$?

echo ""
echo "=========================================="
if [ $LOCAL_EXIT -eq 0 ]; then
  echo "✅ LOCAL TESTS PASSED"
else
  echo "❌ LOCAL TESTS FAILED (Exit code: $LOCAL_EXIT)"
fi
echo "=========================================="
echo ""

# If local tests pass, run edge cases
if [ $LOCAL_EXIT -eq 0 ]; then
  echo "STEP 2: Running edge case tests (30 comprehensive tests)..."
  echo "Command: node tests/phase3_edge_cases.js"
  echo ""
  
  PHASE3_THROTTLE_MS=3000 node tests/phase3_edge_cases.js
  EDGE_EXIT=$?
  
  echo ""
  echo "=========================================="
  if [ $EDGE_EXIT -eq 0 ]; then
    echo "✅ EDGE CASE TESTS PASSED"
  else
    echo "⚠️  EDGE CASE TESTS HAD ISSUES (Exit code: $EDGE_EXIT)"
  fi
  echo "=========================================="
  echo ""
  
  # If edge cases pass, run integration tests
  if [ $EDGE_EXIT -eq 0 ]; then
    echo "STEP 3: Running integration tests (20 real-world tests)..."
    echo "Command: node tests/lc_integration_tests.js"
    echo ""
    
    node tests/lc_integration_tests.js
    INTEG_EXIT=$?
    
    echo ""
    echo "=========================================="
    if [ $INTEG_EXIT -eq 0 ]; then
      echo "✅ INTEGRATION TESTS PASSED"
    else
      echo "⚠️  INTEGRATION TESTS HAD ISSUES (Exit code: $INTEG_EXIT)"
    fi
    echo "=========================================="
  fi
fi

echo ""
echo "TEST SUITE COMPLETE"
echo ""
