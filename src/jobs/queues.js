const Bull = require('bull');
const env = require('../config/env');

const redisConfig = {
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  password: env.REDIS_PASSWORD || undefined,
};

const paymentQueue = new Bull('payment', { redis: redisConfig });
const notificationQueue = new Bull('notification', { redis: redisConfig });

module.exports = {
  paymentQueue,
  notificationQueue,
};