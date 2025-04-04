// routes/publicRoutes.js
const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

// Search hunters route
router.get('/hunters/search', publicController.searchHunters);

module.exports = router;