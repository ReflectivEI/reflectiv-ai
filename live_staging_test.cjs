#!/usr/bin/env node

/**
 * PHASE 9: Live Worker Validation - Real Staging Worker Tests
 * Tests actual deployed staging worker with real API calls
 */

const fs = require('fs');

// Test configuration
const STAGING_WORKER_URL = 'https://my-chat-agent-v2-staging.tonyabdelmalak.workers.dev';
const MODES = ['sales-coach', 'role-play', 'product-knowledge', 'emotional-assessment', 'general-knowledge'];

const TEST_MESSAGES = {
  'sales-coach': "We're seeing toxicity concerns with ADC. How should we approach this?",
  'role-play': "I'm not comfortable discussing PrEP with my patients. What should I say?",
  'product-knowledge': "What's the mechanism of action for ADCs?",
  'emotional-assessment': "That conversation with the patient felt really challenging. How do I process this?",
  'general-knowledge': "Can you explain how HIV transmission works?"
};

// Test utilities
function assert(condition, message) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  }
}

async function testStagingWorker() {
  console.log('🚀 PHASE 9: LIVE STAGING WORKER VALIDATION');
  console.log('📍 Staging Worker:', STAGING_WORKER_URL);
  console.log('📅 Date:', new Date().toISOString());
  console.log('');

  const results = {
    totalTests: MODES.length,
    passedTests: 0,
    failedTests: 0,
    details: []
  };

  for (const mode of MODES) {
    console.log(`\n======================================================================`);
    console.log(`TEST: ${mode.toUpperCase()} MODE - LIVE STAGING WORKER`);
    console.log(`======================================================================`);

    try {
      const startTime = Date.now();
      const response = await fetch(`${STAGING_WORKER_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: 'You are a helpful assistant.' },
            { role: 'user', content: TEST_MESSAGES[mode] }
          ],
          mode: mode,
          scenario: {
            therapeuticArea: 'HIV',
            hcpRole: 'Primary Care Physician',
            goal: 'Discuss PrEP options'
          }
        })
      });

      const responseTime = Date.now() - startTime;
      console.log(`📤 Request sent to ${mode} mode...`);
      console.log(`⏱️  Response time: ${responseTime}ms`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      console.log(`✅ Response received (${JSON.stringify(data).length} characters)`);

      // Validate response contract
      assert(data.role === 'assistant', `Response must have role="assistant", got: ${data.role}`);
      assert(typeof data.content === 'string' && data.content.length > 0, 'Response must have non-empty content');
      assert(data.content.trim() === data.content, 'Content should not have leading/trailing whitespace');

      // Validate citations if present
      if (data.citations) {
        assert(Array.isArray(data.citations), 'Citations must be an array');
        data.citations.forEach((citation, index) => {
          assert(citation.id, `Citation ${index} must have id`);
          assert(citation.text, `Citation ${index} must have text`);
        });
      }

      // Validate metrics if present
      if (data.metrics) {
        assert(typeof data.metrics === 'object', 'Metrics must be an object');
        assert(data.metrics.mode === mode, `Metrics mode should match request mode: ${data.metrics.mode} !== ${mode}`);
      }

      // Mode-specific validations
      if (mode === 'sales-coach') {
        assert(data.content.includes('Challenge:'), 'Sales coach must have Challenge section');
        assert(data.content.includes('Rep Approach:'), 'Sales coach must have Rep Approach section');
        assert(data.content.includes('Impact:'), 'Sales coach must have Impact section');
        assert(data.content.includes('Suggested Phrasing:'), 'Sales coach must have Suggested Phrasing');
      } else if (mode === 'role-play') {
        assert(!data.content.includes('<coach>'), 'Role-play must not have <coach> blocks');
        assert(!data.content.includes('Challenge:'), 'Role-play must not have sales coach sections');
      } else if (mode === 'product-knowledge') {
        assert(data.content.includes('[HIV-'), 'Product knowledge should have citations');
      } else if (mode === 'emotional-assessment') {
        assert(data.content.includes('?'), 'Emotional assessment should end with questions');
      }

      console.log(`✅ CONTRACT VALIDATION PASSED`);
      console.log(`   ✓ role: "assistant"`);
      console.log(`   ✓ content: ${data.content.length} characters`);
      console.log(`   ✓ citations: ${data.citations ? data.citations.length : 0} items`);
      console.log(`   ✓ metrics: ${data.metrics ? 'present' : 'absent'}`);

      results.passedTests++;
      results.details.push({
        mode,
        status: 'PASSED',
        responseTime,
        contentLength: data.content.length,
        citationsCount: data.citations ? data.citations.length : 0,
        hasMetrics: !!data.metrics
      });

    } catch (error) {
      console.log(`❌ TEST FAILED: ${error.message}`);
      results.failedTests++;
      results.details.push({
        mode,
        status: 'FAILED',
        error: error.message
      });
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log('PHASE 9 STAGING WORKER VALIDATION RESULTS');
  console.log('='.repeat(70));
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Passed: ${results.passedTests}`);
  console.log(`Failed: ${results.failedTests}`);
  console.log(`Success Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%`);

  if (results.failedTests > 0) {
    console.log('\n❌ CRITICAL: STAGING WORKER HAS ISSUES');
    console.log('Failed tests:', results.details.filter(d => d.status === 'FAILED').map(d => d.mode));
    process.exit(1);
  } else {
    console.log('\n🎉 SUCCESS: ALL STAGING WORKER TESTS PASSED');
    console.log('✅ Worker contract compliance verified');
    console.log('✅ All modes functioning correctly');
    console.log('✅ Response format standardized');
    console.log('✅ Citations properly formatted');
    console.log('✅ Metrics included where expected');
  }

  // Save results
  fs.writeFileSync('staging_test_results.json', JSON.stringify({
    timestamp: new Date().toISOString(),
    workerUrl: STAGING_WORKER_URL,
    results
  }, null, 2));

  console.log('\n📄 Results saved to: staging_test_results.json');
}

testStagingWorker().catch(error => {
  console.error('💥 FATAL ERROR:', error);
  process.exit(1);
});
