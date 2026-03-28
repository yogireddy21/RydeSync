require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');
const logger = require('./src/utils/logger');
const env = require('./src/config/env');

// ── Create HTTP server ────────────────────────────────────────────────────────
// We wrap Express in a raw Node HTTP server instead of app.listen()
// Reason: Socket.io (Phase 5) must attach to this same server instance
// If we used app.listen() we'd lose the reference and couldn't add WebSockets later
// GoF Singleton: one server instance shared across Express and Socket.io
const server = http.createServer(app);

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// SIGTERM = sent by Railway/Docker when restarting or stopping the container
// SIGINT  = sent when you press Ctrl+C in terminal during development
// Without this: process dies instantly, active requests are dropped,
// MongoDB connections are left hanging, Bull jobs can duplicate on restart
const shutdown = async (signal) => {
  logger.info(`${signal} received — starting graceful shutdown`);

  // Stop accepting new connections, finish the ones already in progress
  server.close(async () => {
    logger.info('HTTP server closed');

    // Close MongoDB connection cleanly
    // Without this: MongoDB thinks the client is still connected
    // and holds the connection open on its side, wasting resources
    const mongoose = require('mongoose');
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');

    // Redis client will be closed here in Phase 3
    // redisClient.quit()

    logger.info('Graceful shutdown complete');
    process.exit(0);
  });

  // Safety net: if graceful shutdown takes more than 10 seconds
  // something is stuck (a hanging DB query, a stuck request)
  // Force kill so Railway/Docker doesn't wait forever
  setTimeout(() => {
    logger.error('Graceful shutdown timed out — forcing exit');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// ── Unhandled promise rejections ──────────────────────────────────────────────
// Happens when a Promise rejects and no .catch() handles it
// Example: await db.save() fails but you forgot try/catch
// Without this: Node prints a warning but keeps running in a broken state
// You'd never know the DB write failed
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled Promise Rejection: ${reason}`);
  // Don't exit — log it and let the request fail naturally via the error handler
});

// ── Uncaught exceptions ───────────────────────────────────────────────────────
// Happens when a synchronous throw is never caught anywhere
// These are always fatal — process state is undefined after this
// Log it for the paper trail, then exit
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught Exception — process will exit: ${err.message}`);
  process.exit(1);
});

// ── Boot sequence ─────────────────────────────────────────────────────────────
// SOLID SRP: this function has one job — start the server in the correct order
// Connect DB first → if it fails, don't start → no broken requests ever served
const start = async () => {
  try {
    await connectDatabase();

    // Redis connection added here in Phase 3
    // await connectRedis();

    server.listen(env.PORT, () => {
      logger.info(`RideSync server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });
  } catch (err) {
    logger.error(`Failed to start server: ${err.message}`);
    process.exit(1);
  }
};

start();