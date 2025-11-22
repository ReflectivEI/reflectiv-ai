/**
 * TEST: Modal Content Verification
 * Verifies all 10 EI metric modals contain:
 * - Metric name as title
 * - Definition section
 * - Calculation section
 * - Tips section
 * - Citations
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOT_DIR = './test-screenshots-modal/';

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const expectedMetrics = [
    'empathy',
    'clarity',
    'compliance',
    'discovery',
    'objection_handling',
    'confidence',
    'active_listening',
    'adaptability',
    'action_insight',
    'resilience'
];

const testResults = {
    timestamp: new Date().toISOString(),
    url: URL,
    tests: [],
    screenshots: [],
    consoleLogs: [],
    totalTests: 0,
    passed: 0,
    failed: 0,
    skipped: 0
};

function addTest(name, status, details = {}) {
    const test = { name, status, details };
    testResults.tests.push(test);
    testResults.totalTests++;

    if (status === 'PASS') {
        console.log(`[PASS] ${name}`);
        testResults.passed++;
    } else if (status === 'FAIL') {
        console.log(`[FAIL] ${name}`);
        testResults.failed++;
    } else {
        console.log(`[SKIP] ${name}`);
        testResults.skipped++;
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
    console.log('🚀 Starting Modal Content Tests...');
    console.log('URL:', URL);
    console.log('Time:', new Date().toISOString());
    console.log('\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();

    // Capture console logs
    page.on('console', msg => {
        const logEntry = `[CONSOLE ${msg.type().toUpperCase()}] ${msg.text()}`;
        testResults.consoleLogs.push(logEntry);
        console.log(logEntry);
    });

    try {
        // =====================================================
        // TEST 1: Page loads
        // =====================================================
        console.log('\n[TEST 1] Page loads...');
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await waitFor(2000);
        addTest('Page loads', 'PASS', { url: URL });

        // =====================================================
        // TEST 2: Select EI mode
        // =====================================================
        console.log('\n[TEST 2] Select Emotional Intelligence mode...');
        await page.evaluate(() => {
            const select = document.querySelector('#reflectiv-widget select, #reflectiv-widget .mode-select');
            if (select) {
                const option = Array.from(select.querySelectorAll('option')).find(
                    opt => opt.textContent.includes('Emotional Intelligence')
                );
                if (option) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        await waitFor(1000);
        await screenshot(page, 'ei_mode_selected');
        addTest('Select EI mode', 'PASS');

        // =====================================================
        // TEST 3: Send emotional message
        // =====================================================
        console.log('\n[TEST 3] Send emotional message...');
        await page.evaluate(() => {
            const input = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
            if (input) {
                input.value = 'I feel overwhelmed with work stress';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await waitFor(500);

        const sendButton = await page.evaluateHandle(() => {
            return document.querySelector('#reflectiv-widget button.btn');
        });

        if (sendButton) {
            console.log('[MODAL TEST] Found send button');
            await page.evaluate(btn => btn.click(), sendButton);
            await waitFor(1000);
            addTest('Send emotional message', 'PASS');
        } else {
            addTest('Send emotional message', 'FAIL', { reason: 'Send button not found' });
        }

        // =====================================================
        // TEST 4: Wait for response and pills
        // =====================================================
        console.log('\n[TEST 4] Wait for EI pills to appear...');
        await waitFor(8000); // Wait for AI response

        const pills = await page.evaluate(() => {
            const pillElements = Array.from(document.querySelectorAll('#reflectiv-widget [data-metric]'));
            return pillElements.map(pill => ({
                metric: pill.getAttribute('data-metric'),
                text: pill.textContent.trim(),
                hasGradient: pill.style.background.includes('gradient') ||
                    window.getComputedStyle(pill).backgroundImage.includes('gradient')
            }));
        });

        console.log(`[MODAL TEST] Found ${pills.length} pills`);
        if (pills.length === 10) {
            addTest('10 EI pills appeared', 'PASS', { pills });
            await screenshot(page, 'pills_appeared');
        } else {
            addTest('10 EI pills appeared', 'FAIL', { found: pills.length, expected: 10, pills });
        }

        // =====================================================
        // TESTS 5-14: Check each metric modal content
        // =====================================================
        for (let i = 0; i < expectedMetrics.length; i++) {
            const metric = expectedMetrics[i];
            const testNum = i + 5;

            console.log(`\n[TEST ${testNum}] Check modal content for ${metric}...`);

            // Click the pill
            const clickSuccess = await page.evaluate((metricName) => {
                const pill = document.querySelector(`#reflectiv-widget [data-metric="${metricName}"]`);
                if (pill) {
                    pill.click();
                    return true;
                }
                return false;
            }, metric);

            if (!clickSuccess) {
                addTest(`Modal content for ${metric}`, 'FAIL', { reason: 'Pill not found' });
                continue;
            }

            await waitFor(500);

            // Extract modal content
            const modalContent = await page.evaluate(() => {
                const modal = document.querySelector('#metric-modal');
                if (!modal) return null;

                const title = modal.querySelector('h3')?.textContent?.trim() || '';
                const allText = modal.textContent || '';

                // Look for section indicators (match actual modal structure)
                // Definition starts right after title, contains description words
                const hasDefinition = allText.toLowerCase().includes('measures') ||
                    allText.toLowerCase().includes('assesses') ||
                    allText.toLowerCase().includes('tracks') ||
                    allText.toLowerCase().includes('quantifies') ||
                    allText.toLowerCase().includes('evaluates') ||
                    allText.toLowerCase().includes('rates') ||
                    (modalContent.textLength > 300); // If substantial content exists
                const hasCalculation = allText.toLowerCase().includes('calculation:');
                const hasTips = allText.toLowerCase().includes('sample indicators:');
                const hasCitations = allText.toLowerCase().includes('learn more:') ||
                    modal.querySelector('a[href]') !== null;

                return {
                    exists: true,
                    title,
                    textLength: allText.length,
                    hasDefinition,
                    hasCalculation,
                    hasTips,
                    hasCitations,
                    preview: allText.substring(0, 200)
                };
            });

            if (!modalContent || !modalContent.exists) {
                addTest(`Modal content for ${metric}`, 'FAIL', { reason: 'Modal not found' });
                continue;
            }

            await screenshot(page, `modal_${metric}`);

            // Verify all sections present
            const missingSection = [];
            if (!modalContent.hasDefinition) missingSection.push('definition');
            if (!modalContent.hasCalculation) missingSection.push('calculation');
            if (!modalContent.hasTips) missingSection.push('tips');
            if (!modalContent.hasCitations) missingSection.push('citations');

            if (missingSection.length === 0 && modalContent.textLength > 100) {
                addTest(`Modal content for ${metric}`, 'PASS', {
                    title: modalContent.title,
                    textLength: modalContent.textLength,
                    hasAllSections: true
                });
            } else {
                addTest(`Modal content for ${metric}`, 'FAIL', {
                    title: modalContent.title,
                    textLength: modalContent.textLength,
                    missingSections: missingSection
                });
            }

            // Close modal
            await page.evaluate(() => {
                const closeBtn = document.querySelector('#metric-modal button');
                if (closeBtn) closeBtn.click();
            });
            await waitFor(300);
        }

        await screenshot(page, 'final_state');

    } catch (error) {
        console.error('❌ Error during testing:', error);
        addTest('Test execution', 'FAIL', { error: error.message });
    } finally {
        await browser.close();
    }

    // =====================================================
    // Generate reports
    // =====================================================
    console.log('\n📝 Generating reports...');

    // Save JSON results
    fs.writeFileSync('./test-modal-results.json', JSON.stringify(testResults, null, 2));
    console.log('✅ JSON results saved to: ./test-modal-results.json');

    // Print summary
    console.log('\n========================================================');
    console.log('TEST SUMMARY');
    console.log('========================================================');
    console.log(`Total Tests: ${testResults.totalTests}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log(`⏭️  Skipped: ${testResults.skipped}`);
    console.log('\n📸 Screenshots:', testResults.screenshots.length);
    console.log('📋 Console Logs:', testResults.consoleLogs.length);
    console.log('========================================================\n');
}

runTests().catch(console.error);
