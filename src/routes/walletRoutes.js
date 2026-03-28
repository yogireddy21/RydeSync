const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletController');
const auth = require('../middlewares/auth');

router.get('/balance', auth, walletController.getWallet);
router.get('/ledger', auth, walletController.getLedger);
router.get('/notifications', auth, walletController.getNotifications);
router.patch('/notifications/:notificationId/read', auth, walletController.markNotificationRead);

module.exports = router;