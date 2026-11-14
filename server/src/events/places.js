// Ushna: cities, genres and venues for the event form's dropdowns.
// The database (db) and audit() are passed in, so tests can use fakes.
// Every function returns { status, body } or throws an HttpError.

const { HttpError } = require('../auth/errors');
const { parseEventId } = require('./input');

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VENUE_SELECT = { id: true, name: true, address: true, cityId: true };

function text(value, label, max, field) {
  const v = typeof value === 'string' ? value.trim() : '';
  if (!v) throw new HttpError(400, `${label} is required`, field);
  if (v.length > max) throw new HttpError(400, `${label} can be at most ${max} characters`, field);
  return v;
}

function createPlacesService({ db, audit, ACTIONS }) {
  // GET /api/lookups: active cities and genres that are not retired.
  async function lookups() {
    const [cities, genres] = await Promise.all([
      db.city.findMany({ where: { active: true }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
      db.genre.findMany({ where: { retired: false }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    ]);
    return { status: 200, body: { cities, genres } };
  }

  // GET /api/venues?cityId=2: the venues in one city.
  async function venuesInCity(cityIdParam) {
    const cityId = parseEventId(cityIdParam);
    if (!cityId) throw new HttpError(400, 'Choose a city first', 'cityId');
    const venues = await db.venue.findMany({ where: { cityId }, orderBy: { name: 'asc' }, select: VENUE_SELECT });
    return { status: 200, body: { venues } };
  }

  // POST /api/venues: an organizer adds a venue. The city must be active.
  async function createVenue(user, body) {
    const b = body && typeof body === 'object' ? body : {};
    const name = text(b.name, 'Venue name', 100, 'name');
    const address = text(b.address, 'Address', 200, 'address');

    const cityId = typeof b.cityId === 'string' ? parseEventId(b.cityId) : b.cityId;
    if (!Number.isInteger(cityId) || cityId < 1) throw new HttpError(400, 'Please choose a city', 'cityId');

    let contactEmail = null;
    if (typeof b.contactEmail === 'string' && b.contactEmail.trim()) {
      contactEmail = b.contactEmail.trim().toLowerCase();
      if (!EMAIL.test(contactEmail) || contactEmail.length > 200) throw new HttpError(400, 'Enter a valid email', 'contactEmail');
    }

    const city = await db.city.findUnique({ where: { id: cityId } });
    if (!city || !city.active) throw new HttpError(400, 'Please choose an active city', 'cityId');

    const venue = await db.$transaction(async (tx) => {
      const created = await tx.venue.create({
        data: { name, address, cityId, contactEmail, createdById: user.id },
        select: VENUE_SELECT,
      });
      await audit(user.id, ACTIONS.VENUE_CREATE, 'Venue', created.id, { name }, tx);
      return created;
    });
    return { status: 201, body: { venue } };
  }

  return { lookups, venuesInCity, createVenue };
}

module.exports = { createPlacesService };
