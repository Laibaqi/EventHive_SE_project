// Hamza: date helpers for the calendar page.
// The API sends times in UTC; everything here shows them in Pakistan time.

const TIME_ZONE = 'Asia/Karachi';

// en-CA writes dates as YYYY-MM-DD, which makes a handy key for each day.
const dayKeyFormat = new Intl.DateTimeFormat('en-CA', {
  timeZone: TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const timeFormat = new Intl.DateTimeFormat('en-PK', {
  timeZone: TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
});
const monthFormat = new Intl.DateTimeFormat('en-PK', {
  timeZone: TIME_ZONE,
  month: 'long',
  year: 'numeric',
});
const dayHeadingFormat = new Intl.DateTimeFormat('en-PK', {
  timeZone: TIME_ZONE,
  weekday: 'short',
  day: 'numeric',
  month: 'short',
});

// The PKT day an instant falls on, e.g. "2026-11-18".
// An event at 19:30 UTC on 31 Oct is 00:30 on 1 Nov in Pakistan, so it gets "2026-11-01".
export function pktDayKey(date) {
  const parts = {};
  for (const { type, value } of dayKeyFormat.formatToParts(new Date(date))) {
    parts[type] = value;
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function todayKey() {
  return pktDayKey(new Date());
}

// This month in Pakistan, e.g. "2026-11".
export function currentMonth() {
  return todayKey().slice(0, 7);
}

// Same rule as the API: year 1000-2999 and month 01-12.
export function isValidMonth(value) {
  return typeof value === 'string' && /^[12]\d{3}-(0[1-9]|1[0-2])$/.test(value);
}

// shiftMonth("2026-12", 1) -> "2027-01". Date.UTC handles the year change.
export function shiftMonth(month, change) {
  const [year, monthNumber] = month.split('-').map(Number);
  const date = new Date(Date.UTC(year, monthNumber - 1 + change, 1));
  const newMonth = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${date.getUTCFullYear()}-${newMonth}`;
}

// Midnight in Pakistan at the start of a day key, so formatting it in PKT gives that same day.
function pktMidnight(dayKey) {
  return new Date(`${dayKey}T00:00:00+05:00`);
}

// "2026-11" -> "November 2026"
export function monthLabel(month) {
  return monthFormat.format(pktMidnight(`${month}-01`));
}

// "2026-11-18" -> "Wed, 18 Nov"
export function dayHeading(dayKey) {
  return dayHeadingFormat.format(pktMidnight(dayKey));
}

// "2026-11-18T13:00:00.000Z" -> "6:00 pm"
export function formatTime(isoString) {
  return isoString ? timeFormat.format(new Date(isoString)) : '';
}

// The month as weeks of 7 days, Monday first.
// Each cell is a day key like "2026-11-18", or null for the blanks before the 1st and after the last day.
export function buildMonthGrid(month) {
  const [year, monthNumber] = month.split('-').map(Number);
  // Day 0 of next month is the last day of this month.
  const daysInMonth = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  // getUTCDay() counts from Sunday = 0; shift it so Monday = 0.
  const blanksBefore = (new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay() + 6) % 7;

  const cells = Array(blanksBefore).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(`${month}-${String(day).padStart(2, '0')}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

// { "2026-11-18": [event, event], ... }, keeping the API's order (sorted by start time).
export function groupByDay(events) {
  const byDay = {};
  for (const event of events) {
    if (!event.startAt) continue; // published events always have one; this just avoids a crash
    const key = pktDayKey(event.startAt);
    if (!byDay[key]) byDay[key] = [];
    byDay[key].push(event);
  }
  return byDay;
}
