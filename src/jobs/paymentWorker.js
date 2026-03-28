const { paymentQueue } = require('./queues');
const Ride = require('../models/Ride');
const Wallet = require('../models/Wallet');
const Ledger = require('../models/Ledger');
const logger = require('../utils/logger');

const PLATFORM_FEE_PERCENT = 20;

const getOrCreateWallet = async (userId) => {
  let wallet = await Wallet.findOne({ user: userId });
  if (!wallet) {
    wallet = await Wallet.create({ user: userId, balance: 0 });
  }
  return wallet;
};

paymentQueue.process(async (job) => {
  const { rideId } = job.data;

  logger.info(`Processing payment for ride ${rideId}`);

  const ride = await Ride.findById(rideId);
  if (!ride) throw new Error(`Ride ${rideId} not found`);
  if (ride.status !== 'COMPLETED') throw new Error(`Ride ${rideId} is not completed`);

  const totalFare = ride.fare.totalFare;
  if (!totalFare || totalFare <= 0) throw new Error(`Invalid fare for ride ${rideId}`);

  const platformFee = Math.round(totalFare * (PLATFORM_FEE_PERCENT / 100));
  const driverPayout = totalFare - platformFee;

  const riderWallet = await getOrCreateWallet(ride.rider);
  const driverWallet = await getOrCreateWallet(ride.driver);

  riderWallet.balance -= totalFare;
  await riderWallet.save();

  driverWallet.balance += driverPayout;
  await driverWallet.save();

  await Ledger.create([
    {
      ride: rideId,
      fromUser: ride.rider,
      toUser: ride.driver,
      type: 'RIDE_PAYMENT',
      amount: totalFare,
      description: `Ride payment: ₹${(totalFare / 100).toFixed(2)}`,
    },
    {
      ride: rideId,
      fromUser: ride.rider,
      toUser: ride.driver,
      type: 'DRIVER_PAYOUT',
      amount: driverPayout,
      description: `Driver payout (${100 - PLATFORM_FEE_PERCENT}%): ₹${(driverPayout / 100).toFixed(2)}`,
    },
    {
      ride: rideId,
      fromUser: ride.rider,
      type: 'PLATFORM_FEE',
      amount: platformFee,
      description: `Platform fee (${PLATFORM_FEE_PERCENT}%): ₹${(platformFee / 100).toFixed(2)}`,
    },
  ]);

  logger.info(`Payment processed for ride ${rideId}: total=₹${(totalFare / 100).toFixed(2)}, driver=₹${(driverPayout / 100).toFixed(2)}, platform=₹${(platformFee / 100).toFixed(2)}`);

  return { rideId, totalFare, driverPayout, platformFee };
});

paymentQueue.on('completed', (job, result) => {
  logger.info(`Payment job ${job.id} completed for ride ${result.rideId}`);
});

paymentQueue.on('failed', (job, err) => {
  logger.error(`Payment job ${job.id} failed: ${err.message}`);
});

module.exports = paymentQueue;