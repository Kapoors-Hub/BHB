const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { validateAdmin } = require('../middleware/auth');

router.post('/login', adminController.login);
router.post('/register', validateAdmin, adminController.registerAdmin);
router.get('/all', validateAdmin, adminController.getAllAdmins);
router.get('/hunters/pending', validateAdmin, adminController.getPendingHunters);
router.get('/hunters', validateAdmin, adminController.getAllHunters);
router.put('/hunters/:hunterId/review', validateAdmin, adminController.reviewHunter);
router.post('/hunters/:hunterId/send-otp', validateAdmin, adminController.sendOTP);

module.exports = router;



