const rideService = require('../services/rideService');

const requestRide = async (req, res, next) => {
  try {
    const { pickupCoords, destinationCoords, pickupAddress, destinationAddress } = req.body;

    if (!pickupCoords || !destinationCoords) {
      const error = new Error('Pickup and destination coordinates are required.');
      error.statusCode = 400;
      throw error;
    }

    const ride = await rideService.requestRide(
      req.user._id.toString(),
      pickupCoords,
      destinationCoords,
      pickupAddress,
      destinationAddress
    );

    res.status(201).json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
};

const respondToRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { accept } = req.body;

    if (accept === undefined) {
      const error = new Error('accept field is required (true or false).');
      error.statusCode = 400;
      throw error;
    }

    const ride = await rideService.respondToRide(
      req.user._id.toString(),
      rideId,
      accept
    );

    res.status(200).json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
};

const updateRideStatus = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { status } = req.body;

    if (!status) {
      const error = new Error('Status is required.');
      error.statusCode = 400;
      throw error;
    }

    const ride = await rideService.updateRideStatus(
      req.user._id.toString(),
      rideId,
      status
    );

    res.status(200).json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
};

const cancelRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const { reason } = req.body;

    const ride = await rideService.cancelRide(
      req.user._id.toString(),
      rideId,
      req.user.role,
      reason
    );

    res.status(200).json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
};

const getRide = async (req, res, next) => {
  try {
    const { rideId } = req.params;
    const ride = await rideService.getRide(rideId);
    res.status(200).json({ success: true, data: ride });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  requestRide,
  respondToRide,
  updateRideStatus,
  cancelRide,
  getRide,
};