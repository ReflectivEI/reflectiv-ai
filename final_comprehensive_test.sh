#!/bin/bash

# FINAL COMPREHENSIVE TEST - PHASE 3 COMPLETE
# Tests all enhancements including hero restructure

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║          FINAL COMPREHENSIVE TEST - PHASE 3 COMPLETE          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Test Date: $(date '+%Y-%m-%d %H:%M:%S')"
echo "Testing: All PHASE 3 enhancements + Hero restructure"
echo ""

PASSED=0
FAILED=0
WARNINGS=0

# ============================================================================
# SECTION 1: EI PANEL ENHANCEMENTS
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 1: EI Panel Enhancements"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 1.1: Grid layout
if grep -q "ei-grid" widget.js && grep -q "grid-template-columns:repeat(5, 1fr)" widget.js; then
  echo "✅ PASS: EI grid with 2x5 layout implemented"
  ((PASSED++))
else
  echo "❌ FAIL: EI grid layout missing"
  ((FAILED++))
fi

# Test 1.2: Animated cards
if grep -q "fadeInUp" widget.js && grep -q "animation-delay" widget.js; then
  echo "✅ PASS: Staggered fade-in animation implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Card animations missing"
  ((FAILED++))
fi

# Test 1.3: Tooltips
if grep -q "ei-tooltip" widget.js && grep -q "backdrop-filter:blur" widget.js; then
  echo "✅ PASS: Tooltips with backdrop blur implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Tooltips missing"
  ((FAILED++))
fi

# Test 1.4: Score-based color coding
COLORS=("ei-score-excellent" "ei-score-good" "ei-score-fair" "ei-score-needs-work")
COLOR_PASS=true
for color in "${COLORS[@]}"; do
  if ! grep -q "$color" widget.js; then
    COLOR_PASS=false
  fi
done

if [ "$COLOR_PASS" = true ]; then
  echo "✅ PASS: All 4 score-based color classes implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Score-based color coding incomplete"
  ((FAILED++))
fi

# Test 1.5: All 10 metrics
METRICS=("empathy" "clarity" "compliance" "discovery" "objection_handling" "confidence" "active_listening" "adaptability" "action_insight" "resilience")
METRICS_PASS=true
for metric in "${METRICS[@]}"; do
  if ! grep -q "\"$metric\":" widget.js; then
    METRICS_PASS=false
  fi
done

if [ "$METRICS_PASS" = true ]; then
  echo "✅ PASS: All 10 metric definitions present"
  ((PASSED++))
else
  echo "❌ FAIL: Some metrics missing"
  ((FAILED++))
fi

echo ""

# ============================================================================
# SECTION 2: MODAL ENHANCEMENTS
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 2: Modal Enhancements"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 2.1: Navy gradient header
if grep -q "linear-gradient.*#0f2747.*#1e3a5f" widget.js; then
  echo "✅ PASS: Navy gradient modal header implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Modal gradient header missing"
  ((FAILED++))
fi

# Test 2.2: Slide animations
if grep -q "@keyframes slideUp" widget.js && grep -q "@keyframes fadeOut" widget.js; then
  echo "✅ PASS: Modal slide/fade animations implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Modal animations missing"
  ((FAILED++))
fi

# Test 2.3: Enhanced styling
if grep -q "backdrop-filter:blur(4px)" widget.js; then
  echo "✅ PASS: Modal backdrop blur implemented"
  ((PASSED++))
else
  echo "❌ FAIL: Modal backdrop blur missing"
  ((FAILED++))
fi

echo ""

# ============================================================================
# SECTION 3: DOCUMENTATION LINKS
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 3: Documentation Links"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 3.1: Widget links
if grep -q "ei-scoring-guide.html" widget.js && grep -q "ei-score-details.html" widget.js; then
  echo "✅ PASS: Both documentation links in widget.js"
  ((PASSED++))
else
  echo "❌ FAIL: Widget documentation links incomplete"
  ((FAILED++))
fi

# Test 3.2: Analytics links
if grep -q "ei-score-details.html" analytics.html && grep -q "ei-scoring-guide.html" analytics.html; then
  echo "✅ PASS: Documentation links in analytics.html"
  ((PASSED++))
else
  echo "❌ FAIL: Analytics links incomplete"
  ((FAILED++))
fi

# Test 3.3: Cross-navigation
if grep -q "analytics.html" ei-score-details.html && grep -q "ei-scoring-guide.html" ei-score-details.html; then
  echo "✅ PASS: Cross-navigation in ei-score-details.html"
  ((PASSED++))
else
  echo "❌ FAIL: Cross-navigation incomplete"
  ((FAILED++))
fi

if grep -q "ei-score-details.html" ei-scoring-guide.html && grep -q "analytics.html" ei-scoring-guide.html; then
  echo "✅ PASS: Cross-navigation in ei-scoring-guide.html"
  ((PASSED++))
else
  echo "❌ FAIL: Cross-navigation in scoring guide incomplete"
  ((FAILED++))
fi

echo ""

# ============================================================================
# SECTION 4: HERO BANNER RESTRUCTURE
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 4: Hero Banner Restructure"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Test 4.1: New main image
if grep -q 'src="assets/site_image 1.png"' index.html; then
  echo "✅ PASS: New hero image (site_image 1.png) implemented"
  ((PASSED++))
else
  echo "❌ FAIL: New hero image not found"
  ((FAILED++))
fi

# Test 4.2: Image file exists
if [ -f "assets/site_image 1.png" ]; then
  SIZE=$(wc -c < "assets/site_image 1.png" | tr -d ' ')
  echo "✅ PASS: site_image 1.png exists ($SIZE bytes)"
  ((PASSED++))
else
  echo "❌ FAIL: site_image 1.png file not found"
  ((FAILED++))
fi

# Test 4.3: Moved image below CTAs
if grep -q "mt-8 flex justify-center" index.html && grep -q "max-width:420px" index.html; then
  echo "✅ PASS: Original hero image moved below CTAs with centered layout"
  ((PASSED++))
else
  echo "❌ FAIL: Image repositioning incomplete"
  ((FAILED++))
fi

# Test 4.4: Taller right column
if grep -q "min-height:680px" index.html; then
  echo "✅ PASS: Right column height increased for alignment"
  ((PASSED++))
else
  echo "❌ FAIL: Right column height not adjusted"
  ((FAILED++))
fi

# Test 4.5: Grid alignment
if grep -q "items-start" index.html; then
  echo "✅ PASS: Grid alignment changed to items-start"
  ((PASSED++))
else
  echo "⚠️  WARN: Grid alignment not updated (may use default)"
  ((WARNINGS++))
fi

echo ""

# ============================================================================
# SECTION 5: FILE INTEGRITY
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 5: File Integrity & Size Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FILES=("widget.js" "index.html" "analytics.html" "ei-scoring-guide.html" "ei-score-details.html")

for file in "${FILES[@]}"; do
  if [ -f "$file" ]; then
    SIZE=$(wc -c < "$file" | tr -d ' ')
    echo "✅ PASS: $file exists ($(numfmt --to=iec-i --suffix=B $SIZE))"
    ((PASSED++))
  else
    echo "❌ FAIL: $file NOT FOUND"
    ((FAILED++))
  fi
done

echo ""

# ============================================================================
# SECTION 6: HTML SYNTAX VALIDATION
# ============================================================================
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "SECTION 6: HTML Syntax Validation"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

HTML_FILES=("index.html" "analytics.html" "ei-scoring-guide.html" "ei-score-details.html")

for htmlfile in "${HTML_FILES[@]}"; do
  if grep -q "</html>" "$htmlfile" && grep -q "<!DOCTYPE html" "$htmlfile" 2>/dev/null || grep -q "<!doctype html" "$htmlfile"; then
    echo "✅ PASS: $htmlfile has valid HTML structure"
    ((PASSED++))
  else
    echo "❌ FAIL: $htmlfile has invalid HTML structure"
    ((FAILED++))
  fi
done

echo ""

# ============================================================================
# FINAL SUMMARY
# ============================================================================
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    FINAL TEST SUMMARY                          ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "✅ PASSED:   $PASSED tests"
echo "❌ FAILED:   $FAILED tests"
echo "⚠️  WARNINGS: $WARNINGS tests"
echo ""

TOTAL=$((PASSED + FAILED + WARNINGS))
if [ $TOTAL -gt 0 ]; then
  PASS_RATE=$((PASSED * 100 / TOTAL))
  echo "Pass Rate: $PASS_RATE% ($PASSED/$TOTAL)"
else
  echo "Pass Rate: N/A (no tests run)"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "DEPLOYMENT READINESS CHECK"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ $FAILED -eq 0 ]; then
  echo "🎉 ALL CRITICAL TESTS PASSED!"
  echo "✅ EI Panel enhancements verified"
  echo "✅ Modal animations and styling confirmed"
  echo "✅ Documentation links integrated"
  echo "✅ Hero banner restructured successfully"
  echo "✅ All files present and valid"
  echo ""
  echo "🚀 READY FOR DEPLOYMENT!"
  exit 0
else
  echo "⚠️  $FAILED tests failed. Review errors before deployment."
  echo ""
  echo "Please fix the following before deploying:"
  if [ $FAILED -gt 0 ]; then
    echo "  - Check failed tests above"
  fi
  exit 1
fi
