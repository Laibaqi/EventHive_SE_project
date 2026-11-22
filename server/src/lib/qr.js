// Signed ticket tokens for QR codes (TCKT-02, NFR-13). Laiba.
//
// The QR code on a ticket holds a short text token:
//
//   EH1.<ticketId>.<eventId>.<signature>
//
// signature = HMAC-SHA256 of "EH1.<ticketId>.<eventId>" with QR_SECRET (base64url).
// Change one digit of the ticket or event id and the signature no longer matches,
// so a QR code can't be faked or edited. Only the server knows QR_SECRET.
//
// The token itself never expires. Whether the ticket can still be used (paid, not used,
// event not cancelled, right day) is checked in the database by the check-in code (Ushna).
//
// Usage:
//   const { signTicket, verifyTicket } = require('../lib/qr');
//
//   // Huzaifa, when a ticket is confirmed:
//   const qrToken = signTicket({ ticketId: ticket.id, eventId: ticket.eventId });
//
//   // Ushna, on scan (pass the event being checked in, so another event's ticket is refused):
//   const result = verifyTicket(scannedText, { eventId: 7 });
//   if (!result.ok) -> show red with qrMessage(result)
//   else            -> look up result.ticketId in the database
//
//   // Hamza / Alishah: draw the token as a QR image (e.g. the `qrcode` package).

const crypto = require('crypto');

const VERSION = 'EH1';
const TOKEN_PATTERN = /^EH1\.([1-9]\d{0,9})\.([1-9]\d{0,9})\.([A-Za-z0-9_-]{43})$/;

function secret() {
  const s = process.env.QR_SECRET;
  if (!s || s.length < 32) {
    throw new Error('QR_SECRET is missing or too short. Set it in .env (32+ characters).');
  }
  return s;
}

function signature(ticketId, eventId) {
  return crypto.createHmac('sha256', secret()).update(`${VERSION}.${ticketId}.${eventId}`).digest('base64url');
}

function toId(value, name) {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new Error(`signTicket: ${name} must be a positive whole number`);
  return n;
}

// { ticketId, eventId } -> "EH1.12.3.<signature>"
function signTicket({ ticketId, eventId }) {
  const t = toId(ticketId, 'ticketId');
  const e = toId(eventId, 'eventId');
  return `${VERSION}.${t}.${e}.${signature(t, e)}`;
}

// Returns { ok: true, ticketId, eventId }
//      or { ok: false, reason: 'malformed' | 'bad-signature' | 'wrong-event' }.
// Pass { eventId } to also refuse a valid ticket for a different event.
function verifyTicket(token, { eventId } = {}) {
  const match = typeof token === 'string' ? TOKEN_PATTERN.exec(token.trim()) : null;
  if (!match) return { ok: false, reason: 'malformed' };

  const ticketId = Number(match[1]);
  const tokenEventId = Number(match[2]);
  const given = Buffer.from(match[3]);
  const expected = Buffer.from(signature(ticketId, tokenEventId));
  // Constant-time compare, so the signature can't be guessed one character at a time.
  if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) {
    return { ok: false, reason: 'bad-signature' };
  }

  if (eventId !== undefined && Number(eventId) !== tokenEventId) {
    return { ok: false, reason: 'wrong-event', ticketId, eventId: tokenEventId };
  }
  return { ok: true, ticketId, eventId: tokenEventId };
}

// Words for the red check-in screen.
function qrMessage(result) {
  switch (result && result.reason) {
    case 'malformed':
      return 'This is not an EventHive ticket.';
    case 'bad-signature':
      return 'This ticket code is not valid.';
    case 'wrong-event':
      return 'This ticket is for a different event.';
    default:
      return 'This ticket code is not valid.';
  }
}

module.exports = { signTicket, verifyTicket, qrMessage };
