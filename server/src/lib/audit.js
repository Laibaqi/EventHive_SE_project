// AUDT-01 / BR-22 — append-only audit log.
// Usage: await audit(req.user.id, ACTIONS.EVENT_SUBMIT, 'Event', event.id, { title: event.title });
// Inside a Prisma transaction pass the tx client as the 6th argument so the log row commits with the change.

const ACTIONS = Object.freeze({
  // Laiba
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  REGISTER: 'REGISTER',
  USER_REGISTERED: 'USER_REGISTERED', // name Laiba's signup uses
  EMAIL_VERIFIED: 'EMAIL_VERIFIED',
  OTP_SENT: 'OTP_SENT',
  OTP_FAILED: 'OTP_FAILED', // 5 wrong tries
  MAYOR_APPROVE: 'MAYOR_APPROVE',
  MAYOR_REJECT: 'MAYOR_REJECT',
  EVENT_AUTO_REJECT: 'EVENT_AUTO_REJECT', // "Start time passed" (APPR-04)
  EVENT_PUBLISHED: 'EVENT_PUBLISHED',
  // Zain
  PASSWORD_RESET_REQUEST: 'PASSWORD_RESET_REQUEST',
  PASSWORD_RESET: 'PASSWORD_RESET',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',
  // Ushna
  EVENT_CREATE: 'EVENT_CREATE',
  EVENT_EDIT: 'EVENT_EDIT',
  EVENT_SUBMIT: 'EVENT_SUBMIT',
  EVENT_RESUBMIT: 'EVENT_RESUBMIT',
  VENUE_CREATE: 'VENUE_CREATE',
  // Huzaifa
  VENUE_REQUEST_SENT: 'VENUE_REQUEST_SENT',
  VENUE_APPROVE: 'VENUE_APPROVE',
  VENUE_DECLINE: 'VENUE_DECLINE',
  // Hamza (Admin)
  ADMIN_CITY_CREATE: 'ADMIN_CITY_CREATE',
  ADMIN_CITY_UPDATE: 'ADMIN_CITY_UPDATE',
  ADMIN_MAYOR_CREATE: 'ADMIN_MAYOR_CREATE',
  ADMIN_MAYOR_UPDATE: 'ADMIN_MAYOR_UPDATE',
  ADMIN_DOMAIN_CREATE: 'ADMIN_DOMAIN_CREATE',
  ADMIN_DOMAIN_DELETE: 'ADMIN_DOMAIN_DELETE',
  // Alishah (Admin)
  ADMIN_GENRE_CREATE: 'ADMIN_GENRE_CREATE',
  ADMIN_GENRE_RENAME: 'ADMIN_GENRE_RENAME',
  ADMIN_GENRE_RETIRE: 'ADMIN_GENRE_RETIRE',
  ADMIN_GENRE_RESTORE: 'ADMIN_GENRE_RESTORE',
  ADMIN_GENRE_DELETE: 'ADMIN_GENRE_DELETE',
  ADMIN_TAG_CREATE: 'ADMIN_TAG_CREATE',
  ADMIN_TAG_RENAME: 'ADMIN_TAG_RENAME',
  ADMIN_TAG_RETIRE: 'ADMIN_TAG_RETIRE',
  ADMIN_TAG_RESTORE: 'ADMIN_TAG_RESTORE',
  ADMIN_TAG_DELETE: 'ADMIN_TAG_DELETE',
  // System
  EMAIL_FAILED: 'EMAIL_FAILED', // NFR-08: final failure after retries, visible to Admins
});

const VALID = new Set(Object.values(ACTIONS));
const SECRET_KEYS = /pass(word)?|token|secret|hash/i; // NFR-10: never log secrets

function scrub(details) {
  if (details == null || typeof details !== 'object') return details ?? undefined;
  const out = Array.isArray(details) ? [] : {};
  for (const [k, v] of Object.entries(details)) {
    if (SECRET_KEYS.test(k)) continue;
    out[k] = v && typeof v === 'object' ? scrub(v) : v;
  }
  return out;
}

/**
 * Write one audit row. Never updates or deletes (a DB trigger blocks that too).
 * @param {number|null} actorId  user id, or null for the system / a venue contact
 * @param {string} action        one of ACTIONS
 * @param {string|null} targetType e.g. 'Event', 'User', 'Genre'
 * @param {string|number|null} targetId
 * @param {object|null} details  small JSON; secrets are stripped
 * @param {object} [db]          prisma or a transaction client
 */
async function audit(actorId, action, targetType = null, targetId = null, details = null, db = require('./prisma')) {
  if (!VALID.has(action)) throw new Error(`Unknown audit action: ${action}`);
  return db.auditLog.create({
    data: {
      actorId: actorId ?? null,
      action,
      targetType,
      targetId: targetId == null ? null : String(targetId),
      details: scrub(details),
    },
  });
}

module.exports = { audit, ACTIONS };
