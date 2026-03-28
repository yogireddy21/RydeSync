const Bull = require('bull');
const env = require('../config/env');

let redisConfig;

if (env.REDIS_URL) {
  redisConfig = {
    redis: env.REDIS_URL,
    defaultJobOptions: {
      removeOnComplete: true,
      removeOnFail: false,
    },
  };

  if (env.REDIS_URL.includes('upstash')) {
    const url = new URL(env.REDIS_URL);
    redisConfig = {
      redis: {
        host: url.hostname,
        port: parseInt(url.port),
        password: url.password,
        tls: { rejectUnauthorized: false },
      },
    };
  }
} else {
  redisConfig = {
    redis: {
      host: env.REDIS_HOST,
      port: env.REDIS_PORT,
      password: env.REDIS_PASSWORD || undefined,
    },
  };
}

const paymentQueue = new Bull('payment', redisConfig);
const notificationQueue = new Bull('notification', redisConfig);

module.exports = {
  paymentQueue,
  notificationQueue,
};