// Sends one test OTP email.  Usage:  node try-email.js you@example.com
// With no SMTP settings it prints the email here. With SMTP settings (Mailtrap etc.) it really sends.
const { createOtp, PURPOSE } = require('../src/lib/otp');
const { memoryStore } = require('../src/lib/otpStores');
const { sendEmail } = require('../src/lib/email');

(async () => {
  const to = process.argv[2] || 'test@example.com';
  const otp = await createOtp({ email: to, purpose: PURPOSE.SIGNUP_VERIFY }, { store: memoryStore() });
  const result = await sendEmail('otp', to, { name: 'Test user', code: otp.code, purpose: 'verify your email', minutes: 10 });
  console.log(result.ok ? (result.dev ? 'Printed above (no SMTP set).' : `Sent to ${to}. Check your Mailtrap inbox.`) : `Failed: ${result.error}`);
})();
