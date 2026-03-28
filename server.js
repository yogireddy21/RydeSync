require('dotenv').config();
const http = require('http');
const app = require('./src/app');
const { connectDatabase } = require('./src/config/database');
const { persistLocationsToMongo } = require('./src/services/driverService');
const setupSocket = require('./src/sockets/socketHandler');
const logger = require('./src/utils/logger');
const env = require('./src/config/env');
const { Server } = require('socket.io');

const startServer = async () => {
  await connectDatabase();

  const server = http.createServer(app);

  const io = new Server(server, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  // Make io accessible in routes/controllers if needed
  app.set('io', io);

  setupSocket(io);

  // Persist driver locations every 30 seconds
  setInterval(async () => {
    try {
      await persistLocationsToMongo();
    } catch (err) {
      logger.error(`Location persistence failed: ${err.message}`);
    }
  }, 30000);

  server.listen(env.PORT, () => {
    logger.info(`RideSync server running on port ${env.PORT} in ${env.NODE_ENV} mode`);
  });
};

startServer();