// The real "deps" for the auth functions: Zain's shared Prisma client + Alishah's package.
// Tests don't load this file; they pass in fakes instead.
//
// Alishah's package goes in server/src/lib/ (her PR, alishah/otp). Until it is merged,
// the server still starts: login works, audit is skipped, and sign-up/OTP routes
// reply 503 "Email codes aren't set up yet".

const { HttpError } = require('./errors');

function optional(path) {
  try {
    return require(path);
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes(path.replace('../', ''))) return null;
    throw err;
  }
}

// CHECK when Alishah's PR is merged: file names and export names in server/src/lib/.
const otpLib = optional('../lib/otp');
const emailLib = optional('../lib/email');
const auditLib = optional('../lib/audit');

if (!otpLib || !emailLib) console.warn('[auth] Alishah\'s OTP/email lib not found yet: sign-up and OTP routes reply 503.');
if (!auditLib) console.warn('[auth] audit() not found yet: auth actions are not logged.');

const notReady = () => {
  throw new HttpError(503, "Email codes aren't set up yet. Please try again later.", null);
};

const prisma = () => require('../lib/prisma');

module.exports = {
  findUserByEmail: (email) => prisma().user.findUnique({ where: { email } }),
  findUserById: (id) => prisma().user.findUnique({ where: { id } }),
  createUser: (data) => prisma().user.create({ data }),
  updateUser: (id, data) => prisma().user.update({ where: { id }, data }),
  // Ends every session of a user (logout, and Zain's reset / change password).
  endSessions: (id) => prisma().user.update({ where: { id }, data: { tokenVersion: { increment: 1 } } }),

  otpReady: Boolean(otpLib && emailLib),
  otp: otpLib
    ? { createOtp: otpLib.createOtp, verifyOtp: otpLib.verifyOtp, otpMessage: otpLib.otpMessage, PURPOSE: otpLib.PURPOSE }
    : { createOtp: notReady, verifyOtp: notReady, otpMessage: () => '', PURPOSE: { SIGNUP_VERIFY: 'SIGNUP_VERIFY' } },
  sendEmail: emailLib ? emailLib.sendEmail : notReady,
  audit: auditLib ? auditLib.audit : async () => {},
  ACTIONS: (auditLib && auditLib.ACTIONS) || {},
};
