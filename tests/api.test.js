import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../api/analyze.js';

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('analysis endpoint rejects methods other than POST', async () => {
  const response = responseRecorder();
  await handler({ method: 'GET', headers: {} }, response);
  assert.equal(response.statusCode, 405);
});

test('analysis endpoint has a useful local fallback without an API key', async () => {
  const previous = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  const response = responseRecorder();
  await handler({
    method: 'POST', headers: {}, socket: {},
    body: { transactionCount: 2, balance: 100, personal: 0 },
  }, response);
  if (previous) process.env.OPENAI_API_KEY = previous;

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.ai, false);
  assert.match(response.body.advice, /dejó dinero/i);
});
