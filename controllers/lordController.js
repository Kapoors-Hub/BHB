const Lord = require('../models/Lord');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const transporter = require('../config/mailer');

const lordController = {
    // Register new lord
    async register(req, res) {
        const { username, email, password, mobileNumber } = req.body;
    
        try {
            // Check if username, email, or mobile number already exists
            const existingLord = await Lord.findOne({
                $or: [{ username }, { email }, { mobileNumber }]
            });
    
            if (existingLord) {
                if (existingLord.username === username) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Username already taken'
                    });
                } else if (existingLord.email === email) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Email already registered'
                    });
                } else if (existingLord.mobileNumber === mobileNumber) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Mobile number already registered'
                    });
                }
            }
    
            // Validate mobile number format
            if (mobileNumber) {
                // Validate mobile number format 
                const mobileRegex = /^(\+\d{12}|\d{13})$/;
                if (!mobileRegex.test(mobileNumber)) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Invalid mobile number format'
                    });
                }
            }
    
            // Create new lord
            const lord = await Lord.create({
                username,
                email,
                password,
                mobileNumber
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
    },

    //Get Lord
    async getLordProfile(req, res) {
        try {
            const lordId = req.lord.id;
            
            const lord = await Lord.findById(lordId)
                .select('-password')
                .populate('bounties', 'title status startTime endTime');
                
            if (!lord) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Lord not found'
                });
            }
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Lord profile retrieved successfully',
                data: lord
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving profile',
                error: error.message
            });
        }
    },

    async updateLordProfile(req, res) {
        try {
            const lordId = req.lord.id;
            const { username, email, mobileNumber, currentPassword, newPassword } = req.body;
            
            // Find lord with password
            const lord = await Lord.findById(lordId).select('+password');
            
            if (!lord) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Lord not found'
                });
            }
            
            // Update fields
            let updateData = {};
            
            // Check if username is being updated
            if (username && username !== lord.username) {
                // Check if username is already taken
                const existingUsername = await Lord.findOne({ username });
                if (existingUsername) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Username already taken'
                    });
                }
                updateData.username = username;
            }
            
            // Check if email is being updated
            if (email && email !== lord.email) {
                // Check if email is already registered
                const existingEmail = await Lord.findOne({ email });
                if (existingEmail) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Email already registered'
                    });
                }
                updateData.email = email;
            }
            
            // Check if mobile number is being updated
            if (mobileNumber && mobileNumber !== lord.mobileNumber) {
                // Validate mobile number format
                const mobileRegex = /^(\+\d{1,3}[- ]?)?\d{10,12}$/;
                if (!mobileRegex.test(mobileNumber)) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Invalid mobile number format'
                    });
                }
                
                // Check if mobile number is already registered
                const existingMobile = await Lord.findOne({ mobileNumber });
                if (existingMobile) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Mobile number already registered'
                    });
                }
                updateData.mobileNumber = mobileNumber;
            }
            
            // Handle password update if provided
            if (newPassword && currentPassword) {
                // Verify current password
                const isPasswordValid = await bcrypt.compare(currentPassword, lord.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        status: 401,
                        success: false,
                        message: 'Current password is incorrect'
                    });
                }
                
                // Hash new password
                updateData.password = await bcrypt.hash(newPassword, 10);
            } else if (newPassword && !currentPassword) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Current password is required to update password'
                });
            }
            
            // Update lord profile
            const updatedLord = await Lord.findByIdAndUpdate(
                lordId,
                updateData,
                { new: true }
            ).select('-password');
            
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Profile updated successfully',
                data: updatedLord
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating profile',
                error: error.message
            });
        }
    }
};

module.exports = lordController;