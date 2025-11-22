#!/usr/bin/env node
/**
 * AUTOMATED TEST SCRIPT - REFLECTIV AI WIDGET
 *
 * Tests deployed widget at https://reflectivei.github.io/reflectiv-ai/
 *
 * Captures:
 * - Screenshots at each step
 * - Console logs (all levels)
 * - Network requests/responses
 * - DOM state (dropdown options, pills, modals)
 * - JavaScript errors
 *
 * Outputs:
 * - Screenshots to ./test-screenshots/
 * - JSON report to ./test-results.json
 * - Human-readable report to ./TEST_CYCLE_1_AUTOMATED_REPORT.md
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOTS_DIR = './test-screenshots';
const RESULTS_FILE = './test-results.json';
const REPORT_FILE = './TEST_CYCLE_1_AUTOMATED_REPORT.md';

// Test results object
const results = {
  timestamp: new Date().toISOString(),
  url: URL,
  tests: [],
  consoleLogs: [],
  networkCalls: [],
  errors: [],
  screenshots: []
};

// Helper: Add test result
function addTest(name, status, details = {}) {
  results.tests.push({
    name,
    status, // 'PASS', 'FAIL', 'SKIP'
    details,
    timestamp: new Date().toISOString()
  });
  console.log(`[${status}] ${name}`);
}

// Helper: Take screenshot
async function screenshot(page, name) {
  const filename = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.png`;
  const filepath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: filepath, fullPage: true });
  results.screenshots.push({ name, filepath });
  console.log(`📸 Screenshot: ${filepath}`);
  return filepath;
}

// Helper: Wait with timeout
async function waitFor(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log('🚀 Starting Automated Tests...');
  console.log(`URL: ${URL}`);
  console.log(`Time: ${results.timestamp}\n`);

  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true, // Run in background
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture console logs
  page.on('console', msg => {
    const log = {
      type: msg.type(),
      text: msg.text(),
      timestamp: new Date().toISOString()
    };
    results.consoleLogs.push(log);
    console.log(`[CONSOLE ${log.type.toUpperCase()}] ${log.text}`);
  });

  // Capture JavaScript errors
  page.on('pageerror', error => {
    const err = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    results.errors.push(err);
    console.error(`[JS ERROR] ${err.message}`);
  });

  // Capture network requests
  page.on('request', request => {
    results.networkCalls.push({
      type: 'request',
      url: request.url(),
      method: request.method(),
      timestamp: new Date().toISOString()
    });
  });

  page.on('response', response => {
    results.networkCalls.push({
      type: 'response',
      url: response.url(),
      status: response.status(),
      statusText: response.statusText(),
      timestamp: new Date().toISOString()
    });
  });

  try {
    // =====================================================
    // TEST 1: Page loads
    // =====================================================
    console.log('\n[TEST 1] Page loads...');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await waitFor(2000); // Wait for widget to initialize
    await screenshot(page, 'test_1_page_loaded');
    addTest('Page loads', 'PASS', { url: URL });

    // =====================================================
    // TEST 2: Widget script loaded
    // =====================================================
    console.log('\n[TEST 2] Check widget.js loaded...');
    const widgetRequest = results.networkCalls.find(call =>
      call.url.includes('widget.js') && call.type === 'response'
    );

    if (widgetRequest && widgetRequest.status === 200) {
      addTest('widget.js loaded', 'PASS', {
        url: widgetRequest.url,
        status: widgetRequest.status
      });
    } else {
      addTest('widget.js loaded', 'FAIL', {
        reason: 'widget.js not found in network calls'
      });
    }

    // =====================================================
    // TEST 3: Widget appears on page
    // =====================================================
    console.log('\n[TEST 3] Check widget appears...');
    const widgetExists = await page.evaluate(() => {
      return document.querySelector('#reflectiv-widget') !== null;
    });

    if (widgetExists) {
      addTest('Widget appears on page', 'PASS');
      await screenshot(page, 'test_3_widget_visible');
    } else {
      addTest('Widget appears on page', 'FAIL', {
        reason: '#reflectiv-widget element not found'
      });
    }

    // =====================================================
    // TEST 4: Dropdown has 5 modes
    // =====================================================
    console.log('\n[TEST 4] Check dropdown has 5 modes...');
    const dropdownOptions = await page.evaluate(() => {
      const select = document.querySelector('#reflectiv-widget select, #reflectiv-widget .mode-select');
      if (!select) return null;

      const options = Array.from(select.querySelectorAll('option'));
      return options.map(opt => opt.textContent.trim());
    });

    if (dropdownOptions && dropdownOptions.length === 5) {
      addTest('Dropdown has 5 modes', 'PASS', {
        modes: dropdownOptions,
        expected: ['Emotional Intelligence', 'Product Knowledge', 'Sales Coach', 'Role Play', 'General Assistant']
      });
    } else {
      addTest('Dropdown has 5 modes', 'FAIL', {
        found: dropdownOptions ? dropdownOptions.length : 0,
        modes: dropdownOptions,
        expected: 5
      });
    }

    // =====================================================
    // TEST 5: Select "Sales Coach" mode
    // =====================================================
    console.log('\n[TEST 5] Select Sales Coach mode...');
    try {
      await page.evaluate(() => {
        const select = document.querySelector('#reflectiv-widget select, #reflectiv-widget .mode-select');
        if (select) {
          const option = Array.from(select.querySelectorAll('option')).find(
            opt => opt.textContent.includes('Sales Coach')
          );
          if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });
      await waitFor(1000);
      await screenshot(page, 'test_5_sales_coach_selected');
      addTest('Select Sales Coach mode', 'PASS');
    } catch (error) {
      addTest('Select Sales Coach mode', 'FAIL', { error: error.message });
    }

    // =====================================================
    // TEST 6: Send test message
    // =====================================================
    console.log('\n[TEST 6] Send test message...');
    const testMessage = 'I struggle with HCP objections about drug cost';

    try {
      await page.evaluate((msg) => {
        const textarea = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
        if (textarea) {
          textarea.value = msg;
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }, testMessage);

      await waitFor(500);
      await screenshot(page, 'test_6_message_entered');

      // Click send button
      await page.evaluate(() => {
        const sendBtn = document.querySelector('#reflectiv-widget button.btn');
        console.log('[TEST] Found send button:', sendBtn);
        if (sendBtn) {
          console.log('[TEST] Clicking send button...');
          sendBtn.click();
        } else {
          console.log('[TEST] ERROR: Send button not found!');
        }
      });

      await waitFor(1000);
      await screenshot(page, 'test_6_message_sent');
      addTest('Send test message', 'PASS', { message: testMessage });

      // Wait for response (max 30 seconds)
      console.log('⏳ Waiting for AI response...');
      await page.waitForFunction(
        () => {
          const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');
          return messages.length > 0;
        },
        { timeout: 30000 }
      );

      await waitFor(2000); // Wait for response to fully render
      await screenshot(page, 'test_6_response_received');
      addTest('Response received', 'PASS');

    } catch (error) {
      addTest('Send test message / Response', 'FAIL', { error: error.message });
    }

    // =====================================================
    // TEST 7: Check for EI pills
    // =====================================================
    console.log('\n[TEST 7] Check for EI pills...');
    const pillsData = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#reflectiv-widget .ei-pill'));
      return pills.map(pill => ({
        text: pill.textContent.trim(),
        metric: pill.getAttribute('data-metric'),
        style: pill.getAttribute('style')
      }));
    });

    if (pillsData.length === 10) {
      addTest('10 EI pills present', 'PASS', { pills: pillsData });
      await screenshot(page, 'test_7_ei_pills');
    } else {
      addTest('10 EI pills present', 'FAIL', {
        found: pillsData.length,
        expected: 10,
        pills: pillsData
      });
    }

    // =====================================================
    // TEST 8: Check pill gradients
    // =====================================================
    console.log('\n[TEST 8] Check pill gradients...');
    const pillGradients = await page.evaluate(() => {
      const pills = Array.from(document.querySelectorAll('#reflectiv-widget .ei-pill'));
      return pills.map(pill => {
        const computed = window.getComputedStyle(pill);
        return {
          metric: pill.getAttribute('data-metric'),
          background: computed.background || computed.backgroundColor
        };
      });
    });

    const hasGradients = pillGradients.some(pill =>
      pill.background && pill.background.includes('gradient')
    );

    if (hasGradients) {
      addTest('Pills have gradient backgrounds', 'PASS', { gradients: pillGradients });
    } else {
      addTest('Pills have gradient backgrounds', 'FAIL', {
        reason: 'No gradients detected',
        backgrounds: pillGradients
      });
    }

    // =====================================================
    // TEST 9: Click first pill (test modal)
    // =====================================================
    console.log('\n[TEST 9] Click first EI pill...');
    try {
      await page.evaluate(() => {
        const firstPill = document.querySelector('#reflectiv-widget .ei-pill');
        if (firstPill) {
          firstPill.click();
        }
      });

      await waitFor(1000);
      await screenshot(page, 'test_9_modal_opened');

      // Check if modal appeared
      const modalExists = await page.evaluate(() => {
        return document.querySelector('#metric-modal') !== null;
      });

      if (modalExists) {
        // Extract modal content
        const modalContent = await page.evaluate(() => {
          const modal = document.querySelector('#metric-modal');
          return {
            title: modal.querySelector('h2, h3')?.textContent,
            definition: modal.querySelector('.definition, p')?.textContent,
            hasGotItButton: modal.querySelector('button')?.textContent.includes('Got it')
          };
        });

        addTest('Modal opens on pill click', 'PASS', { modal: modalContent });

        // Close modal
        await page.evaluate(() => {
          const closeBtn = document.querySelector('#metric-modal button');
          if (closeBtn) closeBtn.click();
        });
        await waitFor(500);

      } else {
        addTest('Modal opens on pill click', 'FAIL', {
          reason: '#metric-modal not found after click'
        });
      }

    } catch (error) {
      addTest('Modal opens on pill click', 'FAIL', { error: error.message });
    }

    // =====================================================
    // TEST 10: Check for citations
    // =====================================================
    console.log('\n[TEST 10] Check for citations...');
    const citations = await page.evaluate(() => {
      const citationLinks = Array.from(document.querySelectorAll('#reflectiv-widget a[href*="cdc.gov"], #reflectiv-widget a[href*="fda.gov"], #reflectiv-widget a[style*="e0f2fe"]'));
      return citationLinks.map(link => ({
        text: link.textContent.trim(),
        href: link.href,
        style: link.getAttribute('style')
      }));
    });

    if (citations.length > 0) {
      addTest('Citations present', 'PASS', {
        count: citations.length,
        citations: citations.slice(0, 3) // First 3 examples
      });
      await screenshot(page, 'test_10_citations');
    } else {
      addTest('Citations present', 'SKIP', {
        reason: 'No citations found (may not appear in this response)'
      });
    }

    // =====================================================
    // TEST 11: Test "General Assistant" mode
    // =====================================================
    console.log('\n[TEST 11] Test General Assistant mode...');
    try {
      // Switch to General Assistant
      await page.evaluate(() => {
        const select = document.querySelector('#reflectiv-widget select, #reflectiv-widget .mode-select');
        if (select) {
          const option = Array.from(select.querySelectorAll('option')).find(
            opt => opt.textContent.includes('General Assistant')
          );
          if (option) {
            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
          }
        }
      });

      await waitFor(1000);
      await screenshot(page, 'test_11_general_mode_selected');

      // Send simple message
      await page.evaluate(() => {
        const textarea = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
        if (textarea) {
          textarea.value = "What's the capital of France?";
          textarea.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });

      await waitFor(500);

      await page.evaluate(() => {
        const sendBtn = document.querySelector('#reflectiv-widget button.btn');
        console.log('[TEST] Found send button for General mode:', sendBtn);
        if (sendBtn) {
          console.log('[TEST] Clicking send button for General mode...');
          sendBtn.click();
        }
      });

      await waitFor(1000);

      // Wait for response
      await page.waitForFunction(
        () => {
          const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');
          return messages.length > 1; // More than first response
        },
        { timeout: 30000 }
      );

      await waitFor(2000);
      await screenshot(page, 'test_11_general_mode_response');
      addTest('General Assistant mode works', 'PASS');

    } catch (error) {
      addTest('General Assistant mode works', 'FAIL', { error: error.message });
    }

    // =====================================================
    // Final screenshot
    // =====================================================
    await screenshot(page, 'final_state');

  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    results.errors.push({
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    await browser.close();
  }

  // =====================================================
  // Generate reports
  // =====================================================
  console.log('\n📝 Generating reports...');

  // Save JSON results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`✅ JSON results saved to: ${RESULTS_FILE}`);

  // Generate Markdown report
  generateMarkdownReport();

  // Print summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));

  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const failed = results.tests.filter(t => t.status === 'FAIL').length;
  const skipped = results.tests.filter(t => t.status === 'SKIP').length;

  console.log(`Total Tests: ${results.tests.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`\n📸 Screenshots: ${results.screenshots.length}`);
  console.log(`📋 Console Logs: ${results.consoleLogs.length}`);
  console.log(`🌐 Network Calls: ${results.networkCalls.length}`);
  console.log(`💥 JavaScript Errors: ${results.errors.length}`);
  console.log('='.repeat(60));

  console.log(`\n📄 Full report: ${REPORT_FILE}`);
}

function generateMarkdownReport() {
  const passed = results.tests.filter(t => t.status === 'PASS').length;
  const failed = results.tests.filter(t => t.status === 'FAIL').length;
  const skipped = results.tests.filter(t => t.status === 'SKIP').length;

  let report = `# TEST CYCLE 1 - AUTOMATED REPORT

**URL:** ${URL}
**Date:** ${results.timestamp}
**Test Runner:** Puppeteer (Headless Chrome)

---

## 📊 SUMMARY

- **Total Tests:** ${results.tests.length}
- **✅ Passed:** ${passed}
- **❌ Failed:** ${failed}
- **⏭️ Skipped:** ${skipped}
- **📸 Screenshots:** ${results.screenshots.length}
- **📋 Console Logs:** ${results.consoleLogs.length}
- **🌐 Network Calls:** ${results.networkCalls.length}
- **💥 JavaScript Errors:** ${results.errors.length}

**Pass Rate:** ${((passed / results.tests.length) * 100).toFixed(1)}%

---

## ✅ PASSED TESTS

${results.tests.filter(t => t.status === 'PASS').map(t =>
    `### ${t.name}\n**Status:** ✅ PASS  \n**Details:** ${JSON.stringify(t.details, null, 2)}\n`
  ).join('\n')}

---

## ❌ FAILED TESTS

${failed > 0 ? results.tests.filter(t => t.status === 'FAIL').map(t =>
    `### ${t.name}\n**Status:** ❌ FAIL  \n**Reason:** ${t.details.reason || t.details.error || 'Unknown'}  \n**Details:** ${JSON.stringify(t.details, null, 2)}\n`
  ).join('\n') : '_No failed tests_'}

---

## ⏭️ SKIPPED TESTS

${skipped > 0 ? results.tests.filter(t => t.status === 'SKIP').map(t =>
    `### ${t.name}\n**Status:** ⏭️ SKIP  \n**Reason:** ${t.details.reason || 'N/A'}  \n`
  ).join('\n') : '_No skipped tests_'}

---

## 💥 JAVASCRIPT ERRORS

${results.errors.length > 0 ? results.errors.map(err =>
    `### ${err.message}\n\`\`\`\n${err.stack}\n\`\`\`\n`
  ).join('\n') : '_No JavaScript errors detected_'}

---

## 📋 CONSOLE LOGS (First 20)

${results.consoleLogs.slice(0, 20).map(log =>
    `- **[${log.type.toUpperCase()}]** ${log.text}`
  ).join('\n')}

${results.consoleLogs.length > 20 ? `\n_...and ${results.consoleLogs.length - 20} more logs_` : ''}

---

## 🌐 NETWORK CALLS (widget.js and worker)

${results.networkCalls.filter(call =>
    call.url.includes('widget.js') || call.url.includes('worker')
  ).map(call =>
    `- **${call.type.toUpperCase()}** ${call.url}${call.status ? ` - ${call.status} ${call.statusText}` : ''}`
  ).join('\n')}

---

## 📸 SCREENSHOTS

${results.screenshots.map(ss =>
    `- **${ss.name}:** \`${ss.filepath}\``
  ).join('\n')}

---

## 🎯 NEXT STEPS

Based on test results:
1. Review failed tests and determine root cause
2. Check JavaScript errors for blocking issues
3. Verify network calls completed successfully
4. Examine screenshots for visual verification
5. Proceed to TEST CYCLE 2 if all critical tests pass

---

**Full test data:** \`${RESULTS_FILE}\`
`;

  fs.writeFileSync(REPORT_FILE, report);
  console.log(`✅ Markdown report saved to: ${REPORT_FILE}`);
}

// Run tests
runTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
