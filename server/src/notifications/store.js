// Database queries for notifications (Alishah). Kept apart from notify.js so the tests can
// pass a fake store and never need a database (same idea as lib/otpStores.js).
//
// Until Huzaifa's Ticket table is merged, prisma.ticket doesn't exist: every query then
// returns "nothing found", so the server and the reminder job keep running without errors.

const TICKET_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  tier: { select: { type: true, price: true } },
  event: {
    select: {
      id: true,
      title: true,
      startAt: true,
      status: true,
      venue: { select: { name: true } },
      city: { select: { name: true } },
    },
  },
};

function prismaNotificationStore(prisma) {
  let warned = false;
  const ready = () => {
    if (prisma.ticket) return true;
    if (!warned) {
      console.warn('[notify] Ticket table not added yet: ticket emails and reminders are off.');
      warned = true;
    }
    return false;
  };

  return {
    getTicket: async (id) =>
      ready() ? prisma.ticket.findUnique({ where: { id: Number(id) }, include: TICKET_INCLUDE }) : null,

    // Valid tickets with no reminder yet, for published events starting between `from` and `to`.
    findReminderCandidates: async (from, to, statuses) =>
      ready()
        ? prisma.ticket.findMany({
            where: {
              status: { in: statuses },
              reminderSentAt: null,
              event: { status: 'PUBLISHED', startAt: { gt: from, lte: to } },
            },
            include: TICKET_INCLUDE,
            orderBy: { id: 'asc' },
            take: 500,
          })
        : [],

    // true only for the run that actually set reminderSentAt (it was still empty).
    claimReminder: async (id, at) =>
      ready()
        ? (await prisma.ticket.updateMany({ where: { id, reminderSentAt: null }, data: { reminderSentAt: at } })).count === 1
        : false,

    // Undo a claim after a failed send, so the next run tries again.
    releaseReminder: async (id) => {
      if (ready()) await prisma.ticket.update({ where: { id }, data: { reminderSentAt: null } });
    },
  };
}

module.exports = { prismaNotificationStore, TICKET_INCLUDE };
