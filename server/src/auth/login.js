// POST /api/auth/login: one login for every role (AUTH-02). Team brief, card 4.
// Database and audit are passed in as deps (see auth/deps.js), so tests can use fakes:
//   deps.findUserByEmail(email), deps.updateUser(id, changes), deps.audit(...)

const { HttpError } = require('./errors');
const { loginSchema, parseOrThrow } = require('./schemas');
const { checkPassword, wasteSameTime } = require('./password');
const { lockStatus, afterFailure, afterSuccess } = require('./lockout');
const { signSession } = require('./tokens');

const DASHBOARDS = {
  ATTENDEE: '/dashboard/attendee',
  ORGANIZER: '/dashboard/organizer',
  ADMIN: '/dashboard/admin',
};

// Same message for "no such email" and "wrong password".
const WRONG = () => new HttpError(401, 'Email or password is incorrect');

// What the browser may see about a user. Never the password hash.
function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    emailVerified: Boolean(user.emailVerifiedAt),
  };
}

const action = (deps, name) => (deps.ACTIONS && deps.ACTIONS[name]) || name;

async function login(body, deps, now = new Date()) {
  const audit = deps.audit || (async () => {});
  const { email, password } = parseOrThrow(loginSchema, body);

  const user = await deps.findUserByEmail(email);
  if (!user) {
    await wasteSameTime(password);
    await audit(null, action(deps, 'LOGIN_FAILED'), 'User', null, { email, reason: 'unknown email' });
    throw WRONG();
  }

  const lock = lockStatus(user, now);
  if (lock.locked) {
    await audit(user.id, action(deps, 'LOGIN_FAILED'), 'User', user.id, { reason: 'locked' });
    const unit = lock.minutesLeft === 1 ? 'minute' : 'minutes';
    throw new HttpError(423, `Too many failed attempts. Try again in ${lock.minutesLeft} ${unit}.`);
  }

  const correct = await checkPassword(password, user.passwordHash);
  if (!correct) {
    const changes = afterFailure(user, now);
    await deps.updateUser(user.id, changes);
    await audit(user.id, action(deps, 'LOGIN_FAILED'), 'User', user.id, { locked: Boolean(changes.lockedUntil) });
    throw WRONG();
  }

  await deps.updateUser(user.id, afterSuccess());
  await audit(user.id, action(deps, 'LOGIN'), 'User', user.id, {});

  // Unverified users CAN log in (AUTH-05); requireVerified stops them creating events.
  return {
    token: signSession(user),
    user: publicUser(user),
    dashboard: DASHBOARDS[user.role] || '/dashboard/attendee',
  };
}

module.exports = { DASHBOARDS, publicUser, login };
