// Tests for the AUTH-02 lock rule: 5 failures -> locked for 15 minutes.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { lockStatus, afterFailure, afterSuccess, LOCK_MINUTES } = require('../src/auth/lockout');

const t0 = new Date('2026-11-03T10:00:00+05:00');
const minutes = (n) => new Date(t0.getTime() + n * 60000);

test('4 failures do not lock', () => {
  let user = { failedLogins: 0, lockedUntil: null };
  for (let i = 0; i < 4; i++) user = { ...user, ...afterFailure(user, t0) };
  assert.equal(user.failedLogins, 4);
  assert.equal(lockStatus(user, t0).locked, false);
});

test('the 5th failure locks for 15 minutes', () => {
  const user = { failedLogins: 4, lockedUntil: null };
  const changes = afterFailure(user, t0);
  assert.equal(changes.lockedUntil.getTime(), minutes(LOCK_MINUTES).getTime());
  const locked = { ...user, ...changes };
  assert.deepEqual(lockStatus(locked, minutes(0)), { locked: true, minutesLeft: 15 });
  assert.deepEqual(lockStatus(locked, minutes(14.5)), { locked: true, minutesLeft: 1 });
});

test('after 15 minutes the account opens again with 5 fresh tries', () => {
  const locked = { failedLogins: 0, lockedUntil: minutes(15) };
  assert.equal(lockStatus(locked, minutes(15)).locked, false);
  assert.equal(afterFailure(locked, minutes(16)).failedLogins, 1);
});

test('a correct password resets the counter', () => {
  assert.deepEqual(afterSuccess(), { failedLogins: 0, lockedUntil: null });
});
