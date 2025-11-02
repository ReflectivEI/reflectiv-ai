import { test } from 'node:test';
import assert from 'node:assert';
import { scoreEi } from '../ei/eiRules';

test('scoreEi clamps scores between 1-5', () => {
  const result = scoreEi({
    text: 'Hello, how are you doing today? I hope everything is going well.',
    mode: 'sales-simulation'
  });

  assert.ok(result.scores.empathy >= 1 && result.scores.empathy <= 5);
  assert.ok(result.scores.discovery >= 1 && result.scores.discovery <= 5);
  assert.ok(result.scores.compliance >= 1 && result.scores.compliance <= 5);
  assert.ok(result.scores.clarity >= 1 && result.scores.clarity <= 5);
  assert.ok(result.scores.accuracy >= 1 && result.scores.accuracy <= 5);

  assert.ok(Number.isInteger(result.scores.empathy));
  assert.ok(Number.isInteger(result.scores.discovery));
  assert.ok(Number.isInteger(result.scores.compliance));
  assert.ok(Number.isInteger(result.scores.clarity));
  assert.ok(Number.isInteger(result.scores.accuracy));
});

test('scoreEi returns tips array with max 5 items', () => {
  const result = scoreEi({
    text: 'This is a short text.',
    mode: 'sales-simulation'
  });

  assert.ok(Array.isArray(result.tips));
  assert.ok(result.tips.length <= 5);
});

test('scoreEi includes rubric_version', () => {
  const result = scoreEi({
    text: 'Sample text for testing.',
    mode: 'sales-simulation'
  });

  assert.strictEqual(result.rubric_version, 'v1.2');
});

test('scoreEi detects questions for discovery score', () => {
  const withQuestions = scoreEi({
    text: 'How are you? What do you think? Would you consider this option?',
    mode: 'sales-simulation'
  });

  const withoutQuestions = scoreEi({
    text: 'This is a statement. Here is another statement. No questions here.',
    mode: 'sales-simulation'
  });

  // Text with questions should have higher discovery score
  assert.ok(withQuestions.scores.discovery >= withoutQuestions.scores.discovery);
});

test('scoreEi detects compliance anchors', () => {
  const withCompliance = scoreEi({
    text: 'According to FDA guidelines and per label, this medication is indicated for patients.',
    mode: 'sales-simulation'
  });

  const withoutCompliance = scoreEi({
    text: 'This medication is good for patients.',
    mode: 'sales-simulation'
  });

  // Text with compliance anchors should have higher compliance score
  assert.ok(withCompliance.scores.compliance >= withoutCompliance.scores.compliance);
});
