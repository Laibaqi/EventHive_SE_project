// Sign-up with a 6-digit OTP (AUTH-05, AUTH-03). Team brief, card 3.
// Each function returns { status, body }. Deps (see auth/deps.js):
//   findUserByEmail, createUser, updateUser                 (Prisma)
//   otp = { createOtp, verifyOtp, otpMessage, PURPOSE }      (Alishah)
//   sendEmail(template, to, data), audit(...), ACTIONS       (Alishah)
//
// CHECK AGAINST ALISHAH'S README: assumes createOtp() / verifyOtp() return { ok, ... }
// and createOtp() gives `code`. If her names differ, change only the "OTP RESULT" lines.

const { z } = require('zod');
const { HttpError } = require('./errors');
const { registerSchema, parseOrThrow } = require('./schemas');
const { hashPassword } = require('./password');

const OTP_MINUTES = 10;

const emailField = z.string({ error: 'Enter your email' }).trim().toLowerCase().min(1, 'Enter your email').max(254);
const emailOnly = z.object({ email: emailField });
const verifyBody = z.object({
  email: emailField,
  code: z.string({ error: 'Enter the 6-digit code' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

const action = (deps, name) => (deps.ACTIONS && deps.ACTIONS[name]) || name;

async function sendCode(deps, user) {
  const { createOtp, PURPOSE } = deps.otp;
  const result = await createOtp({ email: user.email, purpose: PURPOSE.SIGNUP_VERIFY, userId: user.id });
  if (!result.ok) return result; // OTP RESULT: e.g. asked again within 60 seconds
  await deps.sendEmail('otp', user.email, {
    name: user.name,
    code: result.code, // OTP RESULT
    purpose: 'verify your email',
    minutes: OTP_MINUTES,
  });
  return result;
}

// POST /api/auth/register  { name, email, password, phone?, role }
async function register(body, deps) {
  const audit = deps.audit || (async () => {});
  const data = parseOrThrow(registerSchema, body);

  // Don't create an account we can't send a code to (Alishah's lib not merged yet).
  if (deps.otpReady === false) {
    throw new HttpError(503, "Email codes aren't set up yet. Please try again later.", null);
  }

  if (await deps.findUserByEmail(data.email)) {
    throw new HttpError(409, 'An account with this email already exists. Try logging in.', 'email');
  }

  const user = await deps.createUser({
    name: data.name,
    email: data.email,
    passwordHash: await hashPassword(data.password),
    phone: data.phone || null,
    role: data.role,
    emailVerifiedAt: null,
  });
  await audit(user.id, action(deps, 'USER_REGISTERED'), 'User', user.id, { role: user.role });

  await sendCode(deps, user);

  return {
    status: 201,
    body: { message: 'Account created. We sent a 6-digit code to your email.', email: user.email },
  };
}

// POST /api/auth/verify-otp  { email, code }
async function verifyOtp(body, deps, now = new Date()) {
  const audit = deps.audit || (async () => {});
  const { email, code } = parseOrThrow(verifyBody, body);

  const user = await deps.findUserByEmail(email);
  if (user && user.emailVerifiedAt) {
    return { status: 200, body: { message: 'Email already verified. You can log in now.' } };
  }

  const { verifyOtp: check, otpMessage, PURPOSE } = deps.otp;
  const result = await check({ email, purpose: PURPOSE.SIGNUP_VERIFY, code });
  if (!user || !result.ok) {
    // OTP RESULT: wrong code, expired code, too many tries
    throw new HttpError(400, user ? otpMessage(result) : 'That code is not valid.', 'code');
  }

  await deps.updateUser(user.id, { emailVerifiedAt: now });
  await audit(user.id, action(deps, 'EMAIL_VERIFIED'), 'User', user.id, {});

  return { status: 200, body: { message: 'Email verified. You can log in now.' } };
}

// POST /api/auth/resend-otp  { email }
// Unknown and already-verified emails get the same reply as everyone else.
async function resendOtp(body, deps) {
  const { email } = parseOrThrow(emailOnly, body);
  const sameReply = { status: 200, body: { message: 'If that account needs verifying, we sent a new code.' } };

  const user = await deps.findUserByEmail(email);
  if (!user || user.emailVerifiedAt) return sameReply;

  const result = await sendCode(deps, user);
  if (!result.ok) {
    // OTP RESULT: "Please wait N seconds…"
    throw new HttpError(429, deps.otp.otpMessage(result), null);
  }
  return sameReply;
}

module.exports = { register, verifyOtp, resendOtp };
