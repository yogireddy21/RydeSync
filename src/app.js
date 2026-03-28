const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const env = require('./config/env');
const logger = require('./utils/logger');

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
// Adds ~15 protective HTTP headers on every response automatically
// Without this: open to clickjacking, MIME sniffing, XSS via headers
app.use(helmet());

// ── Body parsing ──────────────────────────────────────────────────────────────
// Reads the JSON body of incoming requests and puts it on req.body
// 10kb limit: prevents someone sending a 100MB JSON body to crash your process
app.use(express.json({ limit: '10kb' }));

// ── Global rate limiter ───────────────────────────────────────────────────────
// Each IP gets max 100 requests per 15 minutes across all routes
// Without this: one IP can flood your API and starve every other user
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit hit: ${req.ip} on ${req.originalUrl}`);
    res.status(429).json({
      success: false,
      message: 'Too many requests. Please try again after 15 minutes.',
    });
  },
});
app.use(globalLimiter);

// ── Health check ──────────────────────────────────────────────────────────────
// Railway and Docker ping this route to confirm the server is alive
// No auth needed here — it just checks if the process is responding
app.get('/health', (req, res) => {
  res.status(200).json({ success: true, message: 'RideSync API is running' });
});

// ── API Routes ────────────────────────────────────────────────────────────────
// We will uncomment these one by one as we build each phase
app.use('/api/v1/auth', require('./routes/authRoutes'));
app.use('/api/v1/driver', require('./routes/driverRoutes'));
app.use('/api/v1/rides', require('./routes/rideRoutes'));
app.use('/api/v1/surge', require('./routes/surgeRoutes'));

// ── 404 handler ───────────────────────────────────────────────────────────────
// Any request that didn't match a route above falls through to here
// Without this: Express sends back ugly HTML "Cannot GET /xyz"
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
// 4 parameters = Express treats this as the error handler
// Any next(err) call anywhere in the app jumps directly here
// Without this: errors crash the process or leak stack traces to the client
app.use((err, req, res, next) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    // Stack trace only in development — never expose this in production
    ...(env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;