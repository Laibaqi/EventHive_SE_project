// Ushna: GET /api/lookups (no login) -> { cities: [active], genres: [not retired] }
// Used by the event form's dropdowns.
const express = require('express');
const { handle, live } = require('../events/http');

const router = express.Router();
router.get('/', handle(() => live().places.lookups()));

module.exports = router;
