const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

router.post('/request', auth, authorize('rider'), rideController.requestRide);

router.post('/:rideId/respond', auth, authorize('driver'), rideController.respondToRide);

router.patch('/:rideId/status', auth, authorize('driver'), rideController.updateRideStatus);

router.post('/:rideId/cancel', auth, authorize('rider', 'driver'), rideController.cancelRide);

router.get('/:rideId', auth, authorize('rider', 'driver', 'admin'), rideController.getRide);

module.exports = router;