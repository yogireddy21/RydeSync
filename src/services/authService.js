const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { getRedisClient } = require('../config/database');
const env = require('../config/env');

const generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const generateRefreshToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role },
    env.JWT_REFRESH_SECRET,
    { expiresIn: '7d' }
  );
};

const register = async ({ name, email, password, phone, role }) => {
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    const error = new Error('User already exists with this email.');
    error.statusCode = 409;
    throw error;
  }

  const user = await User.create({ name, email, password, phone, role });

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Store refresh token in Redis with 7-day TTL
  const redis = getRedisClient();
  await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

const login = async ({ email, password }) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    const error = new Error('Invalid email or password.');
    error.statusCode = 401;
    throw error;
  }

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  const redis = getRedisClient();
  await redis.set(`refresh:${user._id}`, refreshToken, 'EX', 7 * 24 * 60 * 60);

  return {
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
    },
    accessToken,
    refreshToken,
  };
};

const refreshAccessToken = async (refreshToken) => {
  const redis = getRedisClient();

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
  } catch (err) {
    const error = new Error('Invalid or expired refresh token.');
    error.statusCode = 401;
    throw error;
  }

  // Check if this refresh token matches what's stored in Redis
  const storedToken = await redis.get(`refresh:${decoded.id}`);
  if (!storedToken || storedToken !== refreshToken) {
    const error = new Error('Refresh token has been revoked.');
    error.statusCode = 401;
    throw error;
  }

  const user = await User.findById(decoded.id);
  if (!user) {
    const error = new Error('User not found.');
    error.statusCode = 401;
    throw error;
  }

  // Token rotation: generate new pair, invalidate old refresh token
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  await redis.set(`refresh:${user._id}`, newRefreshToken, 'EX', 7 * 24 * 60 * 60);

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
};

const logout = async (user, accessToken) => {
  const redis = getRedisClient();

  // Blacklist the current access token for its remaining TTL
  const decoded = jwt.decode(accessToken);
  const ttl = decoded.exp - Math.floor(Date.now() / 1000);
  if (ttl > 0) {
    await redis.set(`blacklist:${accessToken}`, 'true', 'EX', ttl);
  }

  // Remove refresh token from Redis
  await redis.del(`refresh:${user._id}`);

  return { message: 'Logged out successfully.' };
};

module.exports = {
  register,
  login,
  refreshAccessToken,
  logout,
};