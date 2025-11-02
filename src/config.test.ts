import { test } from 'node:test';
import assert from 'node:assert';
import { fromRequest } from '../config';

test('fromRequest returns emitEi=true from query param emitEi=true', () => {
  const req = new Request('https://example.com/chat?emitEi=true');
  const config = fromRequest(req);
  assert.strictEqual(config.emitEi, true);
});

test('fromRequest returns emitEi=true from query param emitEi=1', () => {
  const req = new Request('https://example.com/chat?emitEi=1');
  const config = fromRequest(req);
  assert.strictEqual(config.emitEi, true);
});

test('fromRequest returns emitEi=true from header x-ei-emit=1', () => {
  const req = new Request('https://example.com/chat', {
    headers: { 'x-ei-emit': '1' }
  });
  const config = fromRequest(req);
  assert.strictEqual(config.emitEi, true);
});

test('fromRequest returns emitEi=false by default', () => {
  const req = new Request('https://example.com/chat');
  const config = fromRequest(req);
  assert.strictEqual(config.emitEi, false);
});

test('fromRequest returns emitEi=false for invalid values', () => {
  const req = new Request('https://example.com/chat?emitEi=false');
  const config = fromRequest(req);
  assert.strictEqual(config.emitEi, false);
});
