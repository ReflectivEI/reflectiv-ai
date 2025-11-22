// Minimal test harness for edge-case bullet/section parsing in Sales Coach formatter
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Load formatter from widget.js (simulate extraction for test)
const widgetPath = path.resolve(__dirname, '../widget.js');
const widgetSrc = fs.readFileSync(widgetPath, 'utf8');

// Extract parseSalesCoachBullets and extractLabeledSection for test
let parseSalesCoachBullets, extractLabeledSection;
eval(widgetSrc.match(/function parseSalesCoachBullets[\s\S]+?}\n}/)[0]);
eval(widgetSrc.match(/function extractLabeledSection[\s\S]+?}\n}/)[0]);

function testBullets(label, input, expectedCount) {
  const bullets = parseSalesCoachBullets(input);
  assert.strictEqual(bullets.length, expectedCount, `${label}: expected ${expectedCount}, got ${bullets.length}`);
}

function testSection(label, input, header, nextHeaders, expected) {
  const section = extractLabeledSection(input, header, nextHeaders);
  assert.strictEqual(!!section, expected, `${label}: expected section ${header} present=${expected}, got ${!!section}`);
}

console.log('Running Sales Coach bullet/section edge-case tests...');

// Normal case
const normal = `Challenge: X\nRep Approach:\n• Bullet 1\n• Bullet 2\n• Bullet 3\nImpact: Y\nSuggested Phrasing: Z`;
testBullets('Normal bullets', normal, 3);

testSection('Normal Challenge', normal, 'Challenge:', ['Rep Approach:', 'Impact:', 'Suggested Phrasing:'], true);
testSection('Normal Rep Approach', normal, 'Rep Approach:', ['Impact:', 'Suggested Phrasing:'], true);

testBullets('Inline bullets (•)', 'Rep Approach: • One • Two • Three', 3);
testBullets('Semicolon bullets', 'Rep Approach: One; Two; Three', 3);
testBullets('Mixed bullets', 'Rep Approach:\n- One\n• Two; Three', 3);

testSection('Header variation', 'challenge : foo\nrep approach : bar', 'Challenge:', ['Rep Approach:'], true);
testSection('Header variation', 'challenge - foo\nrep approach - bar', 'Challenge:', ['Rep Approach:'], true);
testSection('Header case', 'CHALLENGE: foo\nREP APPROACH: bar', 'Challenge:', ['Rep Approach:'], true);

testSection('Missing Impact', normal, 'Impact:', ['Suggested Phrasing:'], true);
testSection('Missing Phrasing', normal, 'Suggested Phrasing:', [], true);
testSection('Missing section', 'Challenge: X\nRep Approach: Y', 'Impact:', ['Suggested Phrasing:'], false);

console.log('All edge-case bullet/section tests passed!');
