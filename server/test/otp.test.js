// Run: npm test   (uses Node's built-in test runner, like Laiba's auth tests)
const test = require('node:test');
const assert = require('node:assert/strict');
const { createOtp, verifyOtp, otpMessage, PURPOSE, SETTINGS } = require('../src/lib/otp');
const { memoryStore } = require('../src/lib/otpStores');

// A fake clock so we can jump forward in time.
function clock(start = new Date('2026-11-10T10:00:00Z')) {
  let t = start.getTime();
  return { now: () => new Date(t), advance: (sec) => { t += sec * 1000; } };
}
const setup = () => { const store = memoryStore(); const c = clock(); return { store, c, opts: { store, now: c.now } }; };
const S = PURPOSE.SIGNUP_VERIFY;

test('TC-OTP-01: a code is 6 digits and expires in 10 minutes', async () => {
  const { opts, c } = setup();
  const r = await createOtp({ email: 'ali@test.pk', purpose: S, userId: 7 }, opts);
  assert.equal(r.ok, true);
  assert.match(r.code, /^\d{6}$/);
  assert.equal(r.expiresAt - c.now(), SETTINGS.ttlMinutes * 60 * 1000);
});

test('TC-OTP-02: only a hash is stored, never the code', async () => {
  const { opts, store } = setup();
  const r = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  const row = store.rows[0];
  assert.equal(row.codeHash.length, 64);
  assert.ok(!JSON.stringify(row).includes(`"${r.code}"`));
});

test('TC-OTP-03: the right code works once and returns the userId', async () => {
  const { opts } = setup();
  const { code } = await createOtp({ email: 'ali@test.pk', purpose: S, userId: 7 }, opts);
  assert.deepEqual(await verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts), { ok: true, userId: 7 });
  const again = await verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts);
  assert.equal(again.ok, false);
});

test('TC-OTP-04: email case and spaces do not matter', async () => {
  const { opts } = setup();
  const { code } = await createOtp({ email: '  Ali@Test.PK ', purpose: S }, opts);
  assert.equal((await verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts)).ok, true);
});

test('TC-OTP-05: an expired code is refused', async () => {
  const { opts, c } = setup();
  const { code } = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  c.advance(SETTINGS.ttlMinutes * 60 + 1);
  const r = await verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts);
  assert.deepEqual(r, { ok: false, reason: 'expired' });
  assert.equal(otpMessage(r), 'This code has expired. Ask for a new one.');
});

test('TC-OTP-06: wrong codes count down, and the 5th wrong try kills the code', async () => {
  const { opts } = setup();
  const { code } = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  const wrong = code === '000000' ? '111111' : '000000';
  for (let left = 4; left >= 1; left--) {
    const r = await verifyOtp({ email: 'ali@test.pk', purpose: S, code: wrong }, opts);
    assert.deepEqual(r, { ok: false, reason: 'invalid', attemptsLeft: left });
  }
  assert.deepEqual(await verifyOtp({ email: 'ali@test.pk', purpose: S, code: wrong }, opts), { ok: false, reason: 'too_many_attempts' });
  // even the right code no longer works
  assert.equal((await verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts)).ok, false);
});

test('TC-OTP-07: asking again within 60 seconds is refused', async () => {
  const { opts, c } = setup();
  await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  c.advance(20);
  const r = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  assert.deepEqual(r, { ok: false, reason: 'cooldown', retryAfterSeconds: 40 });
});

test('TC-OTP-08: a new code replaces the old one', async () => {
  const { opts, c } = setup();
  const first = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  c.advance(61);
  const second = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  if (first.code !== second.code) {
    assert.equal((await verifyOtp({ email: 'ali@test.pk', purpose: S, code: first.code }, opts)).ok, false);
  }
  assert.equal((await verifyOtp({ email: 'ali@test.pk', purpose: S, code: second.code }, opts)).ok, true);
});

test('TC-OTP-09: a signup code cannot be used to reset a password', async () => {
  const { opts } = setup();
  const { code } = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  const r = await verifyOtp({ email: 'ali@test.pk', purpose: PURPOSE.PASSWORD_RESET, code }, opts);
  assert.equal(r.ok, false);
});

test('TC-OTP-10: garbage input is refused, not crashed', async () => {
  const { opts } = setup();
  await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  for (const bad of ['', '12345', '1234567', 'abcdef', null, undefined]) {
    assert.equal((await verifyOtp({ email: 'ali@test.pk', purpose: S, code: bad }, opts)).ok, false);
  }
  assert.deepEqual(await verifyOtp({ email: 'nobody@test.pk', purpose: S, code: '123456' }, opts), { ok: false, reason: 'invalid' });
});

test('TC-OTP-11: two fast clicks with the right code succeed only once', async () => {
  const { opts } = setup();
  const { code } = await createOtp({ email: 'ali@test.pk', purpose: S }, opts);
  const [a, b] = await Promise.all([
    verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts),
    verifyOtp({ email: 'ali@test.pk', purpose: S, code }, opts),
  ]);
  assert.equal([a, b].filter((r) => r.ok).length, 1);
});

test('unknown purpose is a programming error', async () => {
  const { opts } = setup();
  await assert.rejects(createOtp({ email: 'a@b.pk', purpose: 'LOGIN' }, opts), /Unknown OTP purpose/);
});
