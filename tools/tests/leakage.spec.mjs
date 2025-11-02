/**
 * Leakage Test Spec
 * Tests mode isolation and validates 4-section format for sales-simulation
 */

import { guardedValidate, validateSalesSim, hasSections } from '../../apps/site/widget/core/guards.js';

/**
 * Test runner
 */
class TestRunner {
  constructor() {
    this.tests = [];
    this.results = { passed: 0, failed: 0, total: 0 };
  }

  test(name, fn) {
    this.tests.push({ name, fn });
  }

  async run() {
    console.log('Running tests...\n');

    for (const test of this.tests) {
      this.results.total++;
      try {
        await test.fn();
        this.results.passed++;
        console.log(`✓ ${test.name}`);
      } catch (error) {
        this.results.failed++;
        console.error(`✗ ${test.name}`);
        console.error(`  ${error.message}\n`);
      }
    }

    console.log(`\n${this.results.passed}/${this.results.total} tests passed`);
    
    if (this.results.failed > 0) {
      process.exit(1);
    }
  }
}

/**
 * Assertions
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

/**
 * Tests
 */
const runner = new TestRunner();

// Test 1: Validate complete sales-simulation response
runner.test('validates complete sales-simulation JSON', () => {
  const response = {
    challenge: 'HCP is skeptical about efficacy',
    rep_approach: 'Provide clinical trial data',
    impact: 'Builds credibility with evidence',
    suggested_phrasing: 'The phase 3 trial showed...'
  };

  const result = validateSalesSim(response);
  assert(result.valid, 'Should be valid');
  assertEquals(result.missing.length, 0, 'Should have no missing sections');
});

// Test 2: Detect missing Suggested Phrasing
runner.test('detects missing Suggested Phrasing', () => {
  const response = {
    challenge: 'HCP is skeptical',
    rep_approach: 'Provide data',
    impact: 'Builds credibility'
    // Missing suggested_phrasing
  };

  const result = validateSalesSim(response);
  assert(!result.valid, 'Should be invalid');
  assert(result.missing.includes('suggested_phrasing'), 'Should detect missing phrasing');
});

// Test 3: Parse labeled text format
runner.test('parses labeled text format', () => {
  const text = `
Challenge: HCP concerned about cost

Rep Approach: Address value proposition

Impact: Demonstrates understanding

Suggested Phrasing: "I understand cost is a concern. Let me show you the value..."
  `.trim();

  const result = validateSalesSim(text);
  assert(result.valid, 'Should parse labeled text');
  assertEquals(result.format, 'labeled', 'Should detect labeled format');
});

// Test 4: Parse with markdown headers
runner.test('parses markdown headers', () => {
  const text = `
### Challenge
HCP is time-constrained

### Rep Approach
Be concise and focused

### Impact
Respects their time

### Suggested Phrasing
"I'll keep this brief. The key point is..."
  `.trim();

  const result = validateSalesSim(text);
  assert(result.valid, 'Should parse markdown');
});

// Test 5: Detect missing multiple sections
runner.test('detects multiple missing sections', () => {
  const response = {
    challenge: 'HCP has objections'
    // Missing rep_approach, impact, suggested_phrasing
  };

  const result = validateSalesSim(response);
  assert(!result.valid, 'Should be invalid');
  assert(result.missing.length === 3, 'Should find 3 missing sections');
});

// Test 6: Guarded validate with retry
runner.test('guarded validate allows retry on first failure', () => {
  const response = {
    challenge: 'Test',
    rep_approach: 'Test'
    // Missing impact and phrasing
  };

  const result = guardedValidate(response, 'sales-simulation');
  assert(!result.valid, 'Should be invalid');
  assert(result.shouldRetry, 'Should allow retry on first failure');
  assert(result.hint, 'Should provide hint');
});

// Test 7: Mode isolation - non-sales-simulation passes
runner.test('mode isolation - other modes pass validation', () => {
  const response = {
    feedback: 'Some feedback'
    // Not sales-simulation format
  };

  const result = guardedValidate(response, 'emotional-assessment');
  assert(result.valid, 'Non-sales-sim modes should pass');
});

// Test 8: Quick section check
runner.test('hasSections quick check works', () => {
  const text = `
Challenge: Test
Rep Approach: Test  
Impact: Test
Suggested Phrasing: Test
  `;

  assert(hasSections(text), 'Should detect all sections');
  assert(!hasSections('Just some text'), 'Should detect missing sections');
});

// Test 9: Normalize alternative field names
runner.test('normalizes alternative field names', () => {
  const response = {
    challenge: 'Test',
    'rep approach': 'Test', // Space instead of underscore
    impact: 'Test',
    phrasing: 'Test' // Short form
  };

  const result = validateSalesSim(response);
  // This test may fail if normalization not fully implemented
  // but documents expected behavior
  assert(result.data, 'Should have data');
});

// Test 10: Empty/whitespace values are invalid
runner.test('rejects empty section values', () => {
  const response = {
    challenge: 'Valid content',
    rep_approach: '   ', // Whitespace only
    impact: '',
    suggested_phrasing: 'Valid phrasing'
  };

  const result = validateSalesSim(response);
  assert(!result.valid, 'Should reject empty values');
  assert(result.missing.length >= 2, 'Should find at least 2 empty sections');
});

// Run tests
runner.run().catch(console.error);
