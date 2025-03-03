const express = require('express');
const router = express.Router();
const lordController = require('../controllers/lordController');
const bountyController = require('../controllers/bountyController')
const issueController = require('../controllers/issueController');
const { validateLordToken } = require('../middleware/validateLord');

// Auth routes
router.post('/register', lordController.register);
router.post('/login', lordController.login);
router.post('/verify-password', validateLordToken, lordController.verifyPassword);
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
router.get('/bounties/:bountyId/submissions/:hunterId', validateLordToken, bountyController.getHunterSubmission);
router.post('/bounties/:bountyId/review/:hunterId', validateLordToken, bountyController.reviewSubmission);
router.post('/bounties/:bountyId/result', validateLordToken, bountyController.postBountyResult);
router.get('/bounties/:bountyId/rankings', validateLordToken, bountyController.getBountyRankings);

// Draft Bounties 
router.post('/bounties/drafts', validateLordToken, bountyController.saveBountyDraft);
router.get('/bounties/drafts', validateLordToken, bountyController.getDraftBounties);
router.get('/bounties/drafts/:draftId', validateLordToken, bountyController.getDraftBounty);
router.put('/bounties/drafts/:draftId', validateLordToken, bountyController.saveBountyDraft);
router.delete('/bounties/drafts/:draftId', validateLordToken, bountyController.deleteDraftBounty);
router.post('/bounties/drafts/:draftId/publish', validateLordToken, bountyController.publishDraft);

// Bank Details
router.post('/bank-accounts', validateLordToken, lordController.addBankAccount);
router.get('/bank-accounts', validateLordToken, lordController.getBankAccounts);
router.put('/bank-accounts/:accountId', validateLordToken, lordController.updateBankAccount);
router.delete('/bank-accounts/:accountId', validateLordToken, lordController.deleteBankAccount);
router.put('/bank-accounts/:accountId/set-default', validateLordToken, lordController.setDefaultBankAccount);

//issue
router.post('/issues', validateLordToken, issueController.reportIssue);
router.get('/issues', validateLordToken, issueController.getMyIssues);
router.get('/issues/:issueId', validateLordToken, issueController.getIssue);
router.put('/issues/:issueId', validateLordToken, issueController.updateIssue);
router.put('/issues/:issueId/close', validateLordToken, issueController.closeIssue);
router.post('/issues/:issueId/respond', validateLordToken, issueController.addResponseToIssue);

module.exports = router;

