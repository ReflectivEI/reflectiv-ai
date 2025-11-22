// parserModule.test.cjs - Direct unit tests for parser utilities
const assert = require('assert');
const {
  parseSalesCoachBullets,
  extractLabeledSection,
  escapeRegExp,
  normalizeGuidanceLabels,
  convertCitations,
  esc
} = require('../assets/chat/core/parsers/index.cjs');

// Mock citationsDb for testing

console.log('Running Parser Module Unit Tests...');

// escapeRegExp
assert.strictEqual(escapeRegExp('a.b+c'), 'a\\.b\\+c', 'escapeRegExp works');

// normalizeGuidanceLabels
assert.strictEqual(normalizeGuidanceLabels('My Approach: do this'), 'Rep Approach: do this', 'normalizeGuidanceLabels converts');
assert.strictEqual(normalizeGuidanceLabels('Normal text'), 'Normal text', 'normalizeGuidanceLabels no-op');

// extractLabeledSection
assert.strictEqual(extractLabeledSection('Challenge: test\nNext:', 'Challenge:', ['Next:']), 'test', 'extractLabeledSection basic');
assert.strictEqual(extractLabeledSection('challenge : test\nnext:', 'Challenge:', ['Next:']), 'test', 'extractLabeledSection relaxed');
assert.strictEqual(extractLabeledSection('challenge- test\nnext:', 'Challenge:', ['Next:']), 'test', 'extractLabeledSection dash');
assert.strictEqual(extractLabeledSection('CHALLENGE: test\nnext:', 'Challenge:', ['Next:']), 'test', 'extractLabeledSection case');

// parseSalesCoachBullets
assert.deepStrictEqual(parseSalesCoachBullets('• One\n• Two\n• Three'), ['One', 'Two', 'Three'], 'parseSalesCoachBullets multi-line');
assert.deepStrictEqual(parseSalesCoachBullets('Rep Approach: One; Two; Three'), ['One', 'Two', 'Three'], 'parseSalesCoachBullets semicolon');
assert.deepStrictEqual(parseSalesCoachBullets('Rep Approach: • One • Two • Three'), ['One', 'Two', 'Three'], 'parseSalesCoachBullets inline');

// convertCitations
const testCitationsDb = {
  'HIV-TREAT-001': {
    url: 'https://example.com',
    apa: 'FDA, 2023',
    source: 'FDA',
    year: '2023'
  }
};
assert(convertCitations('[HIV-TREAT-001]', testCitationsDb).includes('href="https://example.com"'), 'convertCitations known code');
assert.strictEqual(convertCitations('[123]', testCitationsDb), '[123]', 'convertCitations non-matching code unchanged');

// esc
assert.strictEqual(esc('<script>'), '&lt;script&gt;', 'esc HTML');

console.log('All parser module unit tests passed!');
