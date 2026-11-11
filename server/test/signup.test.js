// Tests for card 3: sign-up with OTP (TC-AUTH-OTP-01 to 04).
// Alishah's OTP package and email are replaced by small fakes that behave the same way:
// 6-digit code, valid 10 minutes, 60-second wait before resending.
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { register, verifyOtp, resendOtp } = require('../src/auth/signup');
const { checkPassword } = require('../src/auth/password');

let users, emails, auditLog, clock, otps;

function fakeOtp() {
  return {
    PURPOSE: { SIGNUP_VERIFY: 'SIGNUP_VERIFY' },
    async createOtp({ email, purpose }) {
      const key = `${purpose}:${email}`;
      const last = otps[key];
      if (last && clock() - last.sentAt < 60_000) {
        return { ok: false, reason: 'COOLDOWN', waitSeconds: Math.ceil((60_000 - (clock() - last.sentAt)) / 1000) };
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      otps[key] = { code, sentAt: clock(), used: false };
      return { ok: true, code };
    },
    async verifyOtp({ email, purpose, code }) {
      const o = otps[`${purpose}:${email}`];
      if (!o || o.used) return { ok: false, reason: 'INVALID' };
      if (clock() - o.sentAt > 10 * 60_000) return { ok: false, reason: 'EXPIRED' };
      if (o.code !== code) return { ok: false, reason: 'WRONG' };
      o.used = true;
      return { ok: true };
    },
    otpMessage(r) {
      return {
        COOLDOWN: `Please wait ${r.waitSeconds} seconds before asking for a new code.`,
        EXPIRED: 'That code has expired. Ask for a new one.',
        WRONG: "That code isn't right. Check your email and try again.",
        INVALID: 'That code is not valid.',
      }[r.reason];
    },
  };
}

let now;
beforeEach(() => {
  users = [];
  emails = [];
  auditLog = [];
  otps = {};
  now = new Date('2026-11-11T10:00:00+05:00').getTime();
  clock = () => now;
});

const deps = {
  findUserByEmail: async (email) => users.find((u) => u.email === email) ?? null,
  createUser: async (data) => { const u = { id: users.length + 1, ...data }; users.push(u); return u; },
  updateUser: async (id, changes) => Object.assign(users.find((u) => u.id === id), changes),
  sendEmail: async (template, to, data) => { emails.push({ template, to, data }); },
  audit: async (...args) => auditLog.push(args),
  get otp() { return fakeOtp(); },
};

const signup = { name: 'Hira Khan', email: 'Hira@Example.com', password: 'secret123', role: 'ORGANIZER' };

async function rejects(promise) {
  try { await promise; } catch (e) { return e; }
  assert.fail('expected an error');
}

test('TC-AUTH-OTP-01: sign up -> OTP email arrives, account not verified yet', async () => {
  const r = await register(signup, deps);
  assert.equal(r.status, 201);
  assert.deepEqual(r.body, { message: 'Account created. We sent a 6-digit code to your email.', email: 'hira@example.com' });

  const user = users[0];
  assert.equal(user.emailVerifiedAt, null);
  assert.notEqual(user.passwordHash, 'secret123');
  assert.ok(await checkPassword('secret123', user.passwordHash));

  assert.equal(emails.length, 1);
  assert.equal(emails[0].template, 'otp');
  assert.equal(emails[0].to, 'hira@example.com');
  assert.match(emails[0].data.code, /^\d{6}$/);
  assert.equal(emails[0].data.minutes, 10);
});

test('sign-up rules still apply: Admin refused, duplicate email refused', async () => {
  const admin = await rejects(register({ ...signup, role: 'ADMIN' }, deps));
  assert.deepEqual(admin.toJSON(), { error: 'You can only sign up as an Attendee or an Organizer', field: 'role' });

  await register(signup, deps);
  const dup = await rejects(register({ ...signup, email: 'hira@example.com' }, deps));
  assert.equal(dup.status, 409);
  assert.equal(dup.field, 'email');
  assert.equal(users.length, 1);
});

test('TC-AUTH-OTP-02: the right code verifies the account', async () => {
  await register(signup, deps);
  const r = await verifyOtp({ email: 'hira@example.com', code: emails[0].data.code }, deps);
  assert.equal(r.status, 200);
  assert.equal(r.body.message, 'Email verified. You can log in now.');
  assert.ok(users[0].emailVerifiedAt instanceof Date);
  assert.ok(auditLog.some((a) => a[1] === 'EMAIL_VERIFIED'));
});

test('TC-AUTH-OTP-03: a wrong code gives a message on the code box and stays unverified', async () => {
  await register(signup, deps);
  const right = emails[0].data.code;
  const wrong = right === '111111' ? '222222' : '111111';
  const e = await rejects(verifyOtp({ email: 'hira@example.com', code: wrong }, deps));
  assert.equal(e.status, 400);
  assert.equal(e.field, 'code');
  assert.match(e.message, /isn't right/);
  assert.equal(users[0].emailVerifiedAt, null);
});

test('TC-AUTH-OTP-03: an expired code (after 10 minutes) is refused', async () => {
  await register(signup, deps);
  now += 11 * 60_000;
  const e = await rejects(verifyOtp({ email: 'hira@example.com', code: emails[0].data.code }, deps));
  assert.match(e.message, /expired/);
  assert.equal(users[0].emailVerifiedAt, null);
});

test('the code box only takes 6 digits', async () => {
  const e = await rejects(verifyOtp({ email: 'hira@example.com', code: '12ab' }, deps));
  assert.deepEqual(e.toJSON(), { error: 'Enter the 6-digit code from your email', field: 'code' });
});

test('TC-AUTH-OTP-04: resend within 60 seconds -> "Please wait…"', async () => {
  await register(signup, deps);
  now += 20_000;
  const e = await rejects(resendOtp({ email: 'hira@example.com' }, deps));
  assert.equal(e.status, 429);
  assert.match(e.message, /Please wait 40 seconds/);
  assert.equal(emails.length, 1);
});

test('resend after 60 seconds sends a new code that works', async () => {
  await register(signup, deps);
  now += 61_000;
  const r = await resendOtp({ email: 'hira@example.com' }, deps);
  assert.equal(r.status, 200);
  assert.equal(emails.length, 2);
  await verifyOtp({ email: 'hira@example.com', code: emails[1].data.code }, deps);
  assert.ok(users[0].emailVerifiedAt);
});

test('resend for an unknown email gives the same reply and sends nothing', async () => {
  await register(signup, deps);
  now += 61_000;
  const known = await resendOtp({ email: 'hira@example.com' }, deps);
  const unknown = await resendOtp({ email: 'nobody@example.com' }, deps);
  assert.deepEqual(unknown, known);
  assert.equal(emails.filter((m) => m.to === 'nobody@example.com').length, 0);
});
