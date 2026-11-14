// Starter data for EventHive. Run with:  npx prisma db seed
// Safe to run more than once: it never creates duplicates.
// Test accounts (all already email-verified), password: Test1234
//   admin@eventhive.test (Admin) · organizer@eventhive.test (Organizer) · attendee@eventhive.test (Attendee)
require('dotenv/config');
const prisma = require('../src/lib/prisma');
const { hashPassword } = require('../src/auth/password');

const CITIES = ['Karachi', 'Lahore', 'Islamabad'];
const GENRES = ['Tech', 'Music', 'Food', 'Sports', 'Workshop'];
const VENUES = {
  Karachi: [
    { name: 'Expo Centre Karachi', address: 'University Road, Gulshan-e-Iqbal' },
    { name: 'IBA City Campus Auditorium', address: 'Garden Road, Saddar' },
  ],
  Lahore: [
    { name: 'Alhamra Arts Council', address: 'The Mall, Lahore' },
    { name: 'Expo Centre Lahore', address: 'Johar Town, Lahore' },
  ],
  Islamabad: [
    { name: 'Pak-China Friendship Centre', address: 'Garden Avenue, Shakarparian' },
    { name: 'NUST Seecs Auditorium', address: 'H-12, Islamabad' },
  ],
};
const USERS = [
  { name: 'EventHive Admin', email: 'admin@eventhive.test', role: 'ADMIN' },
  { name: 'Test Organizer', email: 'organizer@eventhive.test', role: 'ORGANIZER' },
  { name: 'Test Attendee', email: 'attendee@eventhive.test', role: 'ATTENDEE' },
];

// A date in the current month at the given day and PKT hour (stored as UTC).
function thisMonth(day, hourPkt) {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day, hourPkt - 5, 0, 0));
}

async function main() {
  const cities = {};
  for (const name of CITIES) {
    cities[name] = await prisma.city.upsert({ where: { name }, update: {}, create: { name } });
  }

  const genres = {};
  for (const name of GENRES) {
    genres[name] = await prisma.genre.upsert({ where: { name }, update: {}, create: { name } });
  }

  const venues = {};
  for (const [cityName, list] of Object.entries(VENUES)) {
    for (const v of list) {
      const found = await prisma.venue.findFirst({ where: { name: v.name, cityId: cities[cityName].id } });
      venues[v.name] = found || (await prisma.venue.create({ data: { ...v, cityId: cities[cityName].id } }));
    }
  }

  const passwordHash = await hashPassword('Test1234');
  const users = {};
  for (const u of USERS) {
    users[u.role] = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { ...u, passwordHash, emailVerifiedAt: new Date() },
    });
  }

  const EVENTS = [
    { title: 'Karachi Tech Meetup', genre: 'Tech', venue: 'IBA City Campus Auditorium', day: 18, hour: 18, capacity: 200, tiers: [{ type: 'BASIC', price: 0 }] },
    { title: 'Lahore Food Festival', genre: 'Food', venue: 'Expo Centre Lahore', day: 21, hour: 16, capacity: 500, tiers: [{ type: 'BASIC', price: 500 }, { type: 'VIP', price: 2000, limit: 50 }] },
    { title: 'Islamabad Music Night', genre: 'Music', venue: 'Pak-China Friendship Centre', day: 25, hour: 19, capacity: 300, tiers: [{ type: 'BASIC', price: 1500 }, { type: 'STUDENT', price: 800 }] },
  ];
  for (const e of EVENTS) {
    const exists = await prisma.event.findFirst({ where: { title: e.title, organizerId: users.ORGANIZER.id } });
    if (exists) continue;
    const venue = venues[e.venue];
    await prisma.event.create({
      data: {
        title: e.title,
        description: `${e.title}: a sample event created by the seed script for testing the calendar and event pages.`,
        organizerId: users.ORGANIZER.id,
        genreId: genres[e.genre].id,
        venueId: venue.id,
        cityId: venue.cityId,
        startAt: thisMonth(e.day, e.hour),
        endAt: thisMonth(e.day, e.hour + 3),
        capacity: e.capacity,
        status: 'PUBLISHED',
        tiers: { create: e.tiers },
      },
    });
  }

  console.log('Seed done: 3 cities, 5 genres, 6 venues, 3 test users (password Test1234), 3 published events this month.');
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
