const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const eventRoutes = require('./routes/events');
const calendarRoutes = require('./routes/calendar');
const lookupRoutes = require('./routes/lookups');
const venueRoutes = require('./routes/venues');
const errorHandler = require('./middleware/error');

const app = express();

// Railway/Vercel sit behind a proxy; needed so rate limiting sees the real IP
app.set('trust proxy', 1);

app.use(cors({ origin: process.env.CLIENT_URL }));
app.use(helmet());
app.use(express.json({ limit: '100kb' }));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/lookups', lookupRoutes);
app.use('/api/venues', venueRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found', field: null }));
app.use(errorHandler);

module.exports = app;
