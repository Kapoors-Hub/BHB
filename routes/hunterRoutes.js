// routes/hunterRoutes.js
const express = require('express');
const router = express.Router();
const hunterController = require('../controllers/hunterController');
const hunterBountyController = require('../controllers/hunterBountyController')
const { validateHunterRegistration } = require('../middleware/validation');
const { validateHunterToken } = require('../middleware/hunterAuth');
const upload = require('../config/multer');

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

// Bounty routes for hunters
router.get('/bounties', validateHunterToken, hunterBountyController.getAvailableBounties);
router.get('/bounties/my', validateHunterToken, hunterBountyController.getMyBounties);
router.get('/bounties/:bountyId', validateHunterToken, hunterBountyController.getBountyDetails);
router.post('/bounties/:bountyId/accept', validateHunterToken, hunterBountyController.acceptBounty);
router.post('/bounties/:bountyId/submit',validateHunterToken,upload.array('files', 5), hunterBountyController.submitBountyWork);
router.get('/bounties/:bountyId/score', validateHunterToken, hunterBountyController.getMyScore);

module.exports = router;