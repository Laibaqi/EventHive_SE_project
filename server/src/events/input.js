// Ushna: cleans what the event form sends before it is saved.
// Plain functions, no database, so they are easy to test.
//
// Drafts may be half-filled, so here we only check the SHAPE of each field that was sent
// (right type, not too long, real date...). The full "is it ready?" check is
// checkPublish() in rules.js, which runs when the organizer presses Publish.

const { TIER_TYPES } = require('./rules');

const MAX_INT = 2147483647; // biggest PostgreSQL Int
const FIELDS = ['title', 'description', 'genreId', 'venueId', 'startAt', 'endAt', 'capacity', 'tiers'];

const fail = (error, field) => ({ error, field });
const isId = (v) => Number.isInteger(v) && v >= 1 && v <= MAX_INT;
const empty = (v) => v === null || v === undefined || v === '';

// Turns "12" into 12 so the form can send either; anything else is left alone (and then refused).
function toNumber(v) {
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return v;
}

// Returns { data } with only the known fields that were sent, or { error, field }.
// cityId, status and organizerId are never taken from the user.
function cleanEventInput(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Send the event as JSON', null);
  const data = {};

  for (const field of FIELDS) {
    if (!(field in body)) continue; // only check what was sent
    const value = body[field];

    if (field === 'title' || field === 'description') {
      if (empty(value)) { data[field] = null; continue; }
      if (typeof value !== 'string') return fail(`${field === 'title' ? 'Title' : 'Description'} must be text`, field);
      const text = value.trim();
      const max = field === 'title' ? 100 : 2000;
      if (text.length > max) {
        return fail(field === 'title' ? 'Title can be at most 100 characters' : 'Description can be at most 2,000 characters', field);
      }
      data[field] = text || null;
      continue;
    }

    if (field === 'genreId' || field === 'venueId') {
      if (empty(value)) { data[field] = null; continue; }
      const id = toNumber(value);
      if (!isId(id)) return fail(field === 'genreId' ? 'Please choose a genre' : 'Please choose a venue', field);
      data[field] = id;
      continue;
    }

    if (field === 'startAt' || field === 'endAt') {
      if (empty(value)) { data[field] = null; continue; }
      const date = typeof value === 'string' ? new Date(value) : null;
      if (!date || isNaN(date)) return fail('Enter a valid date and time', field);
      data[field] = date;
      continue;
    }

    if (field === 'capacity') {
      if (empty(value)) { data[field] = null; continue; }
      const cap = toNumber(value);
      if (!Number.isInteger(cap) || cap < 1 || cap > 500) return fail('Capacity must be a whole number from 1 to 500', 'capacity');
      data.capacity = cap;
      continue;
    }

    if (field === 'tiers') {
      if (empty(value)) { data.tiers = []; continue; }
      if (!Array.isArray(value)) return fail('Ticket types must be a list', 'tiers');
      const tiers = [];
      for (const [i, t] of value.entries()) {
        if (!t || typeof t !== 'object') return fail('Each ticket type needs a type and a price', `tiers.${i}.type`);
        if (!TIER_TYPES.includes(t.type)) return fail('Choose a ticket type', `tiers.${i}.type`);
        const price = toNumber(t.price);
        if (!Number.isInteger(price) || price < 0 || price > 1000000) {
          return fail('Price must be whole PKR from 0 to 1,000,000', `tiers.${i}.price`);
        }
        let limit = null;
        if (!empty(t.limit)) {
          limit = toNumber(t.limit);
          if (!Number.isInteger(limit) || limit < 1) return fail('Limit must be a whole number above 0', `tiers.${i}.limit`);
        }
        tiers.push({ type: t.type, price, limit });
      }
      data.tiers = tiers;
    }
  }

  return { data };
}

// Parses the :id in /api/events/:id. Returns a number, or null when it isn't a valid id.
function parseEventId(value) {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const id = Number(value);
  return id <= MAX_INT ? id : null;
}

module.exports = { FIELDS, cleanEventInput, parseEventId };
