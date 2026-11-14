// Hamza: helpers for GET /api/calendar.
// They are plain functions (no Express, no Prisma), so they are easy to test.

const MONTH_ERROR = 'Month must look like 2026-11';

// Pakistan is UTC+5 all year (no daylight saving), so a fixed offset is safe.
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

// Biggest value a PostgreSQL Int column can hold; larger IDs would make Prisma throw.
const MAX_INT = 2147483647;

// "2026-11" -> { start, end } in UTC, covering that month in Pakistan time.
// Returns null for anything else ("abc", "2026-13", "2026-1", arrays, undefined).
function monthRange(month) {
  if (typeof month !== 'string') return null;

  // Year 1000-2999, month 01-12, always two digits.
  const match = /^([12]\d{3})-(0[1-9]|1[0-2])$/.exec(month);
  if (!match) return null;

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  // Midnight on the 1st in PKT is 19:00 UTC the day before, so take UTC midnight
  // and go back 5 hours. Date.UTC turns month 12 into January of the next year
  // and knows about leap years, so December and February need no special code.
  const start = new Date(Date.UTC(year, monthNumber - 1, 1) - PKT_OFFSET_MS);
  const end = new Date(Date.UTC(year, monthNumber, 1) - PKT_OFFSET_MS);
  return { start, end };
}

// Optional ?cityId= / ?genreId= filter.
// Returns undefined when not given (or empty, e.g. an "All cities" dropdown),
// a number when it is a valid ID, and null when it is invalid.
function parseId(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;

  const id = Number(value);
  return id <= MAX_INT ? id : null;
}

// Arguments for prisma.event.findMany: published events starting inside the month.
function buildEventQuery({ start, end, cityId, genreId }) {
  const where = {
    status: 'PUBLISHED',
    startAt: { gte: start, lt: end },
  };
  if (cityId !== undefined) where.cityId = cityId;
  if (genreId !== undefined) where.genreId = genreId;

  const idAndName = { select: { id: true, name: true } };

  return {
    where,
    // id breaks ties, so events at the same time always come back in the same order.
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      title: true,
      startAt: true,
      endAt: true,
      city: idAndName,
      genre: idAndName,
      venue: idAndName,
    },
  };
}

// In the schema these fields are optional (drafts can be half-filled),
// so every one of them may be null.
function toIdName(item) {
  return item ? { id: item.id, name: item.name } : null;
}

function toIsoString(date) {
  return date ? new Date(date).toISOString() : null;
}

// One database row -> one event in the reply.
function toCalendarEvent(event) {
  return {
    id: event.id,
    title: event.title ?? null,
    startAt: toIsoString(event.startAt),
    endAt: toIsoString(event.endAt),
    city: toIdName(event.city),
    genre: toIdName(event.genre),
    venue: toIdName(event.venue),
  };
}

module.exports = { MONTH_ERROR, monthRange, parseId, buildEventQuery, toCalendarEvent };
