// OTP (one-time code) for EventHive — sir's Sprint 1 "Login/Signup/Forget password/OTP".
//
// A 6-digit code is emailed to the user. We store only an HMAC of the code (never the code),
// it expires after 10 minutes, works once, and 5 wrong tries kill it. A new code replaces any
// older one, and a user can ask for a new code at most once every 60 seconds.
//
// Laiba (signup):      const r = await createOtp({ email, purpose: PURPOSE.SIGNUP_VERIFY, userId: user.id });
//                      if (r.ok) await sendEmail('otp', email, { name, code: r.code, purpose: 'verify your email', minutes: 10 });
//                      ...later  const v = await verifyOtp({ email, purpose: PURPOSE.SIGNUP_VERIFY, code: req.body.code });
//                      if (v.ok) -> set user.emailVerifiedAt = now
// Zain (forgot pass):  createOtp({ email, purpose: PURPOSE.PASSWORD_RESET, userId }) then
//                      verifyOtp({ email, purpose: PURPOSE.PASSWORD_RESET, code }) before saving the new password
const crypto = require('crypto');

const PURPOSE = Object.freeze({
  SIGNUP_VERIFY: 'SIGNUP_VERIFY',
  PASSWORD_RESET: 'PASSWORD_RESET',
});

const SETTINGS = Object.freeze({
  digits: 6,
  ttlMinutes: 10,
  maxAttempts: 5,
  resendCooldownSeconds: 60,
});

const normEmail = (email) => String(email || '').trim().toLowerCase();

function secret() {
  const s = process.env.OTP_SECRET || process.env.JWT_SECRET;
  if (!s) {
    if (process.env.NODE_ENV === 'production') throw new Error('OTP_SECRET (or JWT_SECRET) must be set');
    return 'dev-only-otp-secret';
  }
  return s;
}

// HMAC with a server secret: a 6-digit code has only 1,000,000 values, so a plain hash could be
// reversed in seconds if the database leaked. With the secret it cannot.
function hashCode(email, purpose, code) {
  return crypto.createHmac('sha256', secret()).update(`${normEmail(email)}|${purpose}|${code}`).digest('hex');
}

function generateCode() {
  return String(crypto.randomInt(0, 10 ** SETTINGS.digits)).padStart(SETTINGS.digits, '0');
}

function safeEqual(a, b) {
  const x = Buffer.from(a, 'hex');
  const y = Buffer.from(b, 'hex');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function assertPurpose(purpose) {
  if (!Object.values(PURPOSE).includes(purpose)) throw new Error(`Unknown OTP purpose: ${purpose}`);
}

/**
 * Make a new code and save its hash. Returns the PLAIN code so the caller can email it.
 * @returns {Promise<{ok:true, code:string, expiresAt:Date} | {ok:false, reason:'cooldown', retryAfterSeconds:number}>}
 */
async function createOtp({ email, purpose, userId = null }, { store = defaultStore(), now = () => new Date() } = {}) {
  assertPurpose(purpose);
  const e = normEmail(email);
  if (!e) throw new Error('email is required');
  const t = now();

  const last = await store.findLatest(e, purpose);
  if (last) {
    const ageSec = (t - new Date(last.createdAt)) / 1000;
    if (ageSec < SETTINGS.resendCooldownSeconds) {
      return { ok: false, reason: 'cooldown', retryAfterSeconds: Math.ceil(SETTINGS.resendCooldownSeconds - ageSec) };
    }
  }

  await store.invalidateActive(e, purpose, t); // only the newest code works
  const code = generateCode();
  const expiresAt = new Date(t.getTime() + SETTINGS.ttlMinutes * 60 * 1000);
  await store.create({ email: e, purpose, userId, codeHash: hashCode(e, purpose, code), expiresAt, attempts: 0, usedAt: null, createdAt: t });
  return { ok: true, code, expiresAt };
}

/**
 * Check a code the user typed. Works once.
 * @returns {Promise<{ok:true, userId:number|null} | {ok:false, reason:'invalid'|'expired'|'too_many_attempts', attemptsLeft?:number}>}
 */
async function verifyOtp({ email, purpose, code }, { store = defaultStore(), now = () => new Date() } = {}) {
  assertPurpose(purpose);
  const e = normEmail(email);
  const typed = String(code ?? '').trim();
  const t = now();

  const row = await store.findActive(e, purpose);
  if (!row) return { ok: false, reason: 'invalid' };
  if (new Date(row.expiresAt) <= t) return { ok: false, reason: 'expired' };
  if (row.attempts >= SETTINGS.maxAttempts) return { ok: false, reason: 'too_many_attempts' };

  const pattern = new RegExp(`^\\d{${SETTINGS.digits}}$`);
  const matches = pattern.test(typed) && safeEqual(hashCode(e, purpose, typed), row.codeHash);

  if (!matches) {
    const attempts = await store.incrementAttempts(row.id);
    if (attempts >= SETTINGS.maxAttempts) {
      await store.markUsed(row.id, t); // dead: user must request a new code
      return { ok: false, reason: 'too_many_attempts' };
    }
    return { ok: false, reason: 'invalid', attemptsLeft: SETTINGS.maxAttempts - attempts };
  }

  // Mark used only if still unused, so two fast clicks can't both succeed.
  const won = await store.markUsed(row.id, t);
  if (!won) return { ok: false, reason: 'invalid' };
  return { ok: true, userId: row.userId ?? null };
}

/** Friendly message for each failure reason, for the screen. */
function otpMessage(result) {
  if (result.ok) return 'Code accepted';
  switch (result.reason) {
    case 'cooldown': return `Please wait ${result.retryAfterSeconds} seconds before asking for a new code`;
    case 'expired': return 'This code has expired. Ask for a new one.';
    case 'too_many_attempts': return 'Too many wrong tries. Ask for a new code.';
    default: return result.attemptsLeft != null
      ? `Wrong code. ${result.attemptsLeft} ${result.attemptsLeft === 1 ? 'try' : 'tries'} left.`
      : 'This code is not valid. Ask for a new one.';
  }
}

let _default;
function defaultStore() {
  if (!_default) _default = require('./otpStores').prismaStore(require('./prisma'));
  return _default;
}

module.exports = { createOtp, verifyOtp, otpMessage, PURPOSE, SETTINGS, hashCode, generateCode };
