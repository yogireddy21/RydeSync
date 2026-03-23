const mongoose = require('mongoose');
const logger = require('../utils/logger');
const env = require('./env');

const connectDatabase = async () => {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('MongoDB connected successfully');
  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDatabase;