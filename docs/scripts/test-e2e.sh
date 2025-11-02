#!/bin/bash
# test-e2e.sh
# Provides checklist and instructions for end-to-end testing

cat << 'TESTEOF'
🧪 End-to-End Production Smoke Test
====================================

This script provides a checklist for manual E2E testing.
Browser-based testing cannot be automated, so please follow these steps:

📋 Prerequisites
----------------
- Browser: Chrome/Firefox with DevTools
- Clear cache before starting (Ctrl+Shift+Del)
- Close all other tabs for clean test

📋 Test Procedure
-----------------

1. OPEN SITE
   URL: https://reflectivei.github.io/reflectiv-ai/#simulations
   
   ✓ Page loads without errors
   ✓ Console shows no red errors
   ✓ Network tab shows no failed requests (all 200 OK)

2. OPEN DEVTOOLS
   Press F12 or right-click → Inspect
   
   Go to Network tab:
   ✓ Click "Preserve log"
   ✓ Clear existing logs (🚫 icon)
   
   Go to Console tab:
   ✓ Check for any errors (should be clean)

3. SELECT SALES SIMULATION MODE
   ✓ Click "Sales Simulation" button
   ✓ Modal or section opens correctly
   ✓ Input field is visible and enabled

4. SEND TEST MESSAGE
   Type: "What are the key benefits of this product?"
   Press Enter or click Send
   
   ✓ Message appears in chat (user bubble)
   ✓ Loading indicator appears (optional)
   ✓ Response appears within 5 seconds

5. VERIFY NETWORK REQUEST
   In Network tab:
   ✓ Find POST request to: my-chat-agent-v2.tonyabdelmalak.workers.dev
   ✓ Click on the request
   ✓ Check Request URL includes: ?emitEi=true
   ✓ Check Request Headers (optional): X-Emit-EI: true
   ✓ Check Response Status: 200 OK
   
   Click "Response" or "Preview" tab:
   ✓ Response is valid JSON
   ✓ Response includes: _coach.ei.scores
   ✓ Scores object has 5 keys:
      - empathy (1-5)
      - discovery (1-5)
      - compliance (1-5)
      - clarity (1-5)
      - accuracy (1-5)

6. VERIFY UI RENDERING
   In the chat interface:
   
   GREY COACH CARD (should appear):
   ✓ Shows "Challenge" section
   ✓ Shows "Rep Approach" section
   ✓ Shows "Impact" section
   
   YELLOW EI PANEL (should appear):
   ✓ Panel is visible (yellow/amber background)
   ✓ Shows title "EI Summary" or similar
   ✓ Shows 5 colored pills/badges:
      - Empathy: [1-5] (color: green/yellow/red)
      - Discovery: [1-5]
      - Compliance: [1-5]
      - Clarity: [1-5]
      - Accuracy: [1-5]
   ✓ Pills match scores from Network response

7. CHECK CONSOLE
   In Console tab:
   ✓ No red errors
   ✓ No CSP violations
   ✓ No "Failed to fetch" errors
   ✓ No 404s or CORS errors

8. TEST DIFFERENT MESSAGES
   Send 2-3 more messages:
   - "How does it compare to competitors?"
   - "What are the side effects?"
   - "Can you explain the clinical data?"
   
   For each message:
   ✓ Request includes ?emitEi=true
   ✓ Response includes _coach.ei.scores
   ✓ EI panel updates with new scores
   ✓ Scores are different (deterministic based on content)

9. TEST WITHOUT ?eiShim=1
   Confirm current URL does NOT include: ?eiShim=1
   
   ✓ URL is clean (no eiShim parameter)
   ✓ EI panel still works (using server data, not shim)

10. PERFORMANCE CHECK
    In Network tab:
    ✓ Page load time: < 2 seconds
    ✓ First response time: < 5 seconds
    ✓ All assets loaded successfully
    
    In Console, run:
    > performance.getEntriesByType('navigation')[0].responseEnd
    
    ✓ Value is < 2000 (2 seconds)

📸 SCREENSHOTS REQUIRED
-----------------------

Take and save these screenshots:

1. screenshot-network.png
   - Network tab showing:
     * Request URL with ?emitEi=true
     * Response body with _coach.ei.scores expanded
   
2. screenshot-ui.png
   - Chat interface showing:
     * Grey coach card (Challenge/Rep Approach/Impact)
     * Yellow EI panel with 5 pills
     * Pills showing scores from server
   
3. screenshot-console.png
   - Console tab showing:
     * Clean output (no errors)
     * Or any warnings that are acceptable

📝 RECORD RESULTS
-----------------

After completing all steps, record:

- Date/Time: _______________
- Browser: Chrome/Firefox/Safari _______
- All steps passed: YES / NO
- If NO, which steps failed: _______________
- Screenshots saved: YES / NO
- Screenshot location: _______________

✅ TEST COMPLETE
----------------

If all steps passed:
1. Save screenshots to docs/verification/
2. Run: bash docs/scripts/create-tags.sh
3. Create final summary comment

If any steps failed:
1. Note the failure in issue or PR comment
2. Tag @ReflectivEI for assistance
3. Do NOT proceed with tagging until resolved

TESTEOF

# Prompt user for confirmation
echo ""
read -p "Have you completed all test steps above? (yes/no): " COMPLETED

if [ "$COMPLETED" = "yes" ]; then
    read -p "Did all tests pass? (yes/no): " PASSED
    
    if [ "$PASSED" = "yes" ]; then
        echo ""
        echo "✅ E2E tests passed!"
        echo ""
        echo "📋 Next step: Create git tags"
        echo "   bash docs/scripts/create-tags.sh"
    else
        echo ""
        echo "⚠️  Some tests failed"
        echo "   Please review failures and address issues before proceeding"
        echo "   Do not create tags or mark deployment as complete"
    fi
else
    echo ""
    echo "Please complete the test steps above before proceeding"
fi
