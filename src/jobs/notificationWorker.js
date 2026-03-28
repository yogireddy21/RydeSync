const { notificationQueue } = require('./queues');
const Notification = require('../models/Notification');
const logger = require('../utils/logger');

notificationQueue.process(async (job) => {
  const { userId, rideId, type, message } = job.data;

  logger.info(`Sending notification to ${userId}: ${message}`);

  await Notification.create({
    user: userId,
    ride: rideId,
    type,
    message,
  });

  logger.info(`Notification saved for user ${userId}: ${type}`);

  return { userId, type };
});

notificationQueue.on('completed', (job, result) => {
  logger.info(`Notification job ${job.id} completed for user ${result.userId}`);
});

notificationQueue.on('failed', (job, err) => {
  logger.error(`Notification job ${job.id} failed: ${err.message}`);
});

module.exports = notificationQueue;