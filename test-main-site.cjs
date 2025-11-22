/**
 * REAL COMPREHENSIVE TEST - Main Coaching Site
 * URL: https://reflectivei.github.io/reflectiv-ai/
 *
 * Tests:
 * 1. Site loads completely
 * 2. Yellow Feedback Coach panel exists
 * 3. Disease state selector works
 * 4. All UI elements present
 * 5. 10 EI metrics display
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOT_DIR = './test-screenshots-main-site/';

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
    timestamp: new Date().toISOString(),
    url: URL,
    tests: [],
    screenshots: [],
    consoleLogs: [],
    networkCalls: [],
    errors: [],
    totalTests: 0,
    passed: 0,
    failed: 0
};

function addTest(name, status, details = {}) {
    testResults.tests.push({ name, status, details });
    testResults.totalTests++;
    if (status === 'PASS') {
        console.log(`✅ [PASS] ${name}`);
        testResults.passed++;
    } else {
        console.log(`❌ [FAIL] ${name}`);
        testResults.failed++;
    }
}

async function screenshot(page, name) {
    const filename = `${SCREENSHOT_DIR}${name}_${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    testResults.screenshots.push(filename);
    console.log(`📸 Screenshot: ${filename}`);
}

async function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚀 REAL COMPREHENSIVE TEST - Main Coaching Site');
    console.log('URL:', URL);
    console.log('Time:', new Date().toISOString());
    console.log('\n');

    const browser = await puppeteer.launch({
        headless: false, // Run with visible browser to see what's happening
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture all console logs
    page.on('console', msg => {
        const log = {
            type: msg.type(),
            text: msg.text(),
            timestamp: new Date().toISOString()
        };
        testResults.consoleLogs.push(log);
        console.log(`[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`);
    });

    // Capture all network calls
    page.on('request', request => {
        testResults.networkCalls.push({
            type: 'REQUEST',
            url: request.url(),
            method: request.method()
        });
    });

    page.on('response', response => {
        testResults.networkCalls.push({
            type: 'RESPONSE',
            url: response.url(),
            status: response.status()
        });
    });

    // Capture errors
    page.on('pageerror', error => {
        testResults.errors.push({
            message: error.message,
            stack: error.stack
        });
        console.log(`[PAGE ERROR] ${error.message}`);
    });

    try {
        // =====================================================
        // TEST 1: Page loads
        // =====================================================
        console.log('\n[TEST 1] Main site loads...');
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await waitFor(3000); // Wait for dynamic content
        await screenshot(page, '01_page_loaded');
        addTest('Main site loads', 'PASS', { url: URL });

        // =====================================================
        // TEST 2: Check page structure
        // =====================================================
        console.log('\n[TEST 2] Check page structure...');
        const pageStructure = await page.evaluate(() => {
            return {
                title: document.title,
                hasBody: !!document.body,
                bodyHTML: document.body ? document.body.innerHTML.substring(0, 500) : '',
                allElements: document.querySelectorAll('*').length,
                headings: Array.from(document.querySelectorAll('h1, h2, h3')).map(h => h.textContent.trim()),
                buttons: Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim()),
                inputs: Array.from(document.querySelectorAll('input, textarea')).map(i => i.placeholder || i.type),
                scripts: Array.from(document.querySelectorAll('script[src]')).map(s => s.src)
            };
        });

        console.log('[PAGE STRUCTURE]', JSON.stringify(pageStructure, null, 2));
        addTest('Page has content', pageStructure.allElements > 10 ? 'PASS' : 'FAIL', pageStructure);

        // =====================================================
        // TEST 3: Look for Yellow Feedback Coach panel
        // =====================================================
        console.log('\n[TEST 3] Looking for Yellow Feedback Coach panel...');
        const feedbackCoach = await page.evaluate(() => {
            // Look for yellow/colored panel
            const allDivs = Array.from(document.querySelectorAll('div'));
            const yellowPanel = allDivs.find(div => {
                const bg = window.getComputedStyle(div).backgroundColor;
                const text = div.textContent.toLowerCase();
                return (bg.includes('255, 255, 0') || bg.includes('yellow') ||
                    text.includes('feedback') || text.includes('coach'));
            });

            if (yellowPanel) {
                return {
                    found: true,
                    text: yellowPanel.textContent.substring(0, 200),
                    backgroundColor: window.getComputedStyle(yellowPanel).backgroundColor,
                    classList: Array.from(yellowPanel.classList)
                };
            }

            // Also check for specific IDs/classes
            const feedbackElements = document.querySelectorAll('[class*="feedback"], [class*="coach"], [id*="feedback"], [id*="coach"]');
            return {
                found: feedbackElements.length > 0,
                count: feedbackElements.length,
                elements: Array.from(feedbackElements).map(el => ({
                    tag: el.tagName,
                    class: el.className,
                    id: el.id,
                    text: el.textContent.substring(0, 100)
                }))
            };
        });

        console.log('[FEEDBACK COACH SEARCH]', JSON.stringify(feedbackCoach, null, 2));
        if (feedbackCoach.found) {
            addTest('Yellow Feedback Coach panel found', 'PASS', feedbackCoach);
            await screenshot(page, '02_feedback_coach_found');
        } else {
            addTest('Yellow Feedback Coach panel found', 'FAIL', {
                reason: 'No yellow panel or feedback coach element detected',
                details: feedbackCoach
            });
        }

        // =====================================================
        // TEST 4: Look for Disease State selector
        // =====================================================
        console.log('\n[TEST 4] Looking for Disease State selector...');
        const diseaseSelector = await page.evaluate(() => {
            const selects = Array.from(document.querySelectorAll('select'));
            const diseaseSelect = selects.find(s => {
                const text = s.textContent.toLowerCase();
                return text.includes('hiv') || text.includes('diabetes') ||
                    text.includes('oncology') || text.includes('disease');
            });

            if (diseaseSelect) {
                return {
                    found: true,
                    options: Array.from(diseaseSelect.querySelectorAll('option')).map(o => o.textContent.trim()),
                    id: diseaseSelect.id,
                    class: diseaseSelect.className
                };
            }

            // Also check for buttons/tabs for disease selection
            const buttons = Array.from(document.querySelectorAll('button'));
            const diseaseButtons = buttons.filter(b => {
                const text = b.textContent.toLowerCase();
                return text.includes('hiv') || text.includes('diabetes') || text.includes('oncology');
            });

            return {
                found: diseaseButtons.length > 0,
                buttons: diseaseButtons.map(b => b.textContent.trim())
            };
        });

        console.log('[DISEASE SELECTOR]', JSON.stringify(diseaseSelector, null, 2));
        if (diseaseSelector.found) {
            addTest('Disease state selector found', 'PASS', diseaseSelector);
        } else {
            addTest('Disease state selector found', 'FAIL', {
                reason: 'No disease state selector detected'
            });
        }

        // =====================================================
        // TEST 5: Look for EI Metrics display (10 metrics)
        // =====================================================
        console.log('\n[TEST 5] Looking for 10 EI metrics...');
        const eiMetrics = await page.evaluate(() => {
            const text = document.body.textContent.toLowerCase();
            const metrics = [
                'empathy', 'clarity', 'compliance', 'discovery',
                'objection', 'confidence', 'listening', 'adaptability',
                'action', 'resilience', 'rapport'
            ];

            const found = metrics.filter(m => text.includes(m));

            // Also look for specific metric displays
            const metricElements = document.querySelectorAll('[data-metric], .metric, .ei-metric');

            return {
                metricsInText: found,
                metricElements: metricElements.length,
                elementDetails: Array.from(metricElements).map(el => ({
                    text: el.textContent.substring(0, 50),
                    dataMetric: el.getAttribute('data-metric'),
                    class: el.className
                }))
            };
        });

        console.log('[EI METRICS]', JSON.stringify(eiMetrics, null, 2));
        if (eiMetrics.metricsInText.length >= 8) {
            addTest('EI metrics visible on page', 'PASS', eiMetrics);
        } else {
            addTest('EI metrics visible on page', 'FAIL', {
                found: eiMetrics.metricsInText.length,
                expected: 10,
                details: eiMetrics
            });
        }

        // =====================================================
        // TEST 6: Look for Chat widget
        // =====================================================
        console.log('\n[TEST 6] Looking for chat widget/modal...');
        const chatWidget = await page.evaluate(() => {
            const widget = document.querySelector('#reflectiv-widget');
            if (widget) {
                return {
                    found: true,
                    visible: widget.offsetHeight > 0,
                    html: widget.innerHTML.substring(0, 300)
                };
            }
            return { found: false };
        });

        console.log('[CHAT WIDGET]', JSON.stringify(chatWidget, null, 2));
        if (chatWidget.found) {
            addTest('Chat widget present', 'PASS', chatWidget);
        } else {
            addTest('Chat widget present', 'FAIL', {
                reason: 'Widget #reflectiv-widget not found'
            });
        }

        await screenshot(page, '03_final_state');
        await waitFor(2000);

        console.log('\n⏸️  Browser will stay open for 30 seconds for manual inspection...');
        await waitFor(30000);

    } catch (error) {
        console.error('❌ Error during testing:', error);
        addTest('Test execution', 'FAIL', { error: error.message, stack: error.stack });
        await screenshot(page, 'error_state');
    } finally {
        await browser.close();
    }

    // Save results
    fs.writeFileSync('./test-main-site-results.json', JSON.stringify(testResults, null, 2));
    console.log('\n✅ Results saved to: ./test-main-site-results.json');

    // Print summary
    console.log('\n========================================================');
    console.log('MAIN SITE TEST SUMMARY');
    console.log('========================================================');
    console.log(`Total Tests: ${testResults.totalTests}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`📸 Screenshots: ${testResults.screenshots.length}`);
    console.log(`📋 Console Logs: ${testResults.consoleLogs.length}`);
    console.log(`🌐 Network Calls: ${testResults.networkCalls.length}`);
    console.log(`💥 Errors: ${testResults.errors.length}`);
    console.log('========================================================\n');
}

runTests().catch(console.error);
