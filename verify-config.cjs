#!/usr/bin/env node

/**
 * Configuration Verification Script
 * Verifies that the widget configuration is correctly pointing to Cloudflare Worker
 */

const fs = require('fs');
const path = require('path');

console.log('=== ReflectivAI Configuration Verification ===\n');

// Load configuration file
const configPath = path.join(__dirname, 'assets/chat/config.json');
let config;

try {
  const configContent = fs.readFileSync(configPath, 'utf8');
  config = JSON.parse(configContent);
  console.log('✓ Configuration file loaded successfully');
} catch (error) {
  console.error('✗ Failed to load configuration:', error.message);
  process.exit(1);
}

// Verify critical configuration settings
const checks = {
  'API Base URL': {
    value: config.apiBase,
    expected: 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev',
    check: (val, exp) => val === exp
  },
  'Worker URL Fallback': {
    value: config.workerUrlFallback,
    expected: 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev',
    check: (val, exp) => val === exp
  },
  'Analytics Endpoint': {
    value: config.analyticsEndpoint,
    expected: 'https://my-chat-agent-v2.tonyabdelmalak.workers.dev/coach-metrics',
    check: (val, exp) => val === exp
  },
  'Streaming Disabled': {
    value: config.stream,
    expected: false,
    check: (val, exp) => val === exp
  },
  'Modes Count': {
    value: config.modes?.length,
    expected: 5,
    check: (val, exp) => val === exp
  },
  'Has Sales Coach Mode': {
    value: config.modes?.includes('sales-coach'),
    expected: true,
    check: (val, exp) => val === exp
  },
  'Has Role Play Mode': {
    value: config.modes?.includes('role-play'),
    expected: true,
    check: (val, exp) => val === exp
  },
  'Has Emotional Assessment Mode': {
    value: config.modes?.includes('emotional-assessment'),
    expected: true,
    check: (val, exp) => val === exp
  },
  'Has Product Knowledge Mode': {
    value: config.modes?.includes('product-knowledge'),
    expected: true,
    check: (val, exp) => val === exp
  },
  'Has General Knowledge Mode': {
    value: config.modes?.includes('general-knowledge'),
    expected: true,
    check: (val, exp) => val === exp
  },
  'Default Mode': {
    value: config.defaultMode,
    expected: 'sales-coach',
    check: (val, exp) => val === exp
  }
};

let passed = 0;
let failed = 0;

console.log('\n--- Configuration Checks ---\n');

Object.entries(checks).forEach(([name, { value, expected, check }]) => {
  const status = check(value, expected) ? '✓' : '✗';
  const result = check(value, expected) ? 'PASS' : 'FAIL';
  
  if (result === 'PASS') {
    passed++;
    console.log(`${status} ${name}: ${value === expected ? value : `${value} (expected: ${expected})`}`);
  } else {
    failed++;
    console.log(`${status} ${name}: ${value} (expected: ${expected})`);
  }
});

console.log('\n--- Summary ---');
console.log(`Passed: ${passed}/${passed + failed}`);
console.log(`Failed: ${failed}/${passed + failed}`);

if (failed > 0) {
  console.log('\n⚠️  Some configuration checks failed!');
  process.exit(1);
} else {
  console.log('\n✓ All configuration checks passed!');
  console.log('\nThe widget is now configured to use Cloudflare Worker backend.');
  console.log('Backend URL: https://my-chat-agent-v2.tonyabdelmalak.workers.dev');
  process.exit(0);
}
