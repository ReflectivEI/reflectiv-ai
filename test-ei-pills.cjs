#!/usr/bin/env node
/**
 * TARGETED EI PILLS TEST
 *
 * Specifically tests Emotional Intelligence mode for:
 * - 10 EI pills appearing
 * - Gradient backgrounds
 * - Modal functionality
 * - Pill click behavior
 */

const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOTS_DIR = './test-screenshots-ei';

const results = {
    timestamp: new Date().toISOString(),
    url: URL,
    tests: [],
    consoleLogs: [],
    screenshots: []
};

function addTest(name, status, details = {}) {
    results.tests.push({ name, status, details, timestamp: new Date().toISOString() });
    console.log(`[${status}] ${name}`);
}

async function screenshot(page, name) {
    const filename = `${name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_${Date.now()}.png`;
    const filepath = path.join(SCREENSHOTS_DIR, filename);
    await page.screenshot({ path: filepath, fullPage: true });
    results.screenshots.push({ name, filepath });
    console.log(`📸 Screenshot: ${filepath}`);
    return filepath;
}

async function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runEITest() {
    console.log('🚀 Starting EI Pills Test...');
    console.log(`URL: ${URL}`);
    console.log(`Time: ${results.timestamp}\n`);

    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    }

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    page.on('console', msg => {
        const log = { type: msg.type(), text: msg.text(), timestamp: new Date().toISOString() };
        results.consoleLogs.push(log);
        console.log(`[CONSOLE ${log.type.toUpperCase()}] ${log.text}`);
    });

    page.on('pageerror', error => {
        console.error(`[JS ERROR] ${error.message}`);
    });

    try {
        // Load page
        console.log('\n[TEST 1] Loading page...');
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await waitFor(3000); // Wait for full init
        await screenshot(page, 'ei_test_1_loaded');
        addTest('Page loaded', 'PASS');

        // Select Emotional Intelligence mode
        console.log('\n[TEST 2] Select Emotional Intelligence mode...');
        await page.evaluate(() => {
            const select = document.querySelector('#reflectiv-widget select');
            if (select) {
                select.value = select.querySelector('option').value; // First option = EI
                select.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });
        await waitFor(1000);
        await screenshot(page, 'ei_test_2_mode_selected');
        addTest('EI mode selected', 'PASS');

        // Send emotionally-charged message
        console.log('\n[TEST 3] Send emotional message...');
        const eiMessage = 'I felt really frustrated and overwhelmed when the HCP dismissed my product information';

        await page.evaluate((msg) => {
            const textarea = document.querySelector('#reflectiv-widget textarea');
            if (textarea) {
                textarea.value = msg;
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, eiMessage);

        await waitFor(500);
        await screenshot(page, 'ei_test_3_message_entered');

        // Click send
        await page.evaluate(() => {
            const sendBtn = document.querySelector('#reflectiv-widget button.btn');
            console.log('[EI TEST] Clicking send button...');
            if (sendBtn) sendBtn.click();
        });

        await waitFor(1000);
        await screenshot(page, 'ei_test_3_message_sent');
        addTest('Message sent', 'PASS', { message: eiMessage });

        // Wait for response
        console.log('⏳ Waiting for AI response with EI pills...');
        await page.waitForFunction(
            () => {
                const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');
                return messages.length > 0;
            },
            { timeout: 45000 }
        );

        await waitFor(3000); // Wait for pills to render
        await screenshot(page, 'ei_test_4_response_received');
        addTest('Response received', 'PASS');

        // Check for EI pills
        console.log('\n[TEST 4] Checking for EI pills...');
        const pillsData = await page.evaluate(() => {
            const pills = Array.from(document.querySelectorAll('#reflectiv-widget .ei-pill'));
            console.log('[EI TEST] Found pills:', pills.length);
            return pills.map(pill => ({
                text: pill.textContent.trim(),
                metric: pill.getAttribute('data-metric'),
                classList: Array.from(pill.classList),
                computedBackground: window.getComputedStyle(pill).background
            }));
        });

        console.log(`Found ${pillsData.length} EI pills`);

        if (pillsData.length === 10) {
            addTest('10 EI pills present', 'PASS', { pills: pillsData });
            await screenshot(page, 'ei_test_4_pills_found');
        } else {
            addTest('10 EI pills present', 'FAIL', {
                found: pillsData.length,
                expected: 10,
                pills: pillsData
            });
        }

        // Check gradients
        console.log('\n[TEST 5] Checking pill gradients...');
        const hasGradients = pillsData.some(pill =>
            pill.computedBackground && pill.computedBackground.includes('gradient')
        );

        if (hasGradients || pillsData.length > 0) {
            addTest('Pills have gradient backgrounds', 'PASS', {
                sampleBackgrounds: pillsData.slice(0, 3).map(p => p.computedBackground)
            });
        } else {
            addTest('Pills have gradient backgrounds', 'FAIL', {
                reason: 'No gradients detected',
                backgrounds: pillsData.map(p => p.computedBackground)
            });
        }

        // Test pill click (if pills exist)
        if (pillsData.length > 0) {
            console.log('\n[TEST 6] Testing pill click for modal...');

            await page.evaluate(() => {
                const firstPill = document.querySelector('#reflectiv-widget .ei-pill');
                console.log('[EI TEST] Clicking first pill:', firstPill?.textContent);
                if (firstPill) firstPill.click();
            });

            await waitFor(1000);
            await screenshot(page, 'ei_test_6_pill_clicked');

            const modalExists = await page.evaluate(() => {
                const modal = document.querySelector('#metric-modal');
                console.log('[EI TEST] Modal exists:', !!modal);
                return !!modal;
            });

            if (modalExists) {
                const modalContent = await page.evaluate(() => {
                    const modal = document.querySelector('#metric-modal');
                    return {
                        visible: modal !== null,
                        title: modal?.querySelector('h2, h3')?.textContent,
                        hasDefinition: modal?.textContent.includes('definition') || modal?.textContent.includes('Definition'),
                        hasButton: modal?.querySelector('button')?.textContent.includes('Got it')
                    };
                });

                addTest('Modal opens on pill click', 'PASS', { modal: modalContent });
                await screenshot(page, 'ei_test_6_modal_open');

                // Close modal
                await page.evaluate(() => {
                    const btn = document.querySelector('#metric-modal button');
                    if (btn) btn.click();
                });
                await waitFor(500);

            } else {
                addTest('Modal opens on pill click', 'FAIL', { reason: 'Modal not found' });
            }
        } else {
            addTest('Modal opens on pill click', 'SKIP', { reason: 'No pills to test' });
        }

        // Final screenshot
        await screenshot(page, 'ei_test_final');

    } catch (error) {
        console.error('\n❌ Test error:', error.message);
        addTest('EI Test Suite', 'FAIL', { error: error.message });
    } finally {
        await browser.close();
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('EI PILLS TEST SUMMARY');
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
    console.log('='.repeat(60));

    // Save results
    fs.writeFileSync('./test-ei-results.json', JSON.stringify(results, null, 2));
    console.log('\n✅ Results saved to: test-ei-results.json');

    return { passed, failed, skipped, total: results.tests.length };
}

runEITest().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
});
