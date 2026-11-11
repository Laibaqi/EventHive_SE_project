// Login checks for protected routes (AUTH-07). Team brief, card 2.
//
//   401 = we don't know who you are (no token, bad token, expired, logged out)
//   403 = we know who you are, but you're not allowed to do this
//
// Ushna / Zain usage:
//   const { requireAuth, requireRole, requireVerified } = require('../middleware/auth');
//   router.post('/', requireAuth, requireRole('ORGANIZER'), requireVerified, createEvent);
//
// After requireAuth: req.user = { id, role, emailVerified }

const { HttpError } = require('../auth/errors');
const { verifySession } = require('../auth/tokens');
const { publicUser } = require('../auth/login');

const send = (res, err) => res.status(err.status).json(err.toJSON());
const pleaseLogIn = () => new HttpError(401, 'Please log in');

// createAuth is used directly by the tests (with fake loadUser / endSessions).
function createAuth({ loadUser, endSessions }) {
  async function requireAuth(req, res, next) {
    const header = (req.headers && req.headers.authorization) || '';
    const match = /^Bearer (.+)$/.exec(header);
    if (!match) return send(res, pleaseLogIn());

    const result = verifySession(match[1]);
    if (!result.ok) {
      return result.reason === 'expired'
        ? send(res, new HttpError(401, 'Your session has expired. Please log in again.'))
        : send(res, pleaseLogIn());
    }

    try {
      const user = await loadUser(result.payload.uid);
      // tokenVersion changed = logged out or password reset since this token was made.
      if (!user || (user.tokenVersion ?? 0) !== result.payload.tv) return send(res, pleaseLogIn());
      req.user = { id: user.id, role: user.role, emailVerified: Boolean(user.emailVerifiedAt) };
      return next();
    } catch (err) {
      return next(err);
    }
  }

  function requireRole(...roles) {
    return function roleCheck(req, res, next) {
      if (!req.user) return send(res, pleaseLogIn());
      if (!roles.includes(req.user.role)) return send(res, new HttpError(403, "You don't have access to this page"));
      return next();
    };
  }

  function requireVerified(req, res, next) {
    if (!req.user) return send(res, pleaseLogIn());
    if (!req.user.emailVerified) return send(res, new HttpError(403, 'Please verify your email first'));
    return next();
  }

  // POST /api/auth/logout: ends every session of this user.
  async function logout(req, res, next) {
    try {
      await endSessions(req.user.id);
      return res.status(204).end();
    } catch (err) {
      return next(err);
    }
  }

  // GET /api/auth/me: the logged-in user, for Hamza's AuthContext.
  async function me(req, res, next) {
    try {
      const user = await loadUser(req.user.id);
      if (!user) return send(res, pleaseLogIn());
      return res.json({ user: publicUser(user) });
    } catch (err) {
      return next(err);
    }
  }

  return { requireAuth, requireRole, requireVerified, logout, me };
}

// The real ones, using the database. deps.js is loaded on first use so tests
// that only use createAuth never touch Prisma.
const live = createAuth({
  loadUser: (id) => require('../auth/deps').findUserById(id),
  endSessions: (id) => require('../auth/deps').endSessions(id),
});

module.exports = { createAuth, ...live };
