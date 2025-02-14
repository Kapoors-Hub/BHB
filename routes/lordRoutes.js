const express = require('express');
const router = express.Router();
const lordController = require('../controllers/lordController');
const { validateLordToken } = require('../middleware/validateLord');

// Auth routes
router.post('/register', lordController.register);
router.post('/login', lordController.login);
router.post('/forgot-password', lordController.forgotPassword);
router.post('/reset-password', lordController.resetPassword);
router.get('/logout', validateLordToken, lordController.logout);

module.exports = router;