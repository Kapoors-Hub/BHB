// routes/hunterRoutes.js
const express = require('express');
const router = express.Router();
const hunterController = require('../controllers/hunterController');
const { validateHunterRegistration } = require('../middleware/validation');
const { validateHunterToken } = require('../middleware/hunterAuth');

router.post('/register', validateHunterRegistration, hunterController.register);
router.post('/verify-otp', hunterController.verifyOTP);
router.get('/status/:email', hunterController.getStatus);
router.put('/complete-profile/:email', hunterController.completeProfile);
router.post('/login', hunterController.login);
router.get('/logout', hunterController.logout);
router.put('/profile/:id', validateHunterToken, hunterController.updateProfile);
router.post('/forgot-password', hunterController.forgotPassword);
router.post('/reset-password', hunterController.resetPassword);
router.post('/resend-reset-otp', hunterController.resendForgotPasswordOTP);
router.post('/resend-otp', hunterController.resendOTP);

module.exports = router;