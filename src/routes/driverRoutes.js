const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

// Driver-only routes — must be logged in AND have role "driver"
router.post('/online', auth, authorize('driver'), driverController.goOnline);
router.patch('/location', auth, authorize('driver'), driverController.updateLocation);
router.post('/offline', auth, authorize('driver'), driverController.goOffline);

// Nearby drivers — riders and admins can also search
router.get('/nearby', auth, authorize('rider', 'admin'), driverController.getNearbyDrivers);

module.exports = router;