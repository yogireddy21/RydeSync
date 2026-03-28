const surgeService = require('../services/surgeService');

const getSurgeForLocation = async (req, res, next) => {
  try {
    const { longitude, latitude } = req.query;

    if (!longitude || !latitude) {
      const error = new Error('Longitude and latitude are required.');
      error.statusCode = 400;
      throw error;
    }

    const multiplier = await surgeService.getSurgeMultiplier(
      parseFloat(longitude),
      parseFloat(latitude)
    );

    const zone = surgeService.getZoneForLocation(
      parseFloat(longitude),
      parseFloat(latitude)
    );

    res.status(200).json({
      success: true,
      data: {
        zone: zone ? zone.name : 'unknown',
        multiplier,
      },
    });
  } catch (err) {
    next(err);
  }
};

const getAllSurge = async (req, res, next) => {
  try {
    const data = await surgeService.getAllSurgeData();
    res.status(200).json({ success: true, data });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  getSurgeForLocation,
  getAllSurge,
};