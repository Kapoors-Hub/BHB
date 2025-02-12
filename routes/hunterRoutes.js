// routes/hunterRoutes.js
const express = require('express');
const router = express.Router();
const hunterController = require('../controllers/hunterController');
const { validateHunterRegistration } = require('../middleware/validation');

router.post('/register', validateHunterRegistration, hunterController.register);
router.post('/verify-otp', hunterController.verifyOTP);
router.get('/status/:email', hunterController.getStatus);

module.exports = router;