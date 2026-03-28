const authService = require('../services/authService');

const register = async (req, res, next) => {
  try {
    const result = await authService.register(req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authService.login(req.body);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      const error = new Error('Refresh token is required.');
      error.statusCode = 400;
      throw error;
    }
    const result = await authService.refreshAccessToken(refreshToken);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const logout = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(' ')[1];
    const result = await authService.logout(req.user, token);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getProfile = async (req, res, next) => {
  try {
    res.status(200).json({ success: true, data: { user: req.user } });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  getProfile,
};