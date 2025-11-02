import { test } from 'node:test';
import assert from 'node:assert';
import { redactPII } from '../utils/redact';

test('redactPII removes email addresses', () => {
  const text = 'Contact me at john.doe@example.com for details';
  const redacted = redactPII(text);
  assert.strictEqual(redacted, 'Contact me at [EMAIL] for details');
});

test('redactPII removes phone numbers', () => {
  const text = 'Call me at 555-123-4567 or (555) 987-6543';
  const redacted = redactPII(text);
  assert.ok(redacted.includes('[PHONE]'));
  assert.ok(!redacted.includes('555-123-4567'));
});

test('redactPII removes HCP names with Dr. prefix', () => {
  const text = 'Spoke with Dr. Smith yesterday';
  const redacted = redactPII(text);
  assert.ok(redacted.includes('[HCP_NAME]'));
  assert.ok(!redacted.includes('Dr. Smith'));
});

test('redactPII preserves non-PII text', () => {
  const text = 'This is a normal sentence about sales guidance.';
  const redacted = redactPII(text);
  assert.strictEqual(redacted, text);
});
