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
                subject: 'Bounty Hunter Registration Approved - Welcome to the Hunt',
                attachments: [
                    {
                        filename: 'header.png',
                        path: './assets/header.png',
                        cid: 'headerLogo'
                    },
                    {
                        filename: 'bg.png',
                        path: './assets/bg.png',
                        cid: 'backgroundImage'
                    }
                ],
                html: `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Bounty Hunters - Registration</title>
            </head>
            <body style="background-color: #1a1a1a; color: white; font-family: Arial, sans-serif; margin: 0; padding: 0;">
                <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #1a1a1a;">
                    <tr>
                        <td align="center" valign="top" style="padding: 20px;">
                            <table cellpadding="0" cellspacing="0" border="0" width="600" style="max-width: 100%; background-image: url(cid:backgroundImage); background-color: #1a1a1a;">
                                <tr>
                                    <td style="padding: 40px 30px;">
                                        <!-- Header -->
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td align="center" style="padding-bottom: 20px;">
                                                    <img src="cid:headerLogo" alt="Bounty Hunters" style="max-width: 100%; height: auto; display: block;">
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="height: 1px; background-color: #C8C8C8;"></td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Main Content -->
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-top: 20px;">
                                            <tr>
                                                <td>
                                                    <h1 style="font-size: 24px; font-family: 'Orbitron', Arial, sans-serif; margin-bottom: 30px; font-weight: 400; line-height: 140%; letter-spacing: 0.48px;">You made it in!</h1>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-bottom: 5px;">
                                                    <p style="margin: 0; font-size: 16px;">Hey ${hunter.name},</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-top: 15px; padding-bottom: 15px;">
                                                    <p style="margin: 0; font-family: 'Roboto Mono', monospace; font-size: 16px;">The wait is finally over 😊. Here is your secret code to the start of greatness:</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 15px 0;">
                                                    <p style="font-size: 36px; font-weight: bold; color: white; font-family: 'Orbitron', Arial, sans-serif; margin: 0;">${otp}</p>
                                                </td>
                                            </tr>
                                            ${remarks ? `
                                            <tr>
                                                <td style="padding: 15px; margin: 15px 0; background-color: #333; border-left: 3px solid #10daff;">
                                                    <p style="margin: 0; font-family: 'Roboto Mono', monospace;"><strong>Admin Remarks:</strong> ${remarks}</p>
                                                </td>
                                            </tr>` : ''}
                                            <tr>
                                                <td style="padding: 15px 0;">
                                                    <p style="margin: 0;">This OTP will expire in 10 minutes. Click on this <a href="https://bountyhunters.in/hunterLanding" style="color: #10daff; text-decoration: underline;">link</a>, and activate your hunter account now!</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 30px 0;">
                                                    <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                                        <tr>
                                                            <td align="center" bgcolor="white" style="padding: 16px; border-radius: 0;">
                                                                <a href="https://bountyhunters.in/hunterLanding" style="display: block; color: black; text-decoration: none; font-family: 'Roboto Mono', monospace; font-size: 16px; width: 100%; text-align: center;">Go to Bounty Hunter</a>
                                                            </td>
                                                        </tr>
                                                    </table>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="height: 1px; background-color: #C8C8C8; margin-bottom: 20px;"></td>
                                            </tr>
                                        </table>
                                        
                                        <!-- Footer -->
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-top: 20px;">
                                            <tr>
                                                <td align="center">
                                                    <p style="margin: 0; padding-bottom: 5px; font-family: 'Roboto Mono', monospace;">🏳 The Hunt Never Ends.</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center">
                                                    <p style="margin: 0; padding-bottom: 10px; font-family: 'Roboto Mono', monospace;">Bounty Hunters - Only the Worthy Prevail.</p>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td align="center" style="padding: 10px 0;">
                                                    <a href="mailto:theguild@bountyhunters.in" style="color: #C8C8C8; text-decoration: underline;">Contact Us</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
            </html>`,
                text: `Dear ${hunter.name},
            
            Congratulations! Your bounty hunter registration has been approved.
            
            Your OTP for verification is: ${otp}
            
            This OTP will expire in 10 minutes. Please verify your account to complete the registration process.
            
            Admin Remarks: ${remarks}
            
            Verify here: https://bountyhunters.in/hunterLanding
            
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
    },

    // Delete Hunter
    async deleteHunter(req, res) {
        const { hunterId } = req.params;

        try {
            const hunter = await Hunter.findById(hunterId);

            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }

            // Delete the hunter
            await Hunter.findByIdAndDelete(hunterId);

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting hunter',
                error: error.message
            });
        }
    },

    // Get Hunter Single
async getHunterById(req, res) {
    const { hunterId } = req.params;

    try {
        const hunter = await Hunter.findById(hunterId);

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found'
            });
        }

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Hunter fetched successfully',
            data: hunter
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error fetching hunter details',
            error: error.message
        });
    }
}
};

module.exports = adminController;