const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middlewares/auth');

/**
 * @swagger
 * /api/v1/wallet/balance:
 *   get:
 *     summary: Get wallet balance
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current balance
 */
router.get('/balance', auth, walletController.getWallet);

/**
 * @swagger
 * /api/v1/wallet/ledger:
 *   get:
 *     summary: Get transaction history
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of ledger entries
 */
router.get('/ledger', auth, walletController.getLedger);

/**
 * @swagger
 * /api/v1/wallet/notifications:
 *   get:
 *     summary: Get all notifications
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of notifications
 */
router.get('/notifications', auth, walletController.getNotifications);

/**
 * @swagger
 * /api/v1/wallet/notifications/{notificationId}/read:
 *   patch:
 *     summary: Mark notification as read
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Notification marked as read
 */
router.patch('/notifications/:notificationId/read', auth, walletController.markNotificationRead);

module.exports = router;