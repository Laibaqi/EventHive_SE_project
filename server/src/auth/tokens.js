// The login token (JWT): HS256, 60 minutes, holds { uid, role, tv } only.
// tv = token version. Logout and password reset add 1 to the user's tokenVersion,
// so every older token stops working (checked in middleware/auth.js).

const jwt = require('jsonwebtoken');

const SESSION_MINUTES = 60;

function secret() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET is missing or too short. Set it in .env (32+ characters).');
  }
  return s;
}

function signSession(user) {
  return jwt.sign({ uid: user.id, role: user.role, tv: user.tokenVersion ?? 0 }, secret(), {
    algorithm: 'HS256',
    expiresIn: SESSION_MINUTES * 60,
  });
}

// Returns { ok: true, payload } or { ok: false, reason: 'expired' | 'invalid' }.
function verifySession(token) {
  try {
    return { ok: true, payload: jwt.verify(token, secret(), { algorithms: ['HS256'] }) };
  } catch (err) {
    return { ok: false, reason: err.name === 'TokenExpiredError' ? 'expired' : 'invalid' };
  }
}

module.exports = { SESSION_MINUTES, signSession, verifySession };
