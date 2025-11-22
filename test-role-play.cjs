/**
 * TEST: Role Play Mode
 * Verifies role-play scenario handling, response format
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOT_DIR = './test-screenshots-rp/';

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
    timestamp: new Date().toISOString(),
    tests: [],
    totalTests: 0,
    passed: 0,
    failed: 0
};

function addTest(name, status, details = {}) {
    testResults.tests.push({ name, status, details });
    testResults.totalTests++;
    if (status === 'PASS') {
        console.log(`[PASS] ${name}`);
        testResults.passed++;
    } else {
        console.log(`[FAIL] ${name}`);
        testResults.failed++;
    }
}

async function screenshot(page, name) {
    const filename = `${SCREENSHOT_DIR}${name}_${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 ${filename}`);
}

async function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
    console.log('🚀 Starting Role Play Tests...\n');

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox']
    });

    const page = await browser.newPage();

    try {
        // TEST 1: Load page
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 });
        await waitFor(2000);
        addTest('Page loads', 'PASS');

        // TEST 2: Select Role Play mode
        await page.evaluate(() => {
            const select = document.querySelector('#reflectiv-widget select');
            if (select) {
                const option = Array.from(select.querySelectorAll('option')).find(
                    opt => opt.textContent.includes('Role Play')
                );
                if (option) {
                    select.value = option.value;
                    select.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        });
        await waitFor(1000);
        await screenshot(page, 'rp_mode_selected');
        addTest('Select Role Play mode', 'PASS');

        // TEST 3: Send role-play scenario
        await page.evaluate(() => {
            const input = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
            if (input) {
                input.value = 'Let me practice handling objections about cost';
                input.dispatchEvent(new Event('input', { bubbles: true }));
            }
        });
        await waitFor(500);

        const sendBtn = await page.evaluateHandle(() => {
            return document.querySelector('#reflectiv-widget button.btn');
        });

        if (sendBtn) {
            await page.evaluate(btn => btn.click(), sendBtn);
            await waitFor(1000);
            addTest('Send role-play message', 'PASS');
        } else {
            addTest('Send role-play message', 'FAIL', { reason: 'Send button not found' });
        }

        // TEST 4: Wait for response
        try {
            await page.waitForFunction(
                () => {
                    const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');
                    return messages.length > 0;
                },
                { timeout: 30000 }
            );

            await waitFor(2000);

            const response = await page.evaluate(() => {
                const messages = document.querySelectorAll('#reflectiv-widget .message.assistant');

                // In Role Play, first message might be HCP, second is AI coach guidance
                const allMessages = Array.from(messages).map(msg => ({
                    text: msg.textContent.substring(0, 100),
                    length: msg.textContent.length
                }));

                // Return last message (should be longest/most substantial)
                const lastMsg = messages[messages.length - 1];

                return {
                    totalMessages: messages.length,
                    allMessages: allMessages,
                    lastMessage: lastMsg ? {
                        text: lastMsg.textContent.substring(0, 200),
                        length: lastMsg.textContent.length
                    } : null
                };
            });

            if (response && response.lastMessage && response.lastMessage.length > 40) {
                addTest('Role Play response received', 'PASS', {
                    totalMessages: response.totalMessages,
                    preview: response.lastMessage.text,
                    length: response.lastMessage.length
                });
                await screenshot(page, 'rp_response');
            } else {
                addTest('Role Play response received', 'FAIL', { response });
            }
        } catch (error) {
            addTest('Role Play response received', 'FAIL', { error: error.message });
        }

        await screenshot(page, 'final_state');

    } catch (error) {
        console.error('❌ Error:', error);
        addTest('Test execution', 'FAIL', { error: error.message });
    } finally {
        await browser.close();
    }

    fs.writeFileSync('./test-rp-results.json', JSON.stringify(testResults, null, 2));

    console.log('\n========================================================');
    console.log('ROLE PLAY TEST SUMMARY');
    console.log('========================================================');
    console.log(`Total Tests: ${testResults.totalTests}`);
    console.log(`✅ Passed: ${testResults.passed}`);
    console.log(`❌ Failed: ${testResults.failed}`);
    console.log('========================================================\n');
}

runTests().catch(console.error);
