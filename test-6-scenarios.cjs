#!/usr/bin/env node
/**
 * COMPREHENSIVE MODE TESTING SCRIPT
 * Tests 6 scenarios across different modes to prove no errors
 * 
 * Scenarios:
 * 1. Sales Coach mode - HCP objection handling
 * 2. Role Play mode - HCP interaction
 * 3. Emotional Intelligence mode - Self-assessment
 * 4. Product Knowledge mode - Medical question
 * 5. General Assistant mode - General question
 * 6. Sales Coach mode with continuation - Long response handling
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOTS_DIR = './test-6-scenarios';
const RESULTS_FILE = './test-6-scenarios-results.json';

// Test results object
const results = {
  timestamp: new Date().toISOString(),
  url: URL,
  scenarios: [],
  errors: [],
  screenshots: []
};

// Helper: Wait
async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
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

// Helper: Select mode
async function selectMode(page, modeName) {
  await page.evaluate((mode) => {
    const select = document.querySelector('#reflectiv-widget select, #reflectiv-widget .mode-select');
    if (select) {
      const option = Array.from(select.querySelectorAll('option')).find(
        opt => opt.textContent.includes(mode)
      );
      if (option) {
        select.value = option.value;
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }, modeName);
  await wait(1000);
}

// Helper: Send message
async function sendMessage(page, message) {
  await page.evaluate((msg) => {
    const textarea = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
    if (textarea) {
      textarea.value = msg;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, message);
  
  await wait(500);
  
  await page.evaluate(() => {
    const sendBtn = document.querySelector('#reflectiv-widget button.btn');
    if (sendBtn) {
      sendBtn.click();
    }
  });
}

// Helper: Wait for response
async function waitForResponse(page, timeout = 30000) {
  const initialCount = await page.evaluate(() => {
    return document.querySelectorAll('#reflectiv-widget .message.assistant').length;
  });
  
  await page.waitForFunction(
    (prevCount) => {
      const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');
      return messages.length > prevCount;
    },
    { timeout },
    initialCount
  );
  
  await wait(2000); // Wait for full render
}

// Helper: Check for errors
async function checkForErrors(page) {
  const jsErrors = await page.evaluate(() => {
    return window._testErrors || [];
  });
  
  const consoleErrors = results.errors.filter(e => e.type === 'error');
  
  return {
    hasErrors: jsErrors.length > 0 || consoleErrors.length > 0,
    jsErrors,
    consoleErrors
  };
}

// Helper: Check EI pills
async function checkEIPills(page) {
  const pills = await page.evaluate(() => {
    const pillElements = Array.from(document.querySelectorAll('#reflectiv-widget .ei-pill'));
    return pillElements.map(pill => ({
      metric: pill.getAttribute('data-metric'),
      text: pill.textContent.trim(),
      hasGradient: window.getComputedStyle(pill).background.includes('gradient')
    }));
  });
  
  return pills;
}

async function runScenarios() {
  console.log('🚀 Starting 6-Scenario Comprehensive Test...');
  console.log(`URL: ${URL}`);
  console.log(`Time: ${results.timestamp}\n`);

  // Create screenshots directory
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Launch browser
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });

  // Capture JavaScript errors
  page.on('pageerror', error => {
    const err = {
      type: 'error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    };
    results.errors.push(err);
    console.error(`[JS ERROR] ${err.message}`);
  });

  // Capture console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      results.errors.push({
        type: 'console_error',
        text: msg.text(),
        timestamp: new Date().toISOString()
      });
    }
  });

  try {
    // Load page
    console.log('Loading page...');
    await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
    await wait(3000); // Wait for widget to initialize
    await screenshot(page, 'initial_page_load');

    // =====================================================
    // SCENARIO 1: Sales Coach - HCP Objection
    // =====================================================
    console.log('\n📋 SCENARIO 1: Sales Coach - HCP Objection');
    const scenario1 = {
      name: 'Sales Coach - HCP Objection',
      mode: 'Sales Coach',
      message: 'The HCP says the drug is too expensive compared to alternatives',
      status: 'PENDING',
      errors: [],
      eiPills: null
    };

    try {
      await selectMode(page, 'Sales Coach');
      await screenshot(page, 'scenario1_mode_selected');
      
      await sendMessage(page, scenario1.message);
      await screenshot(page, 'scenario1_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario1_response_received');
      
      // Check for EI pills
      const pills1 = await checkEIPills(page);
      scenario1.eiPills = pills1;
      
      const errorCheck1 = await checkForErrors(page);
      scenario1.errors = errorCheck1;
      
      if (!errorCheck1.hasErrors && pills1.length === 10) {
        scenario1.status = 'PASS';
        console.log('✅ PASS - 10 EI pills rendered, no errors');
      } else if (!errorCheck1.hasErrors && pills1.length === 0) {
        scenario1.status = 'FAIL';
        scenario1.reason = 'No EI pills found (expected 10)';
        console.log('❌ FAIL - No EI pills found');
      } else if (errorCheck1.hasErrors) {
        scenario1.status = 'ERROR';
        scenario1.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      } else {
        scenario1.status = 'PARTIAL';
        scenario1.reason = `Only ${pills1.length} EI pills found (expected 10)`;
        console.log(`⚠️  PARTIAL - ${pills1.length}/10 EI pills found`);
      }
    } catch (error) {
      scenario1.status = 'ERROR';
      scenario1.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario1);

    // =====================================================
    // SCENARIO 2: Role Play - HCP Interaction
    // =====================================================
    console.log('\n📋 SCENARIO 2: Role Play - HCP Interaction');
    const scenario2 = {
      name: 'Role Play - HCP Interaction',
      mode: 'Role Play',
      message: 'Hello doctor, I wanted to discuss treatment options for HIV patients',
      status: 'PENDING',
      errors: []
    };

    try {
      await selectMode(page, 'Role Play');
      await screenshot(page, 'scenario2_mode_selected');
      
      await sendMessage(page, scenario2.message);
      await screenshot(page, 'scenario2_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario2_response_received');
      
      const errorCheck2 = await checkForErrors(page);
      scenario2.errors = errorCheck2;
      
      if (!errorCheck2.hasErrors) {
        scenario2.status = 'PASS';
        console.log('✅ PASS - Response received, no errors');
      } else {
        scenario2.status = 'ERROR';
        scenario2.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      }
    } catch (error) {
      scenario2.status = 'ERROR';
      scenario2.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario2);

    // =====================================================
    // SCENARIO 3: Emotional Intelligence - Self Assessment
    // =====================================================
    console.log('\n📋 SCENARIO 3: Emotional Intelligence - Self Assessment');
    const scenario3 = {
      name: 'Emotional Intelligence - Self Assessment',
      mode: 'Emotional Intelligence',
      message: 'I sometimes struggle with staying calm under pressure',
      status: 'PENDING',
      errors: []
    };

    try {
      await selectMode(page, 'Emotional Intelligence');
      await screenshot(page, 'scenario3_mode_selected');
      
      await sendMessage(page, scenario3.message);
      await screenshot(page, 'scenario3_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario3_response_received');
      
      const errorCheck3 = await checkForErrors(page);
      scenario3.errors = errorCheck3;
      
      if (!errorCheck3.hasErrors) {
        scenario3.status = 'PASS';
        console.log('✅ PASS - Response received, no errors');
      } else {
        scenario3.status = 'ERROR';
        scenario3.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      }
    } catch (error) {
      scenario3.status = 'ERROR';
      scenario3.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario3);

    // =====================================================
    // SCENARIO 4: Product Knowledge - Medical Question
    // =====================================================
    console.log('\n📋 SCENARIO 4: Product Knowledge - Medical Question');
    const scenario4 = {
      name: 'Product Knowledge - Medical Question',
      mode: 'Product Knowledge',
      message: 'What are the key efficacy endpoints for HIV treatment?',
      status: 'PENDING',
      errors: [],
      hasCitations: false
    };

    try {
      await selectMode(page, 'Product Knowledge');
      await screenshot(page, 'scenario4_mode_selected');
      
      await sendMessage(page, scenario4.message);
      await screenshot(page, 'scenario4_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario4_response_received');
      
      // Check for citations
      const citations = await page.evaluate(() => {
        const citationLinks = document.querySelectorAll('#reflectiv-widget .message.assistant a[href*="http"]');
        return citationLinks.length;
      });
      scenario4.hasCitations = citations > 0;
      scenario4.citationCount = citations;
      
      const errorCheck4 = await checkForErrors(page);
      scenario4.errors = errorCheck4;
      
      if (!errorCheck4.hasErrors && citations > 0) {
        scenario4.status = 'PASS';
        console.log(`✅ PASS - Response with ${citations} citations, no errors`);
      } else if (!errorCheck4.hasErrors) {
        scenario4.status = 'PARTIAL';
        scenario4.reason = 'No citations found';
        console.log('⚠️  PARTIAL - No citations found');
      } else {
        scenario4.status = 'ERROR';
        scenario4.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      }
    } catch (error) {
      scenario4.status = 'ERROR';
      scenario4.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario4);

    // =====================================================
    // SCENARIO 5: General Assistant - General Question
    // =====================================================
    console.log('\n📋 SCENARIO 5: General Assistant - General Question');
    const scenario5 = {
      name: 'General Assistant - General Question',
      mode: 'General Assistant',
      message: 'What are the main components of emotional intelligence?',
      status: 'PENDING',
      errors: []
    };

    try {
      await selectMode(page, 'General Assistant');
      await screenshot(page, 'scenario5_mode_selected');
      
      await sendMessage(page, scenario5.message);
      await screenshot(page, 'scenario5_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario5_response_received');
      
      const errorCheck5 = await checkForErrors(page);
      scenario5.errors = errorCheck5;
      
      if (!errorCheck5.hasErrors) {
        scenario5.status = 'PASS';
        console.log('✅ PASS - Response received, no errors');
      } else {
        scenario5.status = 'ERROR';
        scenario5.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      }
    } catch (error) {
      scenario5.status = 'ERROR';
      scenario5.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario5);

    // =====================================================
    // SCENARIO 6: Sales Coach with Modal Test
    // =====================================================
    console.log('\n📋 SCENARIO 6: Sales Coach - EI Pill Modal Test');
    const scenario6 = {
      name: 'Sales Coach - EI Pill Modal Test',
      mode: 'Sales Coach',
      message: 'How should I handle pricing concerns from healthcare providers?',
      status: 'PENDING',
      errors: [],
      modalOpened: false
    };

    try {
      await selectMode(page, 'Sales Coach');
      await screenshot(page, 'scenario6_mode_selected');
      
      await sendMessage(page, scenario6.message);
      await screenshot(page, 'scenario6_message_sent');
      
      await waitForResponse(page);
      await screenshot(page, 'scenario6_response_received');
      
      // Try to click an EI pill
      const pillClicked = await page.evaluate(() => {
        const firstPill = document.querySelector('#reflectiv-widget .ei-pill');
        if (firstPill) {
          firstPill.click();
          return true;
        }
        return false;
      });
      
      if (pillClicked) {
        await wait(1000);
        await screenshot(page, 'scenario6_pill_clicked');
        
        // Check if modal opened
        const modalExists = await page.evaluate(() => {
          return document.querySelector('#metric-modal') !== null;
        });
        
        scenario6.modalOpened = modalExists;
        
        if (modalExists) {
          await screenshot(page, 'scenario6_modal_opened');
          
          // Close modal
          await page.evaluate(() => {
            const closeBtn = document.querySelector('#metric-modal button');
            if (closeBtn) closeBtn.click();
          });
          await wait(500);
        }
      }
      
      const errorCheck6 = await checkForErrors(page);
      scenario6.errors = errorCheck6;
      
      if (!errorCheck6.hasErrors && pillClicked && scenario6.modalOpened) {
        scenario6.status = 'PASS';
        console.log('✅ PASS - EI pill clicked, modal opened, no errors');
      } else if (!errorCheck6.hasErrors && pillClicked) {
        scenario6.status = 'PARTIAL';
        scenario6.reason = 'Modal did not open';
        console.log('⚠️  PARTIAL - Pill clicked but modal did not open');
      } else if (!errorCheck6.hasErrors) {
        scenario6.status = 'FAIL';
        scenario6.reason = 'No EI pills to click';
        console.log('❌ FAIL - No EI pills to click');
      } else {
        scenario6.status = 'ERROR';
        scenario6.reason = 'JavaScript errors detected';
        console.log('❌ ERROR - JavaScript errors detected');
      }
    } catch (error) {
      scenario6.status = 'ERROR';
      scenario6.error = error.message;
      console.log(`❌ ERROR - ${error.message}`);
    }
    results.scenarios.push(scenario6);

    // Final screenshot
    await screenshot(page, 'final_state');

  } catch (error) {
    console.error('\n❌ Test suite error:', error);
    results.errors.push({
      type: 'suite_error',
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
  } finally {
    await browser.close();
  }

  // Generate summary
  console.log('\n' + '='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.scenarios.filter(s => s.status === 'PASS').length;
  const failed = results.scenarios.filter(s => s.status === 'FAIL').length;
  const errors = results.scenarios.filter(s => s.status === 'ERROR').length;
  const partial = results.scenarios.filter(s => s.status === 'PARTIAL').length;
  
  console.log(`Total Scenarios: ${results.scenarios.length}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`⚠️  Partial: ${partial}`);
  console.log(`💥 Errors: ${errors}`);
  console.log(`\n📸 Screenshots: ${results.screenshots.length}`);
  console.log(`🐛 JavaScript Errors: ${results.errors.length}`);
  console.log('='.repeat(60));

  // Save results
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log(`\n📄 Results saved to: ${RESULTS_FILE}`);
  
  // Generate markdown report
  generateMarkdownReport();
  
  // Exit with appropriate code
  if (failed > 0 || errors > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

function generateMarkdownReport() {
  const reportFile = './TEST_6_SCENARIOS_REPORT.md';
  let report = `# 6-Scenario Comprehensive Test Report

**Date:** ${results.timestamp}  
**URL:** ${results.url}

---

## Summary

`;

  const passed = results.scenarios.filter(s => s.status === 'PASS').length;
  const failed = results.scenarios.filter(s => s.status === 'FAIL').length;
  const errors = results.scenarios.filter(s => s.status === 'ERROR').length;
  const partial = results.scenarios.filter(s => s.status === 'PARTIAL').length;

  report += `- **Total Scenarios:** ${results.scenarios.length}\n`;
  report += `- **✅ Passed:** ${passed}\n`;
  report += `- **❌ Failed:** ${failed}\n`;
  report += `- **⚠️ Partial:** ${partial}\n`;
  report += `- **💥 Errors:** ${errors}\n`;
  report += `- **📸 Screenshots:** ${results.screenshots.length}\n`;
  report += `- **🐛 JavaScript Errors:** ${results.errors.length}\n\n`;

  report += `**Pass Rate:** ${((passed / results.scenarios.length) * 100).toFixed(1)}%\n\n`;

  report += `---

## Scenarios

`;

  results.scenarios.forEach((scenario, index) => {
    const icon = scenario.status === 'PASS' ? '✅' : 
                 scenario.status === 'FAIL' ? '❌' : 
                 scenario.status === 'PARTIAL' ? '⚠️' : '💥';
    
    report += `### ${index + 1}. ${scenario.name}

**Status:** ${icon} ${scenario.status}  
**Mode:** ${scenario.mode}  
**Message:** "${scenario.message}"

`;

    if (scenario.eiPills) {
      report += `**EI Pills Found:** ${scenario.eiPills.length}/10\n`;
      if (scenario.eiPills.length > 0) {
        report += `**Pills:** ${scenario.eiPills.map(p => p.metric).join(', ')}\n`;
      }
    }

    if (scenario.hasCitations !== undefined) {
      report += `**Citations:** ${scenario.citationCount || 0}\n`;
    }

    if (scenario.modalOpened !== undefined) {
      report += `**Modal Opened:** ${scenario.modalOpened ? 'Yes' : 'No'}\n`;
    }

    if (scenario.reason) {
      report += `**Reason:** ${scenario.reason}\n`;
    }

    if (scenario.errors && scenario.errors.hasErrors) {
      report += `**Errors Detected:** Yes\n`;
    }

    report += `\n`;
  });

  if (results.errors.length > 0) {
    report += `---

## JavaScript Errors

`;
    results.errors.forEach(error => {
      report += `- **[${error.type}]** ${error.message || error.text}\n`;
    });
  }

  report += `\n---

## Screenshots

`;
  results.screenshots.forEach(ss => {
    report += `- **${ss.name}:** \`${ss.filepath}\`\n`;
  });

  fs.writeFileSync(reportFile, report);
  console.log(`📄 Markdown report saved to: ${reportFile}`);
}

// Run tests
runScenarios();
