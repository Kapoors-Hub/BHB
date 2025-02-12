const Admin = require('../models/Admin');
const Hunter = require('../models/Hunter');
const Success = require('../utils/success');
const { ErrorHandler } = require('../utils/error');
const transporter = require('../config/mailer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs')

const adminController = {
  // Admin login
  async login(req, res) {
    const { email, password } = req.body;
    
    const admin = await Admin.findOne({ email });
    if (!admin) {
      throw ErrorHandler.unauthorized('Invalid credentials');
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      throw ErrorHandler.unauthorized('Invalid credentials');
    }

    const token = jwt.sign(
      { id: admin._id, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    return res.status(200).json(Success.ok('Login successful', { token }));
  },

  // Register new admin (only existing admin can create)
  async registerAdmin(req, res) {
    const { email, password, name } = req.body;

    // Check if admin already exists
    const existingAdmin = await Admin.findOne({ email });
    if (existingAdmin) {
      throw ErrorHandler.badRequest('Admin with this email already exists');
    }

    // Create new admin
    const admin = await Admin.create({
      email,
      password,
      name
    });

    return res.status(201).json(Success.created('Admin registered successfully'));
  },

  // Get all admins
  async getAllAdmins(req, res) {
    const admins = await Admin.find().select('-password');
    return res.status(200).json(Success.ok('Admins retrieved successfully', admins));
  },

  // Get all pending hunters
  async getPendingHunters(req, res) {
    const hunters = await Hunter.find({ status: 'pending' }).select('-otp');
    return res.status(200).json(Success.ok('Pending hunters retrieved successfully', hunters));
  },

  // Get all hunters
  async getAllHunters(req, res) {
    const hunters = await Hunter.find().select('-otp');
    return res.status(200).json(Success.ok('Hunters retrieved successfully', hunters));
  },

  // Approve or reject hunter
  async reviewHunter(req, res) {
    const { hunterId } = req.params;
    const { status, remarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      throw ErrorHandler.badRequest('Invalid status');
    }

    const hunter = await Hunter.findById(hunterId);
    if (!hunter) {
      throw ErrorHandler.notFound('Hunter not found');
    }

    hunter.status = status;
    hunter.adminRemarks = remarks;

    // If status is approved, generate and send OTP
    if (status === 'approved') {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

      hunter.otp = {
        code: otp,
        expiresAt: otpExpiry
      };

      // Send OTP email
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: hunter.collegeEmail,
        subject: 'Bounty Hunter Registration Approved - Verification OTP',
        text: `Dear ${hunter.name},

Congratulations! Your bounty hunter registration has been approved.

Your OTP for verification is: ${otp}

This OTP will expire in 10 minutes. Please verify your account to complete the registration process.

Admin Remarks: ${remarks}

Best regards,
Bounty Hunter Platform Team`
      };

      try {
        await transporter.sendMail(mailOptions);
      } catch (error) {
        console.log("ss ->", mailOptions)
        throw ErrorHandler.badRequest('Failed to send OTP email');
      }
    }

    await hunter.save();

    const message = status === 'approved' 
      ? 'Hunter approved and OTP sent successfully'
      : 'Hunter rejected successfully';

    return res.status(200).json(Success.ok(message));
  },

  // Send OTP to approved hunter
  async sendOTP(req, res) {
    const { hunterId } = req.params;
    
    const hunter = await Hunter.findById(hunterId);
    if (!hunter) {
      throw ErrorHandler.notFound('Hunter not found');
    }

    if (hunter.status !== 'approved') {
      throw ErrorHandler.badRequest('Hunter must be approved before sending OTP');
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

    hunter.otp = {
      code: otp,
      expiresAt: otpExpiry
    };
    await hunter.save();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: hunter.collegeEmail,
      subject: 'Bounty Hunter Verification OTP',
      text: `Your OTP for verification is: ${otp}. This OTP will expire in 10 minutes.`
    };

    await transporter.sendMail(mailOptions);
    return res.status(200).json(Success.ok('OTP sent successfully'));
  }
};

module.exports = adminController;