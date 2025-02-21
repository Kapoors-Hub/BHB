const express = require('express');
const router = express.Router();
const lordController = require('../controllers/lordController');
const bountyController = require('../controllers/bountyController')
const { validateLordToken } = require('../middleware/validateLord');

// Auth routes
router.post('/register', lordController.register);
router.post('/login', lordController.login);
router.post('/forgot-password', lordController.forgotPassword);
router.post('/reset-password', lordController.resetPassword);
router.get('/logout', validateLordToken, lordController.logout);
router.get('/profile', validateLordToken, lordController.getLordProfile);
router.put('/profile/update', validateLordToken, lordController.updateLordProfile)

// Bounty routes (protected by validateLordToken)
router.post('/bounties', validateLordToken, bountyController.createBounty);
router.get('/bounties', validateLordToken, bountyController.getLordBounties);
router.get('/bounties/:bountyId', validateLordToken, bountyController.getBountyById);
router.put('/bounties/:bountyId', validateLordToken, bountyController.updateBounty);
router.delete('/bounties/:bountyId', validateLordToken, bountyController.deleteBounty);

module.exports = router;