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
router.get('/bounties/:bountyId/submissions', validateLordToken, bountyController.getBountySubmissions);
router.post('/bounties/:bountyId/review/:hunterId', validateLordToken, bountyController.reviewSubmission);
router.post('/bounties/:bountyId/result', validateLordToken, bountyController.postBountyResult);

// Bank Details
// routes/lordRoutes.js
router.post('/bank-accounts', validateLordToken, lordController.addBankAccount);
router.get('/bank-accounts', validateLordToken, lordController.getBankAccounts);
router.put('/bank-accounts/:accountId', validateLordToken, lordController.updateBankAccount);
router.delete('/bank-accounts/:accountId', validateLordToken, lordController.deleteBankAccount);
router.put('/bank-accounts/:accountId/set-default', validateLordToken, lordController.setDefaultBankAccount);
module.exports = router;

