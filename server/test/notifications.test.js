// Run: npm test. Sprint 2 notification tests (Alishah). A fake store + fake clock, no database.
const test = require('node:test');
const assert = require('node:assert/strict');
const { createNotifier } = require('../src/notifications/notify');
const { prismaNotificationStore } = require('../src/notifications/store');
const { templates, formatPrice } = require('../src/lib/emailTemplates');

const NOW = new Date('2026-12-01T10:00:00Z'); // 3:00 pm in Pakistan
const hours = (h) => new Date(NOW.getTime() + h * 3600000);

function ticket(id, { startAt = hours(20), status = 'BOOKED', eventStatus = 'PUBLISHED', price = 0, type = 'BASIC' } = {}) {
  return {
    id,
    status,
    qrToken: `EH1.${id}.7.fake-signature`,
    reminderSentAt: null,
    user: { id: 100 + id, name: `User ${id}`, email: `user${id}@test.pk` },
    tier: { type, price },
    event: { id: 7, title: 'Karachi Tech Meetup', startAt, status: eventStatus, venue: { name: 'IBA Main Campus' }, city: { name: 'Karachi' } },
  };
}

// Same behaviour as the Prisma store, kept in memory.
function fakeStore(tickets) {
  return {
    tickets,
    getTicket: async (id) => tickets.find((t) => t.id === id) || null,
    findReminderCandidates: async (from, to, statuses) =>
      tickets.filter((t) => statuses.includes(t.status) && t.reminderSentAt === null &&
        t.event.status === 'PUBLISHED' && t.event.startAt > from && t.event.startAt <= to),
    claimReminder: async (id, at) => {
      const t = tickets.find((x) => x.id === id);
      if (!t || t.reminderSentAt) return false;
      t.reminderSentAt = at;
      return true;
    },
    releaseReminder: async (id) => { tickets.find((x) => x.id === id).reminderSentAt = null; },
  };
}

function setup(tickets, { sendOk = true } = {}) {
  const sent = [];
  const audits = [];
  const store = fakeStore(tickets);
  const notifier = createNotifier({
    store,
    sendEmail: async (template, to, data, opts = {}) => { sent.push({ template, to, data, opts }); return { ok: sendOk }; },
    audit: async (...args) => { audits.push(args); },
    ACTIONS: { REMINDER_SENT: 'REMINDER_SENT' },
    makeQr: async (token) => Buffer.from(`PNG:${token}`),
    now: () => NOW,
    clientUrl: 'https://event-hive.test',
    log: { error: () => {}, warn: () => {} },
  });
  return { notifier, sent, audits, store };
}

test('TC-NOTF-01: booking a ticket sends a confirmation email with the QR code attached', async () => {
  const { notifier, sent } = setup([ticket(1, { price: 1500, type: 'VIP', startAt: new Date('2026-12-05T14:00:00Z') })]);
  await notifier.notifyTicketBooked(1);
  assert.equal(sent.length, 1);
  const m = sent[0];
  assert.equal(m.template, 'ticketConfirmed');
  assert.equal(m.to, 'user1@test.pk');
  assert.equal(m.data.eventTitle, 'Karachi Tech Meetup');
  assert.equal(m.data.tier, 'VIP');
  assert.equal(m.data.link, 'https://event-hive.test/tickets');
  assert.match(m.data.when, /5 December 2026.*7:00\s?pm/i); // 14:00 UTC shown as 7:00 pm Pakistan time
  assert.equal(m.opts.attachments.length, 1);
  assert.equal(m.opts.attachments[0].filename, 'eventhive-ticket-1-qr.png');
  assert.equal(m.opts.attachments[0].content.toString(), 'PNG:EH1.1.7.fake-signature');
});

test('TC-NOTF-02: a reminder is sent once, even when the job runs again', async () => {
  const { notifier, sent, audits } = setup([ticket(1)]);
  const first = await notifier.sendDueReminders();
  const second = await notifier.sendDueReminders();
  assert.equal(first.sent, 1);
  assert.equal(second.sent, 0);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].template, 'eventReminder');
  assert.equal(sent[0].data.startsIn, 'in 20 hours');
  assert.equal(audits[0][1], 'REMINDER_SENT');
});

test('TC-NOTF-03: only events starting in the next 24 hours get a reminder', async () => {
  const { notifier, sent } = setup([
    ticket(1, { startAt: hours(23) }), // yes
    ticket(2, { startAt: hours(30) }), // too early, comes in a later run
    ticket(3, { startAt: hours(-2) }), // already started
    ticket(4, { startAt: hours(5), eventStatus: 'DRAFT' }), // not published
  ]);
  await notifier.sendDueReminders();
  assert.deepEqual(sent.map((m) => m.to), ['user1@test.pk']);
});

test('TC-NOTF-04: a cancelled ticket gets no confirmation and no reminder', async () => {
  const { notifier, sent } = setup([ticket(1, { status: 'CANCELLED' })]);
  assert.equal((await notifier.notifyTicketBooked(1)).ok, false);
  await notifier.sendDueReminders();
  assert.equal(sent.length, 0);
});

test('TC-NOTF-05: if a reminder email fails, the next run tries again', async () => {
  const tickets = [ticket(1)];
  const failing = setup(tickets, { sendOk: false });
  const r1 = await failing.notifier.sendDueReminders();
  assert.equal(r1.failed, 1);
  assert.equal(tickets[0].reminderSentAt, null); // claim undone
  const working = setup(tickets);
  assert.equal((await working.notifier.sendDueReminders()).sent, 1);
});

test('TC-NOTF-06: cancelling a ticket sends a cancellation email', async () => {
  const { notifier, sent } = setup([ticket(1, { status: 'CANCELLED' })]);
  await notifier.notifyTicketCancelled(1);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].template, 'ticketCancelled');
});

test('TC-NOTF-07: before the Ticket table exists, nothing breaks', async () => {
  const orig = console.warn; console.warn = () => {};
  try {
    const store = prismaNotificationStore({}); // a Prisma client with no ticket model
    assert.equal(await store.getTicket(1), null);
    assert.deepEqual(await store.findReminderCandidates(NOW, hours(24), ['BOOKED']), []);
    assert.equal(await store.claimReminder(1, NOW), false);
  } finally { console.warn = orig; }
});

test('TC-NOTF-08: a database error never crashes the request or the job', async () => {
  const notifier = createNotifier({
    store: { getTicket: async () => { throw new Error('db down'); }, findReminderCandidates: async () => { throw new Error('db down'); } },
    sendEmail: async () => ({ ok: true }),
    log: { error: () => {} },
  });
  assert.equal((await notifier.notifyTicketBooked(1)).ok, false);
  assert.equal((await notifier.sendDueReminders()).error, 'db down');
});

test('TC-NOTF-09: ticket emails show the details, price and escape names', () => {
  const data = { name: '<b>Ali</b>', eventTitle: 'Tech Meetup', when: 'Tuesday, 1 December 2026 at 3:00 pm', venue: 'IBA', city: 'Karachi', tier: 'VIP', price: 1500, ticketId: 12, link: 'https://x.test/tickets' };
  const c = templates.ticketConfirmed(data);
  assert.equal(c.subject, 'Ticket confirmed: Tech Meetup');
  assert.ok(c.html.includes('PKR 1,500') && c.html.includes('#12') && c.html.includes('IBA, Karachi'));
  assert.ok(!c.html.includes('<b>Ali</b>'));
  assert.match(templates.eventReminder({ ...data, startsIn: 'in 20 hours' }).subject, /in 20 hours/);
  assert.match(templates.ticketCancelled(data).text, /cancelled/);
  assert.equal(formatPrice(0), 'Free');
});

test('TC-EMAIL-08: attachments are sent to Brevo as base64', async () => {
  const { sendEmail, _setFetch } = require('../src/lib/email');
  process.env.BREVO_API_KEY = 'test-key';
  let body;
  _setFetch(async (_url, opts) => { body = JSON.parse(opts.body); return { ok: true, json: async () => ({ messageId: 'm1' }) }; });
  try {
    const r = await sendEmail('ticketConfirmed', 'ali@test.pk', { eventTitle: 'X' }, { attachments: [{ filename: 'qr.png', content: Buffer.from('PNGDATA') }] });
    assert.equal(r.ok, true);
    assert.deepEqual(body.attachment, [{ name: 'qr.png', content: Buffer.from('PNGDATA').toString('base64') }]);
  } finally { delete process.env.BREVO_API_KEY; _setFetch(null); }
});
