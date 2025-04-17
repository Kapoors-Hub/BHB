const Bounty = require('../models/Bounty');
const Lord = require('../models/Lord');
const Hunter = require('../models/Hunter');
const Badge = require("../models/Badge");
const { checkAndAwardBadges } = require('../services/badgeService');
const { calculateReviewXP, updateHunterXP } = require('../services/xpService');
const passController = require("./passController");
const performanceCalculator = require('../utils/performanceCalculator');
const notificationController = require('./notificationController');
const transactionService = require('../services/transactionService');
const Foul = require('../models/Foul');
const FoulRecord = require('../models/FoulRecord');
const BountyResult = require('../models/BountyResult');
const notificationService = require('../services/notificationService');
const { PassType, HunterPass, PassUsage, PassReset } = require('../models/Pass');
const mongoose = require('mongoose');

const bountyController = {
    // Create new bounty
    async createBounty(req, res) {
        try {
            const {
                title,
                context,
                deliverables,
                challenge,
                startTime,
                endTime,
                resultTime,
                doubtSessionTime,
                doubtSessionDate,
                doubtSessionLink,
                rewardPrize,
                maxHunters,
                assetsDescription
            } = req.body;
    
            // Process uploaded files
            const uploadedAssets = req.files ? req.files.map(file => ({
                fileName: file.originalname,
                fileUrl: file.path, // or wherever you store the file path/URL
                uploadedAt: new Date()
            })) : [];
    
            // Validate dates
            const currentDate = new Date();
            const startDate = new Date(startTime);
            const endDate = new Date(endTime);
            const resultDate = new Date(resultTime);
            const doubtDate = new Date(doubtSessionDate);
    
            if (startDate < currentDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Start time cannot be in the past'
                });
            }
    
            if (endDate <= startDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'End time must be after start time'
                });
            }
    
            if (resultDate <= endDate) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Result time must be after end time'
                });
            }
    
            // Set initial status based on start time
            const initialStatus = currentDate >= startDate ? 'active' : 'yts';
    
            const bounty = await Bounty.create({
                title,
                context,
                deliverables,
                challenge,
                startTime,
                endTime,
                resultTime,
                doubtSessionTime,
                doubtSessionDate,
                doubtSessionLink,
                rewardPrize,
                maxHunters,
                assets: uploadedAssets, // Use the processed files
                assetsDescription,
                status: initialStatus,
                createdBy: req.lord.id
            });
    
            await Lord.findByIdAndUpdate(
                req.lord.id,
                { $push: { bounties: bounty._id } },
                { new: true }
            );
    
            const lord = await Lord.findById(req.lord.id);
    
            notificationService.sendNewBountyNotification(bounty, lord)
            .catch(err => console.error('Error in notification sending:', err));
    
            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Bounty created successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error creating bounty',
                error: error.message
            });
        }
    },

    // Get all bounties created by a lord
    async getLordBounties(req, res) {
        try {
            const bounties = await Bounty.find({ createdBy: req.lord.id })
                .sort({ createdAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounties fetched successfully',
                data: bounties
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounties',
                error: error.message
            });
        }
    },

    // Get single bounty
    async getBountyById(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to access this bounty'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty fetched successfully',
                data: bounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error fetching bounty',
                error: error.message
            });
        }
    },

    // Update bounty
    async updateBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to update this bounty'
                });
            }

            // Don't allow updates if bounty is active or completed
            if (bounty.status !== 'draft') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot update bounty after it becomes active'
                });
            }

            const updatedBounty = await Bounty.findByIdAndUpdate(
                req.params.bountyId,
                req.body,
                { new: true, runValidators: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty updated successfully',
                data: updatedBounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error updating bounty',
                error: error.message
            });
        }
    },

    // Delete bounty
    async deleteBounty(req, res) {
        try {
            const bounty = await Bounty.findById(req.params.bountyId);
    
            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }
    
            if (bounty.createdBy.toString() !== req.lord.id) {
                return res.status(403).json({
                    status: 403,
                    success: false,
                    message: 'Not authorized to delete this bounty'
                });
            }
    
            // Only allow deletion of bounties that are 'yet to start'
            if (bounty.status !== 'yts') {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Only upcoming bounties can be deleted. Active, closed, or completed bounties cannot be deleted.'
                });
            }
    
            // Check if there are any participants already
            if (bounty.participants && bounty.participants.length > 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot delete bounty with registered participants'
                });
            }
    
            // Remove the bounty from the lord's bounties array
            await Lord.findByIdAndUpdate(
                req.lord.id,
                { $pull: { bounties: bounty._id } }
            );
    
            // Delete the bounty
            await Bounty.findByIdAndDelete(req.params.bountyId);
    
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting bounty',
                error: error.message
            });
        }
    },

    // Get bounty submissions
    async getBountySubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate('participants.hunter', 'username name email');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Filter only participants who have submitted
            const submissions = bounty.participants.filter(
                participant => participant.submission && participant.submission.submittedAt
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    totalSubmissions: submissions.length,
                    submissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving submissions',
                error: error.message
            });
        }
    },

    // Get a specific hunter's submission for a bounty
    // async getHunterSubmission(req, res) {
    //     try {
    //         const { bountyId, hunterId } = req.params;
    //         const lordId = req.lord.id;

    //         // Find the bounty and verify ownership
    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             createdBy: lordId
    //         }).populate('participants.hunter', 'username name email');

    //         if (!bounty) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Bounty not found or you do not have permission'
    //             });
    //         }

    //         // Find the participant
    //         const participant = bounty.participants.find(
    //             p => p.hunter._id.toString() === hunterId
    //         );


    //         if (!participant) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter not found in this bounty'
    //             });
    //         }

    //         if (!participant.submission) {
    //             return res.status(404).json({
    //                 status: 404,
    //                 success: false,
    //                 message: 'Hunter has not submitted any work yet'
    //             });
    //         }

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Hunter submission retrieved successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 hunter: {
    //                     id: participant.hunter._id,
    //                     name: participant.hunter.name,
    //                     username: participant.hunter.username,
    //                     email: participant.hunter.email
    //                 },
    //                 submission: participant.submission,
    //                 submittedAt: participant.submission.submittedAt,
    //                 reviewed: !!participant.submission.review,
    //                 joinedAt: participant.joinedAt
    //             }
    //         });
    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error retrieving hunter submission',
    //             error: error.message
    //         });
    //     }
    // },

    // Review Submission

    // async reviewSubmission(req, res) {
    //         try {
    //             const { bountyId, hunterId } = req.params;
    //             const lordId = req.lord.id;
    //             const {
    //                 adherenceToBrief,
    //                 conceptualThinking,
    //                 technicalExecution,
    //                 originalityCreativity,
    //                 documentation,
    //                 feedback
    //             } = req.body;

    //             // Validate that all scores are provided
    //             const scores = [
    //                 adherenceToBrief,
    //                 conceptualThinking,
    //                 technicalExecution,
    //                 originalityCreativity,
    //                 documentation
    //             ];

    //             if (scores.some(score => score === undefined || score < 0 || score > 5)) {
    //                 return res.status(400).json({
    //                     status: 400,
    //                     success: false,
    //                     message: 'All scores must be provided and be between 0 and 5'
    //                 });
    //             }

    //             // Check if result date has passed
    //             const bounty = await Bounty.findOne({
    //                 _id: bountyId,
    //                 createdBy: lordId
    //             }).populate('participants.hunter');

    //             const currentDate = new Date();
    //             if (currentDate > bounty.resultTime) {
    //                 return res.status(400).json({
    //                     status: 400,
    //                     success: false,
    //                     message: 'Cannot review after result date has passed'
    //                 });
    //             }

    //             // Calculate total score
    //             const totalScore = scores.reduce((sum, score) => sum + score, 0);

    //             // Update submission with review
    //             await Bounty.findOneAndUpdate(
    //                 {
    //                     _id: bountyId,
    //                     'participants.hunter': hunterId
    //                 },
    //                 {
    //                     $set: {
    //                         'participants.$.submission.review': {
    //                             adherenceToBrief,
    //                             conceptualThinking,
    //                             technicalExecution,
    //                             originalityCreativity,
    //                             documentation,
    //                             totalScore,
    //                             feedback,
    //                             reviewedAt: new Date(),
    //                             reviewedBy: lordId
    //                         }
    //                     }
    //                 }
    //             );

    //             // Get all reviewed submissions and determine current winner
    //             const updatedBounty = await Bounty.findById(bountyId)
    //                 .populate('participants.hunter');

    //             const reviewedParticipants = updatedBounty.participants.filter(
    //                 p => p.submission && p.submission.review
    //             );

    //             // Sort reviewed participants by score
    //             const sortedParticipants = reviewedParticipants.sort(
    //                 (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
    //             );

    //             // Current leader is the highest scored among reviewed submissions
    //             const currentLeader = sortedParticipants[0];
    //             const lastPlace = sortedParticipants[sortedParticipants.length - 1];

    //             // Update achievements only if it's the current leader
    //             if (currentLeader && currentLeader.hunter._id.toString() === hunterId) {
    //                 await Hunter.findByIdAndUpdate(
    //                     hunterId,
    //                     {
    //                         $inc: { 'achievements.bountiesWon.count': 1 },
    //                         $push: { 'achievements.bountiesWon.bountyIds': bountyId }
    //                     }
    //                 );
    //                 // Placeholder for badge service
    //                 await checkAndAwardBadges(hunterId);
    //             }

    //             // Update last place achievement
    //             if (lastPlace && lastPlace.hunter._id.toString() === hunterId) {
    //                 await Hunter.findByIdAndUpdate(
    //                     lastPlace.hunter._id,
    //                     {
    //                         $inc: { 'achievements.lastPlaceFinishes.count': 1 },
    //                         $push: { 'achievements.lastPlaceFinishes.bountyIds': bountyId }
    //                     }
    //                 );
    //                 // Placeholder for badge service
    //                 await checkAndAwardBadges(lastPlace.hunter._id);
    //             }

    //             // Calculate XP change using XP service
    //             const xpChange = calculateReviewXP(scores);

    //             // Update hunter's XP using XP service
    //             const newTotalXp = await updateHunterXP(hunterId, xpChange);

    //             // Add hunter to evaluated list
    //             if (!bounty.evaluatedHunters.includes(hunterId)) {
    //                 bounty.evaluatedHunters.push(hunterId);
    //                 await bounty.save();
    //             }

    //             return res.status(200).json({
    //                 status: 200,
    //                 success: true,
    //                 message: 'Submission reviewed successfully',
    //                 data: {
    //                     totalScore,
    //                     reviewedCount: reviewedParticipants.length,
    //                     totalParticipants: bounty.participants.length,
    //                     currentLeader: {
    //                         hunter: currentLeader.hunter.username,
    //                         score: currentLeader.submission.review.totalScore
    //                     },
    //                     isCurrentLeader: currentLeader.hunter._id.toString() === hunterId,
    //                     xpChange: xpChange,
    //                     newTotalXp: newTotalXp
    //                 }
    //             });

    //         } catch (error) {
    //             return res.status(500).json({
    //                 status: 500,
    //                 success: false,
    //                 message: 'Error reviewing submission',
    //                 error: error.message
    //             });
    //         }
    //     },

    // async postBountyResult(req, res) {
    //     try {
    //         const { bountyId } = req.params;
    //         const lordId = req.lord.id;

    //         const bounty = await Bounty.findOne({
    //             _id: bountyId,
    //             createdBy: lordId
    //         }).populate('participants.hunter');

    //         // Check if result date has reached
    //         const currentDate = new Date();
    //         if (currentDate < bounty.resultTime) {
    //             return res.status(400).json({
    //                 status: 400,
    //                 success: false,
    //                 message: 'Cannot post result before result date'
    //             });
    //         }

    //         // Get reviewed submissions
    //         const reviewedParticipants = bounty.participants.filter(
    //             p => p.submission && p.submission.review
    //         );

    //         // Sort by score
    //         const sortedParticipants = reviewedParticipants.sort(
    //             (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
    //         );

    //         // Calculate performance scores for each participant
    //         const performanceResults = [];
    //         for (let i = 0; i < sortedParticipants.length; i++) {
    //             const participant = sortedParticipants[i];
    //             const rank = i + 1; // 1-based ranking

    //             try {
    //                 const performanceResult = await performanceCalculator.calculatePerformanceScore(
    //                     participant.hunter._id.toString(),
    //                     bountyId,
    //                     rank
    //                 );

    //                 if (performanceResult) {
    //                     performanceResults.push({
    //                         hunterId: participant.hunter._id,
    //                         hunterUsername: participant.hunter.username,
    //                         performanceScore: performanceResult.bountyScore,
    //                         overallScore: performanceResult.overallScore
    //                     });
    //                 }
    //             } catch (perfError) {
    //                 console.error(`Error calculating performance for hunter ${participant.hunter._id}:`, perfError);
    //                 // Continue with other hunters even if one fails
    //             }
    //         }

    //         // Update bounty status to completed
    //         bounty.status = 'completed';
    //         await passController.awardPassesForBounty(bountyId);
    //         await bounty.save();

    //         // Send notifications to all participants about results
    //         for (const participant of sortedParticipants) {
    //             try {
    //                 const rank = sortedParticipants.findIndex(p => p.hunter._id.toString() === participant.hunter._id.toString()) + 1;

    //                 await notificationController.createNotification({
    //                     hunterId: participant.hunter._id,
    //                     title: 'Bounty Results Published',
    //                     message: `Results for "${bounty.title}" are now available. You ranked #${rank} out of ${sortedParticipants.length} hunters.`,
    //                     type: 'bounty',
    //                     relatedItem: bountyId,
    //                     itemModel: 'Bounty'
    //                 });
    //             } catch (notifyError) {
    //                 console.error(`Error sending notification to hunter ${participant.hunter._id}:`, notifyError);
    //             }
    //         }

    //         return res.status(200).json({
    //             status: 200,
    //             success: true,
    //             message: 'Bounty result posted successfully',
    //             data: {
    //                 bountyTitle: bounty.title,
    //                 totalParticipants: bounty.participants.length,
    //                 reviewedParticipants: reviewedParticipants.length,
    //                 rankings: sortedParticipants.map((p, index) => ({
    //                     rank: index + 1,
    //                     hunter: p.hunter.username,
    //                     score: p.submission.review.totalScore,
    //                     performanceScore: performanceResults.find(r => r.hunterId.toString() === p.hunter._id.toString())?.performanceScore || null
    //                 }))
    //             }
    //         });

    //     } catch (error) {
    //         return res.status(500).json({
    //             status: 500,
    //             success: false,
    //             message: 'Error posting result',
    //             error: error.message
    //         });
    //     }
    // },

 

    // Update in bountyController.js
    async reviewSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation,
                feedback
            } = req.body;

            const lordId = req.lord.id;

            // Find the bounty
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you are not authorized'
                });
            }

            // Find the participant
            const participantIndex = bounty.participants.findIndex(
                p => p.hunter.toString() === hunterId
            );

            if (participantIndex === -1) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter is not a participant in this bounty'
                });
            }

            // Check if submission exists
            if (!bounty.participants[participantIndex].submission ||
                !bounty.participants[participantIndex].submission.submittedAt) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter has not submitted any work'
                });
            }

            // Calculate total score
            const totalScore =
                adherenceToBrief +
                conceptualThinking +
                technicalExecution +
                originalityCreativity +
                documentation;

            // Update the submission with review
            bounty.participants[participantIndex].submission.review = {
                adherenceToBrief,
                conceptualThinking,
                technicalExecution,
                originalityCreativity,
                documentation,
                totalScore,
                feedback,
                reviewedAt: new Date(),
                reviewedBy: lordId,
                reviewStatus: 'draft' // Set as draft initially
            };

            // Add to evaluatedHunters list if not already there
            if (!bounty.evaluatedHunters.includes(hunterId)) {
                bounty.evaluatedHunters.push(hunterId);
            }

            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submission reviewed successfully',
                data: {
                    hunterName: bounty.participants[participantIndex].hunter.name || 'Hunter',
                    totalScore,
                    reviewStatus: 'draft'
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error reviewing submission',
                error: error.message
            });
        }
    },

    // Post Bounty

    // async postBountyResult(req, res) {
    //     const { bountyId } = req.params;
    //     const lordId = req.lord.id;
    //     let session = null;
        
    //     // Function to retry a transaction with exponential backoff
    //     const runTransactionWithRetry = async (txnFunc, maxRetries = 5) => {
    //       let retryCount = 0;
          
    //       while (true) {
    //         try {
    //           // Start a new session for each retry
    //           if (session) {
    //             try { session.endSession(); } catch (e) { /* ignore */ }
    //           }
    //           session = await mongoose.startSession();
              
    //           // Start transaction and run the function
    //           session.startTransaction();
    //           const result = await txnFunc(session);
    //           await session.commitTransaction();
    //           session.endSession();
    //           return result; // Success! Exit the retry loop
    //         } catch (error) {
    //           // If we've reached max retries or it's not a transient error, throw it
    //           const isTransientError = error.errorLabels && 
    //                                 error.errorLabels.includes('TransientTransactionError');
              
    //           if (retryCount >= maxRetries || !isTransientError) {
    //             if (session) {
    //               await session.abortTransaction().catch(e => console.error('Error aborting transaction:', e));
    //               session.endSession();
    //             }
    //             throw error; // Not a transient error or too many retries
    //           }
              
    //           // It's a transient error, so wait and retry
    //           retryCount++;
    //           const waitTimeMs = Math.pow(2, retryCount) * 100; // Exponential backoff
    //           console.log(`Transaction failed with transient error, retrying (${retryCount}/${maxRetries}) after ${waitTimeMs}ms`);
    //           await new Promise(resolve => setTimeout(resolve, waitTimeMs));
              
    //           // Abort the current transaction before retrying
    //           if (session) {
    //             await session.abortTransaction().catch(e => console.error('Error aborting transaction:', e));
    //           }
    //         }
    //       }
    //     };
        
    //     try {
    //       // Execute the entire transaction with retry logic
    //       const transactionResult = await runTransactionWithRetry(async (session) => {
    //         // Get the bounty with participants populated
    //         const bounty = await Bounty.findOne({
    //           _id: bountyId,
    //           createdBy: lordId
    //         }).populate('participants.hunter').session(session);
            
    //         if (!bounty) {
    //           throw new Error('Bounty not found or you are not authorized');
    //         }
            
    //         // Check if result date has reached
    //         const currentDate = new Date();
    //         if (currentDate < bounty.resultTime) {
    //           throw new Error('Cannot post result before result date');
    //         }
            
    //         // Get reviewed submissions with stricter validation
    //         const reviewedParticipants = bounty.participants.filter(
    //           p => p.submission &&
    //             p.submission.submittedAt &&
    //             p.submission.review &&
    //             typeof p.submission.review.totalScore === 'number' &&
    //             p.submission.review.totalScore >= 0
    //         );
            
    //         if (reviewedParticipants.length === 0) {
    //           throw new Error('No submissions have been reviewed yet');
    //         }
            
    //         // Identify hunters who registered but did not submit
    //         const nonSubmittingParticipants = bounty.participants.filter(
    //           p => !p.submission || !p.submission.submittedAt
    //         );
            
    //         // Get foul type for non-submitting participants
    //         const noSubmissionFoul = await Foul.findOne({ name: "Registers but does not submit" }).session(session);
            
    //         // Batch operations for non-submitting participants
    //         const foulRecords = [];
    //         const hunterUpdates = [];
    //         const notificationPromises = [];
            
    //         // Process non-submitting participants in bulk
    //         for (const participant of nonSubmittingParticipants) {
    //           const hunter = participant.hunter;
              
    //           if (noSubmissionFoul) {
    //             // Find previous occurrences in one query
    //             const previousOccurrences = await FoulRecord.countDocuments({
    //               hunter: hunter._id,
    //               foul: noSubmissionFoul._id
    //             }).session(session);
                
    //             const isStrike = previousOccurrences > 0;
    //             const occurrenceNumber = previousOccurrences + 1;
    //             const xpPenalty = 625;
                
    //             // Prepare foul record
    //             foulRecords.push({
    //               hunter: hunter._id,
    //               foul: noSubmissionFoul._id,
    //               reason: `Registered for bounty "${bounty.title}" but did not submit work`,
    //               evidence: `Bounty ID: ${bountyId}`,
    //               xpPenalty,
    //               occurrenceNumber,
    //               isStrike,
    //               appliedBy: lordId,
    //               relatedBounty: bountyId
    //             });
                
    //             // Update hunter based on strike status
    //             if (isStrike) {
    //               // Check if this pushes hunter to 3 strikes
    //               const updatedHunter = await Hunter.findById(hunter._id).session(session);
    //               const newStrikeCount = updatedHunter.strikes.count + 1;
                  
    //               let updateObj = {
    //                 $inc: {
    //                   xp: -xpPenalty,
    //                   'strikes.count': 1
    //                 }
    //               };
                  
    //               // Add suspension if reaching 3 strikes
    //               if (newStrikeCount >= 3) {
    //                 const suspensionStartDate = new Date();
    //                 const suspensionEndDate = new Date();
    //                 suspensionEndDate.setDate(suspensionEndDate.getDate() + 14);
                    
    //                 updateObj.$set = {
    //                   'strikes.isCurrentlySuspended': true,
    //                   'strikes.suspensionEndDate': suspensionEndDate
    //                 };
                    
    //                 updateObj.$push = {
    //                   'strikes.suspensionHistory': {
    //                     startDate: suspensionStartDate,
    //                     endDate: suspensionEndDate,
    //                     reason: `Accumulated 3 strikes. Latest foul: No submission for bounty "${bounty.title}"`
    //                   }
    //                 };
                    
    //                 // Notification for suspension
    //                 notificationPromises.push({
    //                   hunterId: hunter._id,
    //                   title: 'Account Suspended',
    //                   message: `Your account has been suspended for 14 days due to accumulating 3 strikes. You will be able to return on ${suspensionEndDate.toLocaleDateString()}.`,
    //                   type: 'system'
    //                 });
    //               }
                  
    //               hunterUpdates.push({
    //                 updateOne: {
    //                   filter: { _id: hunter._id },
    //                   update: updateObj
    //                 }
    //               });
    //             } else {
    //               // Just deduct XP for first occurrence
    //               hunterUpdates.push({
    //                 updateOne: {
    //                   filter: { _id: hunter._id },
    //                   update: { $inc: { xp: -xpPenalty } }
    //                 }
    //               });
    //             }
                
    //             // Notification for foul
    //             notificationPromises.push({
    //               hunterId: hunter._id,
    //               title: 'Foul Received',
    //               message: `You have received a foul for registering but not submitting work for bounty "${bounty.title}". This has resulted in a penalty of ${xpPenalty} XP.${isStrike ? ' This foul counts as a strike.' : ''}`,
    //               type: 'system'
    //             });
    //           }
    //         }
            
    //         // Sort by score for rankings
    //         const sortedParticipants = reviewedParticipants.sort(
    //           (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
    //         );
            
    //         // Check if this is a non-profit bounty
    //         const isNonProfit = bounty.rewardPrize === 0;
    //         if (isNonProfit) {
    //           // Batch update for non-profit participants
    //           for (const participant of reviewedParticipants) {
    //             hunterUpdates.push({
    //               updateOne: {
    //                 filter: { _id: participant.hunter._id },
    //                 update: {
    //                   $inc: { 'achievements.nonProfitBounties.count': 1 },
    //                   $push: { 'achievements.nonProfitBounties.bountyIds': bountyId }
    //                 }
    //               }
    //             });
                
    //             notificationPromises.push({
    //               hunterId: participant.hunter._id,
    //               title: 'Non-Profit Bounty Completed',
    //               message: `You've completed a non-profit bounty: "${bounty.title}". Thank you for your contribution!`,
    //               type: 'achievement',
    //               relatedItem: bountyId,
    //               itemModel: 'Bounty'
    //             });
    //           }
    //         }
            
    //         // Create result rankings data
    //         const resultRankings = [];
    //         const xpService = require('../services/xpService');
    //         const passTypePromise = PassType.findOne({ name: 'booster' }).session(session);
            
    //         // Process each ranked participant
    //         const levelCheckPromises = [];
            
    //         for (let i = 0; i < sortedParticipants.length; i++) {
    //           const participant = sortedParticipants[i];
    //           const hunter = participant.hunter;
    //           const rank = i + 1;
              
    //           // Calculate base XP from scores
    //           const scores = [
    //             participant.submission.review.adherenceToBrief,
    //             participant.submission.review.conceptualThinking,
    //             participant.submission.review.technicalExecution,
    //             participant.submission.review.originalityCreativity,
    //             participant.submission.review.documentation
    //           ];
              
    //           let xpEarned = xpService.calculateReviewXP(scores);
              
    //           // Apply booster if active
    //           if (participant.boosterActive) {
    //             try {
    //               const passType = await passTypePromise;
    //               const boostPercentage = passType?.boostPercentage || 25;
    //               const boostMultiplier = 1 + (boostPercentage / 100);
    //               const originalXP = xpEarned;
    //               xpEarned = Math.round(xpEarned * boostMultiplier);
    //               const extraXP = xpEarned - originalXP;
                  
    //               notificationPromises.push({
    //                 hunterId: hunter._id,
    //                 title: 'XP Boost Applied',
    //                 message: `Your Booster Pass gave you an extra ${extraXP} XP (${boostPercentage}% boost) for bounty "${bounty.title}"!`,
    //                 type: 'bounty',
    //                 relatedItem: bountyId,
    //                 itemModel: 'Bounty'
    //               });
    //             } catch (error) {
    //               console.error('Error applying booster pass effect:', error);
    //             }
    //           }
              
    //           // Track XP earned in participant for later updating
    //           participant.xpEarned = xpEarned;
              
    //           // Check for level changes
    //           const currentHunter = await Hunter.findById(hunter._id).session(session);
    //           const originalTier = currentHunter.level.tier;
    //           const originalRank = currentHunter.level.rank;
              
    //           // We'll check for level changes after transaction
    //           levelCheckPromises.push({
    //             hunterId: hunter._id,
    //             originalTier,
    //             originalRank,
    //             bountyTitle: bounty.title
    //           });
              
    //           // Update hunter's profile based on rank
    //           let updateObj = { $inc: { xp: xpEarned } };
              
    //           // Additional updates based on position
    //           if (rank === 1) {
    //             // Winner specific updates
    //             updateObj.$inc = {
    //               ...updateObj.$inc,
    //               'achievements.bountiesWon.count': 1,
    //               'passes.resetFoul.count': 1
    //             };
                
    //             if (!updateObj.$push) updateObj.$push = {};
    //             updateObj.$push['achievements.bountiesWon.bountyIds'] = bountyId;
                
    //             // Increment consecutive wins
    //             const hunterConsWins = currentHunter.passes?.consecutiveWins || 0;
    //             const newConsWins = hunterConsWins + 1;
    //             updateObj.$set = { ...updateObj.$set, 'passes.consecutiveWins': newConsWins };
                
    //             // Check if earned booster pass (2+ consecutive wins)
    //             if (newConsWins >= 2) {
    //               updateObj.$inc['passes.booster.count'] = 1;
    //               updateObj.$set['passes.consecutiveWins'] = 0; // Reset counter
    //             }
                
    //             // Award prize money if not non-profit
    //             if (!isNonProfit) {
    //               updateObj.$inc.totalEarnings = bounty.rewardPrize;
                  
    //               // Create transaction for winner
    //               await transactionService.createTransaction({
    //                 hunterId: hunter._id,
    //                 amount: bounty.rewardPrize,
    //                 type: 'credit',
    //                 category: 'bounty',
    //                 description: `Winner reward for bounty: ${bounty.title}`,
    //                 reference: bountyId,
    //                 referenceModel: 'Bounty',
    //                 initiatedBy: {
    //                   id: lordId,
    //                   role: 'Lord'
    //                 },
    //                 metaData: {
    //                   rank: 1,
    //                   totalParticipants: sortedParticipants.length
    //                 }
    //               }, session);
                  
    //               notificationPromises.push({
    //                 hunterId: hunter._id,
    //                 title: 'Reward Received',
    //                 message: `You've received ${bounty.rewardPrize} for winning the bounty "${bounty.title}"`,
    //                 type: 'bounty',
    //                 relatedItem: bountyId,
    //                 itemModel: 'Bounty'
    //               });
    //             }
    //           } else {
    //             // Non-winner: reset consecutive wins
    //             updateObj.$set = { ...updateObj.$set, 'passes.consecutiveWins': 0 };
                
    //             // Last place specific update
    //             if (rank === sortedParticipants.length) {
    //               updateObj.$inc = {
    //                 ...updateObj.$inc,
    //                 'achievements.lastPlaceFinishes.count': 1
    //               };
                  
    //               if (!updateObj.$push) updateObj.$push = {};
    //               updateObj.$push['achievements.lastPlaceFinishes.bountyIds'] = bountyId;
    //             }
    //           }
              
    //           // Add to batch update
    //           hunterUpdates.push({
    //             updateOne: {
    //               filter: { _id: hunter._id },
    //               update: updateObj
    //             }
    //           });
              
    //           // Update submission review status
    //           participant.submission.review.reviewStatus = 'published';
              
    //           // Notification for results
    //           notificationPromises.push({
    //             hunterId: hunter._id,
    //             title: 'Bounty Results Published',
    //             message: `Results for "${bounty.title}" are now available. You ranked #${rank} out of ${sortedParticipants.length} hunters.`,
    //             type: 'bounty',
    //             relatedItem: bountyId,
    //             itemModel: 'Bounty'
    //           });
              
    //           // Add to rankings for result
    //           resultRankings.push({
    //             hunter: hunter._id,
    //             rank,
    //             score: participant.submission.review.totalScore,
    //             scores: {
    //               adherenceToBrief: participant.submission.review.adherenceToBrief,
    //               conceptualThinking: participant.submission.review.conceptualThinking,
    //               technicalExecution: participant.submission.review.technicalExecution,
    //               originalityCreativity: participant.submission.review.originalityCreativity,
    //               documentation: participant.submission.review.documentation
    //             },
    //             xpEarned,
    //             rewardEarned: rank === 1 ? bounty.rewardPrize : 0
    //           });
    //         }
            
    //         // Process passes in bulk - Clean Slate for winner and Booster for consecutive wins
    //         const passUpdates = [];
    //         if (sortedParticipants.length > 0) {
    //           const winnerHunter = sortedParticipants[0].hunter;
              
    //           // Add Clean Slate pass for winner
    //           passUpdates.push({
    //             updateOne: {
    //               filter: { hunter: winnerHunter._id, passType: 'cleanSlate' },
    //               update: { $inc: { count: 1 }, $set: { lastUpdated: new Date() } },
    //               upsert: true
    //             }
    //           });
              
    //           // Add Booster pass if needed (for 2+ consecutive wins)
    //           const winnerConsecutiveWins = await Hunter.findById(winnerHunter._id)
    //             .select('passes.consecutiveWins')
    //             .session(session);
              
    //           if ((winnerConsecutiveWins.passes?.consecutiveWins || 0) >= 1) { // Will become 2+ after increment
    //             passUpdates.push({
    //               updateOne: {
    //                 filter: { hunter: winnerHunter._id, passType: 'booster' },
    //                 update: { $inc: { count: 1 }, $set: { lastUpdated: new Date() } },
    //                 upsert: true
    //               }
    //             });
    //           }
    //         }
            
    //         // Format non-submitters for result
    //         const nonSubmitters = nonSubmittingParticipants.map(participant => ({
    //           hunter: participant.hunter._id,
    //           foulApplied: true,
    //         }));
            
    //         // Update bounty status
    //         bounty.status = 'completed';
            
    //         // Execute all bulk operations
    //         const operations = [];
            
    //         // 1. Insert foul records if any
    //         if (foulRecords.length > 0) {
    //           operations.push(FoulRecord.insertMany(foulRecords, { session }));
    //         }
            
    //         // 2. Update hunter documents in bulk
    //         if (hunterUpdates.length > 0) {
    //           operations.push(Hunter.bulkWrite(hunterUpdates, { session }));
    //         }
            
    //         // 3. Update passes in bulk
    //         if (passUpdates.length > 0) {
    //           operations.push(HunterPass.bulkWrite(passUpdates, { session }));
    //         }
            
    //         // 4. Create bounty result
    //         const bountyResult = new BountyResult({
    //           bounty: bountyId,
    //           postedBy: lordId,
    //           rankings: resultRankings,
    //           nonSubmitters
    //         });
            
    //         operations.push(bountyResult.save({ session }));
            
    //         // 5. Update bounty with completed status and result ID
    //         bounty.resultId = bountyResult._id;
    //         operations.push(bounty.save({ session }));
            
    //         // Execute all database operations
    //         await Promise.all(operations);
            
    //         // Return data for post-transaction processing
    //         return {
    //           bounty,
    //           sortedParticipants,
    //           reviewedParticipants,
    //           notificationsToCreate: notificationPromises,
    //           levelCheckPromises
    //         };
    //       });
          
    //       // The transaction completed successfully, now process notifications and other operations
    //       const { 
    //         bounty, 
    //         sortedParticipants, 
    //         reviewedParticipants, 
    //         notificationsToCreate, 
    //         levelCheckPromises 
    //       } = transactionResult;
          
    //       // After transaction, process notifications
    //       for (const notification of notificationsToCreate) {
    //         await notificationController.createNotification(notification);
    //       }
          
    //       // Check and update level tiers after transaction
    //       for (const levelCheck of levelCheckPromises) {
    //         try {
    //           const updatedHunter = await Hunter.findById(levelCheck.hunterId);
    //           // Use the existing updateLevel method on the hunter model
    //           updatedHunter.updateLevel();
    //           await updatedHunter.save();
              
    //           // Check if level changed and send notification if it did
    //           if (updatedHunter.level.tier !== levelCheck.originalTier || 
    //               updatedHunter.level.rank !== levelCheck.originalRank) {
    //             await notificationController.createNotification({
    //               hunterId: levelCheck.hunterId,
    //               title: 'Level Up!',
    //               message: `Congratulations! You've leveled up to ${updatedHunter.level.tier} ${updatedHunter.level.rank} after completing the bounty "${levelCheck.bountyTitle}".`,
    //               type: 'achievement'
    //             });
    //           }
    //         } catch (err) {
    //           console.error('Error updating hunter level:', err);
    //         }
    //       }
          
    //       // Update performance scores asynchronously (outside transaction)
    //       if (bounty.participants.length > 1) {
    //         const performanceCalculator = require('../utils/performanceCalculator');
    //         for (let i = 0; i < sortedParticipants.length; i++) {
    //           const participant = sortedParticipants[i];
    //           performanceCalculator.calculatePerformanceScore(
    //             participant.hunter._id.toString(),
    //             bountyId,
    //             i + 1,
    //             participant.xpEarned
    //           ).catch(err => console.error('Error calculating performance score:', err));
    //         }
    //       }
          
    //       // Award badges asynchronously (outside transaction)
    //       for (const participant of reviewedParticipants) {
    //         checkAndAwardBadges(participant.hunter._id).catch(err => 
    //           console.error('Error checking/awarding badges:', err)
    //         );
    //       }
          
    //       // Return success response
    //       return res.status(200).json({
    //         status: 200,
    //         success: true,
    //         message: 'Bounty result posted successfully',
    //         data: {
    //           bountyTitle: bounty.title,
    //           totalParticipants: bounty.participants.length,
    //           reviewedParticipants: reviewedParticipants.length,
    //           nonSubmittingParticipants: bounty.participants.length - reviewedParticipants.length,
    //           foulsApplied: bounty.participants.length - reviewedParticipants.length,
    //           rankings: sortedParticipants.map((p, index) => ({
    //             rank: index + 1,
    //             hunter: p.hunter.username,
    //             score: p.submission.review.totalScore
    //           }))
    //         }
    //       });
          
    //     } catch (error) {
    //       console.error('Error in postBountyResult:', error);
          
    //       // Abort transaction if it's active and hasn't been cleaned up yet
    //       if (session) {
    //         try {
    //           await session.abortTransaction().catch(() => {});
    //           session.endSession();
    //         } catch (sessionError) {
    //           console.error('Error cleaning up session:', sessionError);
    //         }
    //       }
          
    //       return res.status(500).json({
    //         status: 500,
    //         success: false,
    //         message: 'Error posting result',
    //         error: error.message
    //       });
    //     }
    //   },

    // Get hunter rankings for a bounty
    async getBountyRankings(req, res) {
        try {
            const { bountyId } = req.params;

            // Find the bounty
            const bounty = await Bounty.findById(bountyId)
                .populate('createdBy', 'username firstName lastName');

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found'
                });
            }

            // Response data structure
            const responseData = {
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
                totalParticipants: bounty.participants.length
            };

            // If there's a result, use the stored rankings
            if (bounty.resultId) {
                const result = await BountyResult.findById(bounty.resultId)
                    .populate('rankings.hunter', 'username name email xp level')
                    .populate('nonSubmitters.hunter', 'username name email xp level');

                if (result) {
                    responseData.reviewedParticipants = result.rankings.length;
                    responseData.rankings = result.rankings.map(r => ({
                        rank: r.rank,
                        hunter: {
                            id: r.hunter._id,
                            username: r.hunter.username,
                            name: r.hunter.name
                        },
                        scores: r.scores,
                        xpEarned: r.xpEarned,
                        rewardEarned: r.rewardEarned,
                        submittedAt: r.submittedAt
                    }));

                    responseData.notSubmitted = result.nonSubmitters.map(ns => ({
                        hunter: {
                            id: ns.hunter._id,
                            username: ns.hunter.username,
                            name: ns.hunter.name
                        },
                        joined: true,
                        submitted: false,
                        foulApplied: ns.foulApplied
                    }));

                    // Set unreviewedSubmissions as empty since all are already reviewed in the result
                    responseData.unreviewedSubmissions = [];
                }
            } else {
                // If no result yet, use the live view approach with enhanced filtering
                // Populate participant data
                await bounty.populate('participants.hunter', 'username name email xp level');

                // Filter out participants with valid reviews
                const reviewedParticipants = bounty.participants.filter(
                    p => p.submission &&
                        p.submission.submittedAt &&
                        p.submission.review &&
                        typeof p.submission.review.totalScore === 'number' &&
                        p.submission.review.totalScore >= 0
                );

                // Sort participants by score (highest first)
                const rankedParticipants = reviewedParticipants.sort(
                    (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
                );

                // Format data for response
                responseData.reviewedParticipants = reviewedParticipants.length;
                responseData.rankings = rankedParticipants.map((participant, index) => ({
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

                // Better filtering for unreviewed participants
                const unreviewedParticipants = bounty.participants
                    .filter(p => p.submission &&
                        p.submission.submittedAt &&
                        (!p.submission.review ||
                            typeof p.submission.review.totalScore !== 'number' ||
                            p.submission.review.totalScore < 0))
                    .map(p => ({
                        hunter: {
                            id: p.hunter._id,
                            username: p.hunter.username,
                            name: p.hunter.name
                        },
                        submittedAt: p.submission.submittedAt,
                        reviewed: false
                    }));
                responseData.unreviewedSubmissions = unreviewedParticipants;

                // Better filtering for non-submitting participants
                const notSubmittedParticipants = bounty.participants
                    .filter(p => !p.submission || !p.submission.submittedAt)
                    .map(p => ({
                        hunter: {
                            id: p.hunter._id,
                            username: p.hunter.username,
                            name: p.hunter.name
                        },
                        joined: true,
                        submitted: false
                    }));
                responseData.notSubmitted = notSubmittedParticipants;
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Bounty rankings retrieved successfully',
                data: responseData
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

    // Save bounty as draft
    async saveBountyDraft(req, res) {
        try {
            const lordId = req.lord.id;
            const bountyData = req.body;

            // Set status to draft explicitly
            bountyData.status = 'draft';
            bountyData.createdBy = lordId;

            // If bountyId is provided, update existing draft
            if (bountyData._id) {
                const existingBounty = await Bounty.findOne({
                    _id: bountyData._id,
                    createdBy: lordId,
                    status: 'draft'
                });

                if (!existingBounty) {
                    return res.status(404).json({
                        status: 404,
                        success: false,
                        message: 'Draft bounty not found or cannot be edited'
                    });
                }

                // Update existing draft
                const updatedDraft = await Bounty.findByIdAndUpdate(
                    bountyData._id,
                    bountyData,
                    { new: true }
                );

                return res.status(200).json({
                    status: 200,
                    success: true,
                    message: 'Draft updated successfully',
                    data: updatedDraft
                });
            }

            // Create new draft
            const newDraft = await Bounty.create(bountyData);

            // Add to lord's bounties array
            await Lord.findByIdAndUpdate(
                lordId,
                { $push: { bounties: newDraft._id } }
            );

            return res.status(201).json({
                status: 201,
                success: true,
                message: 'Draft saved successfully',
                data: newDraft
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error saving draft',
                error: error.message
            });
        }
    },

    // Get all draft bounties
    async getDraftBounties(req, res) {
        try {
            const lordId = req.lord.id;

            const drafts = await Bounty.find({
                createdBy: lordId,
                status: 'draft'
            }).sort({ updatedAt: -1 });

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft bounties retrieved successfully',
                data: {
                    count: drafts.length,
                    drafts
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving drafts',
                error: error.message
            });
        }
    },

    // Get a specific draft
    async getDraftBounty(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft retrieved successfully',
                data: draft
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving draft',
                error: error.message
            });
        }
    },

    // Delete a draft
    async deleteDraftBounty(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            await Bounty.findByIdAndDelete(draftId);

            // Remove from lord's bounties array
            await Lord.findByIdAndUpdate(
                lordId,
                { $pull: { bounties: draftId } }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Draft deleted successfully'
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error deleting draft',
                error: error.message
            });
        }
    },

    // Publish a draft (change status from draft to active)
    async publishDraft(req, res) {
        try {
            const { draftId } = req.params;
            const lordId = req.lord.id;

            const draft = await Bounty.findOne({
                _id: draftId,
                createdBy: lordId,
                status: 'draft'
            });

            if (!draft) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Draft not found'
                });
            }

            // Validate required fields before publishing
            const requiredFields = [
                'title', 'context', 'startTime', 'endTime', 'resultTime',
                'doubtSessionTime', 'doubtSessionDate', 'doubtSessionLink',
                'rewardPrize', 'maxHunters'
            ];

            const missingFields = requiredFields.filter(field => !draft[field]);

            if (missingFields.length > 0) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Cannot publish incomplete draft',
                    missingFields
                });
            }

            // Set status based on timing
            const currentTime = new Date();
            const startTime = new Date(draft.startTime);

            const status = currentTime >= startTime ? 'active' : 'draft';

            // Update status
            const publishedBounty = await Bounty.findByIdAndUpdate(
                draftId,
                { status },
                { new: true }
            );

            return res.status(200).json({
                status: 200,
                success: true,
                message: status === 'active' ?
                    'Bounty published and active' :
                    'Bounty scheduled for future activation',
                data: publishedBounty
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error publishing draft',
                error: error.message
            });
        }
    },

    // Shortlist a hunter submission
    async shortlistSubmission(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;

            // Find the bounty and verify ownership
            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Check if hunter has submitted work
            const participant = bounty.participants.find(
                p => p.hunter.toString() === hunterId && p.submission
            );

            if (!participant) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Hunter submission not found for this bounty'
                });
            }

            // Check if hunter is already shortlisted
            if (bounty.shortlistedHunters.includes(hunterId)) {
                return res.status(400).json({
                    status: 400,
                    success: false,
                    message: 'Hunter is already shortlisted'
                });
            }

            // Add hunter to shortlisted array
            bounty.shortlistedHunters.push(hunterId);
            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter submission shortlisted successfully',
                data: {
                    shortlistedCount: bounty.shortlistedHunters.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error shortlisting submission',
                error: error.message
            });
        }
    },

    // Remove hunter from shortlist
    async removeFromShortlist(req, res) {
        try {
            const { bountyId, hunterId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Remove hunter from shortlisted array
            bounty.shortlistedHunters = bounty.shortlistedHunters.filter(
                id => id.toString() !== hunterId
            );
            await bounty.save();

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Hunter removed from shortlist successfully',
                data: {
                    shortlistedCount: bounty.shortlistedHunters.length
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error removing hunter from shortlist',
                error: error.message
            });
        }
    },

    // Get shortlisted submissions
    async getShortlistedSubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate({
                path: 'shortlistedHunters',
                select: 'username name'
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Get details of shortlisted submissions
            const shortlistedSubmissions = [];
            for (const hunter of bounty.shortlistedHunters) {
                const participant = bounty.participants.find(
                    p => p.hunter.toString() === hunter._id.toString()
                );

                if (participant && participant.submission) {
                    const reviewed = bounty.evaluatedHunters.includes(hunter._id);
                    let rank = null;

                    if (reviewed) {
                        // Find rank if reviewed
                        const reviewedParticipants = bounty.participants.filter(
                            p => p.submission && p.submission.review
                        ).sort(
                            (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
                        );

                        const rankIndex = reviewedParticipants.findIndex(
                            p => p.hunter.toString() === hunter._id.toString()
                        );

                        if (rankIndex !== -1) {
                            rank = rankIndex + 1;
                        }
                    }

                    shortlistedSubmissions.push({
                        hunterId: hunter._id,
                        username: hunter.username,
                        name: hunter.name,
                        files: participant.submission.files,
                        submittedAt: participant.submission.submittedAt,
                        reviewed,
                        rank,
                        score: reviewed ? participant.submission.review.totalScore : null
                    });
                }
            }
            console.log(shortlistedSubmissions)
            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Shortlisted submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    shortlistedCount: shortlistedSubmissions.length,
                    shortlistedSubmissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving shortlisted submissions',
                error: error.message
            });
        }
    },

    // Get evaluated submissions
    async getEvaluatedSubmissions(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            }).populate({
                path: 'evaluatedHunters',
                select: 'username name'
            }).populate({
                path: 'participants.hunter',
                select: 'username name'
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Get only participants that have been properly evaluated
            const validEvaluatedParticipants = bounty.participants.filter(p =>
                p.submission &&
                p.submission.review &&
                p.submission.review.totalScore !== undefined &&
                bounty.evaluatedHunters.some(h => h._id.toString() === p.hunter._id.toString())
            );

            // Sort by score
            const sortedEvaluatedParticipants = validEvaluatedParticipants.sort(
                (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
            );

            // Format evaluated submissions
            const evaluatedSubmissions = sortedEvaluatedParticipants.map((participant, index) => ({
                hunterId: participant.hunter._id,
                username: participant.hunter.username,
                name: participant.hunter.name,
                files: participant.submission.files,
                rank: index + 1,
                score: participant.submission.review.totalScore,
                shortlisted: bounty.shortlistedHunters.some(
                    id => id.toString() === participant.hunter._id.toString()
                )
            }));

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Evaluated submissions retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    evaluatedCount: evaluatedSubmissions.length,
                    evaluatedSubmissions
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving evaluated submissions',
                error: error.message
            });
        }
    },

    // Get submissions to be evaluated
    async getSubmissionsToEvaluate(req, res) {
        try {
            const { bountyId } = req.params;
            const lordId = req.lord.id;

            const bounty = await Bounty.findOne({
                _id: bountyId,
                createdBy: lordId
            });

            if (!bounty) {
                return res.status(404).json({
                    status: 404,
                    success: false,
                    message: 'Bounty not found or you do not have permission'
                });
            }

            // Find participants with submissions that haven't been evaluated
            const toEvaluateParticipants = bounty.participants.filter(
                p => p.submission &&
                    !bounty.evaluatedHunters.includes(p.hunter)
            );

            // Populate hunter details
            const submissionsToEvaluate = [];
            for (const participant of toEvaluateParticipants) {
                const hunter = await Hunter.findById(participant.hunter)
                    .select('username name');

                if (hunter) {
                    submissionsToEvaluate.push({
                        hunterId: hunter._id,
                        username: hunter.username,
                        name: hunter.name,
                        files: participant.submission.files,
                        submittedAt: participant.submission.submittedAt,
                        shortlisted: bounty.shortlistedHunters.includes(hunter._id)
                    });
                }
            }

            return res.status(200).json({
                status: 200,
                success: true,
                message: 'Submissions to evaluate retrieved successfully',
                data: {
                    bountyTitle: bounty.title,
                    toEvaluateCount: submissionsToEvaluate.length,
                    submissionsToEvaluate
                }
            });
        } catch (error) {
            return res.status(500).json({
                status: 500,
                success: false,
                message: 'Error retrieving submissions to evaluate',
                error: error.message
            });
        }
    },


async postBountyResult(req, res) {
    try {
        const { bountyId } = req.params;
        const lordId = req.lord.id;

        const bounty = await Bounty.findOne({
            _id: bountyId,
            createdBy: lordId
        }).populate('participants.hunter');

        // Check if result date has reached
        const currentDate = new Date();
        if (currentDate < bounty.resultTime) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'Cannot post result before result date'
            });
        }


        // Get reviewed submissions with stricter validation
        const reviewedParticipants = bounty.participants.filter(
            p => p.submission &&
                p.submission.submittedAt &&
                p.submission.review &&
                typeof p.submission.review.totalScore === 'number' &&
                p.submission.review.totalScore >= 0
        );



        if (reviewedParticipants.length === 0) {
            return res.status(400).json({
                status: 400,
                success: false,
                message: 'No submissions have been reviewed yet'
            });
        }

        // Identify hunters who registered but did not submit
        const nonSubmittingParticipants = bounty.participants.filter(
            p => !p.submission || !p.submission.submittedAt
        );

        // Apply fouls to non-submitting participants
        for (const participant of nonSubmittingParticipants) {
            // Find the appropriate foul type
            const noSubmissionFoul = await Foul.findOne({ name: "Registers but does not submit" });

            if (noSubmissionFoul) {
                // Find if this hunter has previous occurrences of this foul
                const previousOccurrences = await FoulRecord.find({
                    hunter: participant.hunter._id,
                    foul: noSubmissionFoul._id
                });

                // Determine if this is a strike (second or later occurrence)
                const isStrike = previousOccurrences.length > 0;
                const occurrenceNumber = previousOccurrences.length + 1;

                // Calculate XP penalty (625 XP)
                const xpPenalty = 625;

                // Create foul record
                await FoulRecord.create({
                    hunter: participant.hunter._id,
                    foul: noSubmissionFoul._id,
                    reason: `Registered for bounty "${bounty.title}" but did not submit work`,
                    evidence: `Bounty ID: ${bountyId}`,
                    xpPenalty,
                    occurrenceNumber,
                    isStrike,
                    appliedBy: lordId, // Or you could use an admin ID if available
                    relatedBounty: bountyId
                });

                // Update hunter's XP and strike count if applicable
                if (isStrike) {
                    await Hunter.findByIdAndUpdate(
                        participant.hunter._id,
                        {
                            $inc: {
                                xp: -xpPenalty,
                                'strikes.count': 1
                            }
                        }
                    );

                    // Get updated hunter data to check tier after XP deduction
                    const updatedHunter = await Hunter.findById(participant.hunter._id);
                    
                    // Check and update level tier if needed
                    updatedHunter.updateLevel();
                    await updatedHunter.save();

                    // Check if this pushes hunter to 3 strikes (suspension threshold)
                    if (updatedHunter.strikes.count >= 3) {
                        // Calculate suspension period (14 days from now)
                        const suspensionStartDate = new Date();
                        const suspensionEndDate = new Date();
                        suspensionEndDate.setDate(suspensionEndDate.getDate() + 14);

                        // Update hunter with suspension
                        await Hunter.findByIdAndUpdate(
                            participant.hunter._id,
                            {
                                $set: {
                                    'strikes.isCurrentlySuspended': true,
                                    'strikes.suspensionEndDate': suspensionEndDate
                                },
                                $push: {
                                    'strikes.suspensionHistory': {
                                        startDate: suspensionStartDate,
                                        endDate: suspensionEndDate,
                                        reason: `Accumulated 3 strikes. Latest foul: No submission for bounty "${bounty.title}"`
                                    }
                                }
                            }
                        );

                        // Create notification for suspension
                        await notificationController.createNotification({
                            hunterId: participant.hunter._id,
                            title: 'Account Suspended',
                            message: `Your account has been suspended for 14 days due to accumulating 3 strikes. You will be able to return on ${suspensionEndDate.toLocaleDateString()}.`,
                            type: 'system'
                        });
                    }
                } else {
                    // Just deduct XP for first occurrence
                    const updatedHunter = await Hunter.findByIdAndUpdate(
                        participant.hunter._id,
                        { $inc: { xp: -xpPenalty } },
                        { new: true } // Return the updated document
                    );
                    
                    // Check and update level tier if needed
                    updatedHunter.updateLevel();
                    await updatedHunter.save();
                }

                // Create notification for hunter
                await notificationController.createNotification({
                    hunterId: participant.hunter._id,
                    title: 'Foul Received',
                    message: `You have received a foul for registering but not submitting work for bounty "${bounty.title}". This has resulted in a penalty of ${xpPenalty} XP.${isStrike ? ' This foul counts as a strike.' : ''}`,
                    type: 'system'
                });
            }
        }

        // Sort by score
        const sortedParticipants = reviewedParticipants.sort(
            (a, b) => b.submission.review.totalScore - a.submission.review.totalScore
        );

        // Check if this is a non-profit bounty (reward prize is zero)
        if (bounty.rewardPrize === 0) {
            // Update nonProfitBounties count for all submitters
            for (const participant of reviewedParticipants) {
                await Hunter.findByIdAndUpdate(
                    participant.hunter._id,
                    {
                        $inc: { 'achievements.nonProfitBounties.count': 1 },
                        $push: { 'achievements.nonProfitBounties.bountyIds': bountyId }
                    }
                );

                // Create a notification for the hunter
                await notificationController.createNotification({
                    hunterId: participant.hunter._id,
                    title: 'Non-Profit Bounty Completed',
                    message: `You've completed a non-profit bounty: "${bounty.title}". Thank you for your contribution!`,
                    type: 'achievement',
                    relatedItem: bountyId,
                    itemModel: 'Bounty'
                });
            }

            console.log(`Updated nonProfitBounties count for ${reviewedParticipants.length} hunters`);
        }

        // Update bounty status to completed
        bounty.status = 'completed';

        // Now update each hunter's profile based on their performance
        for (let i = 0; i < sortedParticipants.length; i++) {
            const participant = sortedParticipants[i];
            const hunter = participant.hunter;
            const rank = i + 1;

            // Calculate XP earned based on review scores
            const scores = [
                participant.submission.review.adherenceToBrief,
                participant.submission.review.conceptualThinking,
                participant.submission.review.technicalExecution,
                participant.submission.review.originalityCreativity,
                participant.submission.review.documentation
            ];

            // Calculate XP using XP service
            const xpService = require('../services/xpService');
            const xpEarned = xpService.calculateReviewXP(scores);

            // Update hunter's XP
            const updatedHunter = await Hunter.findByIdAndUpdate(
                hunter._id,
                { $inc: { xp: xpEarned } },
                { new: true } // Return the updated document
            );
            
            // Check and update level tier if needed
            updatedHunter.updateLevel();
            await updatedHunter.save();
            
            // Store original tier and rank for notification
            const originalTier = hunter.level.tier;
            const originalRank = hunter.level.rank;
            const newTier = updatedHunter.level.tier;
            const newRank = updatedHunter.level.rank;
            
            // Send notification if tier or rank changed
            if (originalTier !== newTier || originalRank !== newRank) {
                await notificationController.createNotification({
                    hunterId: hunter._id,
                    title: 'Level Up!',
                    message: `Congratulations! You've leveled up to ${newTier} ${newRank} after completing the bounty "${bounty.title}".`,
                    type: 'achievement'
                });
            }

            // Update hunter's achievements based on performance
            if (rank === 1) {
                // Winner
                await Hunter.findByIdAndUpdate(
                    hunter._id,
                    {
                        $inc: { 'achievements.bountiesWon.count': 1 },
                        $push: { 'achievements.bountiesWon.bountyIds': bountyId }
                    }
                );

                // Give a resetFoul pass to the winner
                await Hunter.findByIdAndUpdate(
                    hunter._id,
                    { $inc: { 'passes.resetFoul.count': 1 } }
                );

                // Increment consecutive wins for booster pass
                const updatedHunterWins = await Hunter.findByIdAndUpdate(
                    hunter._id,
                    { $inc: { 'passes.consecutiveWins': 1 } },
                    { new: true }
                );

                // If they reached 2 consecutive wins, give a booster pass
                if (updatedHunterWins.passes.consecutiveWins >= 2) {
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        {
                            $inc: { 'passes.booster.count': 1 },
                            $set: { 'passes.consecutiveWins': 0 } // Reset counter
                        }
                    );
                }
            } else {
                // Not winner, reset consecutive wins
                await Hunter.findByIdAndUpdate(
                    hunter._id,
                    { $set: { 'passes.consecutiveWins': 0 } }
                );

                // If last place
                if (rank === sortedParticipants.length) {
                    await Hunter.findByIdAndUpdate(
                        hunter._id,
                        {
                            $inc: { 'achievements.lastPlaceFinishes.count': 1 },
                            $push: { 'achievements.lastPlaceFinishes.bountyIds': bountyId }
                        }
                    );
                }
            }

            // Calculate and update performance score
            if (bounty.participants.length > 1) {  // Only if competitive
                const performanceCalculator = require('../utils/performanceCalculator');
                await performanceCalculator.calculatePerformanceScore(
                    hunter._id.toString(),
                    bountyId,
                    rank,
                    xpEarned
                );
            }

            // Create wallet transaction for winner
            if (rank === 1 && bounty.rewardPrize > 0) {
                // Add the prize money to the winner's wallet
                // Update total earnings separately
                await Hunter.findByIdAndUpdate(
                    hunter._id,
                    { $inc: { totalEarnings: bounty.rewardPrize } }
                );
                console.log(`Updated totalEarnings for hunter ${hunter._id} with amount ${bounty.rewardPrize}`);

                await transactionService.createTransaction({
                    hunterId: hunter._id,
                    amount: bounty.rewardPrize,
                    type: 'credit',
                    category: 'bounty',
                    description: `Winner reward for bounty: ${bounty.title}`,
                    reference: bountyId,
                    referenceModel: 'Bounty',
                    initiatedBy: {
                        id: lordId,
                        role: 'Lord'
                    },
                    metaData: {
                        rank: 1,
                        totalParticipants: sortedParticipants.length
                    }
                });

                // Add a notification about the wallet credit
                await notificationController.createNotification({
                    hunterId: hunter._id,
                    title: 'Reward Received',
                    message: `You've received ${bounty.rewardPrize} for winning the bounty "${bounty.title}"`,
                    type: 'bounty',
                    relatedItem: bountyId,
                    itemModel: 'Bounty'
                });
            }

            // Update review status to published
            participant.submission.review.reviewStatus = 'published';

            // Create notification for hunter
            await notificationController.createNotification({
                hunterId: hunter._id,
                title: 'Bounty Results Published',
                message: `Results for "${bounty.title}" are now available. You ranked #${rank} out of ${sortedParticipants.length} hunters.`,
                type: 'bounty',
                relatedItem: bountyId,
                itemModel: 'Bounty'
            });
        }

        // Save bounty with updated review statuses
        await bounty.save();

        // Award passes (assuming this also exists in your system)
        await passController.awardPassesForBounty(bountyId);

        // Create the result rankings data
        const resultRankings = sortedParticipants.map((participant, index) => {
            const rank = index + 1;
            const hunter = participant.hunter._id;
            const score = participant.submission.review.totalScore;

            // Get scores
            const scores = {
                adherenceToBrief: participant.submission.review.adherenceToBrief,
                conceptualThinking: participant.submission.review.conceptualThinking,
                technicalExecution: participant.submission.review.technicalExecution,
                originalityCreativity: participant.submission.review.originalityCreativity,
                documentation: participant.submission.review.documentation
            };

            // Calculate XP
            const xpService = require('../services/xpService');
            const xpEarned = xpService.calculateReviewXP([
                scores.adherenceToBrief,
                scores.conceptualThinking,
                scores.technicalExecution,
                scores.originalityCreativity,
                scores.documentation
            ]);

            // Calculate reward (only for rank 1)
            const rewardEarned = rank === 1 ? bounty.rewardPrize : 0;

            return {
                hunter,
                rank,
                score,
                scores,
                xpEarned,
                rewardEarned
            };
        });

        // Track non-submitters
        const nonSubmitters = nonSubmittingParticipants.map(participant => {
            return {
                hunter: participant.hunter._id,
                foulApplied: true,
            };
        });

        // Create the bounty result
        const bountyResult = await BountyResult.create({
            bounty: bountyId,
            postedBy: lordId,
            rankings: resultRankings,
            nonSubmitters
        });

        // Update the bounty with the result ID
        bounty.resultId = bountyResult._id;
        await bounty.save();

        return res.status(200).json({
            status: 200,
            success: true,
            message: 'Bounty result posted successfully',
            data: {
                bountyTitle: bounty.title,
                totalParticipants: bounty.participants.length,
                reviewedParticipants: reviewedParticipants.length,
                nonSubmittingParticipants: nonSubmittingParticipants.length,
                foulsApplied: nonSubmittingParticipants.length,
                rankings: sortedParticipants.map((p, index) => ({
                    rank: index + 1,
                    hunter: p.hunter.username,
                    score: p.submission.review.totalScore
                }))
            }
        });

    } catch (error) {
        return res.status(500).json({
            status: 500,
            success: false,
            message: 'Error posting result',
            error: error.message
        });
    }
}
}

module.exports = bountyController;