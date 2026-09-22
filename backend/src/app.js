const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const authRoutes = require('./routes/auth');
const listingRoutes = require('./routes/listings');
const threadRoutes = require('./routes/threads');
const paymentRoutes = require('./routes/payments');
const dashboardRoutes = require('./routes/dashboard');
const adminRoutes = require('./routes/admin');
const savedListingsRoutes = require('./routes/savedListings');
const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors({ origin: config.frontendUrl }));
// Stripe webhook signature verification needs the raw, unparsed request
// body — this must be registered before the global express.json() below so
// only this one path's body arrives as a Buffer instead of already-parsed
// JSON (see routes/payments.js's POST /webhook).
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.get('/health', (req, res) => res.json({ ok: true }));

app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/owner', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/saved-listings', savedListingsRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));
app.use(errorHandler);

module.exports = app;
