// Shared by Laiba (signup/login/OTP verify) and Zain (forgot/reset/change password).
const express = require('express');
const router = express.Router();

const { authLimiter } = require('../middleware/rateLimit');
const { requireAuth, logout, me } = require('../middleware/auth');
const { HttpError } = require('../auth/errors');
const { login } = require('../auth/login');
const { register, verifyOtp, resendOtp } = require('../auth/signup');
const deps = require('../auth/deps');

// Runs an auth function and sends its { status, body }. An HttpError becomes
// { error, field } with its status; anything else goes to the 500 error handler.
const handle = (fn) => async (req, res, next) => {
  try {
    const { status, body } = await fn(req);
    res.status(status).json(body);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json(err.toJSON());
    next(err);
  }
};

// ---- Laiba: sign-up, OTP, login, logout, me ----
router.post('/register', handle((req) => register(req.body, deps)));
router.post('/verify-otp', authLimiter, handle((req) => verifyOtp(req.body, deps)));
router.post('/resend-otp', authLimiter, handle((req) => resendOtp(req.body, deps)));
router.post('/login', authLimiter, handle(async (req) => ({ status: 200, body: await login(req.body, deps) })));
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, me);

// ---- Zain: POST /forgot, /reset, /change-password go here ----
// Use authLimiter on forgot and reset; requireAuth on change-password.
// To end old sessions after a reset/change: await deps.endSessions(userId)
// To clear a login lock: deps.updateUser(userId, require('../auth/lockout').afterSuccess())

module.exports = router;
