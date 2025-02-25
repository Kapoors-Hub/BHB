const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const badgeController = require('../controllers/badgeController');
const adminIssueController = require('../controllers/adminIssueController');
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

//issue
router.get('/issues', validateAdmin, adminIssueController.getAllIssues);
router.get('/issues/type/:type', validateAdmin, adminIssueController.getIssuesByType);
router.get('/issues/:userType/:userId/:issueId', validateAdmin, adminIssueController.getIssueDetails);
router.put('/issues/:userType/:userId/:issueId/assign', validateAdmin, adminIssueController.assignIssue);
router.put('/issues/:userType/:userId/:issueId/resolve', validateAdmin, adminIssueController.resolveIssue);

module.exports = router;



