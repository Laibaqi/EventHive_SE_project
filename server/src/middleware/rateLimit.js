const rateLimit = require('express-rate-limit');

// 10 requests per 15 minutes per IP.
// Apply to: login, forgot, reset, verify OTP, resend OTP.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: 'Too many tries. Please wait and try again.', field: null }),
});

module.exports = { authLimiter };
