// Tests for AUTH-07 login checks, logout and /api/auth/me (team brief, cards 2 and 4).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';

const jwt = require('jsonwebtoken');
const { createAuth } = require('../src/middleware/auth');
const { signSession } = require('../src/auth/tokens');

let users;
beforeEach(() => {
  users = {
    1: { id: 1, name: 'Ali', email: 'ali@example.com', role: 'ATTENDEE', tokenVersion: 0, emailVerifiedAt: null, passwordHash: 'x' },
    2: { id: 2, name: 'Sara', email: 'admin@eventhive.pk', role: 'ADMIN', tokenVersion: 0, emailVerifiedAt: new Date(), passwordHash: 'x' },
    3: { id: 3, name: 'Hira', email: 'hira@example.com', role: 'ORGANIZER', tokenVersion: 0, emailVerifiedAt: new Date(), passwordHash: 'x' },
    4: { id: 4, name: 'Bilal', email: 'bilal@example.com', role: 'ORGANIZER', tokenVersion: 0, emailVerifiedAt: null, passwordHash: 'x' },
  };
});

const { requireAuth, requireRole, requireVerified, logout, me } = createAuth({
  loadUser: async (id) => users[id] ?? null,
  endSessions: async (id) => { users[id].tokenVersion += 1; },
});

// Tiny stand-ins for Express's req and res.
function fakeRes() {
  return {
    statusCode: 200,
    body: undefined,
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
    end() { return this; },
  };
}
async function run(middleware, req) {
  const res = fakeRes();
  let passed = false;
  await middleware(req, res, () => { passed = true; });
  return { res, passed, req };
}
const bearer = (token) => ({ headers: { authorization: `Bearer ${token}` } });
const loggedIn = async (user) => (await run(requireAuth, bearer(signSession(user)))).req;

test('no token -> 401 in the team error format', async () => {
  const { res, passed } = await run(requireAuth, { headers: {} });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 401);
  assert.deepEqual(res.body, { error: 'Please log in', field: null });
});

test('AUTH-07 acceptance: an expired token gets 401', async () => {
  const expired = jwt.sign({ uid: 1, role: 'ATTENDEE', tv: 0, exp: Math.floor(Date.now() / 1000) - 10 }, process.env.JWT_SECRET);
  const { res } = await run(requireAuth, bearer(expired));
  assert.equal(res.statusCode, 401);
  assert.match(res.body.error, /expired/);
});

test('a token signed with the wrong secret -> 401', async () => {
  const fake = jwt.sign({ uid: 2, role: 'ADMIN', tv: 0 }, 'some-other-secret-that-is-32-characters!!');
  const { res } = await run(requireAuth, bearer(fake));
  assert.equal(res.statusCode, 401);
});

test('a valid token sets req.user = { id, role, emailVerified }', async () => {
  const { passed, req } = await run(requireAuth, bearer(signSession(users[3])));
  assert.equal(passed, true);
  assert.deepEqual(req.user, { id: 3, role: 'ORGANIZER', emailVerified: true });
});

test('wrong role -> 403', async () => {
  const { res, passed } = await run(requireRole('ORGANIZER'), { user: await loggedIn(users[1]).then((r) => r.user) });
  assert.equal(passed, false);
  assert.equal(res.statusCode, 403);
});

test('right role passes', async () => {
  const req = await loggedIn(users[3]);
  assert.equal((await run(requireRole('ORGANIZER', 'ADMIN'), req)).passed, true);
});

test('TC-AUTH-OTP-05: unverified organizer -> 403 "Please verify your email first"', async () => {
  const req = await loggedIn(users[4]);
  const { res } = await run(requireVerified, req);
  assert.equal(res.statusCode, 403);
  assert.deepEqual(res.body, { error: 'Please verify your email first', field: null });
  assert.equal((await run(requireVerified, await loggedIn(users[3]))).passed, true);
});

test('logout makes the old token stop working', async () => {
  const token = signSession(users[3]);
  const first = await run(requireAuth, bearer(token));
  const { res } = await run(logout, first.req);
  assert.equal(res.statusCode, 204);
  const again = await run(requireAuth, bearer(token));
  assert.equal(again.res.statusCode, 401);
});

test('GET /api/auth/me returns the user without the password hash', async () => {
  const { res } = await run(me, await loggedIn(users[1]));
  assert.deepEqual(res.body, {
    user: { id: 1, name: 'Ali', email: 'ali@example.com', role: 'ATTENDEE', emailVerified: false },
  });
});
