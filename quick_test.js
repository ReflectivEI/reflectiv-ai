#!/usr/bin/env node

/**
 * Direct test execution wrapper to capture output
 */

import https from 'https';

const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/chat';

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

// Quick test of Sales-Coach mode
async function quickTest() {
  console.log('PHASE 3 QUICK TEST');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('Test 1: Sales-Coach Mode');
    console.log('-'.repeat(60));
    
    const scPayload = {
      mode: 'sales-coach',
      persona: 'onc_hemonc_md_costtox',
      disease: 'onc_md_decile10_io_adc_pathways',
      messages: [{ role: 'user', content: 'We\'re seeing ADC toxicity concerns. How do we position this benefit?' }],
      session: `test-sc-${Date.now()}`
    };

    console.log('Sending request to worker...');
    const scResponse = await makeRequest(scPayload);
    
    if (scResponse.status === 200 && scResponse.data && scResponse.data.reply) {
      const reply = scResponse.data.reply;
      console.log(`✅ Response received (${reply.length} chars)`);
      console.log(`\nFirst 400 chars:\n${reply.substring(0, 400)}\n`);
      
      // Check for <coach> block
      if (/<coach>/.test(reply)) {
        console.log('❌ FAIL: <coach> block detected');
      } else {
        console.log('✅ PASS: No <coach> block');
      }
      
      // Check for sections
      const hasSections = /Challenge:|Positioning:|Key Talking Points:|Final Thought:/i.test(reply);
      if (hasSections) {
        console.log('✅ PASS: Has expected sections');
      } else {
        console.log('❌ FAIL: Missing expected sections');
      }
    } else {
      console.log(`❌ Error: HTTP ${scResponse.status}`);
      console.log(`Details: ${JSON.stringify(scResponse)}`);
    }

    await sleep(3000);

    console.log('\n' + '='.repeat(60));
    console.log('Test 2: Emotional-Assessment Mode');
    console.log('-'.repeat(60));
    
    const eiPayload = {
      mode: 'emotional-assessment',
      persona: 'hiv_id_md_guideline_strict',
      disease: 'hiv_np_decile10_highshare_access',
      messages: [{ role: 'user', content: 'That conversation felt challenging. I got defensive when they questioned my approach.' }],
      session: `test-ei-${Date.now()}`
    };

    console.log('Sending request to worker...');
    const eiResponse = await makeRequest(eiPayload);
    
    if (eiResponse.status === 200 && eiResponse.data && eiResponse.data.reply) {
      const reply = eiResponse.data.reply;
      console.log(`✅ Response received (${reply.length} chars)`);
      console.log(`\nFirst 400 chars:\n${reply.substring(0, 400)}\n`);
      
      // Check for final ?
      const endsWithQ = /\?\s*$/.test(reply.trim());
      if (endsWithQ) {
        console.log('✅ PASS: Ends with question mark');
      } else {
        console.log('❌ FAIL: Does not end with question mark');
        console.log(`Last 50 chars: "${reply.trim().slice(-50)}"`);
      }
      
      // Check for multiple questions
      const questionCount = (reply.match(/\?/g) || []).length;
      if (questionCount >= 2) {
        console.log(`✅ PASS: Has ${questionCount} questions`);
      } else {
        console.log(`❌ FAIL: Only ${questionCount} question(s)`);
      }
    } else {
      console.log(`❌ Error: HTTP ${eiResponse.status}`);
      console.log(`Details: ${JSON.stringify(eiResponse)}`);
    }

    await sleep(3000);

    console.log('\n' + '='.repeat(60));
    console.log('Test 3: Product-Knowledge Mode');
    console.log('-'.repeat(60));
    
    const pkPayload = {
      mode: 'product-knowledge',
      persona: 'onc_hemonc_md_costtox',
      disease: 'onc_md_decile10_io_adc_pathways',
      messages: [{ role: 'user', content: 'What\'s the mechanism of action?' }],
      session: `test-pk-${Date.now()}`
    };

    console.log('Sending request to worker...');
    const pkResponse = await makeRequest(pkPayload);
    
    if (pkResponse.status === 200 && pkResponse.data && pkResponse.data.reply) {
      const reply = pkResponse.data.reply;
      console.log(`✅ Response received (${reply.length} chars)`);
      console.log(`\nFirst 400 chars:\n${reply.substring(0, 400)}\n`);
      
      // Check for citations
      const hasCitations = /\[\d+\]/.test(reply);
      if (hasCitations) {
        console.log('✅ PASS: Has numbered citations [1], [2], etc.');
      } else {
        console.log('❌ FAIL: No numbered citations found');
      }
      
      // Check for References section
      const hasReferences = /References?:/i.test(reply);
      if (hasReferences) {
        console.log('✅ PASS: Has References section');
      } else {
        console.log('❌ FAIL: Missing References section');
      }
    } else {
      console.log(`❌ Error: HTTP ${pkResponse.status}`);
      console.log(`Details: ${JSON.stringify(pkResponse)}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('QUICK TEST COMPLETE');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('Test error:', error.message);
    process.exit(1);
  }
}

quickTest();
