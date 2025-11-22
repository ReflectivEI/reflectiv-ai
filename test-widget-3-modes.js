#!/usr/bin/env node

/**
 * Test Widget Functionality in 3 Modes
 * Tests that the chat API properly calls the Cloudflare Worker
 * and receives responses in sales-coach, role-play, and product-knowledge modes
 */

import https from 'https';

const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev';
const MODES_TO_TEST = [
  {
    mode: 'sales-coach',
    message: 'How should I approach an HCP about PrEP for HIV prevention?',
    expectCoach: true
  },
  {
    mode: 'role-play',
    message: 'I am concerned about the side effects of PrEP for my patients.',
    expectCoach: false
  },
  {
    mode: 'product-knowledge',
    message: 'What is the indication for Descovy for PrEP?',
    expectCoach: false
  }
];

let passed = 0;
let failed = 0;

function makeRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const url = new URL(WORKER_URL + path);
    
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        'Origin': 'https://reflectivei.github.io'
      },
      timeout: 15000
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: parsed 
          });
        } catch (e) {
          resolve({ 
            status: res.statusCode, 
            headers: res.headers,
            data: responseData,
            parseError: e.message 
          });
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.write(data);
    req.end();
  });
}

async function testMode(modeConfig) {
  console.log('\n' + '='.repeat(70));
  console.log(`Testing Mode: ${modeConfig.mode.toUpperCase()}`);
  console.log('='.repeat(70));
  
  const payload = {
    mode: modeConfig.mode,
    messages: [
      { role: 'user', content: modeConfig.message }
    ],
    threadId: `test-${Date.now()}`
  };
  
  console.log(`\n📤 Request:`);
  console.log(`   Mode: ${payload.mode}`);
  console.log(`   Message: "${modeConfig.message}"`);
  
  try {
    const response = await makeRequest('/chat', payload);
    
    console.log(`\n📥 Response:`);
    console.log(`   Status: ${response.status}`);
    
    if (response.status !== 200) {
      console.log(`   ❌ FAILED - Expected 200, got ${response.status}`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      failed++;
      return false;
    }
    
    // Check response structure
    if (!response.data) {
      console.log(`   ❌ FAILED - No data in response`);
      failed++;
      return false;
    }
    
    if (!response.data.reply) {
      console.log(`   ❌ FAILED - No 'reply' field in response`);
      console.log(`   Response:`, JSON.stringify(response.data, null, 2));
      failed++;
      return false;
    }
    
    console.log(`   ✅ Reply received: "${response.data.reply.substring(0, 100)}${response.data.reply.length > 100 ? '...' : ''}"`);
    
    // Check for coach data in sales-coach mode
    if (modeConfig.expectCoach) {
      if (response.data.coach) {
        console.log(`   ✅ Coach data present (as expected for ${modeConfig.mode})`);
        console.log(`      Overall score: ${response.data.coach.overall || 'N/A'}`);
      } else {
        console.log(`   ⚠️  No coach data (expected for ${modeConfig.mode})`);
      }
    }
    
    // Check for plan
    if (response.data.plan) {
      console.log(`   ✅ Plan ID: ${response.data.plan.id || 'N/A'}`);
    }
    
    console.log(`\n   ✅ SUCCESS - Mode '${modeConfig.mode}' working correctly`);
    passed++;
    return true;
    
  } catch (error) {
    console.log(`\n   ❌ FAILED - Error: ${error.message}`);
    if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
      console.log(`   ℹ️  Worker appears to be not deployed or not accessible`);
    }
    failed++;
    return false;
  }
}

async function testHealth() {
  console.log('\n' + '='.repeat(70));
  console.log('Testing Worker Health Endpoint');
  console.log('='.repeat(70));
  
  try {
    const url = new URL(WORKER_URL + '/health');
    const options = {
      hostname: url.hostname,
      path: url.pathname,
      method: 'GET',
      timeout: 5000
    };
    
    const response = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve({ status: res.statusCode, data }));
      });
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Timeout'));
      });
      req.end();
    });
    
    console.log(`   Status: ${response.status}`);
    console.log(`   Response: ${response.data}`);
    
    if (response.status === 200) {
      console.log(`   ✅ Worker is healthy and accessible`);
      return true;
    } else {
      console.log(`   ⚠️  Worker returned status ${response.status}`);
      return false;
    }
  } catch (error) {
    console.log(`   ❌ Worker is not accessible: ${error.message}`);
    if (error.code === 'ENOTFOUND') {
      console.log(`   ℹ️  DNS resolution failed - worker may not be deployed`);
    }
    return false;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════════════╗');
  console.log('║  Widget Functionality Test - 3 Modes                               ║');
  console.log('║  Testing Cloudflare Worker Integration                            ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');
  console.log(`\nWorker URL: ${WORKER_URL}`);
  console.log(`Test Time: ${new Date().toISOString()}`);
  
  // First check health
  const isHealthy = await testHealth();
  
  if (!isHealthy) {
    console.log('\n⚠️  WARNING: Worker health check failed. Tests may fail.');
    console.log('ℹ️  The worker may need to be deployed first.');
    console.log('ℹ️  Run: npx wrangler deploy');
  }
  
  // Test each mode
  for (const modeConfig of MODES_TO_TEST) {
    await testMode(modeConfig);
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Summary
  console.log('\n' + '='.repeat(70));
  console.log('TEST SUMMARY');
  console.log('='.repeat(70));
  console.log(`Total tests: ${passed + failed}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  
  if (failed === 0 && passed > 0) {
    console.log('\n🎉 All tests passed! Worker is responding correctly in all modes.');
  } else if (passed === 0) {
    console.log('\n⚠️  All tests failed. The worker may not be deployed.');
    console.log('   Please deploy the worker using:');
    console.log('   • npx wrangler deploy');
    console.log('   • Or merge PR to trigger GitHub Actions deployment');
  } else {
    console.log('\n⚠️  Some tests failed. Check logs above for details.');
  }
  
  process.exit(failed > 0 ? 1 : 0);
}

main().catch(error => {
  console.error('\n💥 Unexpected error:', error);
  process.exit(1);
});
