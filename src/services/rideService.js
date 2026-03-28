const { getRedisClient } = require('../config/database');
const Ride = require('../models/Ride');
const User = require('../models/User');
const { getNearbyDrivers } = require('./driverService');
const logger = require('../utils/logger');
const { getSurgeMultiplier, incrementDemand, decrementDemand } = require('./surgeService');
const LOCK_TTL = 30;

const getIO = () => {
  try {
    const app = require('../app');
    return app.get('io');
  } catch (err) {
    return null;
  }
};

const acquireLock = async (driverId, rideId) => {
  const redis = getRedisClient();
  const result = await redis.set(
    `lock:driver:${driverId}`,
    rideId,
    'EX',
    LOCK_TTL,
    'NX'
  );
  return result === 'OK';
};

const releaseLock = async (driverId) => {
  const redis = getRedisClient();
  await redis.del(`lock:driver:${driverId}`);
};

const requestRide = async (riderId, pickupCoords, destinationCoords, pickupAddress, destinationAddress) => {
  const existingRide = await Ride.findOne({
    rider: riderId,
    status: { $in: ['REQUESTED', 'MATCHED', 'ACCEPTED', 'DRIVER_ARRIVED', 'IN_PROGRESS'] },
  });

  if (existingRide) {
    const error = new Error('You already have an active ride.');
    error.statusCode = 400;
    throw error;
  }

  const nearbyDrivers = await getNearbyDrivers(
    pickupCoords[0],
    pickupCoords[1],
    5,
    5
  );

  if (nearbyDrivers.length === 0) {
    const error = new Error('No drivers available nearby. Please try again later.');
    error.statusCode = 404;
    throw error;
  }

   const surgeMultiplier = await getSurgeMultiplier(pickupCoords[0], pickupCoords[1]);
  await incrementDemand(pickupCoords[0], pickupCoords[1]);

  const BASE_FARE = 5000;
  const PER_KM_RATE = 1200;
  const PER_MIN_RATE = 200;

  const ride = await Ride.create({
    rider: riderId,
    pickup: {
      type: 'Point',
      coordinates: pickupCoords,
      address: pickupAddress,
    },
    destination: {
      type: 'Point',
      coordinates: destinationCoords,
      address: destinationAddress,
    },
    status: 'REQUESTED',
    matchedDrivers: nearbyDrivers.map((d) => d.driverId),
    fare: {
      baseFare: BASE_FARE,
      perKmRate: PER_KM_RATE,
      perMinRate: PER_MIN_RATE,
      surgeMultiplier,
    },
  });

  const matchedDriver = await tryMatchDriver(ride);

  if (!matchedDriver) {
    ride.status = 'CANCELLED';
    ride.cancelledBy = 'rider';
    ride.cancelReason = 'No driver accepted the ride.';
    await ride.save();

    const error = new Error('No driver could be matched. Please try again.');
    error.statusCode = 404;
    throw error;
  }

  return ride;
};

const tryMatchDriver = async (ride) => {
  for (let i = ride.currentDriverIndex; i < ride.matchedDrivers.length; i++) {
    const driverId = ride.matchedDrivers[i].toString();

    const locked = await acquireLock(driverId, ride._id.toString());

    if (!locked) {
      logger.info(`Driver ${driverId} already locked, trying next`);
      continue;
    }

    ride.driver = driverId;
    ride.currentDriverIndex = i;
    ride.transitionTo('MATCHED');
    await ride.save();

    const io = getIO();
    if (io) {
      io.to(`ride:${ride._id}`).emit('ride:status_changed', {
        rideId: ride._id,
        status: 'MATCHED',
        driverId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Ride ${ride._id} matched with driver ${driverId}`);
    return driverId;
  }

  return null;
};

const respondToRide = async (driverId, rideId, accept) => {
  const ride = await Ride.findById(rideId);

  if (!ride) {
    const error = new Error('Ride not found.');
    error.statusCode = 404;
    throw error;
  }

  if (ride.driver.toString() !== driverId) {
    const error = new Error('This ride is not assigned to you.');
    error.statusCode = 403;
    throw error;
  }

  if (ride.status !== 'MATCHED') {
    const error = new Error(`Cannot respond to ride in ${ride.status} state.`);
    error.statusCode = 400;
    throw error;
  }

  if (accept) {
    ride.transitionTo('ACCEPTED');
    await ride.save();
    await releaseLock(driverId);

    const io = getIO();
    if (io) {
      io.to(`ride:${rideId}`).emit('ride:status_changed', {
        rideId,
        status: 'ACCEPTED',
        driverId,
        timestamp: new Date().toISOString(),
      });
    }

    logger.info(`Driver ${driverId} accepted ride ${rideId}`);
    return ride;
  }

  await releaseLock(driverId);
  logger.info(`Driver ${driverId} rejected ride ${rideId}`);

  ride.driver = null;
  ride.currentDriverIndex += 1;
  ride.status = 'REQUESTED';
  await ride.save();

  const nextDriver = await tryMatchDriver(ride);

  if (!nextDriver) {
    ride.status = 'CANCELLED';
    ride.cancelledBy = 'rider';
    ride.cancelReason = 'No driver accepted the ride.';
    await ride.save();

    const io = getIO();
    if (io) {
      io.to(`ride:${rideId}`).emit('ride:cancelled', {
        rideId,
        reason: 'No driver accepted the ride.',
        timestamp: new Date().toISOString(),
      });
    }

    const error = new Error('No more drivers available.');
    error.statusCode = 404;
    throw error;
  }

  return ride;
};

const updateRideStatus = async (driverId, rideId, newStatus) => {
  const ride = await Ride.findById(rideId);

  if (!ride) {
    const error = new Error('Ride not found.');
    error.statusCode = 404;
    throw error;
  }

  if (ride.driver.toString() !== driverId) {
    const error = new Error('This ride is not assigned to you.');
    error.statusCode = 403;
    throw error;
  }

  ride.transitionTo(newStatus);

  if (newStatus === 'IN_PROGRESS') {
    ride.startedAt = new Date();
  }

  if (newStatus === 'COMPLETED') {
    ride.completedAt = new Date();
  }

  await ride.save();

    if (newStatus === 'COMPLETED' && ride.pickup && ride.pickup.coordinates) {
    await decrementDemand(ride.pickup.coordinates[0], ride.pickup.coordinates[1]);
  }

  const io = getIO();
  if (io) {
    io.to(`ride:${rideId}`).emit('ride:status_changed', {
      rideId,
      status: newStatus,
      timestamp: new Date().toISOString(),
    });
  }

  logger.info(`Ride ${rideId} status updated to ${newStatus}`);
  return ride;
};

const cancelRide = async (userId, rideId, role, reason) => {
  const ride = await Ride.findById(rideId);

  if (!ride) {
    const error = new Error('Ride not found.');
    error.statusCode = 404;
    throw error;
  }

  const isRider = ride.rider.toString() === userId;
  const isDriver = ride.driver && ride.driver.toString() === userId;

  if (!isRider && !isDriver) {
    const error = new Error('You are not part of this ride.');
    error.statusCode = 403;
    throw error;
  }

  ride.transitionTo('CANCELLED');
  ride.cancelledBy = role;
  ride.cancelReason = reason || 'No reason provided.';
  await ride.save();
  if (ride.pickup && ride.pickup.coordinates) {
    await decrementDemand(ride.pickup.coordinates[0], ride.pickup.coordinates[1]);
  }
  if (ride.driver) {
    await releaseLock(ride.driver.toString());
  }

  const io = getIO();
  if (io) {
    io.to(`ride:${rideId}`).emit('ride:cancelled', {
      rideId,
      cancelledBy: role,
      reason: reason || 'No reason provided.',
      timestamp: new Date().toISOString(),
    });
  }

  logger.info(`Ride ${rideId} cancelled by ${role}`);
  return ride;
};

const getRide = async (rideId) => {
  const ride = await Ride.findById(rideId)
    .populate('rider', 'name email phone')
    .populate('driver', 'name email phone vehicleDetails');

  if (!ride) {
    const error = new Error('Ride not found.');
    error.statusCode = 404;
    throw error;
  }

  return ride;
};

module.exports = {
  requestRide,
  respondToRide,
  updateRideStatus,
  cancelRide,
  getRide,
};