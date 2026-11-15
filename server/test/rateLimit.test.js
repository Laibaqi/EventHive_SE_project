// Rate limiter: each account has its own 10 tries, but one IP can't dodge the limit by changing emails.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { createAuthLimiter } = require('../src/middleware/rateLimit');

// A fresh app and a fresh limiter per test = fresh counters.
async function withLimitedApp(fn) {
  const app = express();
  app.use(express.json());
  app.post('/try', createAuthLimiter(), (req, res) => res.json({ ok: true }));
  const server = app.listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const send = async (email) => {
    const res = await fetch(`${base}/try`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(email === undefined ? {} : { email }),
    });
    return { status: res.status, body: await res.json() };
  };
  try { await fn(send); } finally { server.close(); }
}

test('TC-PW-09: 11 tries with the same email -> the 11th gets 429 in the team format', async () => {
  await withLimitedApp(async (send) => {
    for (let i = 1; i <= 10; i++) assert.equal((await send('a@x.com')).status, 200);
    const eleventh = await send('a@x.com');
    assert.equal(eleventh.status, 429);
    assert.deepEqual(eleventh.body, { error: 'Too many tries. Please wait and try again.', field: null });
  });
});

test('TC-PW-09b: after 10 tries for a@x.com, b@x.com from the same IP still works', async () => {
  await withLimitedApp(async (send) => {
    for (let i = 0; i < 10; i++) await send('a@x.com');
    assert.equal((await send('a@x.com')).status, 429);
    assert.equal((await send('b@x.com')).status, 200);
  });
});

test('upper-case and spaces in the email do not give extra tries', async () => {
  await withLimitedApp(async (send) => {
    for (let i = 0; i < 5; i++) await send('a@x.com');
    for (let i = 0; i < 5; i++) await send('  A@X.COM ');
    assert.equal((await send('a@x.com')).status, 429);
  });
});

test('requests with no email (e.g. change password) share one count per IP', async () => {
  await withLimitedApp(async (send) => {
    for (let i = 0; i < 10; i++) assert.equal((await send(undefined)).status, 200);
    assert.equal((await send(undefined)).status, 429);
  });
});

test('changing the email on every request does not dodge the limit (IP safety net at 100)', async () => {
  await withLimitedApp(async (send) => {
    for (let i = 1; i <= 100; i++) assert.equal((await send(`user${i}@x.com`)).status, 200);
    const next = await send('someone-new@x.com'); // brand-new email, but the IP is used up
    assert.equal(next.status, 429);
  });
});
