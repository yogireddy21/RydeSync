const express = require('express');
const router = express.Router();
const surgeController = require('../controllers/surgeController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

/**
 * @swagger
 * /api/v1/surge/check:
 *   get:
 *     summary: Check surge multiplier for a location
 *     tags: [Surge]
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
 *     responses:
 *       200:
 *         description: Surge multiplier for the zone
 */
router.get('/check', auth, surgeController.getSurgeForLocation);

/**
 * @swagger
 * /api/v1/surge/all:
 *   get:
 *     summary: Get surge data for all zones (admin only)
 *     tags: [Surge]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All zones with demand, supply, multiplier
 *       403:
 *         description: Admin only
 */
router.get('/all', auth, authorize('admin'), surgeController.getAllSurge);

module.exports = router;