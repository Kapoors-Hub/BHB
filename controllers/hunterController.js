const Hunter = require('../models/Hunter');
const Success = require('../utils/success');
const { ErrorHandler } = require('../utils/error');
const transporter = require('../config/mailer');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const notificationController = require('./notificationController');
const FoulRecord = require('../models/FoulRecord');

const hunterController = {

    // Get hunter profile
async getHunterProfile(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Fetch hunter with related data
      const hunter = await Hunter.findById(hunterId)
        .populate('badges.badge')
        .populate('titles.title')
        .populate('titles.awardedBy', 'username')
        .populate('acceptedBounties', 'title description status startTime endTime')
        .select('-resetPasswordOtp -otp -password');
      
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
      
      // Get count of unread notifications
      const unreadNotifications = await Notification.countDocuments({
        hunter: hunterId,
        isRead: false
      });
      
      // Get active bounties count
      const activeBounties = hunter.acceptedBounties.filter(
        bounty => bounty.status === 'active'
      ).length;
      
      // Format active titles
      const now = new Date();
      const activeTitles = hunter.titles.filter(title => title.validUntil > now);
      
      // Calculate XP needed for next level
      let nextThreshold;
      const xp = hunter.xp;
      
      if (xp < 18000) {  // Bronze tier
        if (hunter.level.rank === 'Novice') nextThreshold = 6000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 12000;
        else nextThreshold = 18000;
      } else if (xp < 42000) {  // Silver tier
        if (hunter.level.rank === 'Novice') nextThreshold = 26000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 34000;
        else nextThreshold = 42000;
      } else {  // Gold tier
        if (hunter.level.rank === 'Novice') nextThreshold = 52000;
        else if (hunter.level.rank === 'Specialist') nextThreshold = 62000;
        else nextThreshold = 72000;
      }
      
      // Format response data
      const profileData = {
        personalInfo: {
          id: hunter._id,
          name: hunter.name,
          username: hunter.username,
          collegeName: hunter.collegeName,
          collegeEmail: hunter.collegeEmail,
          personalEmail: hunter.personalEmail,
          mobileNumber: hunter.mobileNumber,
          discipline: hunter.discipline,
          graduatingYear: hunter.graduatingYear,
          dateOfBirth: hunter.dateOfBirth,
          location: {
            city: hunter.city,
            state: hunter.state,
            postalZipCode: hunter.postalZipCode,
            placeOfResidence: hunter.placeOfResidence
          },
          guild: hunter.guild,
          status: hunter.status,
          isVerified: hunter.isVerified,
          adminRemarks: hunter.adminRemarks,
          createdAt: hunter.createdAt
        },
        progression: {
          xp: hunter.xp,
          level: {
            tier: hunter.level.tier,
            rank: hunter.level.rank
          },
          nextLevelAt: nextThreshold,
          xpNeeded: Math.max(0, nextThreshold - hunter.xp),
          performance: {
            score: hunter.performance.score,
            totalBountiesCalculated: hunter.performance.totalBountiesCalculated
          }
        },
        achievements: {
          badges: hunter.badges.map(badge => ({
            id: badge.badge?._id || badge.badge,
            name: badge.badge?.name || 'Unknown Badge',
            description: badge.badge?.description,
            earnedAt: badge.earnedAt
          })),
          activeTitles: activeTitles.map(title => ({
            id: title.title?._id || title.title,
            name: title.title?.name || 'Unknown Title',
            description: title.title?.description,
            awardedAt: title.awardedAt,
            validUntil: title.validUntil,
            awardedBy: title.awardedBy?.username || 'System'
          })),
          bountiesWon: hunter.achievements.bountiesWon.count,
          firstSubmissions: hunter.achievements.firstSubmissions.count,
          nonProfitBounties: hunter.achievements.nonProfitBounties.count
        },
        passes: {
          timeExtension: hunter.passes.timeExtension.count,
          resetFoul: hunter.passes.resetFoul.count,
          booster: hunter.passes.booster.count,
          seasonal: hunter.passes.seasonal.count,
          consecutiveWins: hunter.passes.consecutiveWins
        },
        stats: {
          activeBounties: activeBounties,
          totalBounties: hunter.acceptedBounties.length,
          unreadNotifications: unreadNotifications
        }
      };
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Profile retrieved successfully',
        data: profileData
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

        return res.status(200).json(Success.ok('OTP verified successfully', hunter));
    },

    // Get hunter status
    async getStatus(req, res) {
        const { email } = req.params;

        const hunter = await Hunter.findOne({ collegeEmail: email })
            .select('status adminRemarks');

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: "Hunter not found"
            })
        }

        return res.status(200).json(Success.ok('Status retrieved successfully', hunter));
    },

    //PUT Complete Profile
    async completeProfile(req, res) {
        const { email } = req.params;
        const {
            username,
            password,
            guild
        } = req.body;

        const hunter = await Hunter.findOne({ collegeEmail: email });

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found'
            });
        }

        if (!hunter.isVerified) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Please verify your OTP first'
            });
        }

        // Validate required fields 
        if (!username || !password || !guild) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'All fields are required'
            });
        }

        // Validate username uniqueness
        const existingUsername = await Hunter.findOne({ username });
        if (existingUsername) {
            throw ErrorHandler.badRequest('Username already taken');
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Update hunter profile
        hunter.username = username;
        hunter.password = hashedPassword;
        hunter.guild = guild;

        await hunter.save();

        // Generate JWT token
        const token = jwt.sign(
            { id: hunter._id, username: hunter.username, role: 'hunter' },
            process.env.JWT_SECRET,
            { expiresIn: '30d' }
        );

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Profile completed successfully',
            data: {
                hunter,
                token
            }
        });
    },

    //Post Login
    async login(req, res) {
        const { emailOrUsername, password } = req.body;

        // Find hunter by email or username
        const hunter = await Hunter.findOne({
            $or: [
                { collegeEmail: emailOrUsername },
                { username: emailOrUsername }
            ]
        }).select('+password'); // Explicitly include password field since it's select: false

        if (!hunter) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Check if hunter is verified
        if (!hunter.isVerified) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Please verify your account first'
            });
        }

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, hunter.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 401,
                success: false,
                message: 'Invalid credentials'
            });
        }

        // Generate JWT token
        const token = jwt.sign(
            {
                id: hunter._id,
                username: hunter.username,
                role: 'hunter'
            },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        // Remove password from response
        hunter.password = undefined;

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Login successful',
            data: {
                hunter,
                token
            }
        });
    },

    // Get Logout
    async logout(req, res) {
        // Since JWT is stateless, we'll just return a success message
        // The client side should remove the token
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Logged out successfully'
        });
    },

    // Update Profile
    async updateProfile(req, res) {
        const { id } = req.params;  // Hunter's ID from JWT token
        const {
            currentPassword,    // Required for password change
            newPassword,
            username,
            placeOfResidence,
            guild
        } = req.body;

        // Find hunter by id
        const hunter = await Hunter.findById(id).select('+password');
        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found'
            });
        }

        try {
            // If updating password, verify current password
            if (newPassword) {
                if (!currentPassword) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Current password is required to update password'
                    });
                }

                const isPasswordValid = await bcrypt.compare(currentPassword, hunter.password);
                if (!isPasswordValid) {
                    return res.status(401).json({
                        status: 401,
                        success: false,
                        message: 'Current password is incorrect'
                    });
                }

                // Hash new password
                hunter.password = await bcrypt.hash(newPassword, 10);
            }

            // If updating username, check if new username is available
            if (username && username !== hunter.username) {
                const existingUsername = await Hunter.findOne({ username });
                if (existingUsername) {
                    return res.status(400).json({
                        status: 400,
                        success: false,
                        message: 'Username already taken'
                    });
                }
                hunter.username = username;
            }

            // Update other fields if provided
            if (placeOfResidence) hunter.placeOfResidence = placeOfResidence;
            if (guild) hunter.guild = guild;

            // Save the updated profile
            await hunter.save();

            // Remove password from response
            hunter.password = undefined;

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Profile updated successfully',
                data: hunter
            });

        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating profile',
                error: error.message
            });
        }
    },

    // Add this method to hunterController.js

// Verify hunter password
async verifyPassword(req, res) {
    try {
      const hunterId = req.hunter.id;
      const { password } = req.body;
      
      // Check if password is provided
      if (!password) {
        return res.status(400).json({
          status: 400,
          success: false,
          message: 'Password is required'
        });
      }
      
      // Find hunter with password field included
      const hunter = await Hunter.findById(hunterId).select('+password');
      
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
      
      // Verify password
      const isPasswordValid = await bcrypt.compare(password, hunter.password);
      
      return res.status(200).json({
        status: 200,
        success: true,
        data: {
          isValid: isPasswordValid
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error verifying password',
        error: error.message
      });
    }
  },


// Update hunter personal information
async updatePersonalInfo(req, res) {
    try {
      const hunterId = req.hunter.id;
      const {
        name,
        collegeName,
        personalEmail,
        mobileNumber,
        discipline,
        graduatingYear,
        dateOfBirth,
        city,
        state,
        postalZipCode,
        placeOfResidence,
        guild
      } = req.body;
  
      // Find hunter by id
      const hunter = await Hunter.findById(hunterId);
      if (!hunter) {
        return res.status(404).json({
          status: 404,
          success: false,
          message: 'Hunter not found'
        });
      }
  
      // Check if personalEmail is changing and if so, validate it's not taken
      if (personalEmail && personalEmail !== hunter.personalEmail) {
        const existingEmailHunter = await Hunter.findOne({ personalEmail });
        if (existingEmailHunter) {
          return res.status(400).json({
            status: 400,
            success: false,
            message: 'Personal email is already in use'
          });
        }
      }
  
      // Check if mobile number is changing and if so, validate it's not taken
      if (mobileNumber && mobileNumber !== hunter.mobileNumber) {
        const existingMobileHunter = await Hunter.findOne({ mobileNumber });
        if (existingMobileHunter) {
          return res.status(400).json({
            status: 400,
            success: false,
            message: 'Mobile number is already in use'
          });
        }
      }
  
      // Fields that can be updated directly
      const updatableFields = {
        name,
        collegeName,
        personalEmail,
        mobileNumber,
        discipline,
        graduatingYear,
        dateOfBirth,
        city,
        state,
        postalZipCode,
        placeOfResidence,
        guild
      };
  
      // Remove undefined fields (fields not included in the request)
      Object.keys(updatableFields).forEach(key => {
        if (updatableFields[key] === undefined) {
          delete updatableFields[key];
        }
      });
  
      // Update hunter with validated fields
      const updatedHunter = await Hunter.findByIdAndUpdate(
        hunterId,
        { $set: updatableFields },
        { new: true, runValidators: true }
      ).select('-resetPasswordOtp -otp -password');
  
      // Create notification about profile update
      await notificationController.createNotification({
        hunterId: hunterId,
        title: 'Profile Updated',
        message: 'Your personal information has been successfully updated.',
        type: 'system'
      });
  
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Personal information updated successfully',
        data: {
          personalInfo: {
            id: updatedHunter._id,
            name: updatedHunter.name,
            username: updatedHunter.username,
            collegeName: updatedHunter.collegeName,
            collegeEmail: updatedHunter.collegeEmail,
            personalEmail: updatedHunter.personalEmail,
            mobileNumber: updatedHunter.mobileNumber,
            discipline: updatedHunter.discipline,
            graduatingYear: updatedHunter.graduatingYear,
            dateOfBirth: updatedHunter.dateOfBirth,
            location: {
              city: updatedHunter.city,
              state: updatedHunter.state,
              postalZipCode: updatedHunter.postalZipCode,
              placeOfResidence: updatedHunter.placeOfResidence
            },
            guild: updatedHunter.guild,
            status: updatedHunter.status,
            isVerified: updatedHunter.isVerified,
            createdAt: updatedHunter.createdAt
          }
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error updating personal information',
        error: error.message
      });
    }
  },

    // Request password reset
    async forgotPassword(req, res) {
        const { emailOrUsername } = req.body;

        // Find hunter by email or username
        const hunter = await Hunter.findOne({
            $or: [
                { collegeEmail: emailOrUsername },
                { username: emailOrUsername }
            ]
        });

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No hunter found with this email/username'
            });
        }

        // Generate OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

        // Save OTP to hunter
        hunter.resetPasswordOtp = {
            code: otp,
            expiresAt: otpExpiry
        };
        await hunter.save();

        // Send email with OTP
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: hunter.collegeEmail,
            subject: 'Password Reset Request - Bounty Hunter Platform',
            text: `Dear ${hunter.name},

You have requested to reset your password.

Your OTP for password reset is: ${otp}

This OTP will expire in 10 minutes.

If you didn't request this, please ignore this email.

Best regards,
Bounty Hunter Platform Team`
        };

        try {
            await transporter.sendMail(mailOptions);
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Password reset OTP sent to your email'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Failed to send reset OTP email'
            });
        }
    },

    // Reset password with OTP
    async resetPassword(req, res) {
        const { emailOrUsername, otp, newPassword } = req.body;

        // Find hunter by email or username
        const hunter = await Hunter.findOne({
            $or: [
                { collegeEmail: emailOrUsername },
                { username: emailOrUsername }
            ]
        });

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'No hunter found with this email/username'
            });
        }

        // Verify OTP
        if (!hunter.resetPasswordOtp ||
            !hunter.resetPasswordOtp.code ||
            hunter.resetPasswordOtp.expiresAt < new Date() ||
            hunter.resetPasswordOtp.code !== otp) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Invalid or expired OTP'
            });
        }

        // Hash new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);
        hunter.password = hashedPassword;

        // Clear reset OTP
        hunter.resetPasswordOtp = undefined;

        await hunter.save();

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Password reset successful. Please login with your new password'
        });
    },

    //Forgot Password Resend OTP
async resendForgotPasswordOTP(req, res) {
    const { emailOrUsername } = req.body;
 
    // Find hunter by email or username
    const hunter = await Hunter.findOne({
        $or: [
            { collegeEmail: emailOrUsername },
            { username: emailOrUsername }
        ]
    });
 
    if (!hunter) {
        return res.status(404).json({
            status: 404,
            success: false,
            message: 'No hunter found with this email/username'
        });
    }
 
    // Check if previous reset OTP was sent within last 1 minute
    if (hunter.resetPasswordOtp && hunter.resetPasswordOtp.expiresAt) {
        const timeDiff = new Date() - new Date(hunter.resetPasswordOtp.expiresAt);
        const minutesPassed = timeDiff / (1000 * 60);
        
        if (minutesPassed < -9) { // Since OTP validity is 10 minutes
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Please wait 1 minute before requesting new OTP',
                timeRemaining: Math.ceil(-minutesPassed - 9)
            });
        }
    }
 
    // Generate new OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity
 
    // Save new OTP
    hunter.resetPasswordOtp = {
        code: otp,
        expiresAt: otpExpiry
    };
 
    // Send email with new OTP
    const mailOptions = {
        from: process.env.EMAIL_USER,
        to: hunter.collegeEmail,
        subject: 'New Password Reset OTP - Bounty Hunter Platform',
        text: `Dear ${hunter.name},
 
 You have requested a new password reset OTP.
 
 Your new OTP is: ${otp}
 
 This OTP will expire in 10 minutes.
 
 If you didn't request this, please ignore this email or secure your account.
 
 Best regards,
 Bounty Hunter Platform Team`
    };
 
    try {
        await transporter.sendMail(mailOptions);
        await hunter.save();
 
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'New password reset OTP sent successfully'
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Failed to send reset OTP email',
            error: error.message
        });
    }
 },

    // In hunterController.js
    async resendOTP(req, res) {
        const { email } = req.body;

        // Find hunter by email
        const hunter = await Hunter.findOne({ collegeEmail: email });

        if (!hunter) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Hunter not found'
            });
        }

        // Check if hunter is already verified
        if (hunter.isVerified) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Account is already verified'
            });
        }

        // Check if previous OTP was sent within last 1 minute (to prevent spam)
        if (hunter.otp && hunter.otp.expiresAt) {
            const timeDiff = new Date() - new Date(hunter.otp.expiresAt);
            const minutesPassed = timeDiff / (1000 * 60);

            if (minutesPassed < -9) { // Since OTP validity is 10 minutes
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Please wait 1 minute before requesting new OTP',
                    timeRemaining: Math.ceil(-minutesPassed - 9) // Time to wait in minutes
                });
            }
        }

        // Generate new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const otpExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes validity

        // Update hunter with new OTP
        hunter.otp = {
            code: otp,
            expiresAt: otpExpiry
        };

        // Send email with new OTP
        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: hunter.collegeEmail,
            subject: 'New OTP - Bounty Hunter Platform',
            text: `Dear ${hunter.name},
 
 You have requested a new OTP.
 
 Your new verification OTP is: ${otp}
 
 This OTP will expire in 10 minutes.
 
 Best regards,
 Bounty Hunter Platform Team`
        };

        try {
            await transporter.sendMail(mailOptions);
            await hunter.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'New OTP sent successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Failed to send OTP email',
                error: error.message
            });
        }
    },

    // My Level
    async getMyLevel(req, res) {
        try {
            const hunterId = req.hunter.id;
            const hunter = await Hunter.findById(hunterId);
    
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
    
            // Calculate XP needed for next rank/tier
            let nextThreshold;
            const xp = hunter.xp;
    
            if (xp < 18000) {  // Bronze tier
                if (hunter.level.rank === 'Novice') nextThreshold = 18000 * 0.33;
                else if (hunter.level.rank === 'Specialist') nextThreshold = 18000 * 0.66;
                else nextThreshold = 18000;
            } else if (xp < 42000) {  // Silver tier
                if (hunter.level.rank === 'Novice') nextThreshold = 18000 + (42000 - 18000) * 0.33;
                else if (hunter.level.rank === 'Specialist') nextThreshold = 18000 + (42000 - 18000) * 0.66;
                else nextThreshold = 42000;
            } else {  // Gold tier
                if (hunter.level.rank === 'Novice') nextThreshold = 42000 + (72000 - 42000) * 0.33;
                else if (hunter.level.rank === 'Specialist') nextThreshold = 42000 + (72000 - 42000) * 0.66;
                else nextThreshold = 72000;
            }
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Level info retrieved successfully',
                data: {
                    currentXP: hunter.xp,
                    level: {
                        tier: hunter.level.tier,
                        rank: hunter.level.rank
                    },
                    nextThreshold,
                    xpNeeded: nextThreshold - hunter.xp,
                    maxTierXP: hunter.level.tier === 'Bronze' ? 18000 : 
                              hunter.level.tier === 'Silver' ? 42000 : 72000
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving level info',
                error: error.message
            });
        }
    },

     // Titles
     async getMyTitles(req, res) {
        try {
            const hunterId = req.hunter.id;

            const hunter = await Hunter.findById(hunterId)
                .populate('titles.title')
                .select('titles');

            const now = new Date();

            // Separate active and expired titles
            const activeTitles = hunter.titles.filter(title =>
                title.validUntil > now
            );

            const expiredTitles = hunter.titles.filter(title =>
                title.validUntil <= now
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Titles retrieved successfully',
                data: {
                    activeTitles,
                    expiredTitles,
                    totalActive: activeTitles.length,
                    totalExpired: expiredTitles.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving titles',
                error: error.message
            });
        }
    },

    async getMyPerformance(req, res) {
        try {
          const hunterId = req.hunter.id;
          const hunter = await Hunter.findById(hunterId)
            .populate('performance.bountyScores.bounty', 'title description');
          
          if (!hunter) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'Hunter not found'
            });
          }
          
          // Format response data
          const performanceData = {
            overallScore: hunter.performance.score,
            totalBounties: hunter.performance.totalBountiesCalculated,
            recentBounties: hunter.performance.bountyScores
              .sort((a, b) => b.calculatedAt - a.calculatedAt)
              .slice(0, 5)
              .map(item => ({
                bountyId: item.bounty._id,
                bountyTitle: item.bounty.title || 'Unknown Bounty',
                score: item.score,
                calculatedAt: item.calculatedAt
              }))
          };
          
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Performance data retrieved successfully',
            data: performanceData
          });
        } catch (error) {
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error retrieving performance data',
            error: error.message
          });
        }
      },
      // Add to hunterController.js
async getMyFouls(req, res) {
  try {
    const hunterId = req.hunter.id;
    
    // Fetch all foul records for this hunter
    const foulRecords = await FoulRecord.find({ hunter: hunterId })
      .populate('foul', 'name description severity xpPenaltyPercentage')
      .populate('appliedBy', 'username firstName lastName')
      .populate('relatedBounty', 'title')
      .sort({ appliedAt: -1 });
    
    // Get total count and total XP penalty
    const totalXpPenalty = foulRecords.reduce((sum, record) => sum + record.xpPenalty, 0);
    
    // Count by severity
    const severityCounts = {
      low: 0,
      medium: 0,
      high: 0
    };
    
    foulRecords.forEach(record => {
      if (record.foul && record.foul.severity) {
        severityCounts[record.foul.severity]++;
      }
    });
    
    // Format the data for response
    const formattedFouls = foulRecords.map(record => ({
      id: record._id,
      foulName: record.foul ? record.foul.name : 'Unknown Foul',
      description: record.foul ? record.foul.description : '',
      severity: record.foul ? record.foul.severity : 'unknown',
      reason: record.reason,
      evidence: record.evidence,
      xpPenalty: record.xpPenalty,
      wasStrike: record.isStrike,
      occurrenceNumber: record.occurrenceNumber,
      relatedBounty: record.relatedBounty ? {
        id: record.relatedBounty._id,
        title: record.relatedBounty.title
      } : null,
      appliedBy: record.appliedBy ? {
        username: record.appliedBy.username,
        name: record.appliedBy.firstName 
          ? `${record.appliedBy.firstName} ${record.appliedBy.lastName}` 
          : record.appliedBy.username
      } : { username: 'System', name: 'System' },
      appliedAt: record.appliedAt,
      status: record.clearedByPass ? 'cleared' : (record.reducedPenalty ? 'reduced' : 'active'),
      originalPenalty: record.reducedPenalty ? record.xpPenalty + record.xpRestored : record.xpPenalty
    }));
    
    // Get hunter strike info
    const hunter = await Hunter.findById(hunterId).select('strikes');
    
    return res.status(200).json({
      status: 200,
      success: true,
      message: 'Foul records retrieved successfully',
      data: {
        totalFouls: foulRecords.length,
        totalXpPenalty,
        severityCounts,
        strikes: {
          count: hunter.strikes.count,
          isCurrentlySuspended: hunter.strikes.isCurrentlySuspended,
          suspensionEndDate: hunter.strikes.suspensionEndDate,
          suspensionHistory: hunter.strikes.suspensionHistory
        },
        fouls: formattedFouls
      }
    });
  } catch (error) {
    return res.status(500).json({
      status: 500,
      success: false,
      message: 'Error retrieving foul records',
      error: error.message
    });
  }
}
      
};




module.exports = hunterController;