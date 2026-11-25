// Sprint 2 email notifications (Alishah). NOTF-01 ticket confirmation, NOTF-02 event reminder,
// NOTF-03 ticket cancelled. Built on sendEmail() and the templates in lib/emailTemplates.js.
//
// How teammates use it (all calls are safe to fire and forget: they never throw):
//
//   const { notifyTicketBooked, notifyTicketCancelled } = require('../notifications/notify');
//
//   // Huzaifa, right after a ticket is confirmed (free tier booked, or mock payment done):
//   notifyTicketBooked(ticket.id);          // don't await: the user shouldn't wait for email
//
//   // Huzaifa, after a ticket is cancelled:
//   notifyTicketCancelled(ticket.id);
//
// The reminder job is started once in src/index.js. Every 15 minutes it emails everyone whose
// event starts in the next 24 hours and who hasn't had a reminder yet (Ticket.reminderSentAt).
//
// Needs from Huzaifa's Ticket model: id, status, qrToken, reminderSentAt, and relations
// user (name, email), tier (type, price), event (title, startAt, status, venue, city).
// Until the Ticket table exists, every function here just does nothing.

const { toPKT } = require('../lib/time');

const ACTIVE_STATUSES = ['BOOKED']; // tickets that are still valid
const TIER_NAMES = { BASIC: 'Basic', STUDENT: 'Student', VIP: 'VIP', SPECIAL_GUEST: 'Special Guest' };

function createNotifier({
  store,
  sendEmail,
  audit = async () => {},
  ACTIONS = {},
  makeQr = async () => null,
  now = () => new Date(),
  clientUrl = process.env.CLIENT_URL || '',
  log = console,
}) {
  const ticketsLink = clientUrl ? `${clientUrl.replace(/\/+$/, '')}/tickets` : '';

  // Everything the ticket email templates need, from one ticket row.
  function emailData(ticket) {
    const event = ticket.event || {};
    return {
      name: ticket.user && ticket.user.name,
      eventTitle: event.title || 'your event',
      when: event.startAt ? toPKT(event.startAt, { dateStyle: 'full', timeStyle: 'short' }) : '',
      venue: event.venue && event.venue.name,
      city: event.city && event.city.name,
      tier: ticket.tier ? TIER_NAMES[ticket.tier.type] || ticket.tier.type : '',
      price: ticket.tier ? ticket.tier.price : 0,
      ticketId: ticket.id,
      link: ticketsLink,
    };
  }

  // "in 3 hours", "in 23 hours", "within the hour"
  function startsIn(startAt) {
    const hours = Math.round((new Date(startAt) - now()) / 3600000);
    if (hours <= 1) return 'within the hour';
    return `in ${hours} hours`;
  }

  async function qrAttachment(ticket) {
    if (!ticket.qrToken) return [];
    try {
      const png = await makeQr(ticket.qrToken);
      return png ? [{ filename: `eventhive-ticket-${ticket.id}-qr.png`, content: png }] : [];
    } catch (err) {
      log.error(`[notify] could not draw QR for ticket ${ticket.id}: ${err.message}`);
      return []; // the email still goes out; the QR is also on the My tickets page
    }
  }

  // NOTF-01: "Ticket confirmed" email with the QR code attached.
  async function notifyTicketBooked(ticketId) {
    try {
      const ticket = await store.getTicket(ticketId);
      if (!ticket || !ticket.user) return { ok: false, reason: 'not-found' };
      if (!ACTIVE_STATUSES.includes(ticket.status)) return { ok: false, reason: 'not-active' };
      const attachments = await qrAttachment(ticket);
      return await sendEmail('ticketConfirmed', ticket.user.email, emailData(ticket), { attachments });
    } catch (err) {
      log.error(`[notify] ticket ${ticketId} confirmation failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // NOTF-03: "Ticket cancelled" email.
  async function notifyTicketCancelled(ticketId) {
    try {
      const ticket = await store.getTicket(ticketId);
      if (!ticket || !ticket.user) return { ok: false, reason: 'not-found' };
      return await sendEmail('ticketCancelled', ticket.user.email, emailData(ticket));
    } catch (err) {
      log.error(`[notify] ticket ${ticketId} cancellation email failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  }

  // NOTF-02: one reminder per ticket, for events starting in the next `windowHours`.
  // Each ticket is "claimed" in the database first (reminderSentAt set only if still empty),
  // so two overlapping runs can never send the same reminder twice. If the email fails,
  // the claim is undone so the next run tries again.
  async function sendDueReminders({ windowHours = 24 } = {}) {
    const result = { checked: 0, sent: 0, failed: 0 };
    try {
      const t = now();
      const until = new Date(t.getTime() + windowHours * 3600000);
      const tickets = await store.findReminderCandidates(t, until, ACTIVE_STATUSES);
      for (const ticket of tickets) {
        result.checked++;
        if (!ticket.user || !(await store.claimReminder(ticket.id, t))) continue;
        const sent = await sendEmail('eventReminder', ticket.user.email, {
          ...emailData(ticket),
          startsIn: startsIn(ticket.event.startAt),
        });
        if (sent && sent.ok) {
          result.sent++;
          try {
            await audit(null, ACTIONS.REMINDER_SENT || 'REMINDER_SENT', 'Ticket', ticket.id, { eventId: ticket.event.id });
          } catch (_) { /* logging must never stop the job */ }
        } else {
          result.failed++;
          await store.releaseReminder(ticket.id);
        }
      }
    } catch (err) {
      log.error(`[notify] reminder run failed: ${err.message}`);
      result.error = err.message;
    }
    return result;
  }

  return { notifyTicketBooked, notifyTicketCancelled, sendDueReminders, emailData, startsIn };
}

// ---------- Real wiring (Prisma, real email). Tests use createNotifier() with fakes instead. ----------

let live;
function liveNotifier() {
  if (!live) {
    const prisma = require('../lib/prisma');
    const { sendEmail } = require('../lib/email');
    const { audit, ACTIONS } = require('../lib/audit');
    const { prismaNotificationStore } = require('./store');
    live = createNotifier({ store: prismaNotificationStore(prisma), sendEmail, audit, ACTIONS, makeQr: qrPng });
  }
  return live;
}

// The QR token drawn as a PNG (needs the `qrcode` package). Returns null if it isn't installed.
async function qrPng(token) {
  let QRCode;
  try {
    QRCode = require('qrcode');
  } catch (_) {
    return null;
  }
  return QRCode.toBuffer(token, { type: 'png', width: 320, margin: 2, errorCorrectionLevel: 'M' });
}

// Starts the reminder job: one run 30 seconds after the server starts, then every 15 minutes.
// Turn it off with REMINDERS_ENABLED=false in .env (e.g. on a laptop sharing the live database).
function startReminderJob({ everyMinutes = 15 } = {}) {
  if (process.env.REMINDERS_ENABLED === 'false' || process.env.NODE_ENV === 'test') return null;
  const run = async () => {
    const r = await liveNotifier().sendDueReminders();
    if (r.sent || r.failed) console.log(`[reminders] checked ${r.checked}, sent ${r.sent}, failed ${r.failed}`);
  };
  const first = setTimeout(run, 30 * 1000);
  const timer = setInterval(run, everyMinutes * 60 * 1000);
  first.unref();
  timer.unref();
  return { stop: () => { clearTimeout(first); clearInterval(timer); } };
}

module.exports = {
  createNotifier,
  startReminderJob,
  qrPng,
  ACTIVE_STATUSES,
  notifyTicketBooked: (id) => liveNotifier().notifyTicketBooked(id),
  notifyTicketCancelled: (id) => liveNotifier().notifyTicketCancelled(id),
  sendDueReminders: (opts) => liveNotifier().sendDueReminders(opts),
};
