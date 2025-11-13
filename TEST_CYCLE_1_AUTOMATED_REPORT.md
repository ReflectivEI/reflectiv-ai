# TEST CYCLE 1 - AUTOMATED REPORT

**URL:** https://reflectivei.github.io/reflectiv-ai/  
**Date:** 2025-11-12T23:04:13.257Z  
**Test Runner:** Puppeteer (Headless Chrome)

---

## 📊 SUMMARY

- **Total Tests:** 12
- **✅ Passed:** 8
- **❌ Failed:** 4
- **⏭️ Skipped:** 0
- **📸 Screenshots:** 10
- **📋 Console Logs:** 35
- **🌐 Network Calls:** 58
- **💥 JavaScript Errors:** 0

**Pass Rate:** 66.7%

---

## ✅ PASSED TESTS

### Page loads
**Status:** ✅ PASS  
**Details:** {
  "url": "https://reflectivei.github.io/reflectiv-ai/"
}

### widget.js loaded
**Status:** ✅ PASS  
**Details:** {
  "url": "https://reflectivei.github.io/reflectiv-ai/widget.js?v=20251110-1243",
  "status": 200
}

### Widget appears on page
**Status:** ✅ PASS  
**Details:** {}

### Dropdown has 5 modes
**Status:** ✅ PASS  
**Details:** {
  "modes": [
    "Emotional Intelligence",
    "Product Knowledge",
    "Sales Coach",
    "Role Play",
    "General Assistant"
  ],
  "expected": [
    "Emotional Intelligence",
    "Product Knowledge",
    "Sales Coach",
    "Role Play",
    "General Assistant"
  ]
}

### Select Sales Coach mode
**Status:** ✅ PASS  
**Details:** {}

### Send test message
**Status:** ✅ PASS  
**Details:** {
  "message": "I struggle with HCP objections about drug cost"
}

### Response received
**Status:** ✅ PASS  
**Details:** {}

### Citations present
**Status:** ✅ PASS  
**Details:** {
  "count": 3,
  "citations": [
    {
      "text": "[001]",
      "href": "https://www.cdc.gov/hiv/guidelines/preventing.html",
      "style": "background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#0369a1;text-decoration:none;border:1px solid #bae6fd"
    },
    {
      "text": "[002]",
      "href": "https://www.accessdata.fda.gov/drugsatfda_docs/label/2024/208215s022lbl.pdf",
      "style": "background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#0369a1;text-decoration:none;border:1px solid #bae6fd"
    },
    {
      "text": "[003]",
      "href": "https://www.cdc.gov/hiv/pdf/risk/prep/cdc-hiv-prep-guidelines-2021.pdf",
      "style": "background:#e0f2fe;padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;color:#0369a1;text-decoration:none;border:1px solid #bae6fd"
    }
  ]
}


---

## ❌ FAILED TESTS

### 10 EI pills present
**Status:** ❌ FAIL  
**Reason:** Unknown  
**Details:** {
  "found": 0,
  "expected": 10,
  "pills": []
}

### Pills have gradient backgrounds
**Status:** ❌ FAIL  
**Reason:** No gradients detected  
**Details:** {
  "reason": "No gradients detected",
  "backgrounds": []
}

### Modal opens on pill click
**Status:** ❌ FAIL  
**Reason:** #metric-modal not found after click  
**Details:** {
  "reason": "#metric-modal not found after click"
}

### General Assistant mode works
**Status:** ❌ FAIL  
**Reason:** Waiting failed: 30000ms exceeded  
**Details:** {
  "error": "Waiting failed: 30000ms exceeded"
}


---

## ⏭️ SKIPPED TESTS

_No skipped tests_

---

## 💥 JAVASCRIPT ERRORS

_No JavaScript errors detected_

---

## 📋 CONSOLE LOGS (First 20)

- **[WARN]** cdn.tailwindcss.com should not be used in production. To use Tailwind CSS in production, install it as a PostCSS plugin or use the Tailwind CLI: https://tailwindcss.com/docs/installation
- **[LOG]** [Citations] Loaded 5 references
- **[LOG]** [DEBUG] About to run initial health check...
- **[LOG]** [DEBUG] checkHealth() called, healthUrl: https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
- **[LOG]** [DEBUG] Health check PASSED, isHealthy set to TRUE
- **[LOG]** [DEBUG] Initial health check complete, result: true , isHealthy: true
- **[LOG]** [TEST] Found send button: JSHandle@node
- **[LOG]** [TEST] Clicking send button...
- **[LOG]** [DEBUG] Send button clicked!
- **[LOG]** [DEBUG] Message text: I struggle with HCP objections about drug cost
- **[LOG]** [DEBUG] sendMessage() called with text: I struggle with HCP objections about drug cost
- **[LOG]** [DEBUG] isSending: false , isHealthy: true
- **[LOG]** [DEBUG] Passed health gate, proceeding with send
- **[LOG]** [renderMessages] ========== SALES COACH MESSAGE ==========
- **[LOG]** [renderMessages] currentMode: sales-simulation
- **[LOG]** [renderMessages] m.role: assistant
- **[LOG]** [renderMessages] Has cached HTML? false
- **[LOG]** [renderMessages] rawContent preview: Challenge: The HCP may be hesitant to prescribe PrEP due to concerns about the cost of the medication.  Rep Approach: • Discuss the long-term cost-effectiveness of PrEP, as recommended for individuals
- **[LOG]** [renderMessages] normalized preview: Challenge: The HCP may be hesitant to prescribe PrEP due to concerns about the cost of the medication.  Rep Approach: • Discuss the long-term cost-effectiveness of PrEP, as recommended for individuals
- **[LOG]** [renderMessages] NO CACHE - Formatting now...


_...and 15 more logs_

---

## 🌐 NETWORK CALLS (widget.js and worker)

- **REQUEST** https://reflectivei.github.io/reflectiv-ai/widget.js?v=20251110-1243
- **RESPONSE** https://reflectivei.github.io/reflectiv-ai/widget.js?v=20251110-1243 - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/health - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat - 204 
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics - 204 
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat - 200 
- **REQUEST** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics
- **RESPONSE** https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics - 200 

---

## 📸 SCREENSHOTS

- **test_1_page_loaded:** `test-screenshots/test_1_page_loaded_1762988659078.png`
- **test_3_widget_visible:** `test-screenshots/test_3_widget_visible_1762988659797.png`
- **test_5_sales_coach_selected:** `test-screenshots/test_5_sales_coach_selected_1762988661437.png`
- **test_6_message_entered:** `test-screenshots/test_6_message_entered_1762988662584.png`
- **test_6_message_sent:** `test-screenshots/test_6_message_sent_1762988664327.png`
- **test_6_response_received:** `test-screenshots/test_6_response_received_1762988666978.png`
- **test_9_modal_opened:** `test-screenshots/test_9_modal_opened_1762988668627.png`
- **test_10_citations:** `test-screenshots/test_10_citations_1762988669270.png`
- **test_11_general_mode_selected:** `test-screenshots/test_11_general_mode_selected_1762988670932.png`
- **final_state:** `test-screenshots/final_state_1762988703082.png`

---

## 🎯 NEXT STEPS

Based on test results:
1. Review failed tests and determine root cause
2. Check JavaScript errors for blocking issues
3. Verify network calls completed successfully
4. Examine screenshots for visual verification
5. Proceed to TEST CYCLE 2 if all critical tests pass

---

**Full test data:** `./test-results.json`
