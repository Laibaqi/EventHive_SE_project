// Ushna: helpers shared by the event pages (form, My events, details).
// The API sends times in UTC; everything here shows them in Pakistan time (PKT, UTC+5).

const TIME_ZONE = 'Asia/Karachi';

export const TIER_TYPES = ['BASIC', 'STUDENT', 'VIP', 'SPECIAL_GUEST'];
export const TIER_LABELS = { BASIC: 'Basic', STUDENT: 'Student', VIP: 'VIP', SPECIAL_GUEST: 'Special Guest' };

const dateTimeFormat = new Intl.DateTimeFormat('en-PK', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-PK', { timeZone: TIME_ZONE, hour: 'numeric', minute: '2-digit' });
const partsFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

// "2026-12-01T14:00:00.000Z" -> "Tue, 1 Dec 2026, 7:00 pm"
export function formatDateTime(iso) {
  return iso ? dateTimeFormat.format(new Date(iso)) : 'Date not set';
}

// Start and end together: "Tue, 1 Dec 2026, 7:00 pm – 11:00 pm"
export function formatRange(startIso, endIso) {
  if (!startIso) return 'Date not set';
  const start = formatDateTime(startIso);
  return endIso ? `${start} – ${timeFormat.format(new Date(endIso))}` : start;
}

// UTC instant -> { date: "2026-12-01", time: "19:00" } in PKT, for the form's inputs.
export function toPktInputs(iso) {
  if (!iso) return { date: '', time: '' };
  const p = {};
  for (const { type, value } of partsFormat.formatToParts(new Date(iso))) p[type] = value;
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

// "2026-12-01" + 1 day -> "2026-12-02" (Date.UTC handles month and year changes).
function nextDay(date) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
}

// Date + start/end time typed in PKT -> ISO strings with +05:00, as the API expects.
// An end time earlier than the start (e.g. 7 pm to 1 am) means the event ends the next day.
export function toApiTimes(date, startTime, endTime) {
  if (!date || !startTime) return { startAt: null, endAt: null };
  const startAt = `${date}T${startTime}:00+05:00`;
  if (!endTime) return { startAt, endAt: null };
  const endDate = endTime < startTime ? nextDay(date) : date;
  return { startAt, endAt: `${endDate}T${endTime}:00+05:00` };
}

// 0 -> "Free", 1500 -> "PKR 1,500"
export function formatPrice(price) {
  return Number(price) === 0 ? 'Free' : `PKR ${Number(price).toLocaleString('en-PK')}`;
}

// Tiers in the order Basic, Student, VIP, Special Guest.
export function sortTiers(tiers) {
  return [...(tiers || [])].sort((a, b) => TIER_TYPES.indexOf(a.type) - TIER_TYPES.indexOf(b.type));
}

// Which form step holds each field, so a server error can jump to the right step.
export function stepForField(field) {
  if (!field) return null;
  if (['title', 'description', 'genreId'].includes(field)) return 1;
  if (['cityId', 'venueId', 'startAt', 'endAt'].includes(field)) return 2;
  if (field === 'capacity' || field.startsWith('tiers')) return 3;
  return null;
}

// An event from the API -> the form's starting values (inputs hold text).
export function eventToForm(event) {
  const start = toPktInputs(event?.startAt);
  const end = toPktInputs(event?.endAt);
  return {
    title: event?.title || '',
    description: event?.description || '',
    genreId: event?.genreId ? String(event.genreId) : '',
    cityId: event?.cityId ? String(event.cityId) : '',
    venueId: event?.venueId ? String(event.venueId) : '',
    date: start.date,
    startTime: start.time,
    endTime: end.time,
    capacity: event?.capacity ? String(event.capacity) : '',
    tiers: sortTiers(event?.tiers).map((t) => ({
      type: t.type,
      price: String(t.price),
      limit: t.limit == null ? '' : String(t.limit),
    })),
  };
}

const numberOrNull = (v) => (v === '' || v == null ? null : Number(v));

// The form's values -> what the API expects.
// A published event may only change its description and capacity, so only those are sent.
export function formToPayload(form, isPublished) {
  if (isPublished) return { description: form.description, capacity: numberOrNull(form.capacity) };
  const { startAt, endAt } = toApiTimes(form.date, form.startTime, form.endTime);
  return {
    title: form.title,
    description: form.description,
    genreId: numberOrNull(form.genreId),
    venueId: numberOrNull(form.venueId),
    startAt,
    endAt,
    capacity: numberOrNull(form.capacity),
    // Rows with no type picked yet are skipped; Special Guest is always free.
    tiers: form.tiers
      .filter((t) => t.type)
      .map((t) => ({
        type: t.type,
        price: t.type === 'SPECIAL_GUEST' ? 0 : numberOrNull(t.price),
        limit: numberOrNull(t.limit),
      })),
  };
}
