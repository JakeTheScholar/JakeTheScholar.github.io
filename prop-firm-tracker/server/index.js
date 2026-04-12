"use strict";

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const { requireAuth } = require('./middleware/auth');
const { apiLimiter, authLimiter } = require('./middleware/rate-limit');

const app = express();
const PORT = process.env.PORT || 3002;

// Railway deploys behind a reverse proxy — required for rate limiting to use real client IPs
app.set('trust proxy', 1);

// ═══ Security middleware ═══
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'none'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdn.jsdelivr.net"],
      fontSrc: ["https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://*.supabase.co"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"],
    },
  },
}));

app.use(express.json({ limit: '1mb' })); // Import payloads can be large

// CORS — allow same-origin (Railway serves frontend + API)
const ALLOWED_ORIGINS = [
  'https://prop-firm-tracker-production.up.railway.app',
  'http://localhost:3002',
  'http://127.0.0.1:3002',
];
app.use(cors({
  origin(origin, cb) {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS blocked'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200,
}));

// ═══ Static files (client) ═══
app.use(express.static(path.join(__dirname, '..', 'client')));

// ═══ Health check ═══
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ═══ Auth config (public — needed by Supabase JS client) ═══
app.get('/api/auth/config', authLimiter, (_req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  });
});

// ═══ Protected API routes ═══
app.use('/api', apiLimiter, requireAuth);

const accountRoutes = require('./routes/accounts');
const journalRoutes = require('./routes/journal');
const payoutRoutes = require('./routes/payouts');
const statsRoutes = require('./routes/stats');
const importRoutes = require('./routes/import');

app.use('/api/accounts', accountRoutes);
app.use('/api', journalRoutes);   // /api/journal/*, /api/accounts/:id/journal
app.use('/api', payoutRoutes);    // /api/payouts/*, /api/accounts/:id/payouts
app.use('/api', statsRoutes);     // /api/accounts/:id/stats, /api/dashboard
app.use('/api', importRoutes);    // /api/import, /api/export

// ═══ SPA fallback — serve index.html for client routes ═══
app.get('*', (req, res) => {
  // Don't serve HTML for API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(path.join(__dirname, '..', 'client', 'index.html'));
});

// ═══ Global error handler ═══
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══ Start ═══
app.listen(PORT, () => {
  console.log(`Prop Firm Tracker running on port ${PORT}`);
});
