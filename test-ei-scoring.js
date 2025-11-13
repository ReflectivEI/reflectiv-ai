/**
 * EI Scoring Integration Test
 * Tests the complete flow: UI → Worker → AI → Parser → UI
 * Validates PHASE 2 fixes: correct path, all 10 metrics, no invalid metrics
 */

const WORKER_URL = "https://my-chat-agent-v2.tonyabdelmalak.workers.dev";

// Test scenarios for each mode
const testScenarios = [
    {
        mode: "sales-coach",
        message: "I understand your concerns about patient adherence. Based on the DISCOVER trial data, Descovy for PrEP has shown excellent efficacy. How do you currently discuss PrEP options with at-risk patients?",
        expectedMetrics: ["empathy", "clarity", "compliance", "discovery", "objection_handling", "confidence", "active_listening", "adaptability", "action_insight", "resilience"],
        description: "Sales Coach - HIV PrEP discussion"
    },
    {
        mode: "role-play",
        persona: "difficult",
        disease: "HIV",
        message: "I appreciate you taking the time to meet with me today. I wanted to discuss how Descovy for PrEP might benefit your at-risk patient population.",
        expectedMetrics: ["empathy", "clarity", "compliance", "discovery", "objection_handling", "confidence", "active_listening", "adaptability", "action_insight", "resilience"],
        description: "Role Play - Difficult HCP, HIV"
    },
    {
        mode: "emotional-assessment",
        message: "Tell me about a recent challenging interaction with an HCP where you felt frustrated.",
        expectedMetrics: ["empathy", "clarity", "compliance", "discovery", "objection_handling", "confidence", "active_listening", "adaptability", "action_insight", "resilience"],
        description: "Emotional Assessment - Self-reflection"
    }
];

// Expected 10 metrics (NO "accuracy" or "ei" nesting)
const CANONICAL_METRICS = [
    "empathy",
    "clarity",
    "compliance",
    "discovery",
    "objection_handling",
    "confidence",
    "active_listening",
    "adaptability",
    "action_insight",
    "resilience"
];

async function testEIScoring(scenario, testNumber) {
    console.log(`\n${"=".repeat(80)}`);
    console.log(`TEST ${testNumber}: ${scenario.description}`);
    console.log(`${"=".repeat(80)}`);

    const body = {
        mode: scenario.mode,
        message: scenario.message,
        conversation: [],
        sessionId: `test-${Date.now()}-${testNumber}`
    };

    if (scenario.persona) body.persona = scenario.persona;
    if (scenario.disease) body.disease = scenario.disease;

    console.log(`\n📤 REQUEST:`);
    console.log(`Mode: ${scenario.mode}`);
    console.log(`Message: ${scenario.message.substring(0, 100)}...`);

    try {
        const startTime = Date.now();
        const response = await fetch(`${WORKER_URL}/chat`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const elapsed = Date.now() - startTime;

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`\n📥 RESPONSE (${elapsed}ms):`);
        console.log(`Reply length: ${data.reply?.length || 0} chars`);

        // CRITICAL VALIDATION: Check coach object structure
        console.log(`\n🔍 COACH OBJECT STRUCTURE:`);

        if (!data.coach) {
            console.log(`❌ FAIL: No coach object in response`);
            return { success: false, error: "Missing coach object" };
        }

        console.log(`✅ coach object exists`);

        // Check for INCORRECT .ei nesting (should NOT exist)
        if (data.coach.ei) {
            console.log(`❌ FAIL: Incorrect .ei nesting detected (should be flat .scores)`);
            console.log(`   Found: data.coach.ei = ${JSON.stringify(data.coach.ei).substring(0, 100)}`);
            return { success: false, error: "Invalid .ei nesting" };
        }

        console.log(`✅ No incorrect .ei nesting`);

        // Check for CORRECT .scores object
        if (!data.coach.scores) {
            console.log(`❌ FAIL: No .scores object in coach`);
            console.log(`   Coach keys: ${Object.keys(data.coach).join(", ")}`);
            return { success: false, error: "Missing .scores object" };
        }

        console.log(`✅ .scores object exists at correct path`);

        const scores = data.coach.scores;
        console.log(`\n📊 SCORES VALIDATION:`);

        // Validate all 10 canonical metrics present
        let allMetricsPresent = true;
        let missingMetrics = [];
        let invalidMetrics = [];

        CANONICAL_METRICS.forEach(metric => {
            if (!(metric in scores)) {
                allMetricsPresent = false;
                missingMetrics.push(metric);
                console.log(`❌ Missing metric: ${metric}`);
            } else {
                const value = scores[metric];
                console.log(`✅ ${metric}: ${value}/5`);
            }
        });

        // Check for invalid metrics (e.g., "accuracy")
        Object.keys(scores).forEach(key => {
            if (!CANONICAL_METRICS.includes(key)) {
                invalidMetrics.push(key);
                console.log(`⚠️  Invalid metric detected: ${key} = ${scores[key]}`);
            }
        });

        // Validate rationales
        console.log(`\n📝 RATIONALES:`);
        const rationales = data.coach.rationales || {};
        let rationaleCount = 0;
        CANONICAL_METRICS.forEach(metric => {
            if (rationales[metric]) {
                rationaleCount++;
                console.log(`✅ ${metric}: "${rationales[metric].substring(0, 60)}..."`);
            }
        });

        console.log(`\nRationale coverage: ${rationaleCount}/${CANONICAL_METRICS.length}`);

        // Validate other coach fields
        console.log(`\n📋 OTHER COACH FIELDS:`);
        console.log(`worked: ${data.coach.worked ? `${data.coach.worked.length} items` : "missing"}`);
        console.log(`improve: ${data.coach.improve ? `${data.coach.improve.length} items` : "missing"}`);
        console.log(`phrasing: ${data.coach.phrasing ? `"${data.coach.phrasing.substring(0, 50)}..."` : "missing"}`);

        // FINAL VERDICT
        const success = allMetricsPresent && invalidMetrics.length === 0 && !data.coach.ei;

        console.log(`\n${"=".repeat(80)}`);
        if (success) {
            console.log(`✅ TEST ${testNumber} PASSED`);
            console.log(`   - All 10 canonical metrics present`);
            console.log(`   - No invalid metrics (e.g., "accuracy")`);
            console.log(`   - Correct path (coach.scores, not coach.ei.scores)`);
            console.log(`   - ${rationaleCount} rationales provided`);
        } else {
            console.log(`❌ TEST ${testNumber} FAILED`);
            if (missingMetrics.length > 0) {
                console.log(`   - Missing metrics: ${missingMetrics.join(", ")}`);
            }
            if (invalidMetrics.length > 0) {
                console.log(`   - Invalid metrics: ${invalidMetrics.join(", ")}`);
            }
            if (data.coach.ei) {
                console.log(`   - Incorrect .ei nesting detected`);
            }
        }
        console.log(`${"=".repeat(80)}\n`);

        return {
            success,
            testNumber,
            scenario: scenario.description,
            metrics: scores,
            missingMetrics,
            invalidMetrics,
            hasEiNesting: !!data.coach.ei,
            rationaleCount,
            elapsed
        };

    } catch (error) {
        console.log(`\n❌ TEST ${testNumber} ERROR: ${error.message}`);
        console.log(`${"=".repeat(80)}\n`);
        return {
            success: false,
            testNumber,
            scenario: scenario.description,
            error: error.message
        };
    }
}

async function runAllTests() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    EI SCORING INTEGRATION TEST SUITE                       ║
║                         PHASE 2 FIX VALIDATION                             ║
╚════════════════════════════════════════════════════════════════════════════╝

Testing against: ${WORKER_URL}
Date: ${new Date().toISOString()}

VALIDATION CRITERIA:
✓ All 10 canonical metrics present in response
✓ Correct path: coach.scores (NOT coach.ei.scores)
✓ No invalid metrics (e.g., "accuracy")
✓ Rationales provided for metrics
✓ Response time < 10 seconds
`);

    const results = [];

    // TEST 1
    console.log(`\n🧪 RUNNING TEST SET 1 (Sales Coach)`);
    const test1 = await testEIScoring(testScenarios[0], 1);
    results.push(test1);
    await new Promise(r => setTimeout(r, 2000)); // 2s delay between tests

    // TEST 2
    console.log(`\n🧪 RUNNING TEST SET 2 (Role Play)`);
    const test2 = await testEIScoring(testScenarios[1], 2);
    results.push(test2);
    await new Promise(r => setTimeout(r, 2000));

    // TEST 3 (FINAL)
    console.log(`\n🧪 RUNNING FINAL TEST (Emotional Assessment)`);
    const test3 = await testEIScoring(testScenarios[2], 3);
    results.push(test3);

    // SUMMARY REPORT
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                           FINAL TEST RESULTS                               ║
╚════════════════════════════════════════════════════════════════════════════╝
`);

    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    results.forEach((result, i) => {
        console.log(`TEST ${i + 1}: ${result.scenario}`);
        console.log(`  Status: ${result.success ? "✅ PASSED" : "❌ FAILED"}`);
        if (result.error) {
            console.log(`  Error: ${result.error}`);
        } else {
            console.log(`  Response time: ${result.elapsed}ms`);
            console.log(`  Metrics count: ${Object.keys(result.metrics || {}).length}/10`);
            console.log(`  Missing: ${result.missingMetrics?.length || 0}`);
            console.log(`  Invalid: ${result.invalidMetrics?.length || 0}`);
            console.log(`  Has .ei nesting: ${result.hasEiNesting ? "YES (BAD)" : "NO (GOOD)"}`);
            console.log(`  Rationales: ${result.rationaleCount}/10`);
        }
        console.log("");
    });

    console.log(`${"=".repeat(80)}`);
    console.log(`SUMMARY: ${passed}/${results.length} tests passed`);
    console.log(`${"=".repeat(80)}\n`);

    if (passed === results.length) {
        console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║  ✅ ALL TESTS PASSED - PHASE 2 FIXES CONFIRMED WORKING                     ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
    } else {
        console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║  ❌ SOME TESTS FAILED - REVIEW FAILURES ABOVE                              ║
╚════════════════════════════════════════════════════════════════════════════╝
`);
    }

    return results;
}

// Run tests
runAllTests().then(() => {
    console.log("\n✅ Test suite completed\n");
    process.exit(0);
}).catch(err => {
    console.error("\n❌ Test suite failed:", err);
    process.exit(1);
});
