#!/usr/bin/env node
/**
 * Test all 5 modes against Cloudflare Workers backend
 * This verifies that the backend mapping is correctly configured
 */

const WORKER_URL = 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev';
const MODES = [
  'sales-coach',
  'role-play',
  'emotional-assessment',
  'product-knowledge',
  'general-knowledge'
];

async function testMode(mode) {
  try {
    const response = await fetch(`${WORKER_URL}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mode: mode,
        messages: [
          { role: 'user', content: 'Hello, testing mode: ' + mode }
        ]
      })
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.log(`❌ ${mode}: HTTP ${response.status} - ${data.error || 'Unknown error'}`);
      return false;
    }
    
    if (data.error) {
      console.log(`❌ ${mode}: Error - ${data.error}`);
      return false;
    }
    
    console.log(`✅ ${mode}: OK (response length: ${data.reply?.length || 0} chars)`);
    return true;
  } catch (error) {
    console.log(`❌ ${mode}: Exception - ${error.message}`);
    return false;
  }
}

async function main() {
  console.log('Testing all 5 modes against Cloudflare Workers backend...');
  console.log(`Backend URL: ${WORKER_URL}\n`);
  
  const results = await Promise.all(MODES.map(testMode));
  
  const successCount = results.filter(r => r).length;
  const failCount = results.filter(r => !r).length;
  
  console.log(`\n=== Summary ===`);
  console.log(`✅ Passed: ${successCount}/${MODES.length}`);
  console.log(`❌ Failed: ${failCount}/${MODES.length}`);
  
  if (failCount > 0) {
    console.log('\n⚠️ Some modes failed. Check authentication or backend availability.');
    process.exit(1);
  } else {
    console.log('\n✓ All modes are properly wired to Cloudflare backend!');
    process.exit(0);
  }
}

main();
