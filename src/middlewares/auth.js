const jwt = require('jsonwebtoken');
const { getRedisClient } = require('../config/database');
const User = require('../models/User');
const env = require('../config/env');

const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      const error = new Error('Access denied. No token provided.');
      error.statusCode = 401;
      throw error;
    }

    const token = authHeader.split(' ')[1];
    const redis = getRedisClient();

    // Check if token is blacklisted (user logged out)
    const isBlacklisted = await redis.get(`blacklist:${token}`);
    if (isBlacklisted) {
      const error = new Error('Token has been revoked. Please login again.');
      error.statusCode = 401;
      throw error;
    }

    const decoded = jwt.verify(token, env.JWT_SECRET);

    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      const error = new Error('User not found.');
      error.statusCode = 401;
      throw error;
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError') {
      err.message = 'Invalid token.';
      err.statusCode = 401;
    }
    if (err.name === 'TokenExpiredError') {
      err.message = 'Token expired. Please refresh.';
      err.statusCode = 401;
    }
    next(err);
  }
};

module.exports = auth;