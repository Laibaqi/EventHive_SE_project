// Bad JSON must be a 400 in the team error format, not a 500.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const app = require('../src/app');
const errorHandler = require('../src/middleware/error');

async function withServer(application, fn) {
  const server = application.listen(0);
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

const post = (base, path, body) =>
  fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body });

test('malformed JSON -> 400 { error, field: null }', async () => {
  await withServer(app, async (base) => {
    const res = await post(base, '/api/auth/forgot', '{"email": "sara@example.com"');
    assert.equal(res.status, 400);
    assert.deepEqual(await res.json(), { error: 'The request body is not valid JSON', field: null });
  });
});

test('body that is not JSON at all -> 400', async () => {
  await withServer(app, async (base) => {
    const res = await post(base, '/api/auth/login', 'email=sara&password=abc');
    assert.equal(res.status, 400);
    assert.equal((await res.json()).field, null);
  });
});

test('body over 100 KB -> 413 in the team format', async () => {
  await withServer(app, async (base) => {
    const res = await post(base, '/api/auth/forgot', JSON.stringify({ email: 'a'.repeat(150_000) }));
    assert.equal(res.status, 413);
    assert.deepEqual(await res.json(), { error: 'The request body is too large', field: null });
  });
});

test('unexpected error -> 500 with no stack trace', async () => {
  const mini = express();
  mini.get('/boom', () => { throw new Error('secret detail at /src/db.js:42'); });
  mini.use(errorHandler);
  const original = console.error;
  console.error = () => {}; // keep the test output clean
  try {
    await withServer(mini, async (base) => {
      const res = await fetch(`${base}/boom`);
      const text = await res.text();
      assert.equal(res.status, 500);
      assert.deepEqual(JSON.parse(text), { error: 'Something went wrong', field: null });
      assert.ok(!text.includes('secret detail'));
    });
  } finally {
    console.error = original;
  }
});

test('valid JSON still reaches the route (no false alarms)', async () => {
  await withServer(app, async (base) => {
    const res = await post(base, '/api/auth/login', JSON.stringify({ email: '', password: '' }));
    assert.equal(res.status, 400);
    const body = await res.json();
    assert.equal(body.field, 'email'); // validation message, not the JSON message
  });
});
