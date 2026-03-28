const express = require('express');
const router = express.Router();
const rideController = require('../controllers/rideController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

/**
 * @swagger
 * /api/v1/rides/request:
 *   post:
 *     summary: Request a new ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupCoords, destinationCoords]
 *             properties:
 *               pickupCoords:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [78.4867, 17.3850]
 *               destinationCoords:
 *                 type: array
 *                 items:
 *                   type: number
 *                 example: [78.5100, 17.4100]
 *               pickupAddress:
 *                 type: string
 *               destinationAddress:
 *                 type: string
 *     responses:
 *       201:
 *         description: Ride requested and driver matched
 *       400:
 *         description: Active ride exists
 *       404:
 *         description: No drivers available
 */
router.post('/request', auth, authorize('rider'), rideController.requestRide);

/**
 * @swagger
 * /api/v1/rides/{rideId}/respond:
 *   post:
 *     summary: Driver accepts or rejects a ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [accept]
 *             properties:
 *               accept:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Ride response recorded
 */
router.post('/:rideId/respond', auth, authorize('driver'), rideController.respondToRide);

/**
 * @swagger
 * /api/v1/rides/{rideId}/status:
 *   patch:
 *     summary: Update ride status
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRIVER_ARRIVED, IN_PROGRESS, COMPLETED]
 *     responses:
 *       200:
 *         description: Status updated
 *       400:
 *         description: Invalid transition
 */
router.patch('/:rideId/status', auth, authorize('driver'), rideController.updateRideStatus);

/**
 * @swagger
 * /api/v1/rides/{rideId}/cancel:
 *   post:
 *     summary: Cancel a ride
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Ride cancelled
 */
router.post('/:rideId/cancel', auth, authorize('rider', 'driver'), rideController.cancelRide);

/**
 * @swagger
 * /api/v1/rides/{rideId}:
 *   get:
 *     summary: Get ride details
 *     tags: [Rides]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: rideId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Ride details
 */
router.get('/:rideId', auth, authorize('rider', 'driver', 'admin'), rideController.getRide);

module.exports = router;