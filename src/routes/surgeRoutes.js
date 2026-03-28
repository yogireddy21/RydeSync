const express = require('express');
const router = express.Router();
const surgeController = require('../controllers/surgeController');
const auth = require('../middlewares/auth');
const authorize = require('../middlewares/rbac');

router.get('/check', auth, surgeController.getSurgeForLocation);

router.get('/all', auth, authorize('admin'), surgeController.getAllSurge);

module.exports = router;