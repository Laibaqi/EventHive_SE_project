// "Five wrong passwords locks the account for 15 minutes" (AUTH-02).
// Pure functions: take the user's numbers, return the new numbers to save.
// Uses User.failedLogins (Int, default 0) and User.lockedUntil (DateTime?).

const MAX_FAILURES = 5;
const LOCK_MINUTES = 15;

function lockStatus(user, now = new Date()) {
  if (user.lockedUntil && new Date(user.lockedUntil) > now) {
    const minutesLeft = Math.ceil((new Date(user.lockedUntil) - now) / 60000);
    return { locked: true, minutesLeft };
  }
  return { locked: false, minutesLeft: 0 };
}

// After a wrong password (only when not locked). The 5th failure locks and resets the
// counter, so after 15 minutes the user gets 5 fresh tries.
function afterFailure(user, now = new Date()) {
  const failures = (user.failedLogins ?? 0) + 1;
  if (failures >= MAX_FAILURES) {
    return { failedLogins: 0, lockedUntil: new Date(now.getTime() + LOCK_MINUTES * 60000) };
  }
  return { failedLogins: failures, lockedUntil: null };
}

// After a correct password. Zain also uses this to clear the lock after a reset.
function afterSuccess() {
  return { failedLogins: 0, lockedUntil: null };
}

module.exports = { MAX_FAILURES, LOCK_MINUTES, lockStatus, afterFailure, afterSuccess };
