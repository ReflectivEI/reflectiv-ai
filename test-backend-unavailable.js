/**
 * Test for Backend Unavailable Banner and SEND Button Fix
 * 
 * This test verifies that the SEND button remains disabled when the backend
 * is unavailable, even after a failed send attempt.
 */

import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test results
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`✓ ${name}`);
    passed++;
  } catch (error) {
    console.log(`✗ ${name}`);
    console.log(`  Error: ${error.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

async function main() {
  console.log('\n=== Testing Backend Unavailable Fix ===\n');

  // Read the widget.js file
  const widgetPath = join(__dirname, 'widget.js');
  const widgetContent = await readFile(widgetPath, 'utf-8');

  // Test 1: Verify the fix is present in widget.js
  test('widget.js contains health check before re-enabling button', () => {
    const hasHealthCheck = widgetContent.includes('sendBtn2.disabled = !isHealthy');
    assert(hasHealthCheck, 'widget.js should have the health check fix');
  });

  // Test 2: Verify the old code is not present
  test('widget.js does not unconditionally enable button', () => {
    // Look for the pattern in the finally block context
    const finallyBlockPattern = /finally\s*{[\s\S]*?sendBtn2\.disabled\s*=\s*false/;
    const hasOldCode = finallyBlockPattern.test(widgetContent);
    assert(!hasOldCode, 'widget.js should not have unconditional button enable');
  });

  // Test 3: Verify comment is added
  test('widget.js has explanatory comment', () => {
    const hasComment = widgetContent.includes('Only re-enable send button if backend is healthy');
    assert(hasComment, 'widget.js should have explanatory comment');
  });

  // Test 4: Verify checkHealth function exists and sets isHealthy
  test('checkHealth function exists and manages isHealthy flag', () => {
    const hasCheckHealth = widgetContent.includes('async function checkHealth()');
    assert(hasCheckHealth, 'checkHealth function should exist');
    
    const setsHealthyTrue = widgetContent.includes('isHealthy = true');
    assert(setsHealthyTrue, 'checkHealth should set isHealthy to true on success');
    
    const setsHealthyFalse = widgetContent.includes('isHealthy = false');
    assert(setsHealthyFalse, 'checkHealth should set isHealthy to false on failure');
  });

  // Test 5: Verify health gate exists in sendMessage
  test('sendMessage has health gate to block sends when unhealthy', () => {
    const hasHealthGate = widgetContent.includes('if (!isHealthy)') &&
                          widgetContent.includes('Backend unavailable. Please wait...');
    assert(hasHealthGate, 'sendMessage should have health gate');
  });

  // Test 6: Verify enableSendButton and disableSendButton functions exist
  test('enableSendButton and disableSendButton functions exist', () => {
    const hasEnable = widgetContent.includes('function enableSendButton()');
    const hasDisable = widgetContent.includes('function disableSendButton()');
    assert(hasEnable && hasDisable, 'Both enable and disable functions should exist');
  });

  // Test 7: Verify health check calls enableSendButton on success
  test('checkHealth calls enableSendButton when backend is healthy', () => {
    const pattern = /if\s*\(\s*response\.ok\s*\)\s*{[\s\S]*?enableSendButton\(\)/;
    const callsEnable = pattern.test(widgetContent);
    assert(callsEnable, 'checkHealth should call enableSendButton on success');
  });

  // Test 8: Verify health check calls disableSendButton on failure
  test('checkHealth calls disableSendButton when backend is unhealthy', () => {
    const callsDisable = widgetContent.includes('disableSendButton()') &&
                         widgetContent.includes('showHealthBanner()');
    assert(callsDisable, 'checkHealth should call disableSendButton on failure');
  });

  // Read widget-nov11-complete.js for consistency check
  const widgetNov11Path = join(__dirname, 'widget-nov11-complete.js');
  const widgetNov11Content = await readFile(widgetNov11Path, 'utf-8');

  // Test 9: Verify the fix is also in widget-nov11-complete.js
  test('widget-nov11-complete.js contains health check before re-enabling button', () => {
    const hasHealthCheck = widgetNov11Content.includes('sendBtn2.disabled = !isHealthy');
    assert(hasHealthCheck, 'widget-nov11-complete.js should have the health check fix');
  });

  // Test 10: Verify widget-nov11-complete.js has the comment
  test('widget-nov11-complete.js has explanatory comment', () => {
    const hasComment = widgetNov11Content.includes('Only re-enable send button if backend is healthy');
    assert(hasComment, 'widget-nov11-complete.js should have explanatory comment');
  });

  // Summary
  console.log('\n=== Test Results ===');
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed}`);
  console.log(`Total:  ${passed + failed}`);

  if (failed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch(error => {
  console.error('Test execution failed:', error);
  process.exit(1);
});
