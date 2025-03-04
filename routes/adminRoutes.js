const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const badgeController = require('../controllers/badgeController');
const titleController = require('../controllers/titleController');
const adminIssueController = require('../controllers/adminIssueController');
const issueController = require('../controllers/issueController');
const { validateAdmin } = require('../middleware/auth');

router.post('/login', adminController.login);
router.post('/register', validateAdmin, adminController.registerAdmin);
router.get('/all', validateAdmin, adminController.getAllAdmins);
router.get('/hunters/pending', validateAdmin, adminController.getPendingHunters);
router.get('/hunters', validateAdmin, adminController.getAllHunters);
router.get('/hunters/:hunterId', validateAdmin, adminController.getHunterById);
router.put('/hunters/:hunterId/review', validateAdmin, adminController.reviewHunter);
router.post('/hunters/:hunterId/send-otp', validateAdmin, adminController.sendOTP);
router.delete('/hunters/:hunterId', validateAdmin, adminController.deleteHunter);

// Badges
router.post('/badges', validateAdmin, badgeController.createBadge);
router.put('/badges/:badgeId', validateAdmin, badgeController.updateBadge);

// titles
router.post('/titles', validateAdmin, titleController.createTitle);
router.get('/titles', validateAdmin, titleController.getAllTitles);
router.post('/titles/award', validateAdmin, titleController.awardTitle);
router.get('/titles/current-holders', validateAdmin, titleController.getCurrentTitleHolders);
router.get('/titles/recommendations', validateAdmin, titleController.generateTitleRecommendations);

//issue
router.get('/issues', validateAdmin, adminIssueController.getAllIssues);
router.get('/issues/type/:type', validateAdmin, adminIssueController.getIssuesByType);
router.get('/issues/:userType/:userId/:issueId', validateAdmin, adminIssueController.getIssueDetails);
router.put('/issues/:userType/:userId/:issueId/assign', validateAdmin, adminIssueController.assignIssue);
router.put('/issues/:userType/:userId/:issueId/resolve', validateAdmin, adminIssueController.resolveIssue);
router.post('/issues/:issueId/respond', validateAdmin, issueController.addResponseToIssue);

module.exports = router;



