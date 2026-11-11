// Shared by Laiba (signup/login/OTP verify) and Zain (forgot/reset/change password).
const express = require('express');
const router = express.Router();

// Zain: POST /forgot, /reset, /change-password go here
// Laiba: POST /signup, /login, /verify-otp, /resend-otp go here
// Remember: add authLimiter from ../middleware/rateLimit to login, forgot, reset, verify, resend

module.exports = router;
