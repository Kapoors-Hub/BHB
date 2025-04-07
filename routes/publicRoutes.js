// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Search hunters route
router.get('/hunters/search', publicController.searchHunters);

router.get('/hunters/:hunterId/profile', publicController.getHunterPublicProfile);

router.get('/stats', publicController.getPlatformStats);

module.exports = router;