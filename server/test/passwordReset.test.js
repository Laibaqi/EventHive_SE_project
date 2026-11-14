// Tests for forgot / reset / change password (TC-PW-01 to TC-PW-09, TC-SRV-01).
// Alishah's OTP package is replaced by a fake that behaves like hers: 6-digit code,
// 10 minutes, 5 tries, 60-second wait, one use. Messages copy her otpMessage().
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

process.env.JWT_SECRET = 'a-test-secret-that-is-at-least-32-characters-long';

const { forgot, reset, changePassword } = require('../src/auth/passwordReset');
const { hashPassword, checkPassword } = require('../src/auth/password');
const { verifySession } = require('../src/auth/tokens');
const { authLimiter } = require('../src/middleware/rateLimit');

let users, emails, auditLog, otps, now;

const PURPOSE = { SIGNUP_VERIFY: 'SIGNUP_VERIFY', PASSWORD_RESET: 'PASSWORD_RESET' };

const otp = {
  PURPOSE,
  async createOtp({ email, purpose }) {
    const key = `${purpose}:${email}`;
    const last = otps[key];
    if (last && now - last.sentAt < 60_000) {
      return { ok: false, reason: 'cooldown', retryAfterSeconds: Math.ceil((60_000 - (now - last.sentAt)) / 1000) };
    }
    const code = String(100000 + Math.floor(Math.random() * 900000));
    otps[key] = { code, sentAt: now, attempts: 0, used: false };
    return { ok: true, code };
  },
  async verifyOtp({ email, purpose, code }) {
    const o = otps[`${purpose}:${email}`];
    if (!o || o.used) return { ok: false, reason: 'invalid' };
    if (now - o.sentAt > 10 * 60_000) return { ok: false, reason: 'expired' };
    if (o.attempts >= 5) return { ok: false, reason: 'too_many_attempts' };
    if (o.code !== code) {
      o.attempts += 1;
      return { ok: false, reason: 'invalid', attemptsLeft: 5 - o.attempts };
    }
    o.used = true;
    return { ok: true };
  },
  otpMessage(r) {
    switch (r.reason) {
      case 'expired': return 'This code has expired. Ask for a new one.';
      case 'too_many_attempts': return 'Too many wrong tries. Ask for a new code.';
      default: return r.attemptsLeft != null
        ? `Wrong code. ${r.attemptsLeft} ${r.attemptsLeft === 1 ? 'try' : 'tries'} left.`
        : 'This code is not valid. Ask for a new one.';
    }
  },
};

const deps = {
  findUserByEmail: async (email) => users.find((u) => u.email === email) ?? null,
  findUserById: async (id) => users.find((u) => u.id === id) ?? null,
  updateUser: async (id, changes) => Object.assign(users.find((u) => u.id === id), changes),
  endSessions: async (id) => {
    const u = users.find((x) => x.id === id);
    u.tokenVersion += 1;
    return u;
  },
  sendEmail: async (template, to, data) => { emails.push({ template, to, data }); },
  audit: async (...args) => auditLog.push(args),
  ACTIONS: {},
  otp,
};

const OLD = 'oldpass123';
const NEW = 'newpass456';

beforeEach(async () => {
  now = new Date('2026-11-11T10:00:00+05:00').getTime();
  otps = {};
  emails = [];
  auditLog = [];
  users = [{
    id: 1, name: 'Sara', email: 'sara@example.com', role: 'ATTENDEE',
    passwordHash: await hashPassword(OLD), tokenVersion: 0, failedLogins: 3, lockedUntil: new Date(now + 600_000),
  }];
});

const codeSentTo = (email) => otps[`PASSWORD_RESET:${email}`].code;
const rejects = (promise, status, field, messagePart) =>
  assert.rejects(promise, (e) => {
    assert.equal(e.status, status);
    assert.equal(e.field, field);
    if (messagePart) assert.match(e.message, messagePart);
    return true;
  });

test('TC-PW-01 forgot with a registered email: same message, OTP email sent', async () => {
  const r = await forgot({ email: 'sara@example.com' }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'If an account exists, we sent a code');
  assert.equal(emails.length, 1);
  assert.equal(emails[0].template, 'otp');
  assert.equal(emails[0].to, 'sara@example.com');
  assert.equal(emails[0].data.code, codeSentTo('sara@example.com'));
  assert.equal(emails[0].data.purpose, 'reset your password');
  assert.equal(emails[0].data.minutes, 10);
});

test('TC-PW-02 forgot with an unknown email: exactly the same reply, no email', async () => {
  const known = await forgot({ email: 'sara@example.com' }, deps);
  emails.length = 0;
  const unknown = await forgot({ email: 'nobody@example.com' }, deps);
  assert.deepEqual(unknown, known);
  assert.equal(emails.length, 0);
});

test('forgot asked twice within 60 seconds: same reply, only one email', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  const again = await forgot({ email: 'sara@example.com' }, deps);
  assert.equal(again.body.message, 'If an account exists, we sent a code');
  assert.equal(emails.length, 1);
});

test('forgot treats the email case-insensitively and trims it', async () => {
  await forgot({ email: '  SARA@Example.com ' }, deps);
  assert.equal(emails.length, 1);
});

test('TC-PW-03 reset with the right code: password changes, old one stops working', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  const r = await reset({ email: 'sara@example.com', code: codeSentTo('sara@example.com'), newPassword: NEW }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'Password changed');
  assert.equal(await checkPassword(NEW, users[0].passwordHash), true);
  assert.equal(await checkPassword(OLD, users[0].passwordHash), false);
  assert.equal(users[0].tokenVersion, 1); // old sessions ended
  assert.equal(users[0].failedLogins, 0); // login lock cleared
  assert.equal(users[0].lockedUntil, null);
  assert.equal(auditLog.at(-1)[1], 'PASSWORD_RESET');
});

test('TC-PW-04 reset with a wrong code: 400 on code, tries left', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  await rejects(reset({ email: 'sara@example.com', code: '000000', newPassword: NEW }, deps), 400, 'code', /Wrong code\. 4 tries left\./);
  assert.equal(await checkPassword(OLD, users[0].passwordHash), true); // unchanged
});

test('TC-PW-05 reset with an expired code (over 10 minutes): 400 expired', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  const code = codeSentTo('sara@example.com');
  now += 11 * 60_000;
  await rejects(reset({ email: 'sara@example.com', code, newPassword: NEW }, deps), 400, 'code', /expired/);
});

test('TC-PW-06 reusing a code that already worked is refused', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  const code = codeSentTo('sara@example.com');
  await reset({ email: 'sara@example.com', code, newPassword: NEW }, deps);
  await rejects(reset({ email: 'sara@example.com', code, newPassword: 'another789' }, deps), 400, 'code');
  assert.equal(await checkPassword(NEW, users[0].passwordHash), true);
});

test('TC-PW-07 weak new password (abc): 400 on newPassword, code not used up', async () => {
  await forgot({ email: 'sara@example.com' }, deps);
  const code = codeSentTo('sara@example.com');
  await rejects(reset({ email: 'sara@example.com', code, newPassword: 'abc' }, deps), 400, 'newPassword');
  const ok = await reset({ email: 'sara@example.com', code, newPassword: NEW }, deps); // same code still works
  assert.equal(ok.status, 200);
});

test('reset with a code that is not 6 digits: 400 on code', async () => {
  await rejects(reset({ email: 'sara@example.com', code: '12ab', newPassword: NEW }, deps), 400, 'code');
});

test('reset for an email with no code requested: refused', async () => {
  await rejects(reset({ email: 'nobody@example.com', code: '123456', newPassword: NEW }, deps), 400, 'code');
});

test('change password: success ends old sessions but returns a fresh token', async () => {
  const r = await changePassword(1, { currentPassword: OLD, newPassword: NEW }, deps);
  assert.equal(r.status, 200);
  assert.equal(await checkPassword(NEW, users[0].passwordHash), true);
  assert.equal(await checkPassword(OLD, users[0].passwordHash), false);
  assert.equal(users[0].tokenVersion, 1);
  const session = verifySession(r.body.token);
  assert.equal(session.ok, true);
  assert.equal(session.payload.tv, 1); // matches the new tokenVersion, so this session stays valid
  assert.equal(auditLog.at(-1)[1], 'PASSWORD_CHANGE');
});

test('TC-PW-08 change password with a wrong current password: 400 on currentPassword', async () => {
  await rejects(changePassword(1, { currentPassword: 'wrong-one1', newPassword: NEW }, deps), 400, 'currentPassword', /Current password is wrong/);
  assert.equal(await checkPassword(OLD, users[0].passwordHash), true);
});

test('change password: new password must differ from the current one', async () => {
  await rejects(changePassword(1, { currentPassword: OLD, newPassword: OLD }, deps), 400, 'newPassword');
});

test('change password: weak new password is refused on newPassword', async () => {
  await rejects(changePassword(1, { currentPassword: OLD, newPassword: 'short1' }, deps), 400, 'newPassword');
});

test('passwords never appear in audit entries', async () => {
  await changePassword(1, { currentPassword: OLD, newPassword: NEW }, deps);
  assert.ok(!JSON.stringify(auditLog).includes(NEW));
  assert.ok(!JSON.stringify(auditLog).includes(OLD));
});

// ---- Real HTTP tests: rate limit and /health ----
async function withServer(app, fn) {
  const server = app.listen(0);
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('TC-PW-09 eleven quick forgot requests: the 11th gets 429', async () => {
  const app = express();
  app.use(express.json());
  app.post('/forgot', authLimiter, (req, res) => res.json({ message: 'ok' }));
  await withServer(app, async (base) => {
    const statuses = [];
    for (let i = 0; i < 11; i++) {
      const res = await fetch(`${base}/forgot`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      statuses.push(res.status);
      if (i === 10) assert.deepEqual(await res.json(), { error: 'Too many tries. Please wait and try again.', field: null });
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(200));
    assert.equal(statuses[10], 429);
  });
});

test('TC-SRV-01 GET /health returns { ok: true }', async () => {
  const app = require('../src/app');
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/health`);
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
  });
});
