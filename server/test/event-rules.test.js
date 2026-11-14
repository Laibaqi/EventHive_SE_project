const test = require('node:test');
const assert = require('node:assert');
const { checkPublish, checkPublishedEdit } = require('../src/events/rules');

const NOW = new Date('2026-11-12T10:00:00+05:00');

// A good event. Each test breaks ONE thing.
const good = () => ({
  title: 'Lahore Music Night',
  description: 'Live bands and food stalls.',
  genre: { id: 1, retired: false },
  venueId: 3,
  startAt: '2026-12-01T19:00:00+05:00',
  endAt: '2026-12-01T23:00:00+05:00',
  capacity: 200,
  tiers: [{ type: 'BASIC', price: 1500, limit: 150 }, { type: 'SPECIAL_GUEST', price: 0 }],
});

test('a good event passes', () => {
  assert.strictEqual(checkPublish(good(), NOW), null);
});

test('TC-EVNT-04: no capacity names capacity', () => {
  const e = { ...good(), capacity: null };
  assert.strictEqual(checkPublish(e, NOW).field, 'capacity');
});

test('TC-EVNT-04: start in the past names startAt', () => {
  const e = { ...good(), startAt: '2026-11-01T19:00:00+05:00' };
  assert.strictEqual(checkPublish(e, NOW).field, 'startAt');
});

test('TC-EVNT-04: no tiers names tiers', () => {
  const e = { ...good(), tiers: [] };
  assert.strictEqual(checkPublish(e, NOW).field, 'tiers');
});

test('TC-EVNT-05: two Basic tiers fail', () => {
  const e = { ...good(), tiers: [{ type: 'BASIC', price: 100 }, { type: 'BASIC', price: 200 }] };
  assert.ok(checkPublish(e, NOW));
});

test('TC-EVNT-05: limits above capacity fail', () => {
  const e = { ...good(), capacity: 100, tiers: [{ type: 'BASIC', price: 100, limit: 150 }] };
  assert.strictEqual(checkPublish(e, NOW).field, 'tiers');
});

test('TC-EVNT-06: Special Guest with a price fails', () => {
  const e = { ...good(), tiers: [{ type: 'SPECIAL_GUEST', price: 500 }] };
  assert.strictEqual(checkPublish(e, NOW).field, 'tiers.0.price');
});

test('TC-EVNT-08: changing the date of a published event names startAt', () => {
  assert.strictEqual(checkPublishedEdit(good(), { startAt: '2026-12-05T19:00:00+05:00' }).field, 'startAt');
});

test('TC-EVNT-09: capacity up is fine, down is refused', () => {
  assert.strictEqual(checkPublishedEdit(good(), { capacity: 300 }), null);
  assert.strictEqual(checkPublishedEdit(good(), { capacity: 100 }).field, 'capacity');
});

test('Published edit: sending an unchanged title is fine', () => {
  assert.strictEqual(checkPublishedEdit(good(), { title: 'Lahore Music Night', capacity: 250 }), null);
});

test('Published edit: same date written in UTC counts as unchanged', () => {
  assert.strictEqual(checkPublishedEdit(good(), { startAt: '2026-12-01T14:00:00Z' }), null);
});

test('A garbage start date is refused', () => {
  const e = { ...good(), startAt: 'abc' };
  assert.strictEqual(checkPublish(e, NOW).field, 'startAt');
});