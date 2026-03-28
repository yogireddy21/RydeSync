const { getRedisClient } = require('../config/database');
const User = require('../models/User');
const logger = require('../utils/logger');

const goOnline = async (driverId, longitude, latitude) => {
  const user = await User.findById(driverId);
  if (!user || user.role !== 'driver') {
    const error = new Error('Driver not found.');
    error.statusCode = 404;
    throw error;
  }

  const redis = getRedisClient();

  // GEOADD stores the driver in Redis geo set
  // If driver already exists, their position is updated
  await redis.geoadd('active_drivers', longitude, latitude, driverId);

  // Mark driver as online in MongoDB
  await User.findByIdAndUpdate(driverId, {
    isOnline: true,
    currentLocation: {
      type: 'Point',
      coordinates: [longitude, latitude],
    },
  });

  logger.info(`Driver ${driverId} went online at [${longitude}, ${latitude}]`);

  return { message: 'Driver is now online.', location: { longitude, latitude } };
};

const updateLocation = async (driverId, longitude, latitude) => {
  const redis = getRedisClient();

  // Check if driver is in the active set
  const position = await redis.geopos('active_drivers', driverId);
  if (!position || !position[0]) {
    const error = new Error('Driver is not online. Go online first.');
    error.statusCode = 400;
    throw error;
  }

  // Update position in Redis — same command as goOnline
  await redis.geoadd('active_drivers', longitude, latitude, driverId);

  return { message: 'Location updated.', location: { longitude, latitude } };
};

const goOffline = async (driverId) => {
  const redis = getRedisClient();

  // Remove from Redis geo set
  await redis.zrem('active_drivers', driverId);

  // Mark offline in MongoDB
  await User.findByIdAndUpdate(driverId, { isOnline: false });

  logger.info(`Driver ${driverId} went offline`);

  return { message: 'Driver is now offline.' };
};

const getNearbyDrivers = async (longitude, latitude, radiusKm = 5, count = 5) => {
  const redis = getRedisClient();

  // GEOSEARCH returns drivers within radius, sorted by distance (ASC = nearest first)
  const drivers = await redis.geosearch(
    'active_drivers',
    'FROMLONLAT', longitude, latitude,
    'BYRADIUS', radiusKm, 'km',
    'ASC',
    'COUNT', count,
    'WITHCOORD',
    'WITHDIST'
  );

  // geosearch with WITHCOORD and WITHDIST returns a flat array:
  // [driverId, distance, [longitude, latitude], driverId2, ...]
  // We need to parse this into a clean format
const results = [];
for (const entry of drivers) {
    results.push({
      driverId: entry[0],
      distance: `${entry[1]} km`,
      longitude: parseFloat(entry[2][0]),
      latitude: parseFloat(entry[2][1]),
    });
}
  return results;
};

const persistLocationsToMongo = async () => {
  const redis = getRedisClient();

  // Get all active driver IDs from the geo set
  const driverIds = await redis.zrange('active_drivers', 0, -1);

  if (driverIds.length === 0) return;

  // Get all their positions in one call
  const positions = await redis.geopos('active_drivers', ...driverIds);

  const bulkOps = [];
  for (let i = 0; i < driverIds.length; i++) {
    if (positions[i]) {
      bulkOps.push({
        updateOne: {
          filter: { _id: driverIds[i] },
          update: {
            currentLocation: {
              type: 'Point',
              coordinates: [
                parseFloat(positions[i][0]),
                parseFloat(positions[i][1]),
              ],
            },
          },
        },
      });
    }
  }

  if (bulkOps.length > 0) {
    await User.bulkWrite(bulkOps);
    logger.info(`Persisted ${bulkOps.length} driver locations to MongoDB`);
  }
};

module.exports = {
  goOnline,
  updateLocation,
  goOffline,
  getNearbyDrivers,
  persistLocationsToMongo,
};