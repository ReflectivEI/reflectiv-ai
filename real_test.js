#!/usr/bin/env node

/**
 * REAL PHASE 3 TEST EXECUTION
 * Tests actual deployed worker with real repository code
 * No mocks, no simulation - genuine HTTP requests and responses
 */

import https from 'https';

const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat';
let testsPassed = 0;
let testsFailed = 0;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function makeRequest(payload) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'my-chat-agent-v2.tonyabdelmalak.workers.dev',
      path: '/chat',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(JSON.stringify(payload))
      },
      timeout: 30000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: null, error: e.message });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(JSON.stringify(payload));
    req.end();
  });
}

async function runTest(testName, payload, validations) {
  console.log('\n' + '='.repeat(70));
  console.log(`TEST: ${testName}`);
  console.log('='.repeat(70));
  
  try {
    console.log(`📤 Sending request to ${payload.mode} mode...`);
    console.log(`   Message: "${payload.messages[0].content.substring(0, 50)}..."`);
    
    const response = await makeRequest(payload);
    
    if (response.status !== 200) {
      console.log(`❌ FAILED - HTTP ${response.status}`);
      if (response.error) console.log(`   Error: ${response.error}`);
      testsFailed++;
      return false;
    }
    
    if (!response.data || !response.data.reply) {
      console.log(`❌ FAILED - No reply in response`);
      testsFailed++;
      return false;
    }

    const reply = response.data.reply;
    console.log(`✅ Response received (${reply.length} characters)`);
    console.log(`\n--- Response Preview (first 300 chars) ---`);
    console.log(reply.substring(0, 300) + (reply.length > 300 ? '...' : ''));
    console.log(`--- End Preview ---\n`);

    // Run validations
    let allPassed = true;
    for (const validation of validations) {
      try {
        const result = validation.check(reply);
        if (result.passed) {
          console.log(`   ✅ ${validation.name}`);
        } else {
          console.log(`   ❌ ${validation.name}`);
          console.log(`      ${result.message}`);
          allPassed = false;
        }
      } catch (e) {
        console.log(`   ❌ ${validation.name} - Exception: ${e.message}`);
        allPassed = false;
      }
    }

    if (allPassed) {
      console.log(`\n✅ TEST PASSED`);
      testsPassed++;
      return true;
    } else {
      console.log(`\n❌ TEST FAILED`);
      testsFailed++;
      return false;
    }

  } catch (error) {
    console.log(`❌ EXCEPTION: ${error.message}`);
    testsFailed++;
    return false;
  }
}

async function main() {
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' PHASE 3 REAL TEST EXECUTION - ACTUAL DEPLOYED WORKER '.padEnd(69) + '║');
  console.log('║' + ' Testing: reflectiv-ai worker.js (all 5 modes)'.padEnd(69) + '║');
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('');
  console.log(`Worker: ${WORKER_URL}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log('');

  // TEST 1: SALES-COACH - Phase 3 Contract (4 sections; no <coach> in reply string)
  await runTest(
    'SALES-COACH: 4 sections present; no <coach> in reply',
    {
      mode: 'sales-coach',
      persona: 'onc_hemonc_md_costtox',
      disease: 'onc_md_decile10_io_adc_pathways',
      messages: [{ role: 'user', content: 'We\'re seeing toxicity concerns with ADC. How should we position the benefit-risk discussion?' }],
      session: `test-sc-${Date.now()}`
    },
    [
      {
        name: 'No <coach> blocks in reply string',
        check: (reply) => {
          const hasCoachBlock = /<coach>[\s\S]*?<\/coach>/.test(reply);
          return {
            passed: !hasCoachBlock,
            message: hasCoachBlock ? 'Found <coach> block in reply (should be extracted)' : 'Clean reply'
          };
        }
      },
      {
        name: 'Has required 4 sections (Challenge, Rep Approach, Impact, Suggested Phrasing)',
        check: (reply) => {
          const req = ['Challenge:', 'Rep Approach:', 'Impact:', 'Suggested Phrasing:'];
          const found = req.filter(h => reply.includes(h));
          return {
            passed: found.length === 4,
            message: found.length === 4 ? 'All sections present' : `Missing sections: ${req.filter(h => !found.includes(h)).join(', ')}`
          };
        }
      },
      {
        name: 'No internal structure markers',
        check: (reply) => {
          const hasMarkers = /\[internal:|<rep_approach>|__coach__/.test(reply);
          return {
            passed: !hasMarkers,
            message: hasMarkers ? 'Found internal markers' : 'Clean response'
          };
        }
      }
    ]
  );

  await sleep(3000);

  // TEST 2: EMOTIONAL-ASSESSMENT - Verify Fix #2 (Ends with ?)
  await runTest(
    'EMOTIONAL-ASSESSMENT: Ends with question mark (FIX #2)',
    {
      mode: 'emotional-assessment',
      persona: 'hiv_id_md_guideline_strict',
      disease: 'hiv_np_decile10_highshare_access',
      messages: [{ role: 'user', content: 'That conversation with the patient felt really challenging. I got defensive when they questioned my recommendations.' }],
      session: `test-ei-${Date.now()}`
    },
    [
      {
        name: 'Response ends with question mark (?)',
        check: (reply) => {
          const trimmed = reply.trim();
          const endsWithQ = /\?\s*$/.test(trimmed);
          return {
            passed: endsWithQ,
            message: endsWithQ ? 'Ends with ?' : `Ends with: "${trimmed.slice(-20)}"`
          };
        }
      },
      {
        name: 'Contains multiple reflective questions',
        check: (reply) => {
          const questionCount = (reply.match(/\?/g) || []).length;
          return {
            passed: questionCount >= 2,
            message: questionCount >= 2 ? `Found ${questionCount} questions` : `Only ${questionCount} question`
          };
        }
      },
      {
        name: 'Contains EI framework keywords',
        check: (reply) => {
          const keywords = /pattern|reflect|trigger|emotion|notice|awareness|response|reaction/i;
          const hasKeywords = keywords.test(reply);
          return {
            passed: hasKeywords,
            message: hasKeywords ? 'Contains EI keywords' : 'Missing framework keywords'
          };
        }
      }
    ]
  );

  await sleep(3000);

  // TEST 3: PRODUCT-KNOWLEDGE - Verify Fix #1 (Citations)
  await runTest(
    'PRODUCT-KNOWLEDGE: Has citations with [REF] codes (FIX #1)',
    {
      mode: 'product-knowledge',
      persona: 'onc_hemonc_md_costtox',
      disease: 'onc_md_decile10_io_adc_pathways',
      messages: [{ role: 'user', content: 'What\'s the mechanism of action for this ADC? How does it differ from traditional chemotherapy?' }],
      session: `test-pk-${Date.now()}`
    },
    [
      {
        name: 'Has numbered citations [1], [2], etc',
        check: (reply) => {
          const citations = reply.match(/\[\d+\]/g) || [];
          return {
            passed: citations.length >= 2,
            message: citations.length >= 2 ? `Found ${citations.length} citations` : 'No numbered citations'
          };
        }
      },
      {
        name: 'Has References section',
        check: (reply) => {
          const hasReferences = /References?:/i.test(reply);
          return {
            passed: hasReferences,
            message: hasReferences ? 'References section present' : 'Missing References section'
          };
        }
      },
      {
        name: 'Product knowledge content present',
        check: (reply) => {
          const hasContent = reply.length > 200 && /mechanism|action|therapy|study|data|efficacy/i.test(reply);
          return {
            passed: hasContent,
            message: hasContent ? 'Has PK content' : 'Insufficient PK content'
          };
        }
      }
    ]
  );

  await sleep(3000);

  // TEST 4: ROLE-PLAY - General validation
  await runTest(
    'ROLE-PLAY: HCP voice with no <coach> blocks',
    {
      mode: 'role-play',
      persona: 'primary_care_md',
      disease: 'hiv_np_decile10_highshare_access',
      messages: [{ role: 'user', content: 'I\'m not comfortable discussing PrEP with my patients. What should I say?' }],
      session: `test-rp-${Date.now()}`
    },
    [
      {
        name: 'First-person HCP voice (I, my, we)',
        check: (reply) => {
          const hasVoice = /\b(I|my|we|our)\b/i.test(reply);
          return {
            passed: hasVoice,
            message: hasVoice ? 'Has HCP voice' : 'No first-person language'
          };
        }
      },
      {
        name: 'No <coach> blocks',
        check: (reply) => {
          const hasCoachBlock = /<coach>/.test(reply);
          return {
            passed: !hasCoachBlock,
            message: !hasCoachBlock ? 'Clean' : 'Found <coach> block'
          };
        }
      },
      {
        name: 'Response is reasonable length',
        check: (reply) => {
          const isReasonable = reply.length > 100 && reply.length < 5000;
          return {
            passed: isReasonable,
            message: `${reply.length} characters`
          };
        }
      }
    ]
  );

  await sleep(3000);

  // TEST 5: GENERAL-KNOWLEDGE - Verify no mode leakage
  await runTest(
    'GENERAL-KNOWLEDGE: No mode structure leakage',
    {
      mode: 'general-knowledge',
      persona: 'patient',
      disease: 'hiv_np_decile10_highshare_access',
      messages: [{ role: 'user', content: 'Can you explain how HIV transmission works?' }],
      session: `test-gk-${Date.now()}`
    },
    [
      {
        name: 'No HCP-specific markers',
        check: (reply) => {
          const hasMarkers = /Challenge:|Rep Approach:|Positioning:|Key Talking Points:/i.test(reply);
          return {
            passed: !hasMarkers,
            message: !hasMarkers ? 'No HCP markers' : 'Found HCP structure'
          };
        }
      },
      {
        name: 'No <coach> blocks',
        check: (reply) => {
          const hasCoachBlock = /<coach>/.test(reply);
          return {
            passed: !hasCoachBlock,
            message: !hasCoachBlock ? 'Clean' : 'Found <coach> block'
          };
        }
      },
      {
        name: 'Natural language response',
        check: (reply) => {
          const isNatural = reply.length > 100 && /[a-z]/i.test(reply);
          return {
            passed: isNatural,
            message: isNatural ? 'Natural content' : 'Unusual format'
          };
        }
      }
    ]
  );

  // Print summary
  console.log('\n');
  console.log('╔' + '═'.repeat(68) + '╗');
  console.log('║' + ' TEST RESULTS SUMMARY '.padStart(35).padEnd(69) + '║');
  console.log('╠' + '═'.repeat(68) + '╣');
  console.log(`║ Tests Passed: ${String(testsPassed).padEnd(54)}║`);
  console.log(`║ Tests Failed: ${String(testsFailed).padEnd(54)}║`);
  const totalTests = testsPassed + testsFailed;
  const passRate = totalTests > 0 ? ((testsPassed / totalTests) * 100).toFixed(1) : 0;
  console.log(`║ Pass Rate: ${String(passRate + '%').padEnd(57)}║`);
  console.log('╠' + '═'.repeat(68) + '╣');
  
  if (testsFailed === 0 && testsPassed > 0) {
    console.log('║' + ' ✅ ALL TESTS PASSED - Phase 3 Hotfixes Working! '.padStart(35).padEnd(69) + '║');
  } else if (testsPassed > testsFailed) {
    console.log('║' + ' ✅ MAJORITY TESTS PASSED - Phase 3 Hotfixes Mostly Working '.padStart(35).padEnd(69) + '║');
  } else {
    console.log('║' + ' ❌ TESTS FAILED - Investigation Needed '.padStart(35).padEnd(69) + '║');
  }
  
  console.log('╚' + '═'.repeat(68) + '╝');
  console.log('');

  process.exit(testsFailed > 0 ? 1 : 0);
}

main().catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
