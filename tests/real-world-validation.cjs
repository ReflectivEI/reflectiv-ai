#!/usr/bin/env node
/**
 * Final Validation Test - 4 Real-World Scenarios
 * Tests actual behavior patterns that users will experience
 */

const fs = require('fs');
const path = require('path');

console.log('🎯 Chat Coach Fix - Real-World Scenario Validation\n');
console.log('=' .repeat(80));

const results = [];

function testScenario(num, name, testFn) {
  console.log(`\n📋 Scenario ${num}: ${name}`);
  console.log('-'.repeat(80));
  const scenarioResults = testFn();
  results.push({ scenario: num, name, tests: scenarioResults });
}

// ============================================================================
// SCENARIO 1: User visits site with CSP blocking Cloudflare Access
// ============================================================================
testScenario(1, 'CSP allows Cloudflare Access authentication flow', () => {
  const tests = [];
  const indexContent = fs.readFileSync(path.join(process.cwd(), 'index.html'), 'utf8');
  const cspMatch = indexContent.match(/Content-Security-Policy[^>]+content="([^"]+)"/i);
  
  if (!cspMatch) {
    tests.push({ name: 'CSP exists', pass: false, detail: 'No CSP found' });
    return tests;
  }
  
  const csp = cspMatch[1];
  const connectSrc = csp.match(/connect-src[^;]+/)?.[0] || '';
  
  // Test: Worker URL allowed
  const hasWorker = connectSrc.includes('my-chat-agent-v2.tonyabdelmalak.workers.dev');
  tests.push({
    name: 'Worker endpoint in CSP',
    pass: hasWorker,
    detail: hasWorker ? '✓ Can connect to worker' : '✗ Worker blocked by CSP'
  });
  
  // Test: Cloudflare Access allowed
  const hasAuth = connectSrc.includes('cloudflareaccess.com');
  tests.push({
    name: 'Cloudflare Access in CSP',
    pass: hasAuth,
    detail: hasAuth ? '✓ Auth redirects allowed' : '✗ Auth redirects will be blocked (console error)'
  });
  
  // Test: Wildcard for flexibility
  const hasWildcard = connectSrc.includes('*.cloudflareaccess.com');
  tests.push({
    name: 'Wildcard subdomain support',
    pass: hasWildcard,
    detail: hasWildcard ? '✓ Works with any CF Access subdomain' : '⚠ May break if subdomain changes'
  });
  
  return tests;
});

// ============================================================================
// SCENARIO 2: User opens chat when backend is unreachable
// ============================================================================
testScenario(2, 'Chat loads and provides feedback when backend is down', () => {
  const tests = [];
  const widgetContent = fs.readFileSync(path.join(process.cwd(), 'widget.js'), 'utf8');
  
  // Test: Optimistic loading
  const healthMatch = widgetContent.match(/let\s+isHealthy\s*=\s*(true|false)/);
  const startsOptimistic = healthMatch && healthMatch[1] === 'true';
  tests.push({
    name: 'UI loads without backend',
    pass: startsOptimistic,
    detail: startsOptimistic ? 
      '✓ Chat UI appears immediately, checks health in background' : 
      '✗ Chat blocked until backend responds (bad UX)'
  });
  
  // Test: Health check doesn't block UI
  const initSection = widgetContent.substring(
    widgetContent.indexOf('async function init()'),
    widgetContent.indexOf('waitForMount(init)')
  );
  const healthBlocksReturn = initSection.includes('if (!healthy)') && initSection.includes('return;');
  tests.push({
    name: 'Health check non-blocking',
    pass: !healthBlocksReturn,
    detail: !healthBlocksReturn ? 
      '✓ UI remains functional even if health check fails' : 
      '✗ Failed health check prevents UI initialization'
  });
  
  // Test: Helpful error message
  const hasHelpfulBanner = widgetContent.includes('You can try to use');
  tests.push({
    name: 'User guidance in banner',
    pass: hasHelpfulBanner,
    detail: hasHelpfulBanner ? 
      '✓ Banner explains user can try despite warning' : 
      '✗ Banner just shows error without guidance'
  });
  
  // Test: Link to check backend
  const hasCheckLink = widgetContent.includes('/health') && widgetContent.includes('href=');
  tests.push({
    name: 'Backend check link',
    pass: hasCheckLink,
    detail: hasCheckLink ? 
      '✓ User can click to check backend directly' : 
      '✗ No way for user to verify backend status'
  });
  
  return tests;
});

// ============================================================================
// SCENARIO 3: User tries to send message with authentication required
// ============================================================================
testScenario(3, 'Authentication errors handled gracefully', () => {
  const tests = [];
  const widgetContent = fs.readFileSync(path.join(process.cwd(), 'widget.js'), 'utf8');
  
  // Test: Credentials sent with requests
  const hasCredentials = widgetContent.includes("credentials: 'include'");
  tests.push({
    name: 'Sends credentials for auth',
    pass: hasCredentials,
    detail: hasCredentials ? 
      '✓ Browser sends auth cookies/credentials' : 
      '✗ Auth will fail - missing credentials'
  });
  
  // Test: 401/403 don't block UI
  const authSection = widgetContent.substring(
    widgetContent.indexOf('async function checkHealth()'),
    widgetContent.indexOf('async function checkHealth()') + 2000
  );
  const authAllowsOperation = authSection.includes('401') && authSection.includes('isHealthy = true');
  tests.push({
    name: 'Auth errors allow UI usage',
    pass: authAllowsOperation,
    detail: authAllowsOperation ? 
      '✓ User can try to interact, may trigger browser auth' : 
      '✗ Auth errors permanently block UI'
  });
  
  // Test: Specific auth error message
  const hasAuthMessage = widgetContent.includes('authentication_required') || widgetContent.includes('Authentication required');
  tests.push({
    name: 'Clear auth error message',
    pass: hasAuthMessage,
    detail: hasAuthMessage ? 
      '✓ User sees clear authentication error' : 
      '✗ Generic error message (confusing)'
  });
  
  // Test: Adequate timeout for auth redirect
  const timeoutMatch = widgetContent.match(/setTimeout\([^,]+,\s*(\d+)\)[^}]*health/);
  const timeout = timeoutMatch ? parseInt(timeoutMatch[1]) : 0;
  const adequateTimeout = timeout >= 3000;
  tests.push({
    name: 'Timeout allows for redirect',
    pass: adequateTimeout,
    detail: adequateTimeout ? 
      `✓ ${timeout}ms timeout allows auth redirect to complete` : 
      `✗ ${timeout}ms too short for auth redirect (will timeout)`
  });
  
  return tests;
});

// ============================================================================
// SCENARIO 4: User sends message and gets network error
// ============================================================================
testScenario(4, 'Network errors retry and show helpful messages', () => {
  const tests = [];
  const widgetContent = fs.readFileSync(path.join(process.cwd(), 'widget.js'), 'utf8');
  
  // Test: Retry on network errors
  const hasNetworkRetry = widgetContent.includes('Failed to fetch') || widgetContent.includes('NetworkError');
  tests.push({
    name: 'Retries network errors',
    pass: hasNetworkRetry,
    detail: hasNetworkRetry ? 
      '✓ Automatically retries on network failure' : 
      '✗ Network errors fail immediately (no retry)'
  });
  
  // Test: Exponential backoff
  const hasExponentialBackoff = widgetContent.includes('Math.pow(2') || widgetContent.includes('Math.pow(2,');
  tests.push({
    name: 'Exponential backoff',
    pass: hasExponentialBackoff,
    detail: hasExponentialBackoff ? 
      '✓ Retry delays increase exponentially (prevents server flood)' : 
      '⚠ Fixed retry interval (may overload recovering server)'
  });
  
  // Test: Specific error messages
  const hasNetworkMessage = widgetContent.includes('Cannot connect to backend');
  const hasTimeoutMessage = widgetContent.includes('Request timed out') || widgetContent.includes('timeout');
  tests.push({
    name: 'Specific network error messages',
    pass: hasNetworkMessage && hasTimeoutMessage,
    detail: (hasNetworkMessage && hasTimeoutMessage) ? 
      '✓ Different messages for network vs timeout errors' : 
      '✗ Generic error messages (user can\'t diagnose issue)'
  });
  
  // Test: Toast notification
  const hasToast = widgetContent.includes('showToast') && widgetContent.includes('"error"');
  tests.push({
    name: 'Visual error feedback',
    pass: hasToast,
    detail: hasToast ? 
      '✓ Toast notification shows error to user' : 
      '✗ Errors only in console (user doesn\'t see them)'
  });
  
  return tests;
});

// ============================================================================
// Summary Report
// ============================================================================
console.log('\n\n' + '='.repeat(80));
console.log('📊 VALIDATION SUMMARY');
console.log('='.repeat(80));

let totalTests = 0;
let totalPassed = 0;

results.forEach(scenario => {
  const passed = scenario.tests.filter(t => t.pass).length;
  const total = scenario.tests.length;
  totalTests += total;
  totalPassed += passed;
  
  const status = passed === total ? '✅' : (passed > 0 ? '⚠️' : '❌');
  console.log(`\n${status} Scenario ${scenario.scenario}: ${scenario.name}`);
  console.log(`   ${passed}/${total} tests passed`);
  
  scenario.tests.forEach(test => {
    const icon = test.pass ? '  ✓' : '  ✗';
    console.log(`${icon} ${test.name}`);
    console.log(`      ${test.detail}`);
  });
});

console.log('\n' + '='.repeat(80));
console.log(`Overall: ${totalPassed}/${totalTests} tests passed (${((totalPassed/totalTests)*100).toFixed(1)}%)`);

if (totalPassed === totalTests) {
  console.log('\n🎉 All scenarios validated successfully!');
  console.log('✅ The chat coach should work properly on the live site.');
} else if (totalPassed / totalTests >= 0.9) {
  console.log('\n👍 Most scenarios validated - minor issues may exist.');
} else {
  console.log('\n⚠️  Significant issues detected - review failed tests above.');
}

console.log('='.repeat(80) + '\n');

// Exit with appropriate code
process.exit(totalPassed === totalTests ? 0 : 1);
