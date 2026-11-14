// Ushna: small helpers shared by routes/events.js, routes/lookups.js and routes/venues.js.

const { HttpError } = require('../auth/errors');
const { requireAuth, requireRole, requireVerified } = require('../middleware/auth');

// Runs a service function and sends its { status, body }.
// An HttpError becomes { error, field }; anything else goes to Zain's 500 handler.
const handle = (fn) => async (req, res, next) => {
  try {
    const { status, body } = await fn(req);
    res.status(status).json(body);
  } catch (err) {
    if (err instanceof HttpError) return res.status(err.status).json(err.toJSON());
    next(err);
  }
};

// Laiba's three checks: logged in (401), organizer (403), email verified (403).
const organizerOnly = [requireAuth, requireRole('ORGANIZER'), requireVerified];

// For public pages that show more to the owner (a draft's details page).
// Logged in with a good token: req.user is set. No token, or a bad/expired one: carry on as a guest
// (no 401, so a visitor with an old token can still open a published event from the calendar).
function optionalAuth(req, res, next) {
  if (!req.headers.authorization) return next();
  const guestRes = {
    status() { return this; },
    json() { next(); return this; },
    end() { next(); return this; },
  };
  return requireAuth(req, guestRes, next);
}

// The real services, created on first use so tests never load Prisma.
let services;
function live() {
  if (!services) {
    const db = require('../lib/prisma');
    const { audit, ACTIONS } = require('../lib/audit');
    const { createEventService } = require('./service');
    const { createPlacesService } = require('./places');
    services = {
      events: createEventService({ db, audit, ACTIONS }),
      places: createPlacesService({ db, audit, ACTIONS }),
    };
  }
  return services;
}

module.exports = { handle, organizerOnly, optionalAuth, live };
