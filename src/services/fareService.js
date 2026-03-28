const Ride = require('../models/Ride');
const logger = require('../utils/logger');

const BASE_FARE = 5000;
const PER_KM_RATE = 1200;
const PER_MIN_RATE = 200;

const calculateFare = async (rideId) => {
  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error('Ride not found');

  const durationMin = ride.completedAt && ride.startedAt
    ? Math.ceil((ride.completedAt - ride.startedAt) / 60000)
    : 0;

  const distanceKm = ride.fare.distanceKm || 0;
  const surgeMultiplier = ride.fare.surgeMultiplier || 1;

  const totalFare = Math.round(
    (BASE_FARE + PER_KM_RATE * distanceKm + PER_MIN_RATE * durationMin) * surgeMultiplier
  );

  ride.fare.baseFare = BASE_FARE;
  ride.fare.perKmRate = PER_KM_RATE;
  ride.fare.perMinRate = PER_MIN_RATE;
  ride.fare.durationMin = durationMin;
  ride.fare.totalFare = totalFare;

  await ride.save();

  logger.info(`Fare calculated for ride ${rideId}: ₹${(totalFare / 100).toFixed(2)} (${distanceKm}km, ${durationMin}min, ${surgeMultiplier}x surge)`);

  return ride;
};

module.exports = { calculateFare };