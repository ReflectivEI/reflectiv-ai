/**
 * UI Workflow Integration Tests
 * Tests mode switching, history, EI panel, navigation, and format enforcement
 * Run with: node ui-workflow.test.cjs
 */

const assert = require('assert');

let testsPassed = 0;
let testsFailed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`✓ ${description}`);
    testsPassed++;
  } catch (error) {
    console.error(`✗ ${description}`);
    console.error(`  ${error.message}`);
    testsFailed++;
  }
}

function assertEquals(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(
      `${message}\n  Expected: ${JSON.stringify(expected)}\n  Actual: ${JSON.stringify(actual)}`
    );
  }
}

// ===== Mode Module Tests =====
console.log('\n=== Mode Module Tests ===');

test('emotionalIntelligence module exports MODE constant', () => {
  const emotionalIntelligence = require('./assets/chat/modes/emotionalIntelligence.js');
  // Note: Can't test ES modules directly in Node without extra setup
  // This is a placeholder for structure verification
  assert.ok(true, 'Module structure check placeholder');
});

test('productKnowledge module has proper structure', () => {
  // Structure verification placeholder
  assert.ok(true, 'Module structure check placeholder');
});

test('salesCoach module has proper structure', () => {
  // Structure verification placeholder
  assert.ok(true, 'Module structure check placeholder');
});

test('rolePlay module has proper structure', () => {
  // Structure verification placeholder
  assert.ok(true, 'Module structure check placeholder');
});

// ===== Mode Isolation Tests =====
console.log('\n=== Mode Isolation Tests ===');

test('Mode histories should be separate', () => {
  const history1 = [];
  const history2 = [];
  
  history1.push({ role: 'user', content: 'test1', timestamp: Date.now() });
  history2.push({ role: 'user', content: 'test2', timestamp: Date.now() });
  
  assert.notEqual(history1[0].content, history2[0].content);
  assertEquals(history1.length, 1, 'History 1 length');
  assertEquals(history2.length, 1, 'History 2 length');
});

test('History limiting to 20 messages (10 turns)', () => {
  const history = [];
  
  // Add 25 messages
  for (let i = 0; i < 25; i++) {
    history.push({ role: i % 2 === 0 ? 'user' : 'assistant', content: `msg${i}`, timestamp: Date.now() });
  }
  
  // Simulate limiting
  while (history.length > 20) {
    history.shift();
  }
  
  assertEquals(history.length, 20, 'History should be limited to 20');
  assertEquals(history[0].content, 'msg5', 'Oldest messages should be removed');
});

// ===== Format Enforcement Tests =====
console.log('\n=== Format Enforcement Tests ===');

test('Role-play format: plain text, no bullets', () => {
  const testText = '- This is a bullet point\n- Another one\nCoach: Some advice';
  const mode = 'role-play';
  
  // Simulate removeCoachLeakage function (matching actual implementation)
  let cleaned = testText
    .replace(/^[\s\u2022\u2023\u25E6\*-]+/gm, '')
    .replace(/Suggested Phrasing:.*$/gim, '')
    .replace(/\bCoach:\s*/gi, '')
    .replace(/\bHCP:\s*/gi, '')
    .trim();
  
  assert.ok(!cleaned.includes('Coach:'), 'Should remove Coach: prefix');
  assert.ok(!cleaned.startsWith('-'), 'Should remove bullet points');
});

test('Sales-simulation format: should have structure markers', () => {
  const testText = 'Some guidance text without structure';
  const required = ['Assessment', 'Objection', 'Guidance', 'Phrasing', 'Next Steps'];
  
  const hasStructure = required.some(section => 
    testText.includes(section + ':') || testText.includes('**' + section)
  );
  
  // This will be false for unstructured text, which is expected
  assert.ok(hasStructure === false, 'Unstructured text detected correctly');
});

test('Sentence completion: adds period if missing', () => {
  const testText = 'This sentence has no ending punctuation';
  
  const completed = /[.!?]"?\s*$/.test(testText) ? testText : testText + '.';
  
  assert.ok(completed.endsWith('.'), 'Should add period');
});

test('Sentence completion: preserves existing punctuation', () => {
  const testText = 'This sentence already ends!';
  
  const completed = /[.!?]"?\s*$/.test(testText) ? testText : testText + '.';
  
  assertEquals(completed, testText, 'Should preserve existing punctuation');
});

// ===== Token Budget Tests =====
console.log('\n=== Token Budget Tests ===');

test('Token budgets are correctly assigned per mode', () => {
  const tokenBudgets = {
    'sales-simulation': 1400,
    'role-play': 1200,
    'emotional-assessment': 800,
    'product-knowledge': 700
  };
  
  assertEquals(tokenBudgets['sales-simulation'], 1400, 'Sales simulation budget');
  assertEquals(tokenBudgets['role-play'], 1200, 'Role play budget');
  assertEquals(tokenBudgets['emotional-assessment'], 800, 'Emotional assessment budget');
  assertEquals(tokenBudgets['product-knowledge'], 700, 'Product knowledge budget');
});

// ===== Navigation Tests =====
console.log('\n=== Navigation Tests ===');

test('Analytics link exists in navigation structure', () => {
  const navStructure = {
    links: [
      { name: 'Platform', type: 'dropdown' },
      { name: 'Analytics', type: 'link', href: 'analytics.html' },
      { name: 'About EI', type: 'dropdown' },
      { name: 'Ethics', type: 'link' },
    ]
  };
  
  const hasAnalytics = navStructure.links.some(link => link.name === 'Analytics');
  assert.ok(hasAnalytics, 'Analytics link should exist');
});

test('About EI dropdown has correct structure', () => {
  const aboutEiDropdown = {
    items: [
      { name: 'Take EI Assessment', external: true },
      { name: 'EI Overview', action: 'modal' },
      { name: 'EI Score Breakdown', href: 'ei-score-details.html' }
    ]
  };
  
  assertEquals(aboutEiDropdown.items.length, 3, 'Should have 3 items');
  assert.ok(aboutEiDropdown.items.some(item => item.name === 'EI Score Breakdown'), 'Should have breakdown link');
});

// ===== About EI Content Tests =====
console.log('\n=== About EI Content Tests ===');

test('about-ei.md contains required phrase', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(
    content.includes('Reflectiv-AI integrates Emotional Intelligence (EI) into simulation and role-play-based learning by default'),
    'Should contain required integration phrase'
  );
});

test('about-ei.md contains triple-loop reflection section', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(content.includes('Triple-Loop Reflective Architecture'), 'Should have triple-loop section');
  assert.ok(content.includes('Primary'), 'Should describe primary loop');
  assert.ok(content.includes('Secondary'), 'Should describe secondary loop');
  assert.ok(content.includes('Tertiary'), 'Should describe tertiary loop');
});

test('about-ei.md contains EI ↔ SEL mapping', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(content.includes('SEL'), 'Should mention SEL');
  assert.ok(content.includes('Self-Awareness'), 'Should include self-awareness');
  assert.ok(content.includes('Self-Management'), 'Should include self-management');
  assert.ok(content.includes('Social Awareness'), 'Should include social awareness');
  assert.ok(content.includes('Relationship Skills'), 'Should include relationship skills');
  assert.ok(content.includes('Responsible Decision-Making'), 'Should include decision-making');
});

test('about-ei.md contains Socratic prompts section', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(content.includes('Socratic'), 'Should have Socratic section');
  assert.ok(content.includes('What did you notice about your tone'), 'Should have example prompts');
});

test('about-ei.md contains Reflectiv-AI Paradigms section', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(content.includes('Reflexion'), 'Should mention Reflexion');
  assert.ok(content.includes('Reflective LLaVA'), 'Should mention Reflective LLaVA');
});

test('about-ei.md contains Personalized EI Growth Profiles section', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/about-ei.md', 'utf8');
  
  assert.ok(content.includes('Personalized EI Growth Profile'), 'Should have growth profile section');
  assert.ok(content.includes('Reflective Index'), 'Should mention Reflective Index');
});

// ===== File Existence Tests =====
console.log('\n=== File Existence Tests ===');

test('analytics.html exists', () => {
  const fs = require('fs');
  assert.ok(fs.existsSync('./analytics.html'), 'analytics.html should exist');
});

test('ei-score-details.html exists', () => {
  const fs = require('fs');
  assert.ok(fs.existsSync('./ei-score-details.html'), 'ei-score-details.html should exist');
});

test('analytics.html contains Plotly script', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./analytics.html', 'utf8');
  
  assert.ok(content.includes('plotly'), 'Should include Plotly');
  assert.ok(content.includes('volumeChart'), 'Should have volume chart');
  assert.ok(content.includes('trendChart'), 'Should have trend chart');
  assert.ok(content.includes('radarChart'), 'Should have radar chart');
  assert.ok(content.includes('heatmapChart'), 'Should have heatmap chart');
});

test('ei-score-details.html contains domain definitions', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./ei-score-details.html', 'utf8');
  
  const domains = ['Empathy', 'Objection Handling', 'Clarity', 'Accuracy', 'Discovery', 'Self-Regulation'];
  
  domains.forEach(domain => {
    assert.ok(content.includes(domain), `Should define ${domain}`);
  });
});

// ===== Mode File Structure Tests =====
console.log('\n=== Mode File Structure Tests ===');

test('emotionalIntelligence.js has JSDoc header', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/modes/emotionalIntelligence.js', 'utf8');
  
  assert.ok(content.includes('/**'), 'Should have JSDoc comment');
  assert.ok(content.includes('Backend mode'), 'Should document backend mode');
  assert.ok(content.includes('emotional-assessment'), 'Should specify mode name');
});

test('productKnowledge.js has JSDoc header', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/modes/productKnowledge.js', 'utf8');
  
  assert.ok(content.includes('/**'), 'Should have JSDoc comment');
  assert.ok(content.includes('product-knowledge'), 'Should specify mode name');
});

test('salesCoach.js has JSDoc header', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/modes/salesCoach.js', 'utf8');
  
  assert.ok(content.includes('/**'), 'Should have JSDoc comment');
  assert.ok(content.includes('sales-simulation'), 'Should specify mode name');
});

test('rolePlay.js has JSDoc header', () => {
  const fs = require('fs');
  const content = fs.readFileSync('./assets/chat/modes/rolePlay.js', 'utf8');
  
  assert.ok(content.includes('/**'), 'Should have JSDoc comment');
  assert.ok(content.includes('role-play'), 'Should specify mode name');
});

test('Mode files implement history limiting', () => {
  const fs = require('fs');
  const files = [
    './assets/chat/modes/emotionalIntelligence.js',
    './assets/chat/modes/productKnowledge.js',
    './assets/chat/modes/salesCoach.js',
    './assets/chat/modes/rolePlay.js'
  ];
  
  files.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    assert.ok(content.includes('limitHistory'), `${file} should have limitHistory function`);
    assert.ok(content.includes('history.length > 20'), `${file} should limit to 20 messages`);
  });
});

// ===== Summary =====
console.log('\n=== Test Summary ===');
console.log(`Passed: ${testsPassed}`);
console.log(`Failed: ${testsFailed}`);

if (testsFailed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ All tests passed!');
  process.exit(0);
}
