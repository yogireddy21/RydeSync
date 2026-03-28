const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');
const { authLimiter } = require('../middlewares/rateLimiter');

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);
router.post('/refresh', authController.refresh);
router.post('/logout', auth, authController.logout);
router.get('/profile', auth, authController.getProfile);

module.exports = router;