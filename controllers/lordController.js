const Lord = require('../models/Lord');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');

const lordController = {
    // Register new lord
    async register(req, res) {
        const { username, email, password } = req.body;

        try {
            // Check if username or email already exists
            const existingLord = await Lord.findOne({
                $or: [{ username }, { email }]
            });

            if (existingLord) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: existingLord.username === username ? 
                        'Username already taken' : 'Email already registered'
                });
            }

            // Create new lord
            const lord = await Lord.create({
                username,
                email,
                password
            });

            // Generate token
            const token = jwt.sign(
                { id: lord._id, role: 'lord' },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Remove password from response
            lord.password = undefined;

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Lord registered successfully',
                data: {
                    lord,
                    token
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error registering lord',
                error: error.message
            });
        }
    },

    // Lord login
    async login(req, res) {
        const { emailOrUsername, password } = req.body;

        try {
            // Find lord by email or username
            const lord = await Lord.findOne({
                $or: [
                    { email: emailOrUsername },
                    { username: emailOrUsername }
                ]
            }).select('+password');

            if (!lord) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Verify password
            const isPasswordValid = await bcrypt.compare(password, lord.password);
            if (!isPasswordValid) {
                return res.status(401).json({
                    status: 401,
                    success: false,
                    message: 'Invalid credentials'
                });
            }

            // Generate token
            const token = jwt.sign(
                { id: lord._id, role: 'lord' },
                process.env.JWT_SECRET,
                { expiresIn: '1d' }
            );

            // Remove password from response
            lord.password = undefined;

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Login successful',
                data: {
                    lord,
                    token
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error during login',
                error: error.message
            });
        }
    },

    // Forgot password
    async forgotPassword(req, res) {
        const { email } = req.body;

        try {
            const lord = await Lord.findOne({ email });
            if (!lord) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Lord not found with this email'
                });
            }

            // Generate OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

            // Save OTP
            lord.resetPasswordOtp = {
                code: otp,
                expiresAt: otpExpiry
            };
            await lord.save();

            // Send email
            const mailOptions = {
                from: process.env.EMAIL_USER,
                to: lord.email,
                subject: 'Password Reset Request - Bounty Lord Platform',
                text: `Your OTP for password reset is: ${otp}\nThis OTP will expire in 10 minutes.`
            };

            await transporter.sendMail(mailOptions);

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Password reset OTP sent successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error sending reset OTP',
                error: error.message
            });
        }
    },

    // Reset password
    async resetPassword(req, res) {
        const { email, otp, newPassword } = req.body;

        try {
            const lord = await Lord.findOne({ email });
            if (!lord) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Lord not found'
                });
            }

            // Verify OTP
            if (!lord.resetPasswordOtp || 
                !lord.resetPasswordOtp.code || 
                lord.resetPasswordOtp.expiresAt < new Date() ||
                lord.resetPasswordOtp.code !== otp) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Invalid or expired OTP'
                });
            }

            // Update password
            lord.password = newPassword;
            lord.resetPasswordOtp = undefined;
            await lord.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Password reset successful'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error resetting password',
                error: error.message
            });
        }
    },

    // Logout
    async logout(req, res) {
        try {
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error during logout',
                error: error.message
            });
        }
    }
};

module.exports = lordController;