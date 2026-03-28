const mongoose = require('mongoose');
const { getRedisClient } = require('../src/config/database');

const cleanup = async () => {
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }

  try {
    const redis = getRedisClient();
    await redis.flushdb();
  } catch (err) {
    // Redis might not be connected in all tests
  }
};

module.exports = { cleanup };