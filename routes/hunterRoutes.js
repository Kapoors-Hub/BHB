// routes/hunterRoutes.js
const express = require('express');
const router = express.Router();
const hunterController = require('../controllers/hunterController');
const issueController = require('../controllers/issueController');
const hunterQuizController = require('../controllers/hunterQuizController');
const hunterBountyController = require('../controllers/hunterBountyController');
const passController = require('../controllers/passController');
const transactionController = require('../controllers/transactionController');
const notificationController = require('../controllers/notificationController');
const { validateHunterRegistration } = require('../middleware/validation');
const { validateHunterToken } = require('../middleware/hunterAuth');
const upload = require('../config/multer');
const withdrawalController = require('../controllers/withdrawalController');

router.post('/register', validateHunterRegistration, hunterController.register);
router.post('/verify-otp', hunterController.verifyOTP);
router.get('/status/:email', hunterController.getStatus);
router.put('/complete-profile/:email', hunterController.completeProfile);
router.post('/login', hunterController.login);
router.get('/logout', hunterController.logout);
router.put('/profile/:id', validateHunterToken, hunterController.updateProfile);
router.post('/verify-password', validateHunterToken, hunterController.verifyPassword)
router.put('/personal-info', validateHunterToken, hunterController.updatePersonalInfo); 
router.post('/forgot-password', hunterController.forgotPassword);
router.post('/reset-password', hunterController.resetPassword);
router.post('/resend-reset-otp', hunterController.resendForgotPasswordOTP);
router.post('/resend-otp', hunterController.resendOTP);
router.get('/profile', validateHunterToken, hunterController.getHunterProfile);

// Bounty routes for hunters
router.get('/bounties', validateHunterToken, hunterBountyController.getAvailableBounties);
router.get('/bounties/my', validateHunterToken, hunterBountyController.getMyBounties);
router.get('/bounties/:bountyId', validateHunterToken, hunterBountyController.getBountyDetails);
router.get('/bounties/:bountyId/check-status', validateHunterToken, hunterBountyController.checkAcceptedBountyStatus);
router.post('/bounties/:bountyId/accept', validateHunterToken, hunterBountyController.acceptBounty);
router.post('/bounties/:bountyId/quit', validateHunterToken, hunterBountyController.quitBounty);
router.post('/bounties/:bountyId/submit',validateHunterToken,upload.array('files', 5), hunterBountyController.submitBountyWork);
router.get('/bounties/:bountyId/score', validateHunterToken, hunterBountyController.getMyScore);
router.get('/scores/aggregate', validateHunterToken, hunterController.getAggregateScores);
router.get('/level', validateHunterToken, hunterController.getMyLevel);
router.get('/bounties/:bountyId/rankings', validateHunterToken, hunterBountyController.getBountyRankings);
router.get('/rankings', validateHunterToken, hunterBountyController.getMyRankings);
router.get('/quit-bounties', validateHunterToken, hunterBountyController.getMyQuitBounties);


// issue
router.post('/issues', validateHunterToken, issueController.reportIssue);
router.get('/issues', validateHunterToken, issueController.getMyIssues);
router.get('/issues/:issueId', validateHunterToken, issueController.getIssue);
router.put('/issues/:issueId', validateHunterToken, issueController.updateIssue);
router.put('/issues/:issueId/close', validateHunterToken, issueController.closeIssue);
router.post('/issues/:issueId/respond', validateHunterToken, issueController.addResponseToIssue);

// tiitles
router.get('/titles/my', validateHunterToken, hunterController.getMyTitles);

// Quizes
router.get('/quizzes', validateHunterToken, hunterQuizController.getAvailableQuizzes);
router.get('/quizzes/:quizId', validateHunterToken, hunterQuizController.getSingleQuiz); 
router.post('/quizzes/:quizId/start', validateHunterToken, hunterQuizController.startQuiz);
router.get('/quizzes/history', validateHunterToken, hunterQuizController.getQuizHistory);
router.post('/quizzes/attempts/:quizAttemptId/complete', validateHunterToken, hunterQuizController.completeQuiz);

// Passes
router.get('/passes', validateHunterToken, passController.getHunterPasses);
router.post('/passes/time-extension/:bountyId', validateHunterToken, passController.useTimeExtensionPass);
router.post('/passes/reset-foul/:foulRecordId', validateHunterToken, passController.useResetFoulPass);
router.post('/passes/booster/:bountyId', validateHunterToken, passController.useBoosterPass);

// Notification routes
router.get('/notifications', validateHunterToken, notificationController.getNotifications);
router.get('/notifications/unread-count', validateHunterToken, notificationController.getUnreadCount);
router.put('/notifications/:notificationId', validateHunterToken, notificationController.updateNotificationStatus);

router.get('/performance', validateHunterToken, hunterController.getMyPerformance);

router.get('/wallet', validateHunterToken, transactionController.getMyWallet);
router.get('/transactions', validateHunterToken, transactionController.getMyTransactions);
router.get('/transactions/all-activities', validateHunterToken, transactionController.getAllMyActivities);

router.post('/withdrawals', validateHunterToken, withdrawalController.requestWithdrawal);
router.get('/withdrawals', validateHunterToken, withdrawalController.getMyWithdrawalRequests);
router.put('/withdrawals/:requestId/cancel', validateHunterToken, withdrawalController.cancelWithdrawalRequest);

router.get('/fouls', validateHunterToken, hunterController.getMyFouls);

module.exports = router;

// 44fb4129-959e-41b0-93f2-faf4c8d0780b