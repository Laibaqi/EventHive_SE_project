// Ushna: what each event route does. The database (db) and audit() are passed in,
// so the tests can use fakes and never need a real database.
// routes/events.js connects these to Express and the real Prisma client.
//
// Every function returns { status, body } or throws an HttpError (sent as { error, field }).

const { HttpError } = require('../auth/errors');
const { checkPublish, checkTiers, checkPublishedEdit } = require('./rules');
const { cleanEventInput } = require('./input');

// What one event looks like in replies: the event plus its genre, venue, city and tiers.
const EVENT_INCLUDE = {
  genre: { select: { id: true, name: true } },
  venue: { select: { id: true, name: true, address: true } },
  city: { select: { id: true, name: true } },
  tiers: { orderBy: { id: 'asc' }, select: { id: true, type: true, price: true, limit: true } },
};

const idAndName = { select: { id: true, name: true } };

function createEventService({ db, audit, ACTIONS, now = () => new Date() }) {
  const loadEvent = (id) => db.event.findUnique({ where: { id }, include: EVENT_INCLUDE });

  function clean(body) {
    const result = cleanEventInput(body);
    if (!result.data) throw new HttpError(400, result.error, result.field);
    return result.data;
  }

  // The event must exist (404) and belong to this organizer (403).
  async function findOwned(user, id) {
    const event = await loadEvent(id);
    if (!event) throw new HttpError(404, 'Event not found', null);
    if (event.organizerId !== user.id) throw new HttpError(403, 'You can only change your own events', null);
    return event;
  }

  // Genre must exist and not be retired. Venue must exist, and the event's city is
  // ALWAYS copied from the venue's city (the user never sends a city).
  async function checkLinks(data) {
    if ('genreId' in data && data.genreId !== null) {
      const genre = await db.genre.findUnique({ where: { id: data.genreId } });
      if (!genre || genre.retired) throw new HttpError(400, 'Please choose a genre', 'genreId');
    }
    if ('venueId' in data) {
      if (data.venueId === null) {
        data.cityId = null;
      } else {
        const venue = await db.venue.findUnique({ where: { id: data.venueId } });
        if (!venue) throw new HttpError(400, 'Please choose a venue', 'venueId');
        data.cityId = venue.cityId;
      }
    }
  }

  // Drafts may have no tiers yet, but the tiers they do have must follow the rules.
  function checkDraftTiers(tiers, capacity) {
    if (tiers.length === 0) return;
    const problem = checkTiers(tiers, capacity ?? 500);
    if (problem) throw new HttpError(400, problem.error, problem.field);
  }

  // POST /api/events: save a new DRAFT. Every field may be empty.
  async function create(user, body) {
    const data = clean(body);
    await checkLinks(data);
    if (data.tiers) checkDraftTiers(data.tiers, data.capacity);

    const { tiers, ...fields } = data;
    const created = await db.$transaction(async (tx) => {
      const event = await tx.event.create({
        data: {
          ...fields,
          organizerId: user.id,
          status: 'DRAFT',
          ...(tiers && tiers.length ? { tiers: { create: tiers } } : {}),
        },
      });
      await audit(user.id, ACTIONS.EVENT_CREATE, 'Event', event.id, { title: event.title }, tx);
      return event;
    });
    return { status: 201, body: { event: await loadEvent(created.id) } };
  }

  // PATCH /api/events/:id: save changes. Only the fields that were sent are checked.
  async function update(user, id, body) {
    const event = await findOwned(user, id);
    const data = clean(body);

    if (event.status === 'PUBLISHED') {
      // Only description and capacity may change, and capacity only goes up.
      const problem = checkPublishedEdit(event, data);
      if (problem) throw new HttpError(400, problem.error, problem.field);
      if ('description' in data && !data.description) throw new HttpError(400, 'Description is required', 'description');
      // The form may send every field back; keep just the two that are allowed to change.
      for (const field of Object.keys(data)) {
        if (field !== 'description' && field !== 'capacity') delete data[field];
      }
    }

    await checkLinks(data);
    if (data.tiers) checkDraftTiers(data.tiers, 'capacity' in data ? data.capacity : event.capacity);

    const { tiers, ...fields } = data;
    await db.$transaction(async (tx) => {
      await tx.event.update({ where: { id }, data: fields });
      if (tiers) {
        // Simplest safe way to save the tier rows: replace them all.
        await tx.ticketTier.deleteMany({ where: { eventId: id } });
        if (tiers.length) await tx.ticketTier.createMany({ data: tiers.map((t) => ({ ...t, eventId: id })) });
      }
      await audit(user.id, ACTIONS.EVENT_EDIT, 'Event', id, { fields: Object.keys(data) }, tx);
    });
    return { status: 200, body: { event: await loadEvent(id) } };
  }

  // POST /api/events/:id/publish: run the full check; if it passes, the event goes live.
  async function publish(user, id) {
    const event = await findOwned(user, id);
    if (event.status === 'PUBLISHED') throw new HttpError(400, 'This event is already published', null);

    // checkPublish needs to know if the genre is retired, so load the full genre row.
    const genre = event.genreId ? await db.genre.findUnique({ where: { id: event.genreId } }) : null;
    const problem = checkPublish({ ...event, genre }, now());
    if (problem) throw new HttpError(400, problem.error, problem.field);

    await db.$transaction(async (tx) => {
      await tx.event.update({ where: { id }, data: { status: 'PUBLISHED' } });
      await audit(user.id, ACTIONS.EVENT_PUBLISHED, 'Event', id, { title: event.title }, tx);
    });
    return { status: 200, body: { event: await loadEvent(id) } };
  }

  // GET /api/events/mine: this organizer's events, newest first.
  async function listMine(user) {
    const events = await db.event.findMany({
      where: { organizerId: user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        title: true,
        status: true,
        startAt: true,
        endAt: true,
        createdAt: true,
        city: idAndName,
        venue: idAndName,
      },
    });
    return { status: 200, body: { events } };
  }

  // GET /api/events/:id: published events are public; a draft is shown only to its owner.
  // Everyone else gets 404, so they can't even tell the draft exists.
  async function getOne(user, id) {
    const event = await loadEvent(id);
    const isOwner = Boolean(user && event && event.organizerId === user.id);
    if (!event || (event.status !== 'PUBLISHED' && !isOwner)) throw new HttpError(404, 'Event not found', null);
    return { status: 200, body: { event } };
  }

  return { create, update, publish, listMine, getOne };
}

module.exports = { createEventService, EVENT_INCLUDE };
