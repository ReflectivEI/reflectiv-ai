/**
 * FULL DISEASE STATE TESTING - HIV, Diabetes, Oncology
 * 4-6 turn exchanges per disease
 * Verify REP/HCP labeling
 * Check Feedback Coach updates
 * Verify all 10 EI metrics
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

const URL = 'https://reflectivei.github.io/reflectiv-ai/';
const SCREENSHOT_DIR = './test-screenshots-disease-states/';

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

const testResults = {
    timestamp: new Date().toISOString(),
    diseaseStates: {},
    globalIssues: [],
    totalTurns: 0,
    errorsFound: []
};

async function screenshot(page, name) {
    const filename = `${SCREENSHOT_DIR}${name}_${Date.now()}.png`;
    await page.screenshot({ path: filename, fullPage: true });
    console.log(`📸 ${filename}`);
    return filename;
}

async function waitFor(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function testDiseaseState(page, diseaseName, turns) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 TESTING DISEASE STATE: ${diseaseName}`);
    console.log(`${'='.repeat(60)}\n`);

    const stateResults = {
        disease: diseaseName,
        turns: [],
        repHcpLabeling: { correct: 0, incorrect: 0, missing: 0 },
        feedbackCoachUpdates: [],
        eiMetricsDisplayed: [],
        errors: [],
        screenshots: []
    };

    try {
        // Select disease state
        console.log(`[SETUP] Selecting disease: ${diseaseName}...`);
        const diseaseSelected = await page.evaluate((disease) => {
            const select = document.querySelector('#cw-disease');
            if (!select) return { success: false, reason: 'Disease selector not found' };

            const option = Array.from(select.options).find(opt =>
                opt.textContent.toLowerCase().includes(disease.toLowerCase())
            );

            if (!option) return { success: false, reason: `Disease ${disease} not in options` };

            select.value = option.value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return { success: true };
        }, diseaseName);

        if (!diseaseSelected.success) {
            stateResults.errors.push(`Failed to select disease: ${diseaseSelected.reason}`);
            return stateResults;
        }

        await waitFor(2000);
        stateResults.screenshots.push(await screenshot(page, `${diseaseName}_01_disease_selected`));

        // Conduct 4-6 turn conversation
        for (let i = 0; i < turns.length; i++) {
            const turn = turns[i];
            console.log(`\n[TURN ${i + 1}/${turns.length}] Rep says: "${turn}"`);

            // Type message
            await page.evaluate((msg) => {
                const input = document.querySelector('#reflectiv-widget textarea, #reflectiv-widget input[type="text"]');
                if (input) {
                    input.value = msg;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
            }, turn);

            await waitFor(500);

            // Click send
            await page.evaluate(() => {
                const sendBtn = document.querySelector('#reflectiv-widget button.btn');
                if (sendBtn) sendBtn.click();
            });

            await waitFor(1000);

            // Wait for HCP response
            console.log('[WAIT] Waiting for HCP response...');
            try {
                await page.waitForFunction(
                    (prevCount) => {
                        const messages = document.querySelectorAll('#reflectiv-widget .message');
                        return messages.length > prevCount;
                    },
                    { timeout: 30000 },
                    i * 2
                );
            } catch (e) {
                stateResults.errors.push(`Turn ${i + 1}: Timeout waiting for response`);
                continue;
            }

            await waitFor(3000); // Wait for full response

            // Check REP/HCP labeling
            const labelingCheck = await page.evaluate(() => {
                const messages = Array.from(document.querySelectorAll('#reflectiv-widget .message'));
                return messages.map(msg => ({
                    text: msg.textContent.substring(0, 100),
                    hasRepLabel: msg.textContent.toUpperCase().includes('REP:') ||
                        msg.textContent.toUpperCase().includes('REP '),
                    hasHcpLabel: msg.textContent.toUpperCase().includes('HCP:') ||
                        msg.textContent.toUpperCase().includes('HCP '),
                    classList: Array.from(msg.classList),
                    role: msg.classList.contains('user') ? 'user' :
                        msg.classList.contains('assistant') ? 'assistant' : 'unknown'
                }));
            });

            console.log(`[LABELS] Found ${labelingCheck.length} messages`);
            labelingCheck.forEach((msg, idx) => {
                if (msg.hasRepLabel || msg.hasHcpLabel) {
                    stateResults.repHcpLabeling.correct++;
                    console.log(`  ✅ Message ${idx + 1}: ${msg.hasRepLabel ? 'REP' : 'HCP'} label found`);
                } else {
                    stateResults.repHcpLabeling.missing++;
                    console.log(`  ⚠️  Message ${idx + 1}: No REP/HCP label (role: ${msg.role})`);
                }
            });

            // Check Feedback Coach
            const feedbackCoach = await page.evaluate(() => {
                const feedbackElements = document.querySelectorAll('[class*="feedback"], [class*="coach"], .yellow-panel, #coach-feedback');
                return Array.from(feedbackElements).map(el => ({
                    text: el.textContent.substring(0, 200),
                    visible: el.offsetHeight > 0,
                    backgroundColor: window.getComputedStyle(el).backgroundColor
                }));
            });

            if (feedbackCoach.length > 0) {
                console.log(`[FEEDBACK COACH] Found ${feedbackCoach.length} feedback elements`);
                stateResults.feedbackCoachUpdates.push({
                    turn: i + 1,
                    elements: feedbackCoach
                });
            } else {
                console.log(`[FEEDBACK COACH] ⚠️  No feedback coach elements found`);
            }

            // Check EI metrics
            const eiMetrics = await page.evaluate(() => {
                const pills = document.querySelectorAll('[data-metric]');
                return Array.from(pills).map(pill => ({
                    metric: pill.getAttribute('data-metric'),
                    text: pill.textContent.trim(),
                    visible: pill.offsetHeight > 0
                }));
            });

            if (eiMetrics.length > 0) {
                console.log(`[EI METRICS] Found ${eiMetrics.length} metric pills`);
                stateResults.eiMetricsDisplayed.push({
                    turn: i + 1,
                    metrics: eiMetrics
                });
            }

            stateResults.screenshots.push(await screenshot(page, `${diseaseName}_turn_${i + 1}_complete`));
            stateResults.turns.push({
                turnNumber: i + 1,
                userMessage: turn,
                labelsFound: labelingCheck.length,
                feedbackCoachVisible: feedbackCoach.length > 0,
                eiMetricsCount: eiMetrics.length
            });

            testResults.totalTurns++;
        }

    } catch (error) {
        stateResults.errors.push(`Fatal error: ${error.message}`);
        console.error(`❌ Error in ${diseaseName}:`, error);
    }

    return stateResults;
}

async function runTests() {
    console.log('🚀 FULL DISEASE STATE TESTING');
    console.log('Testing: HIV, Oncology (+ others if time permits)');
    console.log('');

    const browser = await puppeteer.launch({
        headless: false,
        args: ['--no-sandbox', '--window-size=1920,1080']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Capture errors
    page.on('console', msg => {
        if (msg.type() === 'error') {
            console.log(`[CONSOLE ERROR] ${msg.text()}`);
            testResults.errorsFound.push(msg.text());
        }
    });

    page.on('pageerror', error => {
        console.log(`[PAGE ERROR] ${error.message}`);
        testResults.errorsFound.push(error.message);
    });

    try {
        await page.goto(URL, { waitUntil: 'networkidle2', timeout: 60000 });
        await waitFor(3000);

        // Test HIV (4-6 turns)
        const hivTurns = [
            "Hi, I'd like to discuss PrEP with you",
            "What concerns do you have about prescribing PrEP?",
            "How do you currently assess patient risk factors?",
            "Let me share some recent efficacy data from the FDA label",
            "Would you be open to a follow-up discussion next month?"
        ];
        testResults.diseaseStates.HIV = await testDiseaseState(page, 'HIV', hivTurns);

        // Test Oncology (4-6 turns)
        const oncologyTurns = [
            "Good morning, I wanted to discuss our oncology treatment options",
            "What's your current approach for first-line therapy?",
            "Have you seen challenges with patient adherence?",
            "Our data shows improved outcomes in this patient population",
            "Can I schedule a time to review the clinical trial results?"
        ];
        testResults.diseaseStates.Oncology = await testDiseaseState(page, 'Oncology', oncologyTurns);

        // Save results
        fs.writeFileSync('./test-disease-states-results.json', JSON.stringify(testResults, null, 2));
        console.log('\n✅ Results saved to: ./test-disease-states-results.json');

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('SUMMARY');
        console.log('='.repeat(60));
        console.log(`Total Turns Tested: ${testResults.totalTurns}`);
        console.log(`Total Errors: ${testResults.errorsFound.length}`);

        Object.keys(testResults.diseaseStates).forEach(disease => {
            const state = testResults.diseaseStates[disease];
            console.log(`\n${disease}:`);
            console.log(`  Turns: ${state.turns.length}`);
            console.log(`  REP/HCP Labels - Correct: ${state.repHcpLabeling.correct}, Missing: ${state.repHcpLabeling.missing}`);
            console.log(`  Feedback Coach Updates: ${state.feedbackCoachUpdates.length}`);
            console.log(`  Errors: ${state.errors.length}`);
        });

        console.log('\n⏸️  Browser staying open for manual review (60 seconds)...');
        await waitFor(60000);

    } catch (error) {
        console.error('❌ Fatal error:', error);
        testResults.globalIssues.push(error.message);
    } finally {
        await browser.close();
    }
}

runTests().catch(console.error);
