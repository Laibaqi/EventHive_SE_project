// Tests for AUTH-02 login, using a fake in-memory "database".
const { test, before, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';

const { login } = require('../src/auth/login');
const { hashPassword } = require('../src/auth/password');
const { verifySession } = require('../src/auth/tokens');

let users;
let auditLog;
const deps = {
  findUserByEmail: async (email) => users.find((u) => u.email === email) ?? null,
  updateUser: async (id, changes) => Object.assign(users.find((u) => u.id === id), changes),
  audit: async (...args) => auditLog.push(args),
};

let hash;
before(async () => {
  hash = await hashPassword('secret123');
});

beforeEach(() => {
  auditLog = [];
  users = [
    { id: 1, name: 'Ali', email: 'ali@example.com', role: 'ATTENDEE', passwordHash: hash, failedLogins: 0, lockedUntil: null, tokenVersion: 0, emailVerifiedAt: null },
    { id: 2, name: 'Sara', email: 'admin@eventhive.pk', role: 'ADMIN', passwordHash: hash, failedLogins: 0, lockedUntil: null, tokenVersion: 0, emailVerifiedAt: new Date() },
  ];
});

async function rejects(promise) {
  try {
    await promise;
  } catch (e) {
    return e;
  }
  assert.fail('expected login to fail');
}

test('correct login returns a 60-minute token and the right dashboard', async () => {
  const out = await login({ email: 'ALI@example.com', password: 'secret123' }, deps);
  assert.equal(out.dashboard, '/dashboard/attendee');
  assert.equal(out.user.emailVerified, false); // unverified can still log in (AUTH-05)
  assert.equal(out.user.passwordHash, undefined); // never sent to the browser
  const { ok, payload } = verifySession(out.token);
  assert.ok(ok);
  assert.equal(payload.uid, 1);
  assert.equal(payload.exp - payload.iat, 60 * 60);
  assert.equal(auditLog.at(-1)[1], 'LOGIN');
});

test('each role lands on its own dashboard', async () => {
  const out = await login({ email: 'admin@eventhive.pk', password: 'secret123' }, deps);
  assert.equal(out.dashboard, '/dashboard/admin');
});

test('wrong password and unknown email give the same message', async () => {
  const a = await rejects(login({ email: 'ali@example.com', password: 'wrong1234' }, deps));
  const b = await rejects(login({ email: 'nobody@example.com', password: 'wrong1234' }, deps));
  assert.equal(a.status, 401);
  assert.equal(a.message, b.message);
  assert.deepEqual(a.toJSON(), { error: 'Email or password is incorrect', field: null });
  assert.equal(auditLog.filter((r) => r[1] === 'LOGIN_FAILED').length, 2);
});

test('AUTH-02 acceptance: after 5 failures the next attempt is refused with a lock message for 15 minutes', async () => {
  const now = new Date('2026-11-03T10:00:00+05:00');
  for (let i = 0; i < 5; i++) {
    const e = await rejects(login({ email: 'ali@example.com', password: 'wrong1234' }, deps, now));
    assert.equal(e.status, 401);
  }
  // 6th try, even with the right password, is refused
  const locked = await rejects(login({ email: 'ali@example.com', password: 'secret123' }, deps, now));
  assert.equal(locked.status, 423);
  assert.match(locked.message, /Try again in 15 minutes/);

  // still locked at 14 minutes, open at 15
  const at14 = new Date(now.getTime() + 14 * 60000);
  assert.equal((await rejects(login({ email: 'ali@example.com', password: 'secret123' }, deps, at14))).status, 423);
  const at15 = new Date(now.getTime() + 15 * 60000);
  const out = await login({ email: 'ali@example.com', password: 'secret123' }, deps, at15);
  assert.ok(out.token);
  assert.equal(users[0].failedLogins, 0);
});

test('a successful login clears earlier failures', async () => {
  await rejects(login({ email: 'ali@example.com', password: 'wrong1234' }, deps));
  assert.equal(users[0].failedLogins, 1);
  await login({ email: 'ali@example.com', password: 'secret123' }, deps);
  assert.equal(users[0].failedLogins, 0);
});

test('works without audit() until Alishah’s helper is ready', async () => {
  const { audit, ...noAudit } = deps;
  const out = await login({ email: 'ali@example.com', password: 'secret123' }, noAudit);
  assert.ok(out.token);
});
