const { getRedisClient } = require('../config/database');
const ZONES = require('../config/zones');
const logger = require('../utils/logger');

const MIN_MULTIPLIER = 1.0;
const MAX_MULTIPLIER = 3.0;

const calculateMultiplier = (demand, supply) => {
  if (demand === 0) return MIN_MULTIPLIER;
  if (supply === 0) return MAX_MULTIPLIER;

  const ratio = demand / supply;

  if (ratio <= 1) return 1.0;
  if (ratio <= 1.5) return 1.2;
  if (ratio <= 2) return 1.5;
  if (ratio <= 3) return 2.0;
  if (ratio <= 4) return 2.5;
  return MAX_MULTIPLIER;
};

const getZoneForLocation = (longitude, latitude) => {
  let closestZone = null;
  let closestDistance = Infinity;

  for (const zone of ZONES) {
    const dlng = zone.center.longitude - longitude;
    const dlat = zone.center.latitude - latitude;
    const distance = Math.sqrt(dlng * dlng + dlat * dlat);

    if (distance < closestDistance) {
      closestDistance = distance;
      closestZone = zone;
    }
  }

  return closestZone;
};

const incrementDemand = async (longitude, latitude) => {
  const redis = getRedisClient();
  const zone = getZoneForLocation(longitude, latitude);
  if (!zone) return;

  const key = `surge:zone:${zone.name}:requests`;
  await redis.incr(key);
  await redis.expire(key, 30);
};

const decrementDemand = async (longitude, latitude) => {
  const redis = getRedisClient();
  const zone = getZoneForLocation(longitude, latitude);
  if (!zone) return;

  const key = `surge:zone:${zone.name}:requests`;
  const current = await redis.get(key);
  if (current && parseInt(current) > 0) {
    await redis.decr(key);
  }
};

const computeSurgeForAllZones = async () => {
  const redis = getRedisClient();

  for (const zone of ZONES) {
    const demandKey = `surge:zone:${zone.name}:requests`;
    const demand = parseInt(await redis.get(demandKey)) || 0;

    let supply = 0;
    try {
      const drivers = await redis.geosearch(
        'active_drivers',
        'FROMLONLAT', zone.center.longitude, zone.center.latitude,
        'BYRADIUS', zone.radiusKm, 'km',
        'ASC'
      );
      supply = drivers.length;
    } catch (err) {
      supply = 0;
    }

    const multiplier = calculateMultiplier(demand, supply);

    await redis.set(`surge:zone:${zone.name}:multiplier`, multiplier.toString(), 'EX', 30);

    if (multiplier > 1) {
      logger.info(`Surge in ${zone.name}: ${multiplier}x (demand: ${demand}, supply: ${supply})`);
    }
  }
};

const getSurgeMultiplier = async (longitude, latitude) => {
  const redis = getRedisClient();
  const zone = getZoneForLocation(longitude, latitude);
  if (!zone) return 1.0;

  const multiplier = await redis.get(`surge:zone:${zone.name}:multiplier`);
  return multiplier ? parseFloat(multiplier) : 1.0;
};

const getAllSurgeData = async () => {
  const redis = getRedisClient();
  const results = [];

  for (const zone of ZONES) {
    const demandKey = `surge:zone:${zone.name}:requests`;
    const multiplierKey = `surge:zone:${zone.name}:multiplier`;

    const demand = parseInt(await redis.get(demandKey)) || 0;
    const multiplier = parseFloat(await redis.get(multiplierKey)) || 1.0;

    let supply = 0;
    try {
      const drivers = await redis.geosearch(
        'active_drivers',
        'FROMLONLAT', zone.center.longitude, zone.center.latitude,
        'BYRADIUS', zone.radiusKm, 'km',
        'ASC'
      );
      supply = drivers.length;
    } catch (err) {
      supply = 0;
    }

    results.push({
      zone: zone.name,
      demand,
      supply,
      multiplier,
    });
  }

  return results;
};

module.exports = {
  computeSurgeForAllZones,
  getSurgeMultiplier,
  incrementDemand,
  decrementDemand,
  getAllSurgeData,
  getZoneForLocation,
};