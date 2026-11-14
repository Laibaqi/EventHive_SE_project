// Ushna: venues for the event form.
//   GET  /api/venues?cityId=2                 public -> { venues }
//   POST /api/venues { name, address, cityId, contactEmail? }  organizer -> 201 { venue }
const express = require('express');
const { handle, organizerOnly, live } = require('../events/http');

const router = express.Router();
router.get('/', handle((req) => live().places.venuesInCity(req.query.cityId)));
router.post('/', organizerOnly, handle((req) => live().places.createVenue(req.user, req.body)));

module.exports = router;
