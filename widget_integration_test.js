#!/usr/bin/env node

/**
 * Widget Integration Test - Tests the actual widget.js hardcoded AI functionality
 * Extracts and tests the getHardcodedResponse function directly
 */

import { readFileSync } from 'fs';

// Extract the getHardcodedResponse function from widget.js
function extractFunction(code, functionName) {
  const regex = new RegExp(`function ${functionName}\\([^)]*\\) {([\\s\\S]*?)^}`);
  const match = code.match(regex);
  if (!match) return null;

  return `
function ${functionName}${match[1]}
}`;
}

// Load and extract the function
const widgetCode = readFileSync('./widget.js', 'utf8');
const functionCode = extractFunction(widgetCode, 'getHardcodedResponse');

if (!functionCode) {
  console.error('❌ Could not extract getHardcodedResponse function from widget.js');
  process.exit(1);
}

// Create a safe evaluation context
const context = {
  console,
  Math,
  Date,
  Array,
  Object,
  String,
  RegExp,
  JSON
};

// Evaluate the function
let getHardcodedResponse;
try {
  const func = new Function(...Object.keys(context), `return (${functionCode})`);
  getHardcodedResponse = func(...Object.values(context));
} catch (e) {
  console.error('❌ Failed to evaluate getHardcodedResponse function:', e.message);
  process.exit(1);
}

console.log('🧪 Widget Integration Test - Testing Hardcoded AI\n');

// Test cases
const testCases = [
  {
    mode: 'sales-coach',
    messages: [{ role: 'user', content: 'How do I talk to doctors about PrEP?' }],
    expected: 'Challenge:'
  },
  {
    mode: 'role-play',
    messages: [{ role: 'user', content: 'Do you recommend PrEP?' }],
    expected: 'I evaluate each patient'
  },
  {
    mode: 'emotional-assessment',
    messages: [{ role: 'user', content: 'I feel nervous discussing PrEP.' }],
    expected: 'It sounds like you'
  },
  {
    mode: 'product-knowledge',
    messages: [{ role: 'user', content: 'Tell me about Truvada.' }],
    expected: '[HIV-PREP-ELIG-001]'
  },
  {
    mode: 'general-knowledge',
    messages: [{ role: 'user', content: 'What is HIV?' }],
    expected: 'HIV transmission'
  }
];

let passed = 0;
let failed = 0;

for (let i = 0; i < testCases.length; i++) {
  const test = testCases[i];
  console.log(`Test ${i + 1}: ${test.mode} mode`);
  console.log(`Input: "${test.messages[0].content}"`);

  try {
    const result = getHardcodedResponse(test.mode, test.messages);
    const response = result.reply || result.content || '';

    console.log(`Output: "${response.substring(0, 100)}${response.length > 100 ? '...' : ''}"`);

    if (response.includes(test.expected)) {
      console.log('✅ PASS\n');
      passed++;
    } else {
      console.log(`❌ FAIL - Expected to contain: "${test.expected}"\n`);
      failed++;
    }
  } catch (e) {
    console.log(`❌ ERROR: ${e.message}\n`);
    failed++;
  }
}

console.log(`📊 Results: ${passed} passed, ${failed} failed`);

if (failed === 0) {
  console.log('🎉 All widget integration tests passed!');
  process.exit(0);
} else {
  console.log('❌ Some tests failed');
  process.exit(1);
}