// Ushna: event creation APIs.
//
//   POST  /api/events              organizer: save a new draft            -> 201 { event }
//   GET   /api/events/mine         organizer: my events, newest first     -> 200 { events }
//   PATCH /api/events/:id          owner: save changes                    -> 200 { event }
//   POST  /api/events/:id/publish  owner: full check, then PUBLISHED      -> 200 { event }
//   GET   /api/events/:id          public if published; drafts owner-only -> 200 { event }
//
// Errors are always { error, field }. The logic is in src/events/service.js.

const express = require('express');
const { HttpError } = require('../auth/errors');
const { parseEventId } = require('../events/input');
const { handle, organizerOnly, optionalAuth, live } = require('../events/http');

const router = express.Router();
const events = () => live().events;

function eventId(req) {
  const id = parseEventId(req.params.id);
  if (!id) throw new HttpError(404, 'Event not found', null);
  return id;
}

router.post('/', organizerOnly, handle((req) => events().create(req.user, req.body)));
// '/mine' must come before '/:id', or Express would treat "mine" as an id.
router.get('/mine', organizerOnly, handle((req) => events().listMine(req.user)));
router.patch('/:id', organizerOnly, handle((req) => events().update(req.user, eventId(req), req.body)));
router.post('/:id/publish', organizerOnly, handle((req) => events().publish(req.user, eventId(req))));
router.get('/:id', optionalAuth, handle((req) => events().getOne(req.user || null, eventId(req))));

module.exports = router;
