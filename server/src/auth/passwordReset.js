// Forgot, reset and change password (AUTH-06). Zain, Sprint 1 brief sections 3-5.
// Each function returns { status, body } or throws HttpError, like Laiba's signup.js.
// Deps (see auth/deps.js): findUserByEmail, findUserById, updateUser, endSessions,
//   otp = { createOtp, verifyOtp, otpMessage, PURPOSE }, sendEmail, audit, ACTIONS (Alishah).

const { z } = require('zod');
const { HttpError } = require('./errors');
const { password: passwordRule, parseOrThrow } = require('./schemas');
const { hashPassword, checkPassword } = require('./password');
const { afterSuccess } = require('./lockout');
const { signSession } = require('./tokens');

const OTP_MINUTES = 10;

const emailField = z.string({ error: 'Enter your email' }).trim().toLowerCase().min(1, 'Enter your email').max(254);

const forgotSchema = z.object({ email: emailField });

// newPassword is checked BEFORE the code, so a weak password never uses up a code.
const resetSchema = z.object({
  email: emailField,
  newPassword: passwordRule,
  code: z.string({ error: 'Enter the 6-digit code' }).trim().regex(/^\d{6}$/, 'Enter the 6-digit code from your email'),
});

const changeSchema = z.object({
  currentPassword: z.string({ error: 'Enter your current password' }).min(1, 'Enter your current password').max(1000),
  newPassword: passwordRule,
});

const action = (deps, name) => (deps.ACTIONS && deps.ACTIONS[name]) || name;

// POST /api/auth/forgot  { email }
// Same reply for every email, so nobody can find out who has an account.
async function forgot(body, deps) {
  const audit = deps.audit || (async () => {});
  const { email } = parseOrThrow(forgotSchema, body);
  const sameReply = { status: 200, body: { message: 'If an account exists, we sent a code' } };

  if (deps.otpReady === false) {
    throw new HttpError(503, "Email codes aren't set up yet. Please try again later.", null);
  }

  const user = await deps.findUserByEmail(email);
  if (!user) return sameReply;

  const { createOtp, PURPOSE } = deps.otp;
  const result = await createOtp({ email: user.email, purpose: PURPOSE.PASSWORD_RESET, userId: user.id });
  if (!result.ok) return sameReply; // asked again within 60 seconds: still the same reply

  // Not awaited: a real SMTP send is slow, and waiting would make "account exists"
  // replies slower than "no such account" replies.
  Promise.resolve(
    deps.sendEmail('otp', user.email, {
      name: user.name,
      code: result.code,
      purpose: 'reset your password',
      minutes: OTP_MINUTES,
    })
  ).catch((err) => console.error('[forgot] could not send email:', err.message));

  await audit(user.id, action(deps, 'PASSWORD_RESET_REQUEST'), 'User', user.id, {});
  return sameReply;
}

// POST /api/auth/reset  { email, code, newPassword }
async function reset(body, deps) {
  const audit = deps.audit || (async () => {});
  const { email, code, newPassword } = parseOrThrow(resetSchema, body);

  const { verifyOtp, otpMessage, PURPOSE } = deps.otp;
  const result = await verifyOtp({ email, purpose: PURPOSE.PASSWORD_RESET, code });
  if (!result.ok) throw new HttpError(400, otpMessage(result), 'code');

  const user = await deps.findUserByEmail(email);
  if (!user) throw new HttpError(400, 'That code is not valid.', 'code');

  // New hash + clear any login lock, then end every old session.
  await deps.updateUser(user.id, { passwordHash: await hashPassword(newPassword), ...afterSuccess() });
  await deps.endSessions(user.id);
  await audit(user.id, action(deps, 'PASSWORD_RESET'), 'User', user.id, {});

  return { status: 200, body: { message: 'Password changed' } };
}

// POST /api/auth/change-password  { currentPassword, newPassword }  (logged in)
// Ends all older sessions but hands back a fresh token so THIS session stays logged in.
async function changePassword(userId, body, deps) {
  const audit = deps.audit || (async () => {});
  const { currentPassword, newPassword } = parseOrThrow(changeSchema, body);

  const user = await deps.findUserById(userId);
  if (!user) throw new HttpError(401, 'Please log in');

  if (!(await checkPassword(currentPassword, user.passwordHash))) {
    throw new HttpError(400, 'Current password is wrong', 'currentPassword');
  }
  if (newPassword === currentPassword) {
    throw new HttpError(400, 'New password must be different from your current password', 'newPassword');
  }

  await deps.updateUser(user.id, { passwordHash: await hashPassword(newPassword), ...afterSuccess() });
  const updated = await deps.endSessions(user.id); // Prisma returns the user with the new tokenVersion
  await audit(user.id, action(deps, 'PASSWORD_CHANGE'), 'User', user.id, {});

  return { status: 200, body: { message: 'Password changed', token: signSession(updated) } };
}

module.exports = { forgot, reset, changePassword };
