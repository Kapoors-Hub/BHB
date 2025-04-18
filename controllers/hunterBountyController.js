// controllers/hunterBountyController.js
const Bounty = require('../models/Bounty');
const BountyResult = require('../models/BountyResult');
const Foul = require('../models/Foul');
const FoulRecord = require('../models/FoulRecord');
const Hunter = require('../models/Hunter');
const { calculateReviewXP } = require('../services/xpService');
const notificationController = require('./notificationController');
const mongoose = require('mongoose');
const path = require('path');
const xpService = require('../services/xpService');

const hunterBountyController = {
    // Get all available bounties

    async getAvailableBounties(req, res) {
        try {
          // Get pagination parameters from request query with defaults
          const page = parseInt(req.query.page) || 1;
          const limit = parseInt(req.query.limit) || 20;
          const skip = (page - 1) * limit;
                
          // Build the query object to exclude completed bounties
          const query = { status: { $ne: 'completed' } };
          
          // Use lean() for better performance when you don't need Mongoose documents
          // Use select() to only fetch the fields you actually need
          const [bounties, totalCount] = await Promise.all([
            Bounty.find(query)
              .select('title description rewardPrize status level days currentHunters category tags')
              // Removed the populate() call
              .sort({ createdAt: -1 })  // Sort by newest first
              .skip(skip)
              .limit(limit)
              .lean(),  // Convert to plain JavaScript objects
              
            Bounty.countDocuments(query)  // Get total count for pagination
          ]);
   
          // Calculate pagination metadata
          const totalPages = Math.ceil(totalCount / limit);
          const hasNextPage = page < totalPages;
          const hasPrevPage = page > 1;
          
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Available bounties fetched successfully',
            data: {
              bounties,
              pagination: {
                totalCount,
                totalPages,
                currentPage: page,
                limit,
                hasNextPage,
                hasPrevPage
              }
            }
          });
        } catch (error) {
          console.error('Error in getAvailableBounties:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error fetching bounties',
            error: error.message
          });
        }
      },

    // Get single bounty details
    // async getBountyDetails(req, res) {
    //     try {
    //         const bounty = await Bounty.findById(req.params.bountyId)
    //             .populate('createdBy', 'username')
    //             .populate('participants.hunter', 'username');

    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found'
    //             });
    //         }

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Bounty details fetched successfully',
    //             data: bounty
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error fetching bounty details',
    //             error: error.message
    //         });
    //     }
    // },

    async getBountyDetails(req, res) {
        try {
          const { bountyId } = req.params;
          const hunterId = req.hunter.id;
          
          // Validate ObjectId to avoid unnecessary database query
          if (!mongoose.Types.ObjectId.isValid(bountyId)) {
            return res.status(400).json({
              status: 400,
              success: false,
              message: 'Invalid bounty ID format'
            });
          }
          
          // Get the bounty with basic details
          const bounty = await Bounty.findById(bountyId)
            .select('-__v -shortlistedHunters -evaluatedHunters -resultId -createdAt')
            .lean();
          
          if (!bounty) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'Bounty not found'
            });
          }
          
          // Find the hunter's submission in the participants array
          const hunterParticipation = bounty.participants.find(
            p => p.hunter.toString() === hunterId
          );
          
          // Create a sanitized version of the bounty without participants array
          const sanitizedBounty = {
            ...bounty,
            participants: undefined // Remove all participants data
          };
          
          // Add hunter's submission files if they exist
          if (hunterParticipation && hunterParticipation.submission && hunterParticipation.submission.files) {
            sanitizedBounty.hunterSubmission = {
              files: hunterParticipation.submission.files,
              description: hunterParticipation.submission.description,
              submittedAt: hunterParticipation.submission.submittedAt
            };
          }
          
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Bounty details fetched successfully',
            data: sanitizedBounty
          });
        } catch (error) {
          console.error('Error in getBountyDetails:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error fetching bounty details',
            error: error.message
          });
        }
    },

    // Check if hunter has accepted a bounty

    async checkAcceptedBountyStatus(req, res) {
        try {
          const { bountyId } = req.params;
          const hunterId = req.hunter.id;
          
          // Find the hunter
          const hunter = await Hunter.findById(hunterId);
          
          if (!hunter) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'Hunter not found'
            });
          }
          
          // Check if the bounty ID is in the hunter's acceptedBounties array
          const isAccepted = hunter.acceptedBounties.includes(bountyId);
          
          // Check if the bounty ID is in the hunter's quitBounties array
          const hasQuit = hunter.quitBounties.includes(bountyId);
          
          // Get additional details if the bounty is accepted
          let bountyDetails = null;
          let participantStatus = null;
          let timeExtensionApplied = false;
          let extendedEndTime = null;
          
          if (isAccepted) {
            const bounty = await Bounty.findOne({
              _id: bountyId,
              'participants.hunter': hunterId
            });
            
            if (bounty) {
              const participant = bounty.participants.find(
                p => p.hunter.toString() === hunterId
              );
              
              if (participant) {
                participantStatus = participant.status;
                
                // Check if time extension has been applied
                timeExtensionApplied = participant.extendedEndTime ? true : false;
                extendedEndTime = participant.extendedEndTime;
                
                bountyDetails = {
                  title: bounty.title,
                  status: bounty.status,
                  startTime: bounty.startTime,
                  endTime: bounty.endTime,
                  hasSubmitted: participant.submission && participant.submission.submittedAt ? true : false,
                  participantStatus: participantStatus,
                  timeExtensionApplied: timeExtensionApplied,
                  extendedEndTime: extendedEndTime
                };
              }
            }
          }
          
          return res.status(200).json({
            status: 200,
            success: true,
            data: {
              isAccepted,
              hasQuit,
              bountyId,
              participantStatus,
              timeExtensionApplied,
              extendedEndTime,
              bountyDetails
            }
          });
        } catch (error) {
          console.error('Error in checkAcceptedBountyStatus:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error checking bounty status',
            error: error.message
          });
        }
      },

    // Accept a bounty
    async acceptBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);
            const hunterId = req.hunter.id;
            const transporter = require('../config/mailer'); // Adjust path to your transporter file
    
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
    
            // Check if bounty is still accepting hunters
            if (bounty.currentHunters >= bounty.maxHunters) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Bounty has reached maximum participants'
                });
            }
    
            // Check if hunter already participating
            const isParticipating = bounty.participants.some(
                p => p.hunter.toString() === hunterId
            );
    
            if (isParticipating) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'You are already participating in this bounty'
                });
            }
    
            // Get hunter details for email
            const hunter = await Hunter.findById(hunterId);
            if (!hunter) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter not found'
                });
            }
    
            // Add hunter to participants array and increment currentHunters
            await Bounty.findByIdAndUpdate(
                bounty._id,
                {
                    $push: {
                        participants: {
                            hunter: hunterId,
                            joinedAt: new Date(),
                            status: 'active'
                        }
                    },
                    $inc: { currentHunters: 1 }
                },
                { new: true }
            );
    
            // Add bounty to hunter's accepted bounties
            await Hunter.findByIdAndUpdate(
                hunterId,
                { $push: { acceptedBounties: bounty._id } }
            );
    
            const updatedBounty = await Bounty.findById(bounty._id)
                .populate('participants.hunter', 'username');
    
            // Create in-app notification
            await notificationController.createNotification({
                hunterId: hunterId,
                title: 'Bounty Accepted',
                message: `You've successfully accepted the bounty: ${bounty.title}`,
                type: 'bounty',
                relatedItem: bounty._id,
                itemModel: 'Bounty'
            });
    
            // Send email notification
            try {
                // Format dates for better readability
                const startDate = new Date(bounty.startTime).toLocaleDateString();
                const endDate = new Date(bounty.endTime).toLocaleDateString();
                const doubtSessionDate = new Date(bounty.doubtSessionDate).toLocaleDateString();
                const doubtSessionTime = bounty.doubtSessionTime;
                
                // Email subject
                const subject = `Registration Confirmed: ${bounty.title}`;
                
      // Email content
const emailContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
    <title>Bounty Registration Confirmed</title>
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
                            
                            <!-- Title with Icon -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-top: 24px; padding-bottom: 40px;">
                                <tr>
                                    <td>
                                        <table cellpadding="0" cellspacing="0" border="0">
                                            <tr>
                                                <td style="vertical-align: middle; padding-right: 10px;">
                                                    <img src="cid:iconConfirmed" alt="Confirmed" style="display: block;">
                                                </td>
                                                <td style="vertical-align: middle;">
                                                    <h1 style="font-size: 24px; font-family: 'Orbitron', Arial, sans-serif; margin: 0; font-weight: 400; line-height: 140%; letter-spacing: 0.48px;">
                                                        Bounty Registration Confirmed
                                                    </h1>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                            
                            <!-- Main Content -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                <tr>
                                    <td style="padding-bottom: 5px;">
                                        <p style="margin: 0; font-size: 16px;">Hey ${hunter.name},</p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding-top: 15px;">
                                        <p style="margin: 0; font-family: 'Roboto Mono', monospace; line-height: 1.6;">
                                            🔒 Your registration for <strong>${bounty.title}</strong> is locked and confirmed. The challenge awaits, and the competition is fierce.
                                        </p>
                                        <p style="margin: 10px 0 0 0; font-family: 'Roboto Mono', monospace; line-height: 1.6;">
                                            Now, it's all about strategy, skill, and execution. Prepare yourself—because only the sharpest will rise.
                                        </p>
                                        
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
                                            <tr>
                                                <td style="padding-bottom: 5px; font-family: 'Roboto Mono', monospace;">
                                                    📅 <strong>Important Dates:</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • Start Date: ${startDate}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • End Date: ${endDate}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • Reward Prize: ${bounty.rewardPrize}
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin: 20px 0;">
                                            <tr>
                                                <td style="padding-bottom: 5px; font-family: 'Roboto Mono', monospace;">
                                                    💬 <strong>Discussion Session:</strong>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • Date: ${doubtSessionDate}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • Time: ${doubtSessionTime}
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding-left: 20px; font-family: 'Roboto Mono', monospace;">
                                                    • Link: <a href="${bounty.doubtSessionLink}" style="color: #10daff; text-decoration: underline;">${bounty.doubtSessionLink}</a>
                                                </td>
                                            </tr>
                                        </table>
                                        
                                        <p style="margin: 10px 0 0 0; font-family: 'Roboto Mono', monospace; line-height: 1.6;">
                                            Stay sharp. Stay ready. The countdown to submission has begun. The hunt has begun. Make your mark.
                                        </p>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="padding: 40px 0;">
                                        <table cellpadding="0" cellspacing="0" border="0" width="100%">
                                            <tr>
                                                <td align="center" bgcolor="white" style="padding: 16px; border-radius: 0;">
                                                    <a href="https://bountyhunters.in/bountydescription/${bounty._id}" style="display: block; color: black; text-decoration: none; font-family: 'Roboto Mono', monospace; font-size: 16px; text-align: center; font-weight: 500;">View Bounty Details</a>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                                <tr>
                                    <td style="height: 1px; background-color: #C8C8C8;"></td>
                                </tr>
                            </table>
                            
                            <!-- Footer -->
                            <table cellpadding="0" cellspacing="0" border="0" width="100%" style="padding-top: 10px;">
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
                                        <a href="mailto:theguild@bountyhunters.in" style="color: #C8C8C8; text-decoration: underline; font-family: 'Roboto Mono', monospace;">Contact Us</a>
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
</html>`;

// Send the email using your transporter
const mailOptions = {
    from: process.env.EMAIL_USER,
    to: hunter.personalEmail,
    cc: hunter.collegeEmail,
    subject: subject,
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
        },
        {
            filename: 'icon1.png',
            path: './assets/icon1.svg',
            cid: 'iconConfirmed'
        }
    ],
    html: emailContent
};
                
                await transporter.sendMail(mailOptions);
                console.log(`Sent registration email for bounty ${bounty._id} to hunter ${hunterId}`);
            } catch (emailError) {
                // Log the error but don't fail the overall request
                console.error('Error sending registration email:', emailError);
            }
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty accepted successfully',
                data: updatedBounty
            });
    
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error accepting bounty',
                error: error.message
            });
        }
    },

    // Get my accepted bounties
//     async getMyBounties(req, res) {
//         try {
//             const hunterId = req.hunter.id;
    
//             // Get participating bounties with creator info
//             const participatingBounties = await Bounty.find({
//                 'participants.hunter': hunterId
//             }).populate('createdBy', 'username')
//               .populate('resultId');
    
//             // Format the response with hunter-specific data
//             const formattedBounties = await Promise.all(participatingBounties.map(async (bounty) => {
//                 // Find the hunter's submission among the participants
//                 const hunterParticipation = bounty.participants.find(
//                     p => p.hunter.toString() === hunterId
//                 );
//                 // Get total number of participants
// const totalParticipants = bounty.participants.length;
//                 // Default values
//                 let hunterScore = null;
//                 let hunterRank = null;
//                 let rewardWon = 0;
//                 let xpEarned = 0;
    
//                 // If the bounty has a result and is completed
//                 if (bounty.status === 'completed' && bounty.resultId) {
//                     // If the hunter has a submission and it was reviewed
//                     if (hunterParticipation && 
//                         hunterParticipation.submission && 
//                         hunterParticipation.submission.review) {
//                         hunterScore = hunterParticipation.submission.review.totalScore;
                        
//                         // Get the review scores to calculate XP
//                         const scores = [
//                             hunterParticipation.submission.review.adherenceToBrief || 0,
//                             hunterParticipation.submission.review.conceptualThinking || 0,
//                             hunterParticipation.submission.review.technicalExecution || 0,
//                             hunterParticipation.submission.review.originalityCreativity || 0,
//                             hunterParticipation.submission.review.documentation || 0
//                         ];
                        
//                         // Calculate XP earned from the review scores
//                         const xpService = require('../services/xpService');
//                         xpEarned = xpService.calculateReviewXP(scores);
//                     }
    
//                     // Get the hunter's rank and XP from the result if available
//                     if (bounty.resultId && bounty.resultId.rankings) {
//                         const hunterRanking = bounty.resultId.rankings.find(
//                             r => r.hunter.toString() === hunterId
//                         );
                        
//                         if (hunterRanking) {
//                             hunterRank = hunterRanking.rank;
//                             // If hunter ranked 1st, they won the reward prize
//                             if (hunterRank === 1) {
//                                 rewardWon = bounty.rewardPrize;
//                             }
                            
//                             // Get XP earned from the result if available
//                             if (hunterRanking.xpEarned) {
//                                 xpEarned = hunterRanking.xpEarned;
//                             }
//                         }
//                     } else {
//                         // If we don't have the populated result, fetch it separately
//                         const bountyResult = await BountyResult.findOne({ bounty: bounty._id });
                        
//                         if (bountyResult && bountyResult.rankings) {
//                             const hunterRanking = bountyResult.rankings.find(
//                                 r => r.hunter.toString() === hunterId
//                             );
                            
//                             if (hunterRanking) {
//                                 hunterRank = hunterRanking.rank;
//                                 // If hunter ranked 1st, they won the reward prize
//                                 if (hunterRank === 1) {
//                                     rewardWon = bounty.rewardPrize;
//                                 }
                                
//                                 // Get XP earned from the result if available
//                                 if (hunterRanking.xpEarned) {
//                                     xpEarned = hunterRanking.xpEarned;
//                                 }
//                             }
//                         }
//                     }
//                 }
    
//                 // Return the formatted bounty with hunter-specific data
//                 return {
//                     _id: bounty._id,
//                     title: bounty.title,
//                     description: bounty.description,
//                     status: bounty.status,
//                     startTime: bounty.startTime,
//                     endTime: bounty.endTime,
//                     resultTime: bounty.resultTime,
//                     rewardPrize: bounty.rewardPrize,
//                     createdBy: bounty.createdBy,
//                     createdAt: bounty.createdAt,
//                     // Hunter-specific data
//                     hunterPerformance: {
//                         score: hunterScore,
//                         rank: hunterRank,
//                         rewardWon: rewardWon,
//                         xpEarned: xpEarned,
//                         totalParticipants: totalParticipants,
//                         days: bounty.days, // Using the existing days field directly
//                     },
//                     // Include submission status
//                     submissionStatus: hunterParticipation && hunterParticipation.submission ? 
//                         hunterParticipation.submission.status : 'not_submitted',
//                     // If there's a review, include its status
//                     reviewStatus: hunterParticipation && 
//                         hunterParticipation.submission && 
//                         hunterParticipation.submission.review ? 
//                         hunterParticipation.submission.review.reviewStatus : null
//                 };
//             }));
    
//             return res.status(200).json({
//                 status: 200,
//                 success: true,
//                 message: 'Your bounties fetched successfully',
//                 data: formattedBounties
//             });
//         } catch (error) {
//             return res.status(500).json({
//                 status: 500,
//                 success: false,
//                 message: 'Error fetching your bounties',
//                 error: error.message
//             });
//         }
//     },

async getMyBounties(req, res) {
    try {
      const hunterId = req.hunter.id;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 10;
      const skip = (page - 1) * limit;
      
      // Use aggregation pipeline for more efficient processing
      const aggregationPipeline = [
        // Match bounties where the hunter is a participant
        { $match: { 
          'participants.hunter': new mongoose.Types.ObjectId(hunterId) 
        }},
        
        // Lookup bounty results in a single operation
        { $lookup: {
          from: 'bountyresults',
          localField: '_id',
          foreignField: 'bounty',
          as: 'resultData'
        }},
        
        // Lookup creator information
        { $lookup: {
          from: 'lords', // or your appropriate collection name
          localField: 'createdBy',
          foreignField: '_id',
          as: 'creatorData'
        }},
        
        // Unwind arrays to single objects (or null)
        { $unwind: { 
          path: '$resultData', 
          preserveNullAndEmptyArrays: true 
        }},
        
        { $unwind: { 
          path: '$creatorData', 
          preserveNullAndEmptyArrays: true 
        }},
        
        // Create a field with hunter's specific participation data
        { $addFields: {
          hunterParticipation: {
            $arrayElemAt: [
              { $filter: {
                input: '$participants',
                as: 'participant',
                cond: { $eq: [{ $toString: '$$participant.hunter' }, hunterId] }
              }},
              0
            ]
          },
          
          hunterRanking: {
            $arrayElemAt: [
              { $filter: {
                input: { $ifNull: ['$resultData.rankings', []] },
                as: 'ranking',
                cond: { $eq: [{ $toString: '$$ranking.hunter' }, hunterId] }
              }},
              0
            ]
          },
          
          totalParticipants: { $size: '$participants' },
          
          // Add a sortOrder field to order by status (active first, then others)
          statusSortOrder: {
            $switch: {
              branches: [
                { case: { $eq: ['$status', 'active'] }, then: 1 },
                { case: { $eq: ['$status', 'yts'] }, then: 2 },
                { case: { $eq: ['$status', 'closed'] }, then: 3 },
                { case: { $eq: ['$status', 'completed'] }, then: 4 }
              ],
              default: 5
            }
          }
        }},
        
        // Project only the needed fields
        { $project: {
          _id: 1,
          title: 1,
          description: 1,
          status: 1,
          startTime: 1,
          endTime: 1,
          resultTime: 1,
          rewardPrize: 1,
          days: 1,
          createdAt: 1,
          statusSortOrder: 1,  // Keep for sorting
          createdBy: {
            _id: '$creatorData._id',
            username: '$creatorData.username'
          },
          totalParticipants: 1,
          
          // Hunter performance data
          hunterPerformance: {
            score: { $ifNull: ['$hunterParticipation.submission.review.totalScore', null] },
            rank: { $ifNull: ['$hunterRanking.rank', null] },
            rewardWon: {
              $cond: {
                if: { $eq: [{ $ifNull: ['$hunterRanking.rank', null] }, 1] },
                then: '$rewardPrize',
                else: 0
              }
            },
            xpEarned: { $ifNull: ['$hunterRanking.xpEarned', 0] },
            totalParticipants: '$totalParticipants',
            days: '$days'
          },
          
          // Add submission and review status
          submissionStatus: { $ifNull: ['$hunterParticipation.submission.status', 'not_submitted'] },
          reviewStatus: { $ifNull: ['$hunterParticipation.submission.review.reviewStatus', null] }
        }},
        
        // Sort first by status order (active first), then by creation date
        { $sort: { 
          statusSortOrder: 1,  // 1=active, 2=yts, 3=closed, 4=completed
          createdAt: -1        // Most recent first within each status group
        }},
        
        // Apply pagination
        { $skip: skip },
        { $limit: limit }
      ];
      
      // Execute the pipeline and get the total count in parallel
      const [bounties, totalCountResult] = await Promise.all([
        Bounty.aggregate(aggregationPipeline),
        Bounty.aggregate([
          { $match: { 'participants.hunter': new mongoose.Types.ObjectId(hunterId) } },
          { $count: 'total' }
        ])
      ]);
      
      const totalCount = totalCountResult.length > 0 ? totalCountResult[0].total : 0;
      const totalPages = Math.ceil(totalCount / limit);
      
      // Remove the statusSortOrder field from the final response
      const formattedBounties = bounties.map(bounty => {
        const { statusSortOrder, ...rest } = bounty;
        return rest;
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Your bounties fetched successfully',
        data: {
          bounties: formattedBounties,
          pagination: {
            totalCount,
            totalPages,
            currentPage: page,
            limit,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1
          }
        }
      });
    } catch (error) {
      console.error('Error in getMyBounties:', error);
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error fetching your bounties',
        error: error.message
      });
    }
  },

    // Submit Bounty
    // async submitBountyWork(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const hunterId = req.hunter.id;
    //         const { description } = req.body;
    //         const files = req.files; // Multer adds files to req

    //         // Find the bounty
    //         const bounty = await Bounty.findById(bountyId);

    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found'
    //             });
    //         }

    //         // Check if hunter is a participant
    //         const isParticipant = bounty.participants.some(
    //             p => p.hunter.toString() === hunterId && p.status === 'active'
    //         );

    //         if (!isParticipant) {
    //             return res.status(403).json({
    //                 status: 403,
    //                 success: false,
    //                 message: 'You are not a participant of this bounty'
    //             });
    //         }

    //         // Check if bounty is still active
    //         if (bounty.status !== 'active') {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Bounty is not active for submissions'
    //             });
    //         }

    //         // Check if submission is within time limit
    //         const currentTime = new Date();
    //         if (currentTime > bounty.endTime) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Submission deadline has passed'
    //             });
    //         }

    //         // Process uploaded files
    //         const fileDetails = files.map(file => ({
    //             fileName: file.originalname,
    //             filePath: file.path,
    //             uploadedAt: new Date()
    //         }));

    //         // Update participant's submission
    //         await Bounty.findOneAndUpdate(
    //             {
    //                 _id: bountyId,
    //                 'participants.hunter': hunterId
    //             },
    //             {
    //                 $set: {
    //                     'participants.$.submission': {
    //                         description,
    //                         files: fileDetails,
    //                         submittedAt: new Date()
    //                     },
    //                     'participants.$.status': 'completed'
    //                 }
    //             }
    //         );

    //         await notificationController.createNotification({
    //             hunterId: hunterId,
    //             title: 'Submission Successful',
    //             message: `Your work for bounty "${bounty.title}" has been submitted successfully.`,
    //             type: 'bounty',
    //             relatedItem: bounty._id,
    //             itemModel: 'Bounty'
    //         });

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Work submitted successfully',
    //             data: {
    //                 submissionTime: new Date(),
    //                 bountyTitle: bounty.title,
    //                 filesUploaded: fileDetails.map(f => f.fileName)
    //             }
    //         });

    //     } catch (error) {
    //         console.error('Submission error:', error);
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error submitting work',
    //             error: error.message
    //         });
    //     }
    // },

    async submitBountyWork(req, res) {
        try {
            const { bountyId } = req.params;
            const hunterId = req.hunter.id;
            const { description } = req.body;
            const files = req.files; // Multer adds files to req
    
            // Find the bounty
            const bounty = await Bounty.findById(bountyId);
    
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
    
            // Find hunter's participation and check status
            const participantIndex = bounty.participants.findIndex(
                p => p.hunter.toString() === hunterId && p.status === 'active'
            );
    
            if (participantIndex === -1) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'You are not an active participant of this bounty'
                });
            }
    
            const participant = bounty.participants[participantIndex];
    
            // Check if bounty is still active
            if (bounty.status !== 'active') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Bounty is not active for submissions'
                });
            }
    
            // Check if submission is within time limit, considering time extension
            const currentTime = new Date();
            
            // If hunter has used a time extension, use their personal deadline
            const effectiveDeadline = participant.extendedEndTime || bounty.endTime;
            
            if (currentTime > effectiveDeadline) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Submission deadline has passed' + 
                        (participant.extendedEndTime ? ' (including your time extension)' : '')
                });
            }
    
            // Process uploaded files
            const fileDetails = files.map(file => ({
                fileName: file.originalname,
                filePath: file.path,
                uploadedAt: new Date()
            }));
    
            // Update participant's submission
            await Bounty.findOneAndUpdate(
                {
                    _id: bountyId,
                    'participants.hunter': hunterId
                },
                {
                    $set: {
                        'participants.$.submission': {
                            description,
                            files: fileDetails,
                            submittedAt: new Date()
                        },
                        'participants.$.status': 'completed'
                    }
                }
            );
    
            // Check if hunter is first to submit
            const isFirstSubmission = !bounty.participants.some(p => 
                p.hunter.toString() !== hunterId && // Not the current hunter
                p.submission && p.submission.submittedAt // Has already submitted
            );
    
            // If this is the first submission, update the hunter's achievements
            if (isFirstSubmission) {
                await Hunter.findByIdAndUpdate(
                    hunterId,
                    {
                        $inc: { 'achievements.firstSubmissions.count': 1 },
                        $push: { 'achievements.firstSubmissions.bountyIds': bountyId }
                    }
                );
            }
    
            // Create notification about successful submission
            await notificationController.createNotification({
                hunterId: hunterId,
                title: 'Submission Successful',
                message: `Your work for bounty "${bounty.title}" has been submitted successfully.`,
                type: 'bounty',
                relatedItem: bounty._id,
                itemModel: 'Bounty'
            });
    
            // Add first submission notification if applicable
            if (isFirstSubmission) {
                await notificationController.createNotification({
                    hunterId: hunterId,
                    title: 'First Submission!',
                    message: `Congratulations! You were the first to submit work for "${bounty.title}".`,
                    type: 'achievement',
                    relatedItem: bounty._id,
                    itemModel: 'Bounty'
                });
            }
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Work submitted successfully',
                data: {
                    submissionTime: new Date(),
                    bountyTitle: bounty.title,
                    filesUploaded: fileDetails.map(f => f.fileName),
                    isFirstSubmission,
                    deadlineUsed: participant.extendedEndTime ? 'extended' : 'original',
                    originalDeadline: bounty.endTime,
                    extendedDeadline: participant.extendedEndTime
                }
            });
    
        } catch (error) {
            console.error('Submission error:', error);
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error submitting work',
                error: error.message
            });
        }
    },

    // Get Score
    // async getMyScore(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const hunterId = req.hunter.id;
            
    //         const bounty = await Bounty.findById(bountyId)
    //             .populate('createdBy', 'username')
    //             .populate('resultId');
            
    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found'
    //             });
    //         }
            
    //         // Find hunter's participation
    //         const participation = bounty.participants.find(
    //             p => p.hunter.toString() === hunterId
    //         );
            
    //         if (!participation) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'You are not a participant in this bounty'
    //             });
    //         }
            
    //         if (!participation.submission || !participation.submission.submittedAt) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'You have not submitted any work for this bounty'
    //             });
    //         }
            
    //         if (!participation.submission.review || !participation.submission.review.reviewedAt) {
    //             return res.status(200).json({
    //                 status: 200,
    //                 success: true,
    //                 message: 'Your submission has not been reviewed yet',
    //                 data: {
    //                     bountyTitle: bounty.title,
    //                     rewardPrize: bounty.rewardPrize, // Added reward prize
    //                     reviewed: false
    //                 }
    //             });
    //         }
    
    //         const adherenceToBrief = participation.submission.review.adherenceToBrief;
    //         const conceptualThinking = participation.submission.review.conceptualThinking;
    //         const technicalExecution = participation.submission.review.technicalExecution;
    //         const originalityCreativity = participation.submission.review.originalityCreativity;
    //         const documentation = participation.submission.review.documentation;
            
    //         // Get review scores
    //         const scores = [
    //             adherenceToBrief,
    //             conceptualThinking,
    //             technicalExecution,
    //             originalityCreativity,
    //             documentation
    //         ];
            
    //         // Calculate XP using XP service
    //         const xp = calculateReviewXP(scores);
            
    //         // Determine if hunter won the bounty and earned the reward
    //         let rewardWon = 0;
    //         let rank = null;
            
    //         if (bounty.status === 'completed') {
    //             // Check if we have the populated result
    //             if (bounty.resultId && bounty.resultId.rankings) {
    //                 const hunterRanking = bounty.resultId.rankings.find(
    //                     r => r.hunter.toString() === hunterId
    //                 );
                    
    //                 if (hunterRanking) {
    //                     rank = hunterRanking.rank;
    //                     if (rank === 1) {
    //                         rewardWon = bounty.rewardPrize;
    //                     }
    //                 }
    //             } else {
    //                 // Try to fetch the result separately
    //                 const bountyResult = await BountyResult.findOne({ bounty: bountyId });
                    
    //                 if (bountyResult && bountyResult.rankings) {
    //                     const hunterRanking = bountyResult.rankings.find(
    //                         r => r.hunter.toString() === hunterId
    //                     );
                        
    //                     if (hunterRanking) {
    //                         rank = hunterRanking.rank;
    //                         if (rank === 1) {
    //                             rewardWon = bounty.rewardPrize;
    //                         }
    //                     }
    //                 }
    //             }
    //         }
            
    //         // Return score details with XP information and reward prize
    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Score retrieved successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 rewardPrize: bounty.rewardPrize, // Total prize for the bounty
    //                 reviewed: true,
    //                 reviewedAt: participation.submission.review.reviewedAt,
    //                 scores: {
    //                     adherenceToBrief: participation.submission.review.adherenceToBrief,
    //                     conceptualThinking: participation.submission.review.conceptualThinking,
    //                     technicalExecution: participation.submission.review.technicalExecution,
    //                     originalityCreativity: participation.submission.review.originalityCreativity,
    //                     documentation: participation.submission.review.documentation
    //                 },
    //                 totalScore: participation.submission.review.totalScore,
    //                 feedback: participation.submission.review.feedback,
    //                 xpEarned: xp, // Add the XP information to the response
    //                 rank: rank, // Add hunter's rank
    //                 rewardWon: rewardWon // Add the reward won by the hunter (if any)
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error retrieving score',
    //             error: error.message
    //         });
    //     }
    // },

    async getMyScore(req, res) {
        try {
          const { bountyId } = req.params;
          const hunterId = req.hunter.id;
          
          // Validate ObjectId format
          if (!mongoose.Types.ObjectId.isValid(bountyId)) {
            return res.status(400).json({
              status: 400,
              success: false,
              message: 'Invalid bounty ID format'
            });
          }
          
          // Use aggregation to get exactly what we need in a single query
          const bountyData = await Bounty.aggregate([
            // Match the specific bounty
            { $match: { _id: new mongoose.Types.ObjectId(bountyId) } },
            
            // Only include necessary fields
            { $project: {
              title: 1,
              rewardPrize: 1,
              status: 1,
              participants: 1
            }},
            
            // Lookup bounty results in a single operation if needed
            { $lookup: {
              from: 'bountyresults',
              localField: '_id',
              foreignField: 'bounty',
              as: 'resultData'
            }},
            
            // Unwind to a single document (or empty if not found)
            { $limit: 1 }
          ]);
          
          // Check if bounty exists
          if (!bountyData.length) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'Bounty not found'
            });
          }
          
          const bounty = bountyData[0];
          
          // Find hunter's participation
          const participation = bounty.participants.find(
            p => p.hunter.toString() === hunterId
          );
          
          // Check if hunter is a participant
          if (!participation) {
            return res.status(404).json({
              status: 404,
              success: false,
              message: 'You are not a participant in this bounty'
            });
          }
          
          // Check for submission
          if (!participation.submission || !participation.submission.submittedAt) {
            return res.status(400).json({
              status: 400,
              success: false,
              message: 'You have not submitted any work for this bounty'
            });
          }
          
          // Check for review
          if (!participation.submission.review || !participation.submission.review.reviewedAt) {
            return res.status(200).json({
              status: 200,
              success: true,
              message: 'Your submission has not been reviewed yet',
              data: {
                bountyTitle: bounty.title,
                rewardPrize: bounty.rewardPrize,
                reviewed: false
              }
            });
          }
          
          // Extract review scores
          const { 
            adherenceToBrief, 
            conceptualThinking, 
            technicalExecution, 
            originalityCreativity, 
            documentation,
            totalScore,
            feedback,
            reviewedAt
          } = participation.submission.review;
          
          // Calculate XP
          const scores = [
            adherenceToBrief,
            conceptualThinking,
            technicalExecution,
            originalityCreativity,
            documentation
          ];
          
          const xp = calculateReviewXP(scores);
          
          // Determine rank and reward
          let rewardWon = 0;
          let rank = null;
          let rank1Scores = null;
          
          if (bounty.status === 'completed' && bounty.resultData && bounty.resultData.length > 0) {
            const result = bounty.resultData[0];
            
            if (result.rankings && result.rankings.length > 0) {
              // Find hunter's ranking
              const hunterRanking = result.rankings.find(
                r => r.hunter.toString() === hunterId
              );
              
              if (hunterRanking) {
                rank = hunterRanking.rank;
                if (rank === 1) {
                  rewardWon = bounty.rewardPrize;
                }
              }
              
              // Find rank 1 hunter's scores
              const rank1Hunter = result.rankings.find(r => r.rank === 1);
              
              if (rank1Hunter && rank1Hunter.scores) {
                rank1Scores = rank1Hunter.scores;
              } else {
                // If scores not in result, find from participants
                const sortedParticipants = bounty.participants
                  .filter(p => p.submission && p.submission.review && p.submission.review.totalScore)
                  .sort((a, b) => b.submission.review.totalScore - a.submission.review.totalScore);
                
                if (sortedParticipants.length > 0) {
                  const topParticipant = sortedParticipants[0];
                  rank1Scores = {
                    adherenceToBrief: topParticipant.submission.review.adherenceToBrief,
                    conceptualThinking: topParticipant.submission.review.conceptualThinking,
                    technicalExecution: topParticipant.submission.review.technicalExecution,
                    originalityCreativity: topParticipant.submission.review.originalityCreativity,
                    documentation: topParticipant.submission.review.documentation,
                    totalScore: topParticipant.submission.review.totalScore
                  };
                }
              }
            }
          }
          
          // Return score details
          return res.status(200).json({
            status: 200,
            success: true,
            message: 'Score retrieved successfully',
            data: {
              bountyTitle: bounty.title,
              rewardPrize: bounty.rewardPrize,
              reviewed: true,
              reviewedAt: reviewedAt,
              scores: {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation
              },
              totalScore,
              feedback,
              xpEarned: xp,
              rank,
              rewardWon,
              rank1Scores // Added the rank1Scores to the response
            }
          });
        } catch (error) {
          console.error('Error in getMyScore:', error);
          return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error retrieving score',
            error: error.message
          });
        }
      },

    // Get hunter rankings for a bounty
    async getBountyRankings(req, res) {
        try {
            const { bountyId } = req.params;

            // Find the bounty and populate hunter information
            const bounty = await Bounty.findById(bountyId)
                .populate('participants.hunter', 'username name email xp level')
                .populate('createdBy', 'username firstName lastName');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Filter out participants with reviews
            const reviewedParticipants = bounty.participants.filter(
                p => p.submission && p.submission.review
            );

            // Sort participants by score (highest first)
            const rankedParticipants = reviewedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );

            // Format data for response
            const rankings = rankedParticipants.map((participant, index) => ({
                rank: index + 1,
                hunter: {
                    id: participant.hunter._id,
                    username: participant.hunter.username,
                    name: participant.hunter.name
                },
                scores: {
                    adherenceToBrief: participant.submission.review.adherenceToBrief,
                    conceptualThinking: participant.submission.review.conceptualThinking,
                    technicalExecution: participant.submission.review.technicalExecution,
                    originalityCreativity: participant.submission.review.originalityCreativity,
                    documentation: participant.submission.review.documentation,
                    totalScore: participant.submission.review.totalScore
                },
                submittedAt: participant.submission.submittedAt,
                reviewedAt: participant.submission.review.reviewedAt
            }));

            // Get unreviewed participants
            const unreviewedParticipants = bounty.participants
                .filter(p => p.submission && !p.submission.review)
                .map(p => ({
                    hunter: {
                        id: p.hunter._id,
                        username: p.hunter.username,
                        name: p.hunter.name
                    },
                    submittedAt: p.submission.submittedAt,
                    reviewed: false
                }));

            // Get participants who haven't submitted yet
            const notSubmittedParticipants = bounty.participants
                .filter(p => !p.submission)
                .map(p => ({
                    hunter: {
                        id: p.hunter._id,
                        username: p.hunter.username,
                        name: p.hunter.name
                    },
                    joined: true,
                    submitted: false
                }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty rankings retrieved successfully',
                data: {
                    bountyId: bounty._id,
                    bountyTitle: bounty.title,
                    createdBy: {
                        id: bounty.createdBy._id,
                        name: `${bounty.createdBy.firstName} ${bounty.createdBy.lastName}`,
                        username: bounty.createdBy.username
                    },
                    status: bounty.status,
                    startTime: bounty.startTime,
                    endTime: bounty.endTime,
                    resultTime: bounty.resultTime,
                    totalParticipants: bounty.participants.length,
                    reviewedParticipants: reviewedParticipants.length,
                    rankings,
                    unreviewedSubmissions: unreviewedParticipants,
                    notSubmitted: notSubmittedParticipants
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving bounty rankings',
                error: error.message
            });
        }
    },

// Quit/withdraw from a bounty
async quitBounty(req, res) {
    try {
        const { bountyId } = req.params;
        const hunterId = req.hunter.id;
        
        // Find the bounty
        const bounty = await Bounty.findById(bountyId);
        
        if (!bounty) {
            return res.status(404).json({
                status: 404,
                success: false,
                message: 'Bounty not found'
            });
        }
        
        // Check if hunter is participating in this bounty
        const participantIndex = bounty.participants.findIndex(
            p => p.hunter.toString() === hunterId
        );
        
        if (participantIndex === -1) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'You are not participating in this bounty'
            });
        }
        
        // Check if hunter has already submitted work
        if (bounty.participants[participantIndex].submission && 
            bounty.participants[participantIndex].submission.submittedAt) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Cannot withdraw after submitting work'
            });
        }

        // Find the appropriate foul type
        const quitBountyFoul = await Foul.findOne({ name: "Hunter Quits Bounty (Before LIVE)" });
        
        if (quitBountyFoul) {
            // Find if this hunter has previous occurrences of this foul
            const previousOccurrences = await FoulRecord.find({
                hunter: hunterId,
                foul: quitBountyFoul._id
            });
            
            // Determine if this is a strike (second or later occurrence)
            const isStrike = previousOccurrences.length > 0;
            const occurrenceNumber = previousOccurrences.length + 1;
            
            // Only deduct XP if bounty is active, not if it's 'yts' (yet to start)
            const xpPenalty = bounty.status === 'active' ? 625 : 0;
            
            // Create foul record
            await FoulRecord.create({
                hunter: hunterId,
                foul: quitBountyFoul._id,
                reason: `Quit bounty "${bounty.title}"`,
                evidence: `Bounty ID: ${bountyId}`,
                xpPenalty,
                occurrenceNumber,
                isStrike,
               
                relatedBounty: bountyId
            });
            
            // Update hunter's XP and strike count if applicable
            if (bounty.status === 'active') {
                // Only deduct XP if bounty is active
                await xpService.subtractLargeXP(hunterId);
            }
            
            if (isStrike) {
                // Increment strike count if this is a strike
                await Hunter.findByIdAndUpdate(
                    hunterId,
                    { $inc: { 'strikes.count': 1 } }
                );
                
                // Get updated hunter to check for suspension
                const updatedHunter = await Hunter.findById(hunterId);
                
                // Check if this pushes hunter to 3 strikes (suspension threshold)
                if (updatedHunter.strikes.count >= 3) {
                    // Calculate suspension period (14 days from now)
                    const suspensionStartDate = new Date();
                    const suspensionEndDate = new Date();
                    suspensionEndDate.setDate(suspensionEndDate.getDate() + 14);
                    
                    // Update hunter with suspension
                    await Hunter.findByIdAndUpdate(
                        hunterId,
                        {
                            $set: {
                                'strikes.isCurrentlySuspended': true,
                                'strikes.suspensionEndDate': suspensionEndDate
                            },
                            $push: {
                                'strikes.suspensionHistory': {
                                    startDate: suspensionStartDate,
                                    endDate: suspensionEndDate,
                                    reason: `Accumulated 3 strikes. Latest foul: Quit bounty "${bounty.title}"`
                                }
                            }
                        }
                    );
                    
                    // Notification for suspension
                    await notificationController.createNotification({
                        hunterId: hunterId,
                        title: 'Account Suspended',
                        message: `Your account has been suspended for 14 days due to accumulating 3 strikes. You will be able to return on ${suspensionEndDate.toLocaleDateString()}.`,
                        type: 'system'
                    });
                }
            }
        }
        
        // Update participant status to withdrawn
        bounty.participants[participantIndex].status = 'withdrawn';
        
        // Decrement currentHunters count
        bounty.currentHunters -= 1;
        
        await bounty.save();
        
        // Update hunter: Remove from acceptedBounties and add to quitBounties
        await Hunter.findByIdAndUpdate(
            hunterId,
            { 
                $pull: { acceptedBounties: bountyId },
                $addToSet: { quitBounties: bountyId } // Use addToSet to avoid duplicates
            }
        );
        
        // Create notification for hunter
        await notificationController.createNotification({
            hunterId: hunterId,
            title: 'Bounty Withdrawal',
            message: `You have withdrawn from the bounty "${bounty.title}".${bounty.status === 'active' ? ' 625 XP has been deducted as penalty.' : ''}`,
            type: 'bounty',
            relatedItem: bountyId,
            itemModel: 'Bounty'
        });
        
        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Successfully withdrawn from bounty',
            data: {
                bountyTitle: bounty.title,
                withdrawalDate: new Date(),
                xpPenalty: bounty.status === 'active' ? 625 : 0,
                status: bounty.status
            }
        });
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error withdrawing from bounty',
            error: error.message
        });
    }
},

// Add to hunterBountyController.js
async getMyRankings(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Find all bounty results where this hunter is ranked
      const results = await BountyResult.find({
        'rankings.hunter': hunterId
      })
      .populate('bounty', 'title status startTime endTime resultTime rewardPrize')
      .sort({ postedAt: -1 });
      
      // Format hunter's results
      const myRankings = results.map(result => {
        const myRanking = result.rankings.find(r => 
          r.hunter.toString() === hunterId
        );
        
        return {
          bountyId: result.bounty._id,
          bountyTitle: result.bounty.title,
          bountyStatus: result.bounty.status,
          resultPostedAt: result.postedAt,
          rank: myRanking.rank,
          totalParticipants: result.rankings.length,
          score: myRanking.score,
          xpEarned: myRanking.xpEarned,
          rewardEarned: myRanking.rewardEarned
        };
      });
      
      return res.status(200).json({
        status: 200,
        success: true,
        message: 'Your rankings retrieved successfully',
        data: {
          totalBounties: myRankings.length,
          rankings: myRankings
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving your rankings',
        error: error.message
      });
    }
  },

  async getMyQuitBounties(req, res) {
    try {
      const hunterId = req.hunter.id;
      
      // Find the hunter and select only the quitBounties field
      const hunter = await Hunter.findById(hunterId).select('quitBounties');
      
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
        message: 'Quit bounty IDs retrieved successfully',
        data: {
          count: hunter.quitBounties.length,
          quitBountyIds: hunter.quitBounties
        }
      });
    } catch (error) {
      return res.status(500).json({
        status: 500,
        success: false,
        message: 'Error retrieving quit bounty IDs',
        error: error.message
      });
    }
  },

  async getHunterFile(req, res) {
    try {
        const fileId = req.params.fileId;
        const hunterId = req.hunter.id;
        
        // Find the submission containing this file
        const bounty = await Bounty.findOne({
            'participants.hunter': hunterId,
            'participants.submission.files.fileName': fileId
        });
        
        if (!bounty) {
            // Check if this is a public bounty asset instead
            const publicBounty = await Bounty.findOne({
                'assets.fileName': fileId
            });
            
            if (publicBounty) {
                // This is a bounty asset which should be public
                const filePath = `/var/www/filestore/${fileId}`;
                return res.sendFile(filePath);
            }
            
            // If neither hunter's file nor public asset
            return res.status(403).json({
                status: 403,
                success: false,
                message: 'You do not have permission to access this file'
            });
        }
        
        // File path on server
        const filePath = `/var/www/filestore/${fileId}`;
        
        // Serve the file
        res.sendFile(filePath);
        
    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error retrieving file',
            error: error.message
        });
    }
}

};

module.exports = hunterBountyController;