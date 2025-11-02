import { test } from 'node:test';
import assert from 'node:assert';
import { validateEiPayload } from '../validator';

test('validateEiPayload accepts valid payload', () => {
  const valid = {
    scores: {
      empathy: 4,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    },
    rubric_version: 'v1.2',
    rationales: {
      empathy: 'Good empathy',
      discovery: 'Needs improvement'
    },
    tips: ['Tip 1', 'Tip 2']
  };

  assert.strictEqual(validateEiPayload(valid), true);
});

test('validateEiPayload rejects payload without scores', () => {
  const invalid = {
    rubric_version: 'v1.2'
  };

  assert.strictEqual(validateEiPayload(invalid), false);
});

test('validateEiPayload rejects payload without rubric_version', () => {
  const invalid = {
    scores: {
      empathy: 4,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    }
  };

  assert.strictEqual(validateEiPayload(invalid), false);
});

test('validateEiPayload rejects scores out of range', () => {
  const invalid = {
    scores: {
      empathy: 6,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    },
    rubric_version: 'v1.2'
  };

  assert.strictEqual(validateEiPayload(invalid), false);
});

test('validateEiPayload rejects non-integer scores', () => {
  const invalid = {
    scores: {
      empathy: 4.5,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    },
    rubric_version: 'v1.2'
  };

  assert.strictEqual(validateEiPayload(invalid), false);
});

test('validateEiPayload rejects tips array with more than 5 items', () => {
  const invalid = {
    scores: {
      empathy: 4,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    },
    rubric_version: 'v1.2',
    tips: ['1', '2', '3', '4', '5', '6']
  };

  assert.strictEqual(validateEiPayload(invalid), false);
});

test('validateEiPayload accepts tips array with exactly 5 items', () => {
  const valid = {
    scores: {
      empathy: 4,
      discovery: 3,
      compliance: 5,
      clarity: 4,
      accuracy: 3
    },
    rubric_version: 'v1.2',
    tips: ['1', '2', '3', '4', '5']
  };

  assert.strictEqual(validateEiPayload(valid), true);
});
