// Tests for AUTH-05 / AUTH-03 input rules.  Run: npm test
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { registerSchema, loginSchema, parseOrThrow } = require('../src/auth/schemas');
const { HttpError } = require('../src/auth/errors');

const good = { name: 'Ali Ahmed', email: 'Ali@Example.com ', password: 'secret123', role: 'ATTENDEE' };

function errorOf(data) {
  try {
    parseOrThrow(registerSchema, data);
  } catch (e) {
    assert.ok(e instanceof HttpError);
    assert.equal(e.status, 400);
    return e;
  }
  assert.fail('expected the input to be rejected');
}

test('a valid sign-up passes and the email is cleaned up', () => {
  const out = parseOrThrow(registerSchema, good);
  assert.equal(out.email, 'ali@example.com');
  assert.equal(out.phone, undefined);
});

test('AUTH-03: signing up as MAYOR or ADMIN is refused', () => {
  for (const role of ['MAYOR', 'ADMIN', 'mayor', '']) {
    const e = errorOf({ ...good, role });
    assert.equal(e.field, 'role');
  }
});

test('Organizer sign-up is allowed', () => {
  assert.equal(parseOrThrow(registerSchema, { ...good, role: 'ORGANIZER' }).role, 'ORGANIZER');
});

test('password needs 8+ characters, a letter and a digit', () => {
  assert.match(errorOf({ ...good, password: 'abc123' }).message, /at least 8/);
  assert.match(errorOf({ ...good, password: 'abcdefgh' }).message, /digit/);
  assert.match(errorOf({ ...good, password: '12345678' }).message, /letter/);
  assert.equal(errorOf({ ...good, password: 'abcdefgh' }).field, 'password');
});

test('name must be 2 to 80 characters', () => {
  assert.equal(errorOf({ ...good, name: 'A' }).field, 'name');
  assert.equal(errorOf({ ...good, name: 'A'.repeat(81) }).field, 'name');
});

test('email must be valid', () => {
  assert.equal(errorOf({ ...good, email: 'not-an-email' }).field, 'email');
});

test('Pakistani mobile numbers are accepted and saved as +92...', () => {
  for (const phone of ['03001234567', '0300 1234567', '+92 300 1234567', '0300-1234567']) {
    assert.equal(parseOrThrow(registerSchema, { ...good, phone }).phone, '+923001234567');
  }
  assert.equal(parseOrThrow(registerSchema, { ...good, phone: '' }).phone, undefined);
});

test('non-mobile or wrong-length numbers are refused', () => {
  for (const phone of ['0213456789', '0300123456', '+1 555 1234567', 'abc']) {
    assert.equal(errorOf({ ...good, phone }).field, 'phone');
  }
});

test('missing fields name the field', () => {
  assert.equal(errorOf({}).field, 'name');
});

test('login needs both email and password', () => {
  assert.throws(() => parseOrThrow(loginSchema, { email: 'a@b.com' }), (e) => e.field === 'password');
  assert.throws(() => parseOrThrow(loginSchema, { password: 'x' }), (e) => e.field === 'email');
});
