#!/bin/bash

# PHASE 3 COMPREHENSIVE TEST SUITE
# Tests all UI enhancements, links, and functionality

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║     PHASE 3 COMPREHENSIVE TEST SUITE - UI ENHANCEMENTS        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Test Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Worker: https://my-chat-agent-v2.tonyabdelmalak.workers.dev"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# Test 1: Verify HTML files exist
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: HTML File Existence"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FILES=("ei-scoring-guide.html" "ei-score-details.html" "analytics.html" "index.html" "widget.js")

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    echo "✅ PASS: $file exists"
    ((PASSED++))
  else
    echo "❌ FAIL: $file NOT FOUND"
    ((FAILED++))
  fi
done

echo ""

# Test 2: Verify links in widget.js
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Widget.js EI Panel Links"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "ei-scoring-guide.html" widget.js; then
  echo "✅ PASS: ei-scoring-guide.html link found in widget.js"
  ((PASSED++))
else
  echo "❌ FAIL: ei-scoring-guide.html link NOT found in widget.js"
  ((FAILED++))
fi

if grep -q "ei-score-details.html" widget.js; then
  echo "✅ PASS: ei-score-details.html link found in widget.js"
  ((PASSED++))
else
  echo "❌ FAIL: ei-score-details.html link NOT found in widget.js"
  ((FAILED++))
fi

echo ""

# Test 3: Verify CSS enhancements
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: CSS Enhancements for EI Cards"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CSS_FEATURES=(
  "ei-grid"
  "ei-card"
  "ei-tooltip"
  "ei-score-excellent"
  "ei-score-good"
  "ei-score-fair"
  "ei-score-needs-work"
  "fadeInUp"
)

for feature in "${CSS_FEATURES[@]}"; do
  if grep -q "$feature" widget.js; then
    echo "✅ PASS: CSS class .$feature implemented"
    ((PASSED++))
  else
    echo "❌ FAIL: CSS class .$feature NOT found"
    ((FAILED++))
  fi
done

echo ""

# Test 4: Verify animations
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Animation Definitions"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

ANIMATIONS=("fadeInUp" "fadeIn" "fadeOut" "slideUp")

for anim in "${ANIMATIONS[@]}"; do
  if grep -q "@keyframes $anim" widget.js; then
    echo "✅ PASS: @keyframes $anim defined"
    ((PASSED++))
  else
    echo "⚠️  WARN: @keyframes $anim not found (may be inline)"
    ((WARNINGS++))
  fi
done

echo ""

# Test 5: Verify metric definitions
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: All 10 Metric Definitions Present"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

METRICS=(
  "empathy"
  "clarity"
  "compliance"
  "discovery"
  "objection_handling"
  "confidence"
  "active_listening"
  "adaptability"
  "action_insight"
  "resilience"
)

for metric in "${METRICS[@]}"; do
  if grep -q "\"$metric\":" widget.js; then
    echo "✅ PASS: $metric definition found"
    ((PASSED++))
  else
    echo "❌ FAIL: $metric definition NOT found"
    ((FAILED++))
  fi
done

echo ""

# Test 6: Verify analytics links
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Analytics Page Links"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "ei-score-details.html" analytics.html; then
  echo "✅ PASS: ei-score-details.html link in analytics.html"
  ((PASSED++))
else
  echo "❌ FAIL: ei-score-details.html link NOT in analytics.html"
  ((FAILED++))
fi

if grep -q "ei-scoring-guide.html" analytics.html; then
  echo "✅ PASS: ei-scoring-guide.html link in analytics.html"
  ((PASSED++))
else
  echo "❌ FAIL: ei-scoring-guide.html link NOT in analytics.html"
  ((FAILED++))
fi

echo ""

# Test 7: Check file sizes (ensure no corruption)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 7: File Size Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

WIDGET_SIZE=$(wc -c < widget.js | tr -d ' ')
if [ "$WIDGET_SIZE" -gt 100000 ]; then
  echo "✅ PASS: widget.js is $WIDGET_SIZE bytes (expected >100KB)"
  ((PASSED++))
else
  echo "⚠️  WARN: widget.js is only $WIDGET_SIZE bytes (may be incomplete)"
  ((WARNINGS++))
fi

EI_GUIDE_SIZE=$(wc -c < ei-scoring-guide.html | tr -d ' ')
if [ "$EI_GUIDE_SIZE" -gt 20000 ]; then
  echo "✅ PASS: ei-scoring-guide.html is $EI_GUIDE_SIZE bytes"
  ((PASSED++))
else
  echo "⚠️  WARN: ei-scoring-guide.html is $EI_GUIDE_SIZE bytes (expected >20KB)"
  ((WARNINGS++))
fi

echo ""

# Test 8: Verify no syntax errors in HTML
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 8: HTML Syntax Validation (Basic)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for htmlfile in ei-scoring-guide.html ei-score-details.html analytics.html; do
  if grep -q "</html>" "$htmlfile"; then
    echo "✅ PASS: $htmlfile has closing </html> tag"
    ((PASSED++))
  else
    echo "❌ FAIL: $htmlfile missing closing </html> tag"
    ((FAILED++))
  fi
done

echo ""

# Test 9: Verify score-based color classes
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 9: Score-Based Color Coding"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "ei-score-excellent" widget.js && grep -q "#10b981" widget.js; then
  echo "✅ PASS: Excellent score styling (green) implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Excellent score styling missing"
  ((FAILED++))
fi

if grep -q "ei-score-fair" widget.js && grep -q "#f59e0b" widget.js; then
  echo "✅ PASS: Fair score styling (yellow) implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Fair score styling missing"
  ((FAILED++))
fi

if grep -q "ei-score-needs-work" widget.js && grep -q "#ef4444" widget.js; then
  echo "✅ PASS: Needs-work score styling (red) implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Needs-work score styling missing"
  ((FAILED++))
fi

echo ""

# Test 10: Verify modal enhancements
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 10: Enhanced Modal Features"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if grep -q "backdrop-filter:blur" widget.js; then
  echo "✅ PASS: Backdrop blur effect implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Backdrop blur NOT implemented"
  ((FAILED++))
fi

if grep -q "animation:slideUp" widget.js; then
  echo "✅ PASS: Modal slide-up animation implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Modal slide-up animation missing"
  ((FAILED++))
fi

if grep -q "linear-gradient.*#0f2747.*#1e3a5f" widget.js; then
  echo "✅ PASS: Navy gradient header implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Navy gradient header missing"
  ((FAILED++))
fi

echo ""

# Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                      TEST SUMMARY                              ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ PASSED:   $PASSED tests"
echo "❌ FAILED:   $FAILED tests"
echo "⚠️  WARNINGS: $WARNINGS tests"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
PASS_RATE=$((PASSED * 100 / TOTAL))

echo "Pass Rate: $PASS_RATE% ($PASSED/$TOTAL)"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL CRITICAL TESTS PASSED! Ready for deployment."
  exit 0
else
  echo "⚠️  $FAILED tests failed. Review errors before deployment."
  exit 1
fi
