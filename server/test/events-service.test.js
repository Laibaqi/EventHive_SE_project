// Ushna: tests for the event and venue APIs, using a pretend database (no Postgres needed).
const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');

const { createEventService } = require('../src/events/service');
const { createPlacesService } = require('../src/events/places');
const { cleanEventInput } = require('../src/events/input');

const ACTIONS = { EVENT_CREATE: 'EVENT_CREATE', EVENT_EDIT: 'EVENT_EDIT', EVENT_PUBLISHED: 'EVENT_PUBLISHED', VENUE_CREATE: 'VENUE_CREATE' };
const NOW = new Date('2026-11-14T10:00:00+05:00');
const HIRA = { id: 3, role: 'ORGANIZER' }; // our organizer
const BILAL = { id: 4, role: 'ORGANIZER' }; // another organizer

// A tiny in-memory stand-in for the Prisma calls the services make.
function fakeDb() {
  const s = {
    events: [],
    tiers: [],
    audits: [],
    cities: [{ id: 1, name: 'Karachi', active: true }, { id: 2, name: 'Lahore', active: true }, { id: 5, name: 'Quetta', active: false }],
    genres: [{ id: 1, name: 'Music', retired: false }, { id: 9, name: 'Old', retired: true }],
    venues: [{ id: 3, name: 'Alhamra', address: 'The Mall', cityId: 2 }, { id: 4, name: 'Expo Karachi', address: 'University Rd', cityId: 1 }],
  };
  let ids = { event: 1, tier: 1, venue: 10, clock: 0 };
  const byId = (list, id) => list.find((x) => x.id === id) ?? null;
  const full = (e) => e && {
    ...e,
    genre: byId(s.genres, e.genreId),
    venue: byId(s.venues, e.venueId),
    city: byId(s.cities, e.cityId),
    tiers: s.tiers.filter((t) => t.eventId === e.id),
  };

  const db = {
    s,
    event: {
      async create({ data }) {
        const { tiers, ...rest } = data;
        const e = { id: ids.event++, title: null, description: null, genreId: null, venueId: null, cityId: null, startAt: null, endAt: null, capacity: null, createdAt: new Date(ids.clock++), ...rest };
        s.events.push(e);
        for (const t of tiers?.create ?? []) s.tiers.push({ id: ids.tier++, eventId: e.id, ...t });
        return { ...e };
      },
      async findUnique({ where }) { return full(byId(s.events, where.id)); },
      async update({ where, data }) { const e = byId(s.events, where.id); Object.assign(e, data); return { ...e }; },
      async findMany({ where }) {
        return s.events.filter((e) => e.organizerId === where.organizerId).sort((a, b) => b.createdAt - a.createdAt).map(full);
      },
    },
    ticketTier: {
      async deleteMany({ where }) { s.tiers = s.tiers.filter((t) => t.eventId !== where.eventId); },
      async createMany({ data }) { for (const t of data) s.tiers.push({ id: ids.tier++, ...t }); },
    },
    venue: {
      async findUnique({ where }) { return byId(s.venues, where.id); },
      async findMany({ where }) { return s.venues.filter((v) => v.cityId === where.cityId); },
      async create({ data }) { const v = { id: ids.venue++, ...data }; s.venues.push(v); return v; },
    },
    genre: {
      async findUnique({ where }) { return byId(s.genres, where.id); },
      async findMany() { return s.genres.filter((g) => !g.retired); },
    },
    city: {
      async findUnique({ where }) { return byId(s.cities, where.id); },
      async findMany() { return s.cities.filter((c) => c.active); },
    },
    async $transaction(fn) { return fn(db); },
  };
  return db;
}

let db, events, places;
beforeEach(() => {
  db = fakeDb();
  const audit = async (actorId, action, targetType, targetId) => { db.s.audits.push({ actorId, action, targetType, targetId }); };
  events = createEventService({ db, audit, ACTIONS, now: () => NOW });
  places = createPlacesService({ db, audit, ACTIONS });
});

// Runs fn and returns the HttpError it throws (fails the test if it doesn't throw).
async function refused(fn) {
  try { await fn(); } catch (err) { return err; }
  assert.fail('expected the request to be refused');
}

const READY = {
  title: 'Lahore Music Night',
  description: 'Live bands and food stalls.',
  genreId: 1,
  venueId: 3,
  startAt: '2026-12-01T19:00:00+05:00',
  endAt: '2026-12-01T23:00:00+05:00',
  capacity: 200,
  tiers: [{ type: 'BASIC', price: 1500, limit: 150 }, { type: 'SPECIAL_GUEST', price: 0 }],
};

async function publishedEvent() {
  const { body } = await events.create(HIRA, READY);
  await events.publish(HIRA, body.event.id);
  return body.event.id;
}

// ---------- Create ----------

test('TC-EVNT-03: a draft with empty fields is saved', async () => {
  const { status, body } = await events.create(HIRA, {});
  assert.equal(status, 201);
  assert.equal(body.event.status, 'DRAFT');
  assert.equal(body.event.organizerId, 3);
  assert.deepEqual(db.s.audits.map((a) => a.action), ['EVENT_CREATE']);
});

test('TC-EVNT-07: the city is copied from the venue, and a city sent by the user is ignored', async () => {
  const { body } = await events.create(HIRA, { venueId: 3, cityId: 1, status: 'PUBLISHED', organizerId: 99 });
  assert.equal(body.event.cityId, 2); // Alhamra is in Lahore
  assert.equal(body.event.status, 'DRAFT');
  assert.equal(body.event.organizerId, 3);
});

test('TC-EVNT-07: changing the venue changes the city too', async () => {
  const { body } = await events.create(HIRA, { venueId: 3 });
  const after = await events.update(HIRA, body.event.id, { venueId: 4 });
  assert.equal(after.body.event.cityId, 1); // Expo Karachi
});

test('a venue or genre that does not exist (or is retired) is refused', async () => {
  assert.equal((await refused(() => events.create(HIRA, { venueId: 77 }))).field, 'venueId');
  assert.equal((await refused(() => events.create(HIRA, { genreId: 9 }))).field, 'genreId');
});

test('a too-long title is refused even in a draft', async () => {
  const err = await refused(() => events.create(HIRA, { title: 'x'.repeat(101) }));
  assert.equal(err.status, 400);
  assert.equal(err.field, 'title');
});

test('TC-EVNT-05: two Basic tiers are refused', async () => {
  const err = await refused(() => events.create(HIRA, { tiers: [{ type: 'BASIC', price: 1 }, { type: 'BASIC', price: 2 }] }));
  assert.equal(err.status, 400);
  assert.equal(err.field, 'tiers.1.type');
});

test('TC-EVNT-05: tier limits above capacity are refused', async () => {
  const err = await refused(() => events.create(HIRA, { capacity: 10, tiers: [{ type: 'BASIC', price: 1, limit: 20 }] }));
  assert.equal(err.field, 'tiers');
});

test('TC-EVNT-06: a Special Guest tier with a price is refused', async () => {
  const err = await refused(() => events.create(HIRA, { tiers: [{ type: 'SPECIAL_GUEST', price: 500 }] }));
  assert.equal(err.field, 'tiers.0.price');
});

// ---------- Edit ----------

test('TC-EVNT-10: another organizer editing my event gets 403', async () => {
  const { body } = await events.create(HIRA, {});
  const err = await refused(() => events.update(BILAL, body.event.id, { title: 'Mine now' }));
  assert.equal(err.status, 403);
});

test('editing an event that does not exist gets 404', async () => {
  assert.equal((await refused(() => events.update(HIRA, 999, {}))).status, 404);
});

test('a draft can change anything, and the tiers are replaced', async () => {
  const { body } = await events.create(HIRA, READY);
  const after = await events.update(HIRA, body.event.id, { title: 'New title here', tiers: [{ type: 'VIP', price: 5000 }] });
  assert.equal(after.body.event.title, 'New title here');
  assert.deepEqual(after.body.event.tiers.map((t) => t.type), ['VIP']);
  assert.equal(db.s.audits.at(-1).action, 'EVENT_EDIT');
});

// ---------- Publish ----------

test('TC-EVNT-04: publishing with no capacity names capacity', async () => {
  const { body } = await events.create(HIRA, { ...READY, capacity: null });
  const err = await refused(() => events.publish(HIRA, body.event.id));
  assert.equal(err.status, 400);
  assert.equal(err.field, 'capacity');
});

test('TC-EVNT-04: publishing with a start in the past names startAt', async () => {
  const { body } = await events.create(HIRA, { ...READY, startAt: '2026-11-01T19:00:00+05:00' });
  assert.equal((await refused(() => events.publish(HIRA, body.event.id))).field, 'startAt');
});

test('TC-EVNT-04: publishing with no tiers names tiers', async () => {
  const { body } = await events.create(HIRA, { ...READY, tiers: [] });
  assert.equal((await refused(() => events.publish(HIRA, body.event.id))).field, 'tiers');
});

test('a complete draft publishes and is logged', async () => {
  const { body } = await events.create(HIRA, READY);
  const res = await events.publish(HIRA, body.event.id);
  assert.equal(res.body.event.status, 'PUBLISHED');
  assert.equal(db.s.audits.at(-1).action, 'EVENT_PUBLISHED');
});

test('a genre retired after saving the draft blocks publishing', async () => {
  const { body } = await events.create(HIRA, READY);
  db.s.genres[0].retired = true;
  assert.equal((await refused(() => events.publish(HIRA, body.event.id))).field, 'genreId');
});

test('only the owner can publish', async () => {
  const { body } = await events.create(HIRA, READY);
  assert.equal((await refused(() => events.publish(BILAL, body.event.id))).status, 403);
});

// ---------- Editing after publishing ----------

test('TC-EVNT-08: changing the date of a published event names startAt', async () => {
  const id = await publishedEvent();
  const err = await refused(() => events.update(HIRA, id, { startAt: '2026-12-05T19:00:00+05:00' }));
  assert.equal(err.field, 'startAt');
  assert.match(err.message, /Date can't change/);
});

test('TC-EVNT-09: capacity of a published event can go up but not down', async () => {
  const id = await publishedEvent();
  const up = await events.update(HIRA, id, { capacity: 300 });
  assert.equal(up.body.event.capacity, 300);
  assert.equal((await refused(() => events.update(HIRA, id, { capacity: 100 }))).field, 'capacity');
});

test('published: the whole form sent back unchanged plus a new description is fine', async () => {
  const id = await publishedEvent();
  const { tiers, ...form } = READY; // the edit page never sends tiers for published events
  const res = await events.update(HIRA, id, { ...form, description: 'Now with fireworks.' });
  assert.equal(res.body.event.description, 'Now with fireworks.');
});

test('published: sending tiers or an empty description is refused', async () => {
  const id = await publishedEvent();
  assert.equal((await refused(() => events.update(HIRA, id, { tiers: READY.tiers }))).field, 'tiers');
  assert.equal((await refused(() => events.update(HIRA, id, { description: '' }))).field, 'description');
});

// ---------- Reading ----------

test('a draft is hidden (404) from guests and other organizers, but shown to its owner', async () => {
  const { body } = await events.create(HIRA, { title: 'Secret plan' });
  assert.equal((await refused(() => events.getOne(null, body.event.id))).status, 404);
  assert.equal((await refused(() => events.getOne(BILAL, body.event.id))).status, 404);
  assert.equal((await events.getOne(HIRA, body.event.id)).body.event.title, 'Secret plan');
});

test('a published event is public, with venue, city, genre and tiers', async () => {
  const id = await publishedEvent();
  const { body } = await events.getOne(null, id);
  assert.equal(body.event.venue.name, 'Alhamra');
  assert.equal(body.event.city.name, 'Lahore');
  assert.equal(body.event.genre.name, 'Music');
  assert.equal(body.event.tiers.length, 2);
});

test('my events lists only my own, newest first', async () => {
  await events.create(HIRA, { title: 'First one' });
  await events.create(BILAL, { title: 'Not mine' });
  await events.create(HIRA, { title: 'Second one' });
  const { body } = await events.listMine(HIRA);
  assert.deepEqual(body.events.map((e) => e.title), ['Second one', 'First one']);
});

// ---------- Lookups and venues ----------

test('lookups returns only active cities and genres that are not retired', async () => {
  const { body } = await places.lookups();
  assert.deepEqual(body.cities.map((c) => c.name), ['Karachi', 'Lahore']);
  assert.deepEqual(body.genres.map((g) => g.name), ['Music']);
});

test('venues for a city; a missing or bad cityId is refused', async () => {
  assert.deepEqual((await places.venuesInCity('2')).body.venues.map((v) => v.name), ['Alhamra']);
  assert.equal((await refused(() => places.venuesInCity(undefined))).field, 'cityId');
  assert.equal((await refused(() => places.venuesInCity('abc'))).field, 'cityId');
});

test('adding a venue: needs a name, an address and an active city', async () => {
  assert.equal((await refused(() => places.createVenue(HIRA, { address: 'x', cityId: 1 }))).field, 'name');
  assert.equal((await refused(() => places.createVenue(HIRA, { name: 'Hall', address: 'x', cityId: 5 }))).field, 'cityId');
  assert.equal((await refused(() => places.createVenue(HIRA, { name: 'Hall', address: 'x', cityId: 1, contactEmail: 'nope' }))).field, 'contactEmail');

  const { status, body } = await places.createVenue(HIRA, { name: ' New Hall ', address: 'Clifton', cityId: 1 });
  assert.equal(status, 201);
  assert.equal(body.venue.name, 'New Hall');
  assert.equal(db.s.audits.at(-1).action, 'VENUE_CREATE');
});

// ---------- Cleaning the form input ----------

test('numbers sent as text are accepted; bad dates are refused', () => {
  assert.equal(cleanEventInput({ capacity: '50' }).data.capacity, 50);
  assert.equal(cleanEventInput({ startAt: 'tomorrow' }).field, 'startAt');
  assert.equal(cleanEventInput({ title: '   ' }).data.title, null);
});
