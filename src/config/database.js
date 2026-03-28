const mongoose = require('mongoose');
const Redis = require('ioredis');
const logger = require('../utils/logger');
const env = require('./env');

let redisClient = null;

const connectDatabase = async () => {
    try {
        await mongoose.connect(env.MONGODB_URI);
        logger.info('MongoDB connected successfully');
    } catch (error) {
        logger.error(`MongoDB connection failed: ${error.message}`);
        process.exit(1);
    }

    try {
        redisClient = new Redis({
            host: env.REDIS_HOST,
            port: env.REDIS_PORT,
            password: env.REDIS_PASSWORD || undefined,
        });

        redisClient.on('connect', () => {
            logger.info('Redis connected successfully');
        });

        redisClient.on('error', (err) => {
            logger.error(`Redis error: ${err.message}`);
        });
    } catch (error) {
        logger.error(`Redis connection failed: ${error.message}`);
        process.exit(1);
    }
};

const getRedisClient = () => {
    if (!redisClient) {
        throw new Error('Redis client not initialized. Call connectDatabase() first.');
    }
    return redisClient;
};

module.exports = { connectDatabase, getRedisClient };