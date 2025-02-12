const Hunter = require('../models/Hunter');
const Success = require('../utils/success');
const { ErrorHandler } = require('../utils/error');

const hunterController = {
  // Register new hunter
  async register(req, res) {
    const hunterData = req.body;
    
    const existingHunter = await Hunter.findOne({
      $or: [
        { collegeEmail: hunterData.collegeEmail },
        { mobileNumber: hunterData.mobileNumber }
      ]
    });

    if (existingHunter) {
      throw ErrorHandler.badRequest('Email or mobile number already registered');
    }

    const hunter = await Hunter.create(hunterData);
    return res.status(201).json(Success.created('Registration successful. Please wait for admin approval.'));
  },

  // Verify OTP
  async verifyOTP(req, res) {
    const { email, otp, personalEmail, graduationDate } = req.body;

    const hunter = await Hunter.findOne({ collegeEmail: email });
    if (!hunter) {
      throw ErrorHandler.notFound('Hunter not found');
    }

    if (!hunter.otp || !hunter.otp.code || hunter.otp.expiresAt < new Date()) {
      throw ErrorHandler.badRequest('OTP is invalid or expired');
    }

    if (hunter.otp.code !== otp) {
      throw ErrorHandler.badRequest('Invalid OTP');
    }

    hunter.isVerified = true;
    hunter.status = 'verified';
    hunter.otp = undefined;
    await hunter.save();

    return res.status(200).json(Success.ok('OTP verified successfully'));
  },

  // Get hunter status
  async getStatus(req, res) {
    const { email } = req.params;
    
    const hunter = await Hunter.findOne({ collegeEmail: email })
      .select('status adminRemarks');
    
    if (!hunter) {
      throw ErrorHandler.notFound('Hunter not found');
    }

    return res.status(200).json(Success.ok('Status retrieved successfully', hunter));
  }
};

module.exports = hunterController;