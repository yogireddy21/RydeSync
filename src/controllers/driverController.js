const driverService = require('../services/driverService');

const goOnline = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
      const error = new Error('Longitude and latitude are required.');
      error.statusCode = 400;
      throw error;
    }

    const result = await driverService.goOnline(req.user._id.toString(), longitude, latitude);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const updateLocation = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.body;

    if (longitude === undefined || latitude === undefined) {
      const error = new Error('Longitude and latitude are required.');
      error.statusCode = 400;
      throw error;
    }

    const result = await driverService.updateLocation(req.user._id.toString(), longitude, latitude);
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const goOffline = async (req, res, next) => {
  try {
    const result = await driverService.goOffline(req.user._id.toString());
    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const getNearbyDrivers = async (req, res, next) => {
  try {
    const { longitude, latitude, radius, count } = req.query;

    if (!longitude || !latitude) {
      const error = new Error('Longitude and latitude are required as query params.');
      error.statusCode = 400;
      throw error;
    }

    const result = await driverService.getNearbyDrivers(
      parseFloat(longitude),
      parseFloat(latitude),
      parseFloat(radius) || 5,
      parseInt(count) || 5
    );

    res.status(200).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  goOnline,
  updateLocation,
  goOffline,
  getNearbyDrivers,
};