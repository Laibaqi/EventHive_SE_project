// Hamza: calendar APIs
// GET /api/calendar?month=2026-11&cityId=1&genreId=2 (cityId and genreId are optional)
// Public (no requireAuth), so guests can browse published events.
const express = require('express');
const {
  MONTH_ERROR,
  monthRange,
  parseId,
  buildEventQuery,
  toCalendarEvent,
} = require('../calendar/month');

// findEvents is passed in so tests can use a fake instead of the database.
function createCalendarRouter({ findEvents }) {
  const router = express.Router();

  router.get('/', async (req, res, next) => {
    // validate() only checks req.body, so the query string is checked here.
    const { month } = req.query;
    const range = monthRange(month);
    if (!range) {
      return res.status(400).json({ error: MONTH_ERROR, field: 'month' });
    }

    const cityId = parseId(req.query.cityId);
    if (cityId === null) {
      return res.status(400).json({ error: 'City must be a valid ID', field: 'cityId' });
    }

    const genreId = parseId(req.query.genreId);
    if (genreId === null) {
      return res.status(400).json({ error: 'Genre must be a valid ID', field: 'genreId' });
    }

    try {
      const events = await findEvents(buildEventQuery({ ...range, cityId, genreId }));
      res.json({ month, events: events.map(toCalendarEvent) });
    } catch (err) {
      next(err); // Zain's error handler sends the 500
    }
  });

  return router;
}

// The real database lookup. Prisma is loaded on first use (like auth/deps.js),
// so tests never need a database or a generated Prisma client.
function findEvents(query) {
  const prisma = require('../lib/prisma');
  return prisma.event.findMany(query);
}

// app.js mounts this ready-made router; tests use createCalendarRouter with a fake.
module.exports = createCalendarRouter({ findEvents });
module.exports.createCalendarRouter = createCalendarRouter;
