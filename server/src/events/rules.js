// Ushna: the event rules. No database in here, so they are easy to test.
// CHECK: tier type names and field names must match Huzaifa's Prisma schema.
const TIER_TYPES = ['BASIC', 'STUDENT', 'VIP', 'SPECIAL_GUEST'];

const fail = (error, field) => ({ error, field });

// Runs before publishing. Returns null if all good, or { error, field } for the FIRST problem.
// `event` must include its genre and tiers.
function checkPublish(event, now = new Date()) {
  const title = (event.title || '').trim();
  if (title.length < 5 || title.length > 100) return fail('Title must be 5–100 characters', 'title');

  const description = (event.description || '').trim();
  if (!description) return fail('Description is required', 'description');
  if (description.length > 2000) return fail('Description can be at most 2,000 characters', 'description');

  if (!event.genre || event.genre.retired) return fail('Please choose a genre', 'genreId');
  if (!event.venueId) return fail('Please choose a venue', 'venueId');

  if (!event.startAt || new Date(event.startAt) <= now) return fail('Start time must be in the future', 'startAt');
  if (!event.endAt || new Date(event.endAt) <= new Date(event.startAt)) return fail('End time must be after the start time', 'endAt');

  const cap = event.capacity;
  if (!Number.isInteger(cap) || cap < 1 || cap > 500) return fail('Capacity must be a whole number from 1 to 500', 'capacity');

  return checkTiers(event.tiers || [], cap);
}

function checkTiers(tiers, capacity) {
  if (tiers.length === 0) return fail('Add at least one ticket type', 'tiers');
  const seen = new Set();
  let totalLimits = 0;

  for (const [i, t] of tiers.entries()) {
    if (!TIER_TYPES.includes(t.type)) return fail('Unknown ticket type', `tiers.${i}.type`);
    if (seen.has(t.type)) return fail('Each ticket type can be used only once', `tiers.${i}.type`);
    seen.add(t.type);

    if (!Number.isInteger(t.price) || t.price < 0 || t.price > 1000000) {
      return fail('Price must be whole PKR from 0 to 1,000,000', `tiers.${i}.price`);
    }
    if (t.type === 'SPECIAL_GUEST' && t.price !== 0) return fail('Special Guest tickets are always free (price 0)', `tiers.${i}.price`);

    if (t.limit != null) {
      if (!Number.isInteger(t.limit) || t.limit < 1) return fail('Limit must be a whole number above 0', `tiers.${i}.limit`);
      totalLimits += t.limit;
    }
  }
  if (totalLimits > capacity) return fail('Ticket limits add up to more than the capacity', 'tiers');
  return null;
}

// Editing a PUBLISHED event: only description and capacity, and capacity only goes up.
const LOCKED = {
  title: "Title can't change after publishing",
  genreId: "Genre can't change after publishing",
  venueId: "Venue can't change after publishing",
  startAt: "Date can't change after publishing",
  endAt: "End time can't change after publishing",
  tiers: "Ticket types can't change after publishing",
};

function checkPublishedEdit(event, changes) {
  for (const field of Object.keys(changes)) {
    if (field === 'description') continue;
    if (field === 'capacity') {
      const c = changes.capacity;
      if (!Number.isInteger(c) || c < event.capacity || c > 500) {
        return fail('After publishing, capacity can only go up (max 500)', 'capacity');
      }
      continue;
    }
    return fail(LOCKED[field] || "This can't change after publishing", field);
  }
  return null;
}

module.exports = { TIER_TYPES, checkPublish, checkTiers, checkPublishedEdit };
