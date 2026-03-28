const jwt = require('jsonwebtoken');
const env = require('../config/env');
const { getRedisClient } = require('../config/database');
const Ride = require('../models/Ride');
const logger = require('../utils/logger');

const setupSocket = (io) => {

  // Authentication middleware for WebSocket connections
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication required.'));
      }

      const redis = getRedisClient();
      const isBlacklisted = await redis.get(`blacklist:${token}`);
      if (isBlacklisted) {
        return next(new Error('Token has been revoked.'));
      }

      const decoded = jwt.verify(token, env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token.'));
    }
  });

  io.on('connection', (socket) => {
    logger.info(`Socket connected: ${socket.userId} (${socket.userRole})`);

    // Join a ride room
    socket.on('ride:join', async (data) => {
      try {
        const { rideId } = data;
        const ride = await Ride.findById(rideId);

        if (!ride) {
          return socket.emit('error', { message: 'Ride not found.' });
        }

        const isRider = ride.rider.toString() === socket.userId;
        const isDriver = ride.driver && ride.driver.toString() === socket.userId;

        if (!isRider && !isDriver) {
          return socket.emit('error', { message: 'You are not part of this ride.' });
        }

        socket.join(`ride:${rideId}`);
        socket.rideId = rideId;

        logger.info(`${socket.userRole} ${socket.userId} joined room ride:${rideId}`);

        socket.to(`ride:${rideId}`).emit('ride:user_joined', {
          userId: socket.userId,
          role: socket.userRole,
        });
      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Driver sends location update
    socket.on('location:update', async (data) => {
      try {
        if (socket.userRole !== 'driver') {
          return socket.emit('error', { message: 'Only drivers can send location updates.' });
        }

        const { rideId, longitude, latitude } = data;

        if (!rideId || longitude === undefined || latitude === undefined) {
          return socket.emit('error', { message: 'rideId, longitude, and latitude are required.' });
        }

        // Update Redis location (same as Phase 3)
        const redis = getRedisClient();
        await redis.geoadd('active_drivers', longitude, latitude, socket.userId);

        // Broadcast to everyone in the ride room (rider sees this)
        io.to(`ride:${rideId}`).emit('location:updated', {
          driverId: socket.userId,
          longitude,
          latitude,
          timestamp: new Date().toISOString(),
        });

      } catch (err) {
        socket.emit('error', { message: err.message });
      }
    });

    // Ride status change notification
    socket.on('ride:status_update', (data) => {
      const { rideId, status } = data;
      io.to(`ride:${rideId}`).emit('ride:status_changed', {
        rideId,
        status,
        updatedBy: socket.userRole,
        timestamp: new Date().toISOString(),
      });
    });

    // Leave ride room
    socket.on('ride:leave', () => {
      if (socket.rideId) {
        socket.leave(`ride:${socket.rideId}`);
        logger.info(`${socket.userRole} ${socket.userId} left room ride:${socket.rideId}`);
        socket.rideId = null;
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      logger.info(`Socket disconnected: ${socket.userId}`);
    });
  });
};

module.exports = setupSocket;