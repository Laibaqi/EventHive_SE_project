const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

// Two layers, applied together as one middleware (use it exactly as before: router.post('/x', authLimiter, ...)).
//
//  1. Per IP + email: 10 requests per 15 minutes. Each account gets its own tries, so people on the
//     same Wi-Fi (team testing, the whole class at the demo) don't lock each other out, and one
//     account still can't be hammered.
//  2. Per IP only: 100 requests per 15 minutes, as a safety net. Without it, someone could change
//     the email on every request and never hit layer 1 (password guessing across many accounts,
//     or making us send thousands of OTP emails to different addresses).
//
// Apply to: login, forgot, reset, verify OTP, resend OTP, change password.
const WINDOW_MS = 15 * 60 * 1000;
const PER_ACCOUNT_LIMIT = 10;
const PER_IP_LIMIT = 100; // roomy enough for a classroom sharing one IP

const tooMany = (req, res) =>
  res.status(429).json({ error: 'Too many tries. Please wait and try again.', field: null });

const emailOf = (req) =>
  typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';

// A factory so tests can get fresh counters; the app uses the single authLimiter below.
function createAuthLimiter() {
  const perIp = rateLimit({
    windowMs: WINDOW_MS,
    limit: PER_IP_LIMIT,
    standardHeaders: false,
    legacyHeaders: false,
    keyGenerator: (req) => ipKeyGenerator(req.ip),
    handler: tooMany,
  });

  const perIpAndEmail = rateLimit({
    windowMs: WINDOW_MS,
    limit: PER_ACCOUNT_LIMIT,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}|${emailOf(req)}`,
    handler: tooMany,
  });

  return (req, res, next) => perIp(req, res, (err) => (err ? next(err) : perIpAndEmail(req, res, next)));
}

const authLimiter = createAuthLimiter();

module.exports = { authLimiter, createAuthLimiter };
