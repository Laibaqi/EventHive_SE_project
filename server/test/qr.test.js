// Tests for the signed QR ticket token (TCKT-02, NFR-13).
const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const { signTicket, verifyTicket, qrMessage } = require('../src/lib/qr');

const SECRET = 'test-qr-secret-0123456789abcdefghijklmnop';
let saved;
beforeEach(() => {
  saved = process.env.QR_SECRET;
  process.env.QR_SECRET = SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.QR_SECRET;
  else process.env.QR_SECRET = saved;
});

test('TC-QR-01 a signed token verifies and gives back the ticket and event id', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  assert.match(token, /^EH1\.12\.3\.[A-Za-z0-9_-]{43}$/);
  assert.deepEqual(verifyTicket(token), { ok: true, ticketId: 12, eventId: 3 });
});

test('TC-QR-02 (TCKT-02 acceptance) a QR code with a changed ticket ID fails', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  const edited = token.replace('EH1.12.', 'EH1.13.');
  assert.deepEqual(verifyTicket(edited), { ok: false, reason: 'bad-signature' });
});

test('TC-QR-03 a changed event ID fails', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  const edited = token.replace('EH1.12.3.', 'EH1.12.4.');
  assert.equal(verifyTicket(edited).reason, 'bad-signature');
});

test('TC-QR-04 a changed signature fails', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  const last = token.at(-1);
  const edited = token.slice(0, -1) + (last === 'A' ? 'B' : 'A');
  assert.equal(verifyTicket(edited).reason, 'bad-signature');
});

test('TC-QR-05 a token signed with another secret fails (forged QR)', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  process.env.QR_SECRET = 'a-completely-different-secret-9876543210';
  assert.equal(verifyTicket(token).reason, 'bad-signature');
});

test('TC-QR-06 a valid ticket for another event is refused when the event is given', () => {
  const token = signTicket({ ticketId: 12, eventId: 3 });
  assert.equal(verifyTicket(token, { eventId: 3 }).ok, true);
  assert.equal(verifyTicket(token, { eventId: '3' }).ok, true);
  const other = verifyTicket(token, { eventId: 9 });
  assert.equal(other.ok, false);
  assert.equal(other.reason, 'wrong-event');
});

test('TC-QR-07 random text, a URL or an empty scan is "malformed"', () => {
  for (const bad of ['', 'hello', 'https://example.com', 'EH1.12.3', 'EH2.12.3.' + 'a'.repeat(43), 'EH1.0.3.' + 'a'.repeat(43),
    'EH1.-1.3.' + 'a'.repeat(43), 'EH1.12.3.' + 'a'.repeat(42), null, undefined, 123, {}]) {
    assert.equal(verifyTicket(bad).reason, 'malformed', `expected malformed for ${JSON.stringify(bad)}`);
  }
});

test('spaces or a new line around a scanned token are ignored', () => {
  const token = signTicket({ ticketId: 5, eventId: 1 });
  assert.equal(verifyTicket(`  ${token}\n`).ok, true);
});

test('each ticket gets a different token, and the same ticket always the same one', () => {
  const a = signTicket({ ticketId: 1, eventId: 1 });
  const b = signTicket({ ticketId: 2, eventId: 1 });
  assert.notEqual(a, b);
  assert.equal(signTicket({ ticketId: 1, eventId: 1 }), a);
});

test('signTicket refuses ids that are not positive whole numbers', () => {
  for (const bad of [0, -1, 1.5, 'abc', null, undefined]) {
    assert.throws(() => signTicket({ ticketId: bad, eventId: 1 }), /ticketId/);
    assert.throws(() => signTicket({ ticketId: 1, eventId: bad }), /eventId/);
  }
});

test('a missing or short QR_SECRET stops the server with a clear message', () => {
  delete process.env.QR_SECRET;
  assert.throws(() => signTicket({ ticketId: 1, eventId: 1 }), /QR_SECRET/);
  process.env.QR_SECRET = 'short';
  assert.throws(() => signTicket({ ticketId: 1, eventId: 1 }), /QR_SECRET/);
});

test('the token is short enough for a small QR code and safe in a URL', () => {
  const token = signTicket({ ticketId: 2147483647, eventId: 2147483647 });
  assert.ok(token.length <= 70, `token is ${token.length} characters`);
  assert.equal(encodeURIComponent(token), token);
});

test('qrMessage gives plain words for each reason', () => {
  assert.equal(qrMessage({ reason: 'malformed' }), 'This is not an EventHive ticket.');
  assert.equal(qrMessage({ reason: 'bad-signature' }), 'This ticket code is not valid.');
  assert.equal(qrMessage({ reason: 'wrong-event' }), 'This ticket is for a different event.');
});
