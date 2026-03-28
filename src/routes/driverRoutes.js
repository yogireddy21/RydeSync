const express = require('express');
const router = express.Router();
const driverController = require('../controllers/driverController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

/**
 * @swagger
 * /api/v1/driver/online:
 *   post:
 *     summary: Driver goes online
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [longitude, latitude]
 *             properties:
 *               longitude:
 *                 type: number
 *               latitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Driver is now online
 */
router.post('/online', auth, authorize('driver'), driverController.goOnline);

/**
 * @swagger
 * /api/v1/driver/location:
 *   patch:
 *     summary: Update driver location
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [longitude, latitude]
 *             properties:
 *               longitude:
 *                 type: number
 *               latitude:
 *                 type: number
 *     responses:
 *       200:
 *         description: Location updated
 */
router.patch('/location', auth, authorize('driver'), driverController.updateLocation);

/**
 * @swagger
 * /api/v1/driver/offline:
 *   post:
 *     summary: Driver goes offline
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Driver is now offline
 */
router.post('/offline', auth, authorize('driver'), driverController.goOffline);

/**
 * @swagger
 * /api/v1/driver/nearby:
 *   get:
 *     summary: Find nearby drivers
 *     tags: [Driver]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *       - in: query
 *         name: radius
 *         schema:
 *           type: number
 *           default: 5
 *       - in: query
 *         name: count
 *         schema:
 *           type: number
 *           default: 5
 *     responses:
 *       200:
 *         description: List of nearby drivers sorted by distance
 */
router.get('/nearby', auth, authorize('rider', 'admin'), driverController.getNearbyDrivers);

module.exports = router;