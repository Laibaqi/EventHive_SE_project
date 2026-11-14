// Tests for the Calendar API (GET /api/calendar). No database needed:
// the route gets a fake findEvents instead of Prisma.
const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
  MONTH_ERROR,
  monthRange,
  parseId,
  buildEventQuery,
  toCalendarEvent,
} = require('../src/calendar/month');
const { createCalendarRouter } = require('../src/routes/calendar');

// ---------- monthRange: month boundaries in Pakistan time ----------

describe('monthRange', () => {
  test('normal month: 2026-11 starts and ends at 19:00 UTC the day before', () => {
    const { start, end } = monthRange('2026-11');
    assert.equal(start.toISOString(), '2026-10-31T19:00:00.000Z');
    assert.equal(end.toISOString(), '2026-11-30T19:00:00.000Z');
  });

  test('December rolls over into January of the next year', () => {
    const { start, end } = monthRange('2026-12');
    assert.equal(start.toISOString(), '2026-11-30T19:00:00.000Z');
    assert.equal(end.toISOString(), '2026-12-31T19:00:00.000Z');
  });

  test('January starts on the last evening of the previous year', () => {
    const { start } = monthRange('2027-01');
    assert.equal(start.toISOString(), '2026-12-31T19:00:00.000Z');
  });

  test('February in a leap year has 29 days', () => {
    const { start, end } = monthRange('2028-02');
    assert.equal(start.toISOString(), '2028-01-31T19:00:00.000Z');
    assert.equal(end.toISOString(), '2028-02-29T19:00:00.000Z');
  });

  test('February in a normal year has 28 days', () => {
    const { end } = monthRange('2027-02');
    assert.equal(end.toISOString(), '2027-02-28T19:00:00.000Z');
  });

  test('bad input returns null', () => {
    const bad = ['abc', '2026-13', '2026-00', '2026-1', '26-11', '2026-11-01', ' 2026-11', '', undefined, null, 202611, ['2026-11'], {}];
    for (const value of bad) {
      assert.equal(monthRange(value), null, `expected null for ${JSON.stringify(value)}`);
    }
  });
});

// ---------- parseId: optional cityId / genreId ----------

describe('parseId', () => {
  test('missing or empty means "no filter"', () => {
    assert.equal(parseId(undefined), undefined);
    assert.equal(parseId(''), undefined);
  });

  test('a positive whole number is returned as a number', () => {
    assert.equal(parseId('1'), 1);
    assert.equal(parseId('42'), 42);
    assert.equal(parseId('2147483647'), 2147483647);
  });

  test('anything else is invalid (null)', () => {
    const bad = ['abc', '0', '-1', '1.5', '01', '1e3', ' 1', '2147483648', ['1', '2'], {}, 5];
    for (const value of bad) {
      assert.equal(parseId(value), null, `expected null for ${JSON.stringify(value)}`);
    }
  });
});

// ---------- buildEventQuery: what we ask Prisma for ----------

describe('buildEventQuery', () => {
  const range = monthRange('2026-11');

  test('only published events that start inside the month, sorted by start time (TC-CAL-02)', () => {
    const query = buildEventQuery(range);
    assert.deepEqual(query.where, {
      status: 'PUBLISHED',
      startAt: { gte: range.start, lt: range.end },
    });
    assert.deepEqual(query.orderBy, [{ startAt: 'asc' }, { id: 'asc' }]);
  });

  test('adds city and genre filters only when given', () => {
    const query = buildEventQuery({ ...range, cityId: 3, genreId: 7 });
    assert.equal(query.where.cityId, 3);
    assert.equal(query.where.genreId, 7);
    assert.equal('cityId' in buildEventQuery(range).where, false);
  });

  test('selects only the fields the reply needs', () => {
    const { select } = buildEventQuery(range);
    assert.deepEqual(Object.keys(select).sort(), ['city', 'endAt', 'genre', 'id', 'startAt', 'title', 'venue']);
    assert.deepEqual(select.city, { select: { id: true, name: true } });
  });
});

// ---------- toCalendarEvent: shape of each event in the reply ----------

describe('toCalendarEvent', () => {
  test('full event becomes ISO UTC times and { id, name } objects', () => {
    const event = toCalendarEvent({
      id: 5,
      title: 'Qawwali Night',
      startAt: new Date('2026-11-20T14:00:00.000Z'),
      endAt: new Date('2026-11-20T17:00:00.000Z'),
      city: { id: 1, name: 'Lahore' },
      genre: { id: 2, name: 'Music' },
      venue: { id: 3, name: 'Alhamra Hall', address: 'not sent' },
    });
    assert.deepEqual(event, {
      id: 5,
      title: 'Qawwali Night',
      startAt: '2026-11-20T14:00:00.000Z',
      endAt: '2026-11-20T17:00:00.000Z',
      city: { id: 1, name: 'Lahore' },
      genre: { id: 2, name: 'Music' },
      venue: { id: 3, name: 'Alhamra Hall' },
    });
  });

  test('missing optional fields become null instead of crashing', () => {
    const event = toCalendarEvent({
      id: 6,
      title: null,
      startAt: new Date('2026-11-21T05:00:00.000Z'),
      endAt: null,
      city: null,
      genre: null,
      venue: null,
    });
    assert.deepEqual(event, {
      id: 6,
      title: null,
      startAt: '2026-11-21T05:00:00.000Z',
      endAt: null,
      city: null,
      genre: null,
      venue: null,
    });
  });
});

// ---------- The route itself, on a small test server ----------

describe('GET /api/calendar', () => {
  let server;
  let baseUrl;
  let calls; // queries the fake findEvents received
  let rows; // what the fake "database" returns
  let failWith; // set to an Error to make findEvents fail
  let passedToNext; // error that reached the error handler

  before(async () => {
    const app = express();
    const findEvents = async (query) => {
      calls.push(query);
      if (failWith) throw failWith;
      return rows;
    };
    app.use('/api/calendar', createCalendarRouter({ findEvents }));
    // Stand-in for Zain's error handler, so we can see what next(err) received.
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      passedToNext = err;
      res.status(500).json({ error: 'Something went wrong', field: null });
    });

    await new Promise((resolve) => {
      server = app.listen(0, resolve); // port 0 = any free port
    });
    baseUrl = `http://127.0.0.1:${server.address().port}/api/calendar`;
  });

  after(() => server.close());

  beforeEach(() => {
    calls = [];
    rows = [];
    failWith = null;
    passedToNext = null;
  });

  async function get(query) {
    const response = await fetch(baseUrl + query);
    return { status: response.status, body: await response.json() };
  }

  test('missing or badly formatted month gives 400 with the month error (TC-CAL-05)', async () => {
    for (const query of ['', '?month=', '?month=abc', '?month=2026-13', '?month=2026-1', '?month=2026-00']) {
      const { status, body } = await get(query);
      assert.equal(status, 400, `status for "${query}"`);
      assert.deepEqual(body, { error: MONTH_ERROR, field: 'month' });
    }
    assert.equal(calls.length, 0, 'database is not called for bad input');
  });

  test('month sent twice (an array) gives the same 400', async () => {
    const { status, body } = await get('?month=2026-11&month=2026-12');
    assert.equal(status, 400);
    assert.deepEqual(body, { error: MONTH_ERROR, field: 'month' });
  });

  test('bad cityId or genreId gives 400 on that field, including arrays', async () => {
    for (const bad of ['abc', '0', '-1', '1.5', '1&cityId=2']) {
      const { status, body } = await get(`?month=2026-11&cityId=${bad}`);
      assert.equal(status, 400, `status for cityId=${bad}`);
      assert.deepEqual(body, { error: 'City must be a valid ID', field: 'cityId' });
    }
    for (const bad of ['abc', '1&genreId=2']) {
      const { status, body } = await get(`?month=2026-11&genreId=${bad}`);
      assert.equal(status, 400, `status for genreId=${bad}`);
      assert.deepEqual(body, { error: 'Genre must be a valid ID', field: 'genreId' });
    }
    assert.equal(calls.length, 0);
  });

  test('valid month returns { month, events } with published events only (TC-CAL-01, TC-CAL-02)', async () => {
    rows = [
      {
        id: 1,
        title: 'Book Fair',
        startAt: new Date('2026-11-01T05:00:00.000Z'),
        endAt: null,
        city: { id: 1, name: 'Karachi' },
        genre: null,
        venue: { id: 4, name: 'Expo Centre' },
      },
    ];
    const { status, body } = await get('?month=2026-11');

    assert.equal(status, 200);
    assert.deepEqual(body, {
      month: '2026-11',
      events: [
        {
          id: 1,
          title: 'Book Fair',
          startAt: '2026-11-01T05:00:00.000Z',
          endAt: null,
          city: { id: 1, name: 'Karachi' },
          genre: null,
          venue: { id: 4, name: 'Expo Centre' },
        },
      ],
    });

    // The database was asked for PUBLISHED events in the PKT month, sorted by start time.
    assert.equal(calls.length, 1);
    const { where, orderBy } = calls[0];
    assert.equal(where.status, 'PUBLISHED');
    assert.equal(where.startAt.gte.toISOString(), '2026-10-31T19:00:00.000Z');
    assert.equal(where.startAt.lt.toISOString(), '2026-11-30T19:00:00.000Z');
    assert.deepEqual(orderBy[0], { startAt: 'asc' });
  });

  test('a month with no events returns an empty list', async () => {
    const { status, body } = await get('?month=2027-01');
    assert.equal(status, 200);
    assert.deepEqual(body, { month: '2027-01', events: [] });
  });

  test('cityId and genreId filters reach the query as numbers', async () => {
    await get('?month=2026-11&cityId=3&genreId=7');
    assert.equal(calls[0].where.cityId, 3);
    assert.equal(calls[0].where.genreId, 7);
  });

  test('empty cityId (e.g. "All cities") means no filter', async () => {
    const { status } = await get('?month=2026-11&cityId=');
    assert.equal(status, 200);
    assert.equal('cityId' in calls[0].where, false);
  });

  test('a database error goes to next(err), which sends the 500', async () => {
    failWith = new Error('database is down');
    const { status, body } = await get('?month=2026-11');
    assert.equal(status, 500);
    assert.deepEqual(body, { error: 'Something went wrong', field: null });
    assert.equal(passedToNext, failWith);
  });
});
