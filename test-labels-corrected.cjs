/**
 * CORRECTED TEST - REP/HCP Labeling in Role Play Mode
 *
 * Original test searched for "REP:" or "HCP:" in message TEXT.
 * This test searches for the actual HTML structure:
 *   <div class="speaker rep">Rep</div>
 *   <div class="speaker hcp">HCP</div>
 */

const puppeteer = require('puppeteer');
const fs = require('fs');

async function testLabels() {
    const browser = await puppeteer.launch({
        headless: false,
        defaultViewport: { width: 1400, height: 900 }
    });

    const page = await browser.newPage();

    console.log('Loading main coaching site...');
    await page.goto('https://reflectivei.github.io/reflectiv-ai/', {
        waitUntil: 'networkidle0'
    });

    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('Selecting HIV disease state...');
    await page.select('#cw-disease', 'hiv');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Selecting Role Play mode...');
    await page.select('#cw-mode', 'role-play');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Widget should already be visible on page
    console.log('Checking if widget is visible...');
    const widgetVisible = await page.evaluate(() => {
        const widget = document.getElementById('reflectiv-widget');
        return widget && window.getComputedStyle(widget).display !== 'none';
    });
    console.log(`Widget visible: ${widgetVisible}`);

    const results = {
        diseaseState: 'HIV',
        mode: 'role-play',
        turns: []
    };

    // Conduct 5 turns
    for (let turn = 1; turn <= 5; turn++) {
        console.log(`\n========== TURN ${turn} ==========`);

        const userMessage = `Turn ${turn}: Tell me about HIV treatment adherence.`;

        console.log(`Sending message: "${userMessage}"`);

        // Use evaluate to interact with the widget directly
        const messageSent = await page.evaluate((msg) => {
            const textarea = document.querySelector('#reflectiv-widget .chat-input textarea');
            const sendBtn = document.querySelector('#reflectiv-widget .chat-input .btn');

            if (!textarea || !sendBtn) {
                console.error('Could not find textarea or button');
                return false;
            }

            // Set the message
            textarea.value = msg;

            // Trigger input event so widget knows the content changed
            textarea.dispatchEvent(new Event('input', { bubbles: true }));

            // Click send button
            sendBtn.click();

            return true;
        }, userMessage);

        if (!messageSent) {
            console.error(`❌ Failed to send message for turn ${turn}`);
            continue;
        }

        // Wait for response
        await new Promise(resolve => setTimeout(resolve, 3000));

        // NOW CHECK FOR CORRECT LABEL STRUCTURE
        const labelData = await page.evaluate(() => {
            // Find all messages
            const messages = Array.from(document.querySelectorAll('#reflectiv-widget .message'));

            const results = messages.map((msg, idx) => {
                const role = msg.classList.contains('user') ? 'user' : 'assistant';

                // Look for speaker chip divs
                const speakerChip = msg.querySelector('.speaker');

                let labelFound = null;
                let labelText = null;
                let labelClass = null;

                if (speakerChip) {
                    labelFound = true;
                    labelText = speakerChip.textContent.trim();
                    labelClass = speakerChip.className;
                } else {
                    labelFound = false;
                }

                // Get message text (excluding speaker chip)
                const content = msg.querySelector('.content');
                const bodyText = content ? content.textContent.trim() : '';

                return {
                    index: idx + 1,
                    role,
                    labelFound,
                    labelText,
                    labelClass,
                    bodyPreview: bodyText.substring(0, 100)
                };
            });

            return results;
        });

        console.log(`Turn ${turn} - Found ${labelData.length} messages`);

        let correctLabels = 0;
        let missingLabels = 0;

        labelData.forEach(msg => {
            if (msg.labelFound) {
                console.log(`✅ Message ${msg.index} (${msg.role}): Label "${msg.labelText}" (class: ${msg.labelClass})`);
                correctLabels++;
            } else {
                console.log(`❌ Message ${msg.index} (${msg.role}): NO LABEL FOUND`);
                missingLabels++;
            }
        });

        results.turns.push({
            turn,
            totalMessages: labelData.length,
            correctLabels,
            missingLabels,
            labelPercentage: Math.round((correctLabels / labelData.length) * 100),
            messages: labelData
        });

        console.log(`Turn ${turn} Summary: ${correctLabels} labeled, ${missingLabels} missing (${Math.round((correctLabels / labelData.length) * 100)}%)`);

        // Screenshot
        await page.screenshot({
            path: `test-screenshots-labels-corrected/turn_${turn}.png`,
            fullPage: true
        });
    }

    // Calculate overall statistics
    const totalMessages = results.turns.reduce((sum, t) => sum + t.totalMessages, 0);
    const totalCorrect = results.turns.reduce((sum, t) => sum + t.correctLabels, 0);
    const totalMissing = results.turns.reduce((sum, t) => sum + t.missingLabels, 0);

    results.summary = {
        totalMessages,
        totalCorrect,
        totalMissing,
        overallPercentage: Math.round((totalCorrect / totalMessages) * 100)
    };

    console.log('\n========== FINAL SUMMARY ==========');
    console.log(`Total Messages: ${totalMessages}`);
    console.log(`Labels Found: ${totalCorrect}`);
    console.log(`Labels Missing: ${totalMissing}`);
    console.log(`Success Rate: ${results.summary.overallPercentage}%`);

    // Save results
    fs.writeFileSync('test-labels-corrected-results.json', JSON.stringify(results, null, 2));

    console.log('\n✅ Test complete. Browser will stay open for 30 seconds for manual inspection.');
    await new Promise(resolve => setTimeout(resolve, 30000));

    await browser.close();
}

// Create screenshot directory
if (!fs.existsSync('test-screenshots-labels-corrected')) {
    fs.mkdirSync('test-screenshots-labels-corrected');
}

testLabels().catch(err => {
    console.error('❌ Test failed:', err);
    process.exit(1);
});
